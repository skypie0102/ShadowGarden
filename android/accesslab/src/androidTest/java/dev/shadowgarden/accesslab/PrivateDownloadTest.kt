package dev.shadowgarden.accesslab

import android.net.Uri
import android.net.http.SslError
import android.os.SystemClock
import android.system.Os
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.ZipFile
import javax.net.ssl.HttpsURLConnection
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Test-only download and offline rendering experiment, not an app download implementation. */
@RunWith(AndroidJUnit4::class)
class PrivateDownloadTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val origin = "https://localhost:18443"
    private val marker = "A generated book remains available offline."

    @Test
    fun protectedFixtureIsStoredPrivatelyAndDisplayedWithoutNetworkAfterRecreation() {
        assumeTrue("Real-handler fixture is not enabled", InstrumentationRegistry.getArguments().getString("accessBackend") == "true")
        clearCookies()
        val directory = File(instrumentation.targetContext.filesDir, "private-download-test")
        directory.deleteRecursively()
        assertTrue(directory.mkdirs())
        val book = File(directory, "fixture.epub")
        val scenario = ActivityScenario.launch(AccessLabActivity::class.java)
        val view = AtomicReference<WebView>()
        val sslErrors = AtomicInteger()
        val blocked = AtomicInteger()
        try {
            scenario.onActivity { activity ->
                val web = WebView(activity)
                web.settings.javaScriptEnabled = true
                web.settings.allowFileAccess = false
                web.settings.allowContentAccess = false
                web.webViewClient = object : WebViewClient() {
                    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                        sslErrors.incrementAndGet()
                        handler.cancel()
                    }
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = !local(request.url)
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                        if (local(request.url)) return null
                        blocked.incrementAndGet()
                        return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), "Blocked".byteInputStream())
                    }
                }
                activity.setContentView(web)
                view.set(web)
                web.loadUrl("$origin/download-fixture")
            }
            val result = awaitObject(view.get(), "window.downloadResult")
            assertEquals(200, result.getInt("human"))
            assertEquals(200, result.getInt("ticket"))
            val ticketUrl = URL(URL(origin), result.getString("url"))
            val cookies = CookieManager.getInstance().getCookie(ticketUrl.toString()) ?: ""
            assertTrue("Expected the HttpOnly book cookie in the native cookie jar", cookies.contains("__Secure-sg_book_"))

            // A rejected response and an interrupted copy must not replace an existing file.
            book.writeText("previous fixture")
            val broken = Uri.parse(ticketUrl.toString()).buildUpon().clearQuery().appendQueryParameter("sig", "tampered").build().toString()
            assertTrue("Invalid ticket must be rejected", runCatching { download(broken, cookies, book, 2_000_000) }.isFailure)
            assertEquals("previous fixture", book.readText())
            download(ticketUrl.toString(), cookies, book, 2_000_000)
            val saved = book.readBytes()
            assertTrue(saved.size > 100)
            assertTrue(book.canonicalPath.startsWith(instrumentation.targetContext.filesDir.canonicalPath + File.separator))
            assertTrue("Limited copy must fail", runCatching { download(ticketUrl.toString(), cookies, book, 8) }.isFailure)
            assertArrayEquals("A failed replacement must preserve the previous file", saved, book.readBytes())
            assertEquals("Temporary files must be cleaned up", listOf("fixture.epub"), directory.list()?.sorted())
            assertEquals(0, sslErrors.get())
            assertEquals(0, blocked.get())

            scenario.onActivity { activity ->
                val web = view.get()
                (web.parent as? ViewGroup)?.removeView(web)
                web.destroy()
                view.set(null)
                activity.setContentView(android.view.View(activity))
            }
            clearCookies()
            val unsigned = Uri.parse(ticketUrl.toString()).buildUpon().clearQuery().build().toString()
            assertTrue("Book access without the ticket or cookie must fail", runCatching { download(unsigned, "", book, 2_000_000) }.isFailure)
            assertArrayEquals(saved, book.readBytes())
            scenario.recreate()

            // This small fixture's chapter is rendered directly in an offline WebView;
            // it is not an EPUB reader or an airplane-mode/device acceptance test.
            val chapter = chapterFromFixture(book)
            val finished = CountDownLatch(1)
            scenario.onActivity { activity ->
                val web = WebView(activity)
                web.settings.javaScriptEnabled = true
                web.settings.allowFileAccess = false
                web.settings.allowContentAccess = false
                web.settings.blockNetworkLoads = true
                web.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView, url: String) { finished.countDown() }
                }
                activity.setContentView(web)
                view.set(web)
                web.loadDataWithBaseURL("https://offline.invalid/", chapter, "text/html", "UTF-8", null)
            }
            assertTrue("Offline chapter did not load", finished.await(15, TimeUnit.SECONDS))
            scenario.onActivity { assertTrue("Offline viewer must block network loads", view.get().settings.blockNetworkLoads) }
            assertEquals(marker, evaluateString(view.get(), "document.getElementById('offline-marker').textContent"))
        } finally {
            view.get()?.let { web -> scenario.onActivity {
                (web.parent as? ViewGroup)?.removeView(web)
                web.destroy()
            } }
            scenario.close()
            clearCookies()
            directory.deleteRecursively()
        }
    }

    private fun local(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "localhost" && uri.port == 18443

    private fun download(url: String, cookie: String, destination: File, maxBytes: Int) {
        val target = URL(url)
        require(target.protocol == "https" && target.host == "localhost" && target.port == 18443 && target.userInfo == null)
        require(target.path == "/media/shadow-garden/books/generated-download.epub")
        val temporary = File.createTempFile("incoming-", ".part", destination.parentFile)
        try {
            val connection = target.openConnection() as HttpsURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.useCaches = false
            if (cookie.isNotEmpty()) connection.setRequestProperty("Cookie", cookie)
            try {
                if (connection.responseCode != 200) throw IOException("Download rejected: ${connection.responseCode}")
                if (connection.contentType?.substringBefore(';') != "application/epub+zip") throw IOException("Unexpected media type")
                connection.inputStream.use { input ->
                    FileOutputStream(temporary).use { output ->
                        val buffer = ByteArray(8192)
                        var total = 0
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            total += count
                            if (total > maxBytes) throw IOException("Fixture size limit exceeded")
                            output.write(buffer, 0, count)
                        }
                        output.fd.sync()
                    }
                }
                chapterFromFixture(temporary)
                Os.rename(temporary.absolutePath, destination.absolutePath)
            } finally {
                connection.disconnect()
            }
        } finally {
            temporary.delete()
        }
    }

    private fun chapterFromFixture(file: File): String = ZipFile(file).use { zip ->
        val mimetype = zip.getEntry("mimetype") ?: throw IOException("Missing EPUB mimetype")
        val actual = zip.getInputStream(mimetype).bufferedReader(Charsets.UTF_8).use { it.readText() }
        if (actual != "application/epub+zip" || zip.getEntry("META-INF/container.xml") == null) throw IOException("Invalid fixture EPUB")
        val chapter = zip.getEntry("chapter.xhtml") ?: throw IOException("Missing fixture chapter")
        if (chapter.size > 64_000) throw IOException("Fixture chapter is too large")
        zip.getInputStream(chapter).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }

    private fun clearCookies() {
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { CookieManager.getInstance().removeAllCookies { latch.countDown() } }
        assertTrue("Cookie cleanup timed out", latch.await(10, TimeUnit.SECONDS))
        CookieManager.getInstance().flush()
    }

    private fun evaluateString(web: WebView, expression: String): String {
        val response = AtomicReference<String>()
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { web.evaluateJavascript(expression) { response.set(it); latch.countDown() } }
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
        return JSONTokener(response.get()).nextValue() as String
    }

    private fun awaitObject(web: WebView, expression: String): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        while (SystemClock.elapsedRealtime() < deadline) {
            val state = JSONObject(evaluateString(web, "JSON.stringify($expression || {})"))
            if (state.optString("state") == "ready") return state
            if (state.optString("state") == "error") throw AssertionError("Fixture failed: $state")
            SystemClock.sleep(100)
        }
        throw AssertionError("Download fixture did not complete")
    }
}

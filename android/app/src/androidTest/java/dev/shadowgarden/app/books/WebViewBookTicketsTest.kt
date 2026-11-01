package dev.shadowgarden.app.books

import android.annotation.SuppressLint
import android.os.SystemClock
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.EpubFixture
import dev.shadowgarden.app.MainActivity
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** An intercepted synthetic HTTPS page; no live site or real verification. */
@RunWith(AndroidJUnit4::class)
class WebViewBookTicketsTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val id = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val expectedUrl = "/media/shadow-garden/books/generated.epub?sig=fixture.token"

    @Test fun ticketFromSiteApiFeedsTransferAndPrivateStore() = withWebView { view ->
        val ticket = runBlocking { requester(view).request(id) }
        assertEquals(id, ticket.bookId)
        assertEquals(expectedUrl, ticket.relativeUrl)
        assertFalse(ticket.toString().contains("fixture.token"))
        val directory = File(context.noBackupFilesDir, "web-ticket-test-${UUID.randomUUID()}")
        try {
            directory.mkdirs()
            val fixture = File(directory, "generated.epub")
            EpubFixture.create(fixture, true)
            val bytes = fixture.readBytes()
            val http = OkHttpClient.Builder().addInterceptor { chain ->
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("fixture")
                    .header("Content-Type", "application/epub+zip").body(bytes.toResponseBody()).build()
            }.build()
            val store = PrivateBookStore(directory)
            val edition = runBlocking { SignedBookTransfer(store, http, { 1_000 }).download(id, ticket) }
            store.open(id)!!.use { assertEquals(edition, it.edition); assertArrayEquals(bytes, it.input.readBytes()) }
        } finally { directory.deleteRecursively() }
    }

    @Test fun invalidOrFailedWebsiteResponsesAreRejectedWithoutLeakingTicket() = withWebView { view ->
        for (mode in listOf("badId", "badPath", "expired", "badExpiry", "failure")) {
            evaluate(view, "window.fixtureMode='$mode'")
            try { runBlocking { requester(view).request(id) }; throw AssertionError("Expected failure for $mode") }
            catch (error: TicketRequestException) {
                assertEquals(if (mode == "failure") TicketRequestFailure.ACCESS_FAILED else TicketRequestFailure.INVALID_RESPONSE, error.failure)
                assertFalse(error.toString().contains("fixture.token"))
            }
        }
    }

    @Test fun timeoutAndCancellationCleanUpPendingRequest() = withWebView { view ->
        evaluate(view, "window.fixtureMode='pending'")
        try { runBlocking { WebViewBookTickets(view, { 1_000 }, 350, 30).request(id) }; throw AssertionError("Expected timeout") }
        catch (error: TicketRequestException) { assertEquals(TicketRequestFailure.TIMEOUT, error.failure) }
        assertEquals("0", evaluate(view, "String(Object.keys(window.__sgAndroidTicketsV1 || {}).length)"))
        runBlocking {
            val request = async(Dispatchers.Default) { WebViewBookTickets(view, { 1_000 }, 10_000, 30).request(id) }
            assertTrue(withContext(Dispatchers.IO) { awaitValue(view, "String(window.fixtureCalls)", "2") })
            request.cancelAndJoin()
        }
        assertEquals("0", evaluate(view, "String(Object.keys(window.__sgAndroidTicketsV1 || {}).length)"))
    }

    @Test fun aDifferentPageCannotRequestTickets() = withWebView("https://untrusted.invalid/series.html") { view ->
        try { runBlocking { requester(view).request(id) }; throw AssertionError("Expected wrong-page failure") }
        catch (error: TicketRequestException) { assertEquals(TicketRequestFailure.WRONG_PAGE, error.failure) }
        assertEquals("0", evaluate(view, "String(window.fixtureCalls)"))
    }

    private fun requester(view: WebView) = WebViewBookTickets(view, { 1_000 }, 10_000, 30)

    @SuppressLint("SetJavaScriptEnabled")
    private fun withWebView(base: String = "https://shadowgarden-bon.pages.dev/series.html?scope=main", block: (WebView) -> Unit) {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        val view = AtomicReference<WebView>()
        val loaded = CountDownLatch(1)
        try {
            scenario.onActivity { activity ->
                val web = WebView(activity)
                web.settings.javaScriptEnabled = true
                web.settings.allowFileAccess = false
                web.settings.allowContentAccess = false
                web.webViewClient = object : WebViewClient() {
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse =
                        if (request.isForMainFrame && request.url.toString() == base)
                            WebResourceResponse("text/html", "utf-8", html.byteInputStream())
                        else WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArray(0).inputStream())
                    override fun onPageFinished(view: WebView, url: String) { if (url == base) loaded.countDown() }
                }
                activity.setContentView(web)
                view.set(web)
                web.loadUrl(base)
            }
            assertTrue("Synthetic page did not load", loaded.await(20, TimeUnit.SECONDS))
            if (base.startsWith("https://shadowgarden-bon.pages.dev")) scenario.onActivity {
                val web = view.get()
                val uri = android.net.Uri.parse(web.url)
                assertEquals("Synthetic WebView URL", base, web.url)
                assertEquals("Synthetic page path", "/series.html", uri.encodedPath)
                assertEquals("Synthetic page host", "shadowgarden-bon.pages.dev", uri.host)
                assertTrue("JavaScript must be enabled", web.settings.javaScriptEnabled)
                assertFalse("File access must be disabled", web.settings.allowFileAccess)
                assertFalse("Content access must be disabled", web.settings.allowContentAccess)
                assertTrue("Synthetic URL userinfo: ${uri.userInfo}", uri.userInfo == null)
                assertTrue("Synthetic URL port: ${uri.port}", uri.port == -1 || uri.port == 443)
                assertTrue("Synthetic URL fragment: ${uri.fragment}", uri.fragment == null)
            }
            block(view.get())
        } finally {
            view.get()?.let { web -> scenario.onActivity { (web.parent as? ViewGroup)?.removeView(web); web.destroy() } }
            scenario.close()
        }
    }

    private fun evaluate(view: WebView, script: String): String {
        val result = AtomicReference<String>()
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { view.evaluateJavascript(script) { result.set(it); latch.countDown() } }
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
        val value = result.get()
        return if (value.startsWith('"') && value.endsWith('"')) org.json.JSONTokener(value).nextValue() as String else value
    }

    private fun awaitValue(view: WebView, script: String, wanted: String): Boolean {
        val deadline = SystemClock.elapsedRealtime() + 5_000
        while (SystemClock.elapsedRealtime() < deadline) {
            if (evaluate(view, script) == wanted) return true
            SystemClock.sleep(50)
        }
        return false
    }

    private val html = """
        <!doctype html><html><body><script>
        window.fixtureMode='ok'; window.fixtureCalls=0;
        window.ShadowGardenBookAccess={resolve:function(id,options){
          window.fixtureCalls++;
          if (!options || options.force!==true || window.fixtureMode==='failure') return Promise.reject(new Error('secret ignored'));
          if (window.fixtureMode==='pending') return new Promise(()=>{});
          const result={bookId:id,url:'/media/shadow-garden/books/generated.epub?sig=fixture.token',expiresAt:2000};
          if (window.fixtureMode==='badId') result.bookId='bk_0123456789abcdefghijkl';
          if (window.fixtureMode==='badPath') result.url='https://evil.invalid/book.epub?sig=fixture.token';
          if (window.fixtureMode==='expired') result.expiresAt=1000;
          if (window.fixtureMode==='badExpiry') result.expiresAt='2000';
          return Promise.resolve(result);
        }};
        </script></body></html>
    """.trimIndent()
}

package dev.shadowgarden.accesslab

import android.content.pm.PackageManager
import android.net.Uri
import android.net.http.SslError
import android.os.SystemClock
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
import java.net.InetAddress
import java.security.KeyStore
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Local HTTPS platform experiment with a fake service, not production verification. */
@RunWith(AndroidJUnit4::class)
class AccessWebViewTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val target = instrumentation.targetContext
    private val assets = instrumentation.context.assets

    @Test
    fun sameOriginCookiesTicketsAndKeeperSessionWorkOverLocalHttps() {
        @Suppress("DEPRECATION")
        val permissions = target.packageManager.getPackageInfo(target.packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions.orEmpty()
        assertTrue(permissions.contains("android.permission.INTERNET"))
        clearCookies()
        val fixtureHtml = assets.open("access-fixture.html").bufferedReader().use { it.readText() }
        val calls = CopyOnWriteArrayList<String>()
        val sslErrors = AtomicInteger()
        val blocked = CopyOnWriteArrayList<String>()
        val tickets = AtomicInteger()
        val adminActive = java.util.concurrent.atomic.AtomicBoolean(false)
        val server = MockWebServer()
        lateinit var origin: String
        server.useHttps(fixtureSocketFactory(), false)
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.requestUrl?.encodedPath ?: return response(400)
                calls.add("${request.method} $path")
                if (request.method != "GET" && request.getHeader("Origin") != origin) return response(403)
                val cookie = request.getHeader("Cookie").orEmpty()
                fun body(): JSONObject = runCatching { JSONObject(request.body.readUtf8()) }.getOrDefault(JSONObject())
                return when ("${request.method} $path") {
                    "GET /" -> MockResponse().setResponseCode(200)
                        .setHeader("content-type", "text/html; charset=utf-8").setBody(fixtureHtml)
                    "POST /human-access" -> {
                        if (body().optString("token") != "human-fixture") response(403)
                        else response(200).addHeader("set-cookie", "__Host-sg_human=fixture-human; Path=/; HttpOnly; Secure; SameSite=Strict")
                    }
                    "POST /book-access" -> {
                        if (!cookie.contains("__Host-sg_human=fixture-human")) response(428)
                        else if (body().optString("bookId") != "fixture-book") response(400)
                        else {
                            val sig = if (tickets.incrementAndGet() == 1) "expired" else "fresh"
                            response(200, """{"url":"/media/shadow-garden/books/fixture.epub?sig=$sig"}""")
                                .addHeader("set-cookie", "__Secure-sg_book_fixture=fixture-ticket; Path=/media/shadow-garden/books/fixture.epub; HttpOnly; Secure; SameSite=Strict")
                        }
                    }
                    "GET /media/shadow-garden/books/fixture.epub" -> {
                        if (!cookie.contains("__Secure-sg_book_fixture=fixture-ticket") || request.requestUrl?.queryParameter("sig") != "fresh") response(403)
                        else MockResponse().setResponseCode(200).setHeader("content-type", "application/epub+zip").setBody("generated-fixture-bytes")
                    }
                    "GET /admin-access" -> response(200, """{"siteKey":"fixture-site","action":"admin_access"}""")
                    "POST /admin-access" -> {
                        val input = body()
                        if (input.optString("adminToken") != "keeper-fixture" || input.optString("turnstileToken") != "admin-fixture") response(401)
                        else {
                            adminActive.set(true)
                            response(200).addHeader("set-cookie", "__Host-sg_admin=fixture-session; Path=/; HttpOnly; Secure; SameSite=Strict")
                        }
                    }
                    "POST /admin-api/status" -> {
                        val hasSession = cookie.contains("__Host-sg_admin=fixture-session")
                        val hasBearer = request.getHeader("Authorization") == "Bearer keeper-fixture"
                        if (adminActive.get() && hasSession && hasBearer) response(200)
                        else response(401, """{"active":${adminActive.get()},"hasSession":$hasSession,"hasBearer":$hasBearer}""")
                    }
                    "DELETE /admin-access" -> {
                        if (!cookie.contains("__Host-sg_admin=fixture-session")) response(401, """{"hasSession":false}""")
                        else {
                            adminActive.set(false)
                            response(200).addHeader("set-cookie", "__Host-sg_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict")
                        }
                    }
                    else -> response(404)
                }
            }
        }
        server.start(InetAddress.getByName("127.0.0.1"), 0)
        origin = "https://localhost:${server.port}"
        val scenario = ActivityScenario.launch(AccessLabActivity::class.java)
        val view = AtomicReference<WebView>()
        try {
            scenario.onActivity { activity ->
                val webView = WebView(activity)
                webView.settings.javaScriptEnabled = true
                webView.settings.allowFileAccess = false
                webView.settings.allowContentAccess = false
                webView.webViewClient = object : WebViewClient() {
                    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                        sslErrors.incrementAndGet()
                        handler.cancel()
                    }
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = !local(request.url, server.port)
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                        if (local(request.url, server.port)) return null
                        blocked.add(request.url.host.orEmpty())
                        return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), "Blocked".byteInputStream())
                    }
                }
                activity.setContentView(webView)
                view.set(webView)
                webView.loadUrl("$origin/")
            }
            val result = awaitResult(view.get())
            for ((key, expected) in mapOf(
                "firstTicket" to 428, "badHuman" to 403, "goodHuman" to 200,
                "ticket1" to 200, "stale" to 403, "ticket2" to 200, "download" to 200,
                "badKeeper" to 401, "goodKeeper" to 200, "status" to 200,
                "logout" to 200, "afterLogout" to 401
            )) assertEquals("Unexpected $key response: $result", expected, result.getInt(key))
            assertEquals("admin_access", result.getString("keeperAction"))
            assertEquals("generated-fixture-bytes", result.getString("downloadedText"))
            assertFalse("HttpOnly cookies must not be visible to page scripts", result.getString("documentCookie").contains("sg_"))
            assertEquals("TLS errors must not be bypassed", 0, sslErrors.get())
            assertTrue("External requests must not be needed: $blocked", blocked.isEmpty())
            assertEquals(2, tickets.get())
            assertEquals(listOf(
                "GET /", "POST /book-access", "POST /human-access", "POST /human-access",
                "POST /book-access", "GET /media/shadow-garden/books/fixture.epub", "POST /book-access",
                "GET /media/shadow-garden/books/fixture.epub", "GET /admin-access", "POST /admin-access",
                "POST /admin-access", "POST /admin-api/status", "DELETE /admin-access", "POST /admin-api/status"
            ), calls.toList())
        } finally {
            view.get()?.let { webView -> scenario.onActivity {
                (webView.parent as? ViewGroup)?.removeView(webView)
                webView.destroy()
            } }
            scenario.close()
            server.shutdown()
            clearCookies()
        }
    }

    private fun fixtureSocketFactory(): javax.net.ssl.SSLSocketFactory {
        val keys = KeyStore.getInstance("PKCS12")
        assets.open("localhost-fixture.p12").use { keys.load(it, "accesslab-fixture".toCharArray()) }
        val manager = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
        manager.init(keys, "accesslab-fixture".toCharArray())
        return SSLContext.getInstance("TLS").apply { init(manager.keyManagers, null, null) }.socketFactory
    }

    private fun local(uri: Uri, port: Int): Boolean = uri.scheme == "https" && uri.host == "localhost" && uri.port == port
    private fun response(status: Int, json: String = "{}") = MockResponse().setResponseCode(status)
        .setHeader("content-type", "application/json").setBody(json)

    private fun clearCookies() {
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { CookieManager.getInstance().removeAllCookies { latch.countDown() } }
        assertTrue("Cookie cleanup timed out", latch.await(10, TimeUnit.SECONDS))
        CookieManager.getInstance().flush()
    }

    private fun awaitResult(view: WebView): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        var last = "unavailable"
        while (SystemClock.elapsedRealtime() < deadline) {
            val response = AtomicReference<String>()
            val latch = CountDownLatch(1)
            instrumentation.runOnMainSync {
                view.evaluateJavascript("JSON.stringify(window.accessResult || {})") { response.set(it); latch.countDown() }
            }
            assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
            last = response.get()
            val value = runCatching { JSONTokener(last).nextValue() }.getOrNull()
            if (value is String) {
                val state = JSONObject(value)
                if (state.optString("state") == "ready") return state
                if (state.optString("state") == "error") throw AssertionError("Access fixture failed: $state")
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("Access fixture did not complete: $last")
    }
}

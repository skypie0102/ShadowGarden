package dev.shadowgarden.accesslab

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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Real server handlers behind a loopback Node fixture; external services are mocked. */
@RunWith(AndroidJUnit4::class)
class RealHandlerWebViewTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val port = 18443

    @Test
    fun webViewUsesRealAccessHandlersWithMockedExternalServices() {
        assumeTrue("Real-handler fixture is not enabled", InstrumentationRegistry.getArguments().getString("accessBackend") == "true")
        clearCookies()
        val sslErrors = AtomicInteger()
        val blocked = AtomicInteger()
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
                    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = !local(request.url)
                    override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                        if (local(request.url)) return null
                        blocked.incrementAndGet()
                        return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), "Blocked".byteInputStream())
                    }
                }
                activity.setContentView(webView)
                view.set(webView)
                webView.loadUrl("https://localhost:$port/")
            }
            val result = awaitResult(view.get())
            for ((key, expected) in mapOf(
                "unverified" to 428, "badHuman" to 403, "badAction" to 403, "badHost" to 403, "goodHuman" to 200,
                "firstTicket" to 200, "rejectedDownload" to 403, "renewed" to 200, "download" to 200,
                "badKeeper" to 401, "goodKeeper" to 200, "missingBearer" to 401,
                "status" to 200, "logout" to 200, "afterLogout" to 401
            )) assertEquals("Unexpected $key response: $result", expected, result.getInt(key))
            assertEquals("book_access", result.getString("humanAction"))
            assertEquals("admin_access", result.getString("adminAction"))
            assertEquals("generated-fixture-bytes", result.getString("downloadedText"))
            assertFalse("HttpOnly cookies must not be visible to scripts", result.getString("documentCookie").contains("sg_"))
            assertEquals("TLS errors must not be bypassed", 0, sslErrors.get())
            assertEquals("Unexpected external requests", 0, blocked.get())
        } finally {
            view.get()?.let { webView -> scenario.onActivity {
                (webView.parent as? ViewGroup)?.removeView(webView)
                webView.destroy()
            } }
            scenario.close()
            clearCookies()
        }
    }

    private fun local(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "localhost" && uri.port == port

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
                if (state.optString("state") == "error") throw AssertionError("Real-handler fixture failed: $state")
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("Real-handler fixture did not complete: $last")
    }
}

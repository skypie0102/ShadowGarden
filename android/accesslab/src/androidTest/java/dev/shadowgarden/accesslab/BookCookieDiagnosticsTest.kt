package dev.shadowgarden.accesslab

import android.net.Uri
import android.net.http.SslError
import android.os.SystemClock
import android.util.Log
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
import java.net.URL
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.HttpsURLConnection
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Measures cookie behavior against the isolated fixture without logging cookie values. */
@RunWith(AndroidJUnit4::class)
class BookCookieDiagnosticsTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val origin = "https://localhost:18443"
    private val path = "/media/shadow-garden/books/generated-download.epub"
    private val bookName = "__Secure-sg_book_bk_abcdefghijklmnopqrstuv="
    private val rootControl = "__Secure-sg_control_root="
    private val pathControl = "__Secure-sg_control_path="
    private val visibleControl = "__Secure-sg_control_visible="
    private val humanName = "__Host-sg_human="

    @Test
    fun compareBrowserAndNativeCookieOnlyRequestsAcrossActivityRecreation() {
        assumeTrue("Real-handler fixture is not enabled", InstrumentationRegistry.getArguments().getString("accessBackend") == "true")
        clearCookies()
        val scenario = ActivityScenario.launch(AccessLabActivity::class.java)
        val view = AtomicReference<WebView>()
        val tlsErrors = AtomicInteger()
        val blockedRequests = AtomicInteger()
        try {
            val initial = open(scenario, view, "/cookie-fixture", tlsErrors, blockedRequests)
            val initialState = awaitObject(initial, "window.cookieResult")
            assertEquals(403, initialState.getInt("before"))
            assertEquals(200, initialState.getInt("human"))
            assertEquals(200, initialState.getInt("ticket"))
            assertEquals(200, initialState.getInt("control"))
            assertEquals(200, initialState.getInt("signed"))
            assertEquals(403, initialState.getInt("sibling"))
            assertFalse("HttpOnly book cookie must not be visible to page scripts", initialState.getBoolean("documentBook"))
            assertFalse("HttpOnly root control must not be visible to page scripts", initialState.getBoolean("documentControl"))
            val browserStatus = initialState.getInt("unsigned")
            assertEquals("WebView should send the scoped book cookie for an unsigned request", 200, browserStatus)

            val manager = CookieManager.getInstance()
            val before = manager.getCookie(origin + path) ?: ""
            manager.flush()
            // Allow the cookie store to settle; only boolean presence is logged.
            val deadline = SystemClock.elapsedRealtime() + 2_000
            var nativeCookies: String
            do {
                nativeCookies = manager.getCookie(origin + path) ?: ""
                if (nativeCookies.contains(bookName) && nativeCookies.contains(pathControl)) break
                SystemClock.sleep(100)
            } while (SystemClock.elapsedRealtime() < deadline)
            val rootCookies = manager.getCookie(origin + "/cookie-fixture") ?: ""
            val signedLookup = manager.getCookie(origin + path + "?sig=fixture") ?: ""
            val mainThreadCookies = AtomicReference<String>()
            instrumentation.runOnMainSync { mainThreadCookies.set(manager.getCookie(origin + path) ?: "") }
            val cookieNativeStatus = nativeStatus(nativeCookies)
            assertEquals("An unsigned request without any cookies must be rejected", 403, nativeStatus(""))
            assertTrue("Unexpected native cookie-only response", cookieNativeStatus == 200 || cookieNativeStatus == 403)

            val priorBrowserStatus = browserStatus
            scenario.onActivity { activity ->
                (initial.parent as? ViewGroup)?.removeView(initial)
                initial.destroy()
                view.set(null)
                activity.setContentView(android.view.View(activity))
            }
            scenario.recreate()
            val resumed = open(scenario, view, "/cookie-resume-fixture", tlsErrors, blockedRequests)
            val resumedState = awaitObject(resumed, "window.resumeResult")
            assertEquals("Activity recreation must preserve the observed browser behavior", priorBrowserStatus, resumedState.getInt("unsigned"))
            val afterCookies = manager.getCookie(origin + path) ?: ""
            assertEquals(nativeCookies.contains(bookName), afterCookies.contains(bookName))
            clearCookies()
            assertEquals(403, nativeStatus(""))
            val removed = AtomicReference<String>()
            instrumentation.runOnMainSync { removed.set(manager.getCookie(origin + path) ?: "") }
            assertFalse("Book cookie should be removed", removed.get().contains(bookName))
            assertEquals(0, tlsErrors.get())
            assertEquals(0, blockedRequests.get())

            // Values and signed URLs are never logged, including on failure.
            Log.i("SGReaderProbe", "Book cookie: browser=$browserStatus native=$cookieNativeStatus " +
                "initial=${before.contains(bookName)} settled=${nativeCookies.contains(bookName)} " +
                "signedLookup=${signedLookup.contains(bookName)} afterRecreate=${afterCookies.contains(bookName)} " +
                "rootControl=${rootCookies.contains(rootControl)} pathControl=${nativeCookies.contains(pathControl)} " +
                "humanNative=${rootCookies.contains(humanName)} visibleDocument=${initialState.getBoolean("documentVisible")} " +
                "visibleNative=${rootCookies.contains(visibleControl)} mainBook=${mainThreadCookies.get().contains(bookName)} " +
                "mainVisible=${mainThreadCookies.get().contains(visibleControl)}")
        } finally {
            view.get()?.let { web -> scenario.onActivity {
                (web.parent as? ViewGroup)?.removeView(web)
                web.destroy()
            } }
            scenario.close()
            clearCookies()
        }
    }

    private fun open(scenario: ActivityScenario<AccessLabActivity>, view: AtomicReference<WebView>, route: String,
                     tlsErrors: AtomicInteger, blockedRequests: AtomicInteger): WebView {
        scenario.onActivity { activity ->
            val web = WebView(activity)
            web.settings.javaScriptEnabled = true
            web.settings.allowFileAccess = false
            web.settings.allowContentAccess = false
            web.webViewClient = object : WebViewClient() {
                override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                    tlsErrors.incrementAndGet()
                    handler.cancel()
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = !local(request.url)
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    if (local(request.url)) return null
                    blockedRequests.incrementAndGet()
                    return WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), "Blocked".byteInputStream())
                }
            }
            activity.setContentView(web)
            view.set(web)
            web.loadUrl(origin + route)
        }
        return view.get()
    }

    private fun local(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "localhost" && uri.port == 18443

    private fun nativeStatus(cookie: String): Int {
        val connection = URL(origin + path).openConnection() as HttpsURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 10_000
        connection.readTimeout = 10_000
        connection.useCaches = false
        if (cookie.isNotEmpty()) connection.setRequestProperty("Cookie", cookie)
        return try { connection.responseCode } finally { connection.disconnect() }
    }

    private fun clearCookies() {
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { CookieManager.getInstance().removeAllCookies { latch.countDown() } }
        assertTrue("Cookie cleanup timed out", latch.await(10, TimeUnit.SECONDS))
        CookieManager.getInstance().flush()
    }

    private fun awaitObject(web: WebView, expression: String): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        while (SystemClock.elapsedRealtime() < deadline) {
            val response = AtomicReference<String>()
            val latch = CountDownLatch(1)
            instrumentation.runOnMainSync {
                web.evaluateJavascript("JSON.stringify($expression || {})") { response.set(it); latch.countDown() }
            }
            assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
            val json = JSONTokener(response.get()).nextValue()
            if (json is String) {
                val value = JSONObject(json)
                if (value.optString("state") == "ready") return value
                if (value.optString("state") == "error") throw AssertionError("Cookie fixture failed")
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("Cookie fixture did not complete")
    }
}

package dev.shadowgarden.accesslab

import android.net.Uri
import android.net.http.SslError
import android.os.Build
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

/** Test-only, local cookie controls. Never records cookie values. */
@RunWith(AndroidJUnit4::class)
class CookieAttributeDiagnosticsTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val origin = "https://localhost:18443"
    private val strict = "sg_attr_strict="
    private val lax = "sg_attr_lax="
    private val none = "sg_attr_none="
    private val defaultCookie = "sg_attr_default="
    private val httpOnly = "sg_attr_httponly="
    private val nativeCookie = "sg_native_set="

    @Test
    fun compareCookieAttributesOriginVariantsAndNativeSet() {
        assumeTrue("Real-handler fixture is not enabled", InstrumentationRegistry.getArguments().getString("accessBackend") == "true")
        clearCookies()
        val scenario = ActivityScenario.launch(AccessLabActivity::class.java)
        val view = AtomicReference<WebView>()
        val tlsErrors = AtomicInteger()
        val blockedRequests = AtomicInteger()
        try {
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
                web.loadUrl("$origin/cookie-attributes-fixture")
            }
            val web = view.get()
            val state = awaitObject(web, "window.attributeResult")
            assertEquals(200, state.getInt("status"))
            assertTrue("SameSite Strict control must be visible to the fixture page", state.getBoolean("strict"))
            assertFalse("HttpOnly control must not be visible to the fixture page", state.getBoolean("httpOnly"))
            val manager = CookieManager.getInstance()
            manager.flush()
            val root = manager.getCookie("$origin/") ?: ""
            val noPort = manager.getCookie("https://localhost/") ?: ""
            val noSlash = manager.getCookie(origin) ?: ""
            val page = manager.getCookie("$origin/cookie-attributes-fixture") ?: ""
            val beforeHasCookies = manager.hasCookies()
            val accepted = AtomicReference<Boolean>()
            val written = CountDownLatch(1)
            instrumentation.runOnMainSync {
                manager.setCookie("$origin/", "sg_native_set=fixture; Path=/; Max-Age=900; Secure; SameSite=Lax") {
                    accepted.set(it)
                    written.countDown()
                }
            }
            assertTrue("Native cookie write timed out", written.await(10, TimeUnit.SECONDS))
            manager.flush()
            val deadline = SystemClock.elapsedRealtime() + 2_000
            var visibleFromPage = false
            do {
                visibleFromPage = evaluateBoolean(web, "document.cookie.split(';').some(function(item){return item.trim().indexOf('sg_native_set=')===0;})")
                if (visibleFromPage) break
                SystemClock.sleep(100)
            } while (SystemClock.elapsedRealtime() < deadline)
            val after = manager.getCookie("$origin/") ?: ""
            val mainThread = AtomicReference<String>()
            instrumentation.runOnMainSync { mainThread.set(manager.getCookie("$origin/") ?: "") }
            val version = WebView.getCurrentWebViewPackage()?.versionName ?: "unknown"
            assertEquals(0, tlsErrors.get())
            assertEquals(0, blockedRequests.get())
            Log.i("SGReaderProbe", "Cookie attributes: api=${Build.VERSION.SDK_INT} webview=$version " +
                "docStrict=${state.getBoolean("strict")} docLax=${state.getBoolean("lax")} " +
                "docNone=${state.getBoolean("none")} docDefault=${state.getBoolean("defaultValue")} " +
                "nativeStrict=${root.contains(strict)} nativeLax=${root.contains(lax)} nativeNone=${root.contains(none)} " +
                "nativeDefault=${root.contains(defaultCookie)} nativeHttpOnly=${root.contains(httpOnly)} " +
                "noPortStrict=${noPort.contains(strict)} noSlashStrict=${noSlash.contains(strict)} pageStrict=${page.contains(strict)} " +
                "hasCookies=$beforeHasCookies writeAccepted=${accepted.get()} nativeSet=${after.contains(nativeCookie)} " +
                "mainSet=${mainThread.get().contains(nativeCookie)} documentSet=$visibleFromPage")
        } finally {
            view.get()?.let { web -> scenario.onActivity {
                (web.parent as? ViewGroup)?.removeView(web)
                web.destroy()
            } }
            scenario.close()
            clearCookies()
        }
    }

    private fun local(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "localhost" && uri.port == 18443

    private fun clearCookies() {
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { CookieManager.getInstance().removeAllCookies { latch.countDown() } }
        assertTrue("Cookie cleanup timed out", latch.await(10, TimeUnit.SECONDS))
        CookieManager.getInstance().flush()
    }

    private fun evaluate(web: WebView, expression: String): Any? {
        val response = AtomicReference<String>()
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { web.evaluateJavascript(expression) { response.set(it); latch.countDown() } }
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
        return JSONTokener(response.get()).nextValue()
    }

    private fun evaluateBoolean(web: WebView, expression: String): Boolean = evaluate(web, expression) == true

    private fun awaitObject(web: WebView, expression: String): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        while (SystemClock.elapsedRealtime() < deadline) {
            val json = evaluate(web, "JSON.stringify($expression || {})")
            if (json is String) {
                val value = JSONObject(json)
                if (value.optString("state") == "ready") return value
                if (value.optString("state") == "error") throw AssertionError("Attribute fixture failed")
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("Attribute fixture did not complete")
    }
}

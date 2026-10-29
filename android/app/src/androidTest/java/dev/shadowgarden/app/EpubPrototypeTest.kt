package dev.shadowgarden.app

import android.content.Context
import android.net.Uri
import android.os.SystemClock
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.ConsoleMessage
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Experimental, offline-only harness; it is not the application reader. */
@RunWith(AndroidJUnit4::class)
class EpubPrototypeTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val testAssets = instrumentation.context.assets
    private val appContext = instrumentation.targetContext
    private val origin = "https://epub-prototype.invalid/"
    private val consoleMessages = CopyOnWriteArrayList<String>()

    @Test
    fun opensLocalEpubAndRestoresChapterAfterRecreation() {
        runFixture(false, "chapter2.xhtml", "A quiet second chapter begins here.", 2)
    }

    @Test
    fun opensLongIllustratedEpubAndRestoresFinalChapter() {
        runFixture(true, "chapter12.xhtml", "Final chapter marker.", 12)
    }

    private fun runFixture(extended: Boolean, href: String, marker: String, tocCount: Int) {
        val fixture = File(appContext.cacheDir, "epub-prototype-fixture.epub")
        val preferences = appContext.getSharedPreferences("epub-prototype-test", Context.MODE_PRIVATE)
        preferences.edit().clear().commit()
        EpubFixture.create(fixture, extended)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        var view: WebView? = null
        try {
            view = openHarness(scenario, fixture, null, href, marker)
            val first = awaitResult(view)
            assertEquals(href, first.getString("href"))
            assertEquals(tocCount, first.getInt("tocCount"))
            if (extended) assertTrue("Illustration should decode", first.getBoolean("imageLoaded"))
            assertTrue("The target chapter should contain its marker", first.getBoolean("markerPresent"))
            val cfi = first.getString("cfi")
            assertTrue("An EPUB CFI should be captured", cfi.startsWith("epubcfi("))
            assertTrue(preferences.edit().putString("location", cfi).commit())

            closeHarness(scenario, view)
            view = null
            scenario.recreate()

            view = openHarness(scenario, fixture, preferences.getString("location", null), href, marker)
            val restored = awaitResult(view)
            assertEquals(href, restored.getString("href"))
            assertTrue("The restored chapter should contain its marker", restored.getBoolean("markerPresent"))
            assertEquals("Restoration should return to the same CFI", cfi, restored.getString("cfi"))
        } finally {
            view?.let { closeHarness(scenario, it) }
            scenario.close()
            preferences.edit().clear().commit()
            fixture.delete()
        }
    }

    private fun openHarness(scenario: ActivityScenario<MainActivity>, fixture: File, cfi: String?, href: String, marker: String): WebView {
        val html = testAssets.open("epub-prototype.html").bufferedReader().use { it.readText() }
            .replace("__RESTORED_CFI__", cfi?.let(JSONObject::quote) ?: "null")
            .replace("__TARGET_HREF__", JSONObject.quote(href))
            .replace("__MARKER__", JSONObject.quote(marker))
        val result = AtomicReference<WebView>()
        scenario.onActivity { activity ->
            val webView = WebView(activity)
            webView.settings.javaScriptEnabled = true
            webView.settings.allowFileAccess = false
            webView.settings.allowContentAccess = false
            webView.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    consoleMessages.add("${message.message()} (line ${message.lineNumber()})")
                    return true
                }
            }
            webView.webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                    val url: Uri = request.url
                    if (url.scheme == "https" && url.host == "epub-prototype.invalid") {
                        return when (url.path) {
                            "/fixture.epub" -> WebResourceResponse("application/epub+zip", null, fixture.inputStream())
                            "/jszip.min.js", "/epub.min.js" -> WebResourceResponse(
                                "text/javascript", "utf-8", testAssets.open(url.path!!.removePrefix("/"))
                            )
                            else -> blockedResponse()
                        }
                    }
                    return blockedResponse()
                }
            }
            activity.setContentView(webView)
            result.set(webView)
            webView.loadDataWithBaseURL(origin, html, "text/html", "utf-8", null)
        }
        return result.get()
    }

    private fun blockedResponse(): WebResourceResponse = WebResourceResponse(
        "text/plain", "utf-8", 403, "Blocked", emptyMap(), "Blocked".byteInputStream()
    )

    private fun awaitResult(view: WebView): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 30_000
        var lastResponse = "unavailable"
        while (SystemClock.elapsedRealtime() < deadline) {
            val response = AtomicReference<String>()
            val latch = CountDownLatch(1)
            instrumentation.runOnMainSync {
                view.evaluateJavascript("JSON.stringify(window.prototypeResult || {})") {
                    response.set(it)
                    latch.countDown()
                }
            }
            assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
            lastResponse = response.get()
            val value = JSONTokener(response.get()).nextValue()
            if (value is String) {
                val state = JSONObject(value)
                if (state.optString("state") == "ready") return state
                if (state.optString("state") == "error") throw AssertionError(state.optString("message"))
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("The EPUB prototype did not finish loading: $lastResponse; console: $consoleMessages")
    }

    private fun closeHarness(scenario: ActivityScenario<MainActivity>, view: WebView) {
        scenario.onActivity {
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
        }
    }

}

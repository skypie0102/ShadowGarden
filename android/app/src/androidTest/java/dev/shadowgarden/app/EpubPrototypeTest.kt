package dev.shadowgarden.app

import android.content.Context
import android.net.Uri
import android.os.SystemClock
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
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

    @Test
    fun opensLocalEpubAndRestoresChapterAfterRecreation() {
        val fixture = File(appContext.cacheDir, "epub-prototype-fixture.epub")
        val preferences = appContext.getSharedPreferences("epub-prototype-test", Context.MODE_PRIVATE)
        preferences.edit().clear().commit()
        createFixture(fixture)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        var view: WebView? = null
        try {
            view = openHarness(scenario, fixture, null)
            val first = awaitResult(view)
            assertEquals("chapter2.xhtml", first.getString("href"))
            assertTrue("The second chapter should be rendered", first.getBoolean("chapterTwoVisible"))
            val cfi = first.getString("cfi")
            assertTrue("An EPUB CFI should be captured", cfi.startsWith("epubcfi("))
            assertTrue(preferences.edit().putString("location", cfi).commit())

            closeHarness(scenario, view)
            view = null
            scenario.recreate()

            view = openHarness(scenario, fixture, preferences.getString("location", null))
            val restored = awaitResult(view)
            assertEquals("chapter2.xhtml", restored.getString("href"))
            assertTrue("The saved chapter should be rendered after recreation", restored.getBoolean("chapterTwoVisible"))
            assertEquals("Restoration should return to the same CFI", cfi, restored.getString("cfi"))
        } finally {
            view?.let { closeHarness(scenario, it) }
            scenario.close()
            preferences.edit().clear().commit()
            fixture.delete()
        }
    }

    private fun openHarness(scenario: ActivityScenario<MainActivity>, fixture: File, cfi: String?): WebView {
        val html = testAssets.open("epub-prototype.html").bufferedReader().use { it.readText() }
            .replace("__RESTORED_CFI__", cfi?.let(JSONObject::quote) ?: "null")
        val result = AtomicReference<WebView>()
        scenario.onActivity { activity ->
            val webView = WebView(activity)
            webView.settings.javaScriptEnabled = true
            webView.settings.allowFileAccess = false
            webView.settings.allowContentAccess = false
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
            val value = JSONTokener(response.get()).nextValue()
            if (value is String) {
                val state = JSONObject(value)
                if (state.optString("state") == "ready") return state
                if (state.optString("state") == "error") throw AssertionError(state.optString("message"))
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("The EPUB prototype did not finish loading")
    }

    private fun closeHarness(scenario: ActivityScenario<MainActivity>, view: WebView) {
        scenario.onActivity {
            (view.parent as? ViewGroup)?.removeView(view)
            view.destroy()
        }
    }

    private fun createFixture(file: File) {
        val mimetype = "application/epub+zip".toByteArray()
        ZipOutputStream(file.outputStream()).use { zip ->
            val checksum = CRC32().apply { update(mimetype) }
            zip.putNextEntry(ZipEntry("mimetype").apply {
                method = ZipEntry.STORED
                size = mimetype.size.toLong()
                compressedSize = size
                crc = checksum.value
            })
            zip.write(mimetype)
            zip.closeEntry()
            fun entry(name: String, contents: String) {
                zip.putNextEntry(ZipEntry(name))
                zip.write(contents.toByteArray(Charsets.UTF_8))
                zip.closeEntry()
            }
            entry("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
            entry("book.opf", """<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">android-epub-prototype</dc:identifier><dc:title>Android EPUB prototype</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-29T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>""")
            entry("nav.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">One</a></li><li><a href="chapter2.xhtml">Two</a></li></ol></nav></body></html>""")
            entry("chapter1.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><h1>Chapter one</h1><p>This is a generated technical fixture.</p></body></html>""")
            entry("chapter2.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head><body><h1>Chapter two</h1><p>A quiet second chapter begins here.</p></body></html>""")
        }
    }
}

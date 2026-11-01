package dev.shadowgarden.app.books

import android.content.ComponentName
import android.net.Uri
import android.os.SystemClock
import android.webkit.WebResourceRequest
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.EpubFixture
import dev.shadowgarden.app.catalog.CatalogVolume
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.File
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OfflineReaderActivityTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext

    @Test fun readsSavedGeneratedEpubOfflineAndNavigatesContents() {
        val id = CatalogBookId("bk_" + UUID.randomUUID().toString().replace("-", "").take(22))
        val store = PrivateBookStore(File(context.noBackupFilesDir, "downloaded-books-v1"))
        val fixture = File(context.cacheDir, "reader-source-${UUID.randomUUID()}.epub")
        val altered = File(context.cacheDir, "reader-test-${UUID.randomUUID()}.epub")
        EpubFixture.create(fixture, true)
        addUntrustedContent(fixture, altered)
        var stored = false
        try {
            assertFalse("Test must not overwrite a saved book", store.contains(id))
            altered.inputStream().use { store.replaceEpub(id, it) }
            stored = true
            val volume = CatalogVolume(id, "Generated volume")
            val scenario = ActivityScenario.launch<OfflineReaderActivity>(OfflineReaderActivity.intent(context, volume))
            try {
                val view = awaitReader(scenario)
                val ready = awaitState(view) { it.optString("state") == "ready" && it.optString("cfi").isNotBlank() }
                assertTrue(ready.getString("href").contains("chapter1.xhtml"))
                val initial = evaluate(view, "JSON.stringify({count:document.getElementById('contents').options.length, warning:document.getElementById('status').textContent, executed:window.sgReader.unsafeExecuted===true})")
                val details = JSONObject(JSONTokener(initial).nextValue() as String)
                assertEquals(13, details.getInt("count"))
                assertTrue(details.getString("warning").contains("not saved"))
                assertFalse("Book scripts must not run", details.getBoolean("executed"))
                evaluate(view, "(function(){const c=document.getElementById('contents');c.selectedIndex=12;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()")
                val last = awaitState(view) { it.optString("href").contains("chapter12.xhtml") && it.optString("cfi").isNotBlank() }
                evaluate(view, "document.getElementById('next').click(); 'ok'")
                val next = awaitState(view) { it.optString("href").contains("chapter12.xhtml") && it.optString("cfi").isNotBlank() && it.optString("cfi") != last.optString("cfi") }
                assertNotEquals(last.getString("cfi"), next.getString("cfi"))
                instrumentation.runOnMainSync {
                    assertFalse(view.settings.allowFileAccess)
                    assertFalse(view.settings.allowContentAccess)
                    val client = view.webViewClient
                    val external = request("https://example.invalid/secret", true)
                    assertTrue(client.shouldOverrideUrlLoading(view, external))
                    assertEquals(403, client.shouldInterceptRequest(view, external)!!.statusCode)
                }
            } finally { scenario.close() }
        } finally {
            if (stored) store.remove(id)
            fixture.delete()
            altered.delete()
        }
    }

    @Test fun readerActivityIsNotExported() {
        @Suppress("DEPRECATION")
        val info = context.packageManager.getActivityInfo(ComponentName(context, OfflineReaderActivity::class.java), 0)
        assertFalse(info.exported)
    }

    private fun awaitReader(scenario: ActivityScenario<OfflineReaderActivity>): WebView {
        val deadline = SystemClock.elapsedRealtime() + 30_000
        val found = AtomicReference<WebView>()
        while (SystemClock.elapsedRealtime() < deadline) {
            scenario.onActivity { it.readerView?.let(found::set) }
            found.get()?.let { return it }
            SystemClock.sleep(100)
        }
        throw AssertionError("Reader WebView did not start")
    }
    private fun awaitState(view: WebView, predicate: (JSONObject) -> Boolean): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        while (SystemClock.elapsedRealtime() < deadline) {
            val raw = evaluate(view, "JSON.stringify(window.sgReader || {})")
            val json = runCatching { JSONObject(JSONTokener(raw).nextValue() as String) }.getOrNull()
            if (json?.optString("state") == "error") throw AssertionError("Reader could not open generated EPUB")
            if (json != null && predicate(json)) return json
            SystemClock.sleep(100)
        }
        throw AssertionError("Reader state did not reach the expected location")
    }
    private fun evaluate(view: WebView, script: String): String {
        val result = AtomicReference<String>()
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { view.evaluateJavascript(script) { result.set(it); latch.countDown() } }
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
        return result.get()
    }
    private fun request(value: String, main: Boolean) = object : WebResourceRequest {
        override fun getUrl(): Uri = Uri.parse(value)
        override fun isForMainFrame() = main
        override fun isRedirect() = false
        override fun hasGesture() = false
        override fun getMethod() = "GET"
        override fun getRequestHeaders(): Map<String, String> = emptyMap()
    }
    private fun addUntrustedContent(source: File, destination: File) {
        ZipFile(source).use { input ->
            ZipOutputStream(destination.outputStream()).use { output ->
                val entries = input.entries()
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement()
                    var bytes = input.getInputStream(entry).use { it.readBytes() }
                    if (entry.name == "chapter1.xhtml") {
                        val content = bytes.toString(Charsets.UTF_8).replace("<h1>",
                            "<script><![CDATA[window.parent.sgReader.unsafeExecuted=true;]]></script><img src=\"https://example.invalid/pixel.png\"/><h1>")
                        bytes = content.toByteArray(Charsets.UTF_8)
                    }
                    val copy = ZipEntry(entry.name)
                    if (entry.name == "mimetype") {
                        copy.method = ZipEntry.STORED
                        copy.size = bytes.size.toLong()
                        copy.compressedSize = copy.size
                        copy.crc = CRC32().apply { update(bytes) }.value
                    }
                    output.putNextEntry(copy)
                    output.write(bytes)
                    output.closeEntry()
                }
            }
        }
    }
}

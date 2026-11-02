package dev.shadowgarden.app.books

import android.content.ComponentName
import android.database.sqlite.SQLiteDatabase
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
import dev.shadowgarden.app.progress.EditionFingerprint
import dev.shadowgarden.app.progress.LocatorFormat
import dev.shadowgarden.app.progress.ProgressLookup
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPositionBackup
import dev.shadowgarden.app.progress.ReadingProgressStore
import java.io.ByteArrayOutputStream
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
            ReadingProgressStore(context).use { assertEquals(ProgressLookup.NoProgress, it.lookup(id, null, LocatorFormat.EPUBJS_CFI)) }
            val edition = altered.inputStream().use { store.replaceEpub(id, it) }
            stored = true
            val volume = CatalogVolume(id, "Generated volume")
            val scenario = ActivityScenario.launch<OfflineReaderActivity>(OfflineReaderActivity.intent(context, volume))
            try {
                val view = awaitReader(scenario)
                val ready = awaitState(view) { it.optString("state") == "ready" && it.optString("cfi").isNotBlank() }
                assertTrue(ready.getString("href").contains("chapter1.xhtml"))
                val initial = evaluate(view, "JSON.stringify({count:document.getElementById('contents').options.length, warning:document.getElementById('status').textContent, executed:window.sgReader.unsafeExecuted===true, text:(document.querySelector('#viewer iframe').contentDocument.body.textContent || '').includes('Chapter 1 paragraph 1.')})")
                val details = JSONObject(JSONTokener(initial).nextValue() as String)
                assertEquals(13, details.getInt("count"))
                assertEquals("", details.getString("warning"))
                assertFalse("Book scripts must not run", details.getBoolean("executed"))
                assertTrue("The first chapter text must be present", details.getBoolean("text"))
                evaluate(view, "(function(){const c=document.getElementById('contents');c.selectedIndex=12;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()")
                val last = awaitState(view) { it.optString("href").contains("chapter12.xhtml") && it.optLong("seq") >= 1 && !it.optBoolean("pending") }
                assertTrue("The generated illustration must decode", awaitBoolean(view, "(function(){const f=document.querySelector('#viewer iframe');const i=f && f.contentDocument && f.contentDocument.querySelector('img');return !!(i && i.complete && i.naturalWidth>0);})()"))
                evaluate(view, "document.getElementById('next').click(); 'ok'")
                val next = awaitState(view) { it.optString("href").contains("chapter12.xhtml") && it.optLong("seq") >= 2 && !it.optBoolean("pending") && it.optString("cfi") != last.optString("cfi") }
                assertNotEquals(last.getString("cfi"), next.getString("cfi"))
                val saved = awaitSaved(id, edition, next.getString("saveCfi"))
                val backup = ByteArrayOutputStream()
                ReadingPositionBackup.write(backup, ReadingProgressStore(context).use { it.snapshotPositions() })
                assertTrue(ReadingPositionBackup.read(backup.toByteArray().inputStream()).contains(saved.position))
                instrumentation.runOnMainSync {
                    assertFalse(view.settings.allowFileAccess)
                    assertFalse(view.settings.allowContentAccess)
                    val client = view.webViewClient
                    val external = request("https://example.invalid/secret", true)
                    assertTrue(client.shouldOverrideUrlLoading(view, external))
                    assertEquals(403, client.shouldInterceptRequest(view, external)!!.statusCode)
                }
                scenario.recreate()
                val reopened = awaitReader(scenario)
                val restart = awaitState(reopened) { it.optString("state") == "ready" && it.optString("href").contains("chapter12.xhtml") }
                assertTrue(restart.getString("href").contains("chapter12.xhtml"))
                assertEquals("Opening must not overwrite saved progress", saved, (ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) } as ProgressLookup.Exact).stored)
                val newer = saved.position.copy(locator = "epubcfi(/6/2!/4/2:1)", recordedAtMillis = saved.position.recordedAtMillis + 1)
                ReadingProgressStore(context).use { assertEquals(ProgressSaveResult.Saved(saved.revision + 1), it.save(newer, saved.revision)) }
                evaluate(reopened, "(function(){const c=document.getElementById('contents');c.selectedIndex=1;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()")
                awaitState(reopened) { it.optLong("seq") >= 1 && !it.optBoolean("pending") }
                val noticeDeadline = SystemClock.elapsedRealtime() + 15_000
                var notice = ""
                while (!notice.contains("changed elsewhere") && SystemClock.elapsedRealtime() < noticeDeadline) {
                    scenario.onActivity { notice = it.progressNotice() }
                    SystemClock.sleep(100)
                }
                assertTrue("The reader must report a conflicting update", notice.contains("changed elsewhere"))
                assertEquals(newer, (ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) } as ProgressLookup.Exact).stored.position)
            } finally { scenario.close() }
            val replacement = fixture.inputStream().use { store.replaceEpub(id, it) }
            assertNotEquals(edition, replacement)
            val replacedScenario = ActivityScenario.launch<OfflineReaderActivity>(OfflineReaderActivity.intent(context, volume))
            try {
                val replacedView = awaitReader(replacedScenario)
                awaitState(replacedView) { it.optString("state") == "ready" && it.optString("href").contains("chapter1.xhtml") }
                replacedScenario.onActivity { assertTrue(it.progressNotice().contains("different edition")) }
                evaluate(replacedView, "(function(){const c=document.getElementById('contents');c.selectedIndex=12;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()")
                val changed = awaitState(replacedView) { it.optLong("seq") >= 1 && !it.optBoolean("pending") }
                awaitSaved(id, replacement, changed.getString("saveCfi"))
                assertTrue(ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) } is ProgressLookup.Exact)
            } finally { replacedScenario.close() }
        } finally {
            if (stored) store.remove(id)
            val database = context.getDatabasePath("reading-progress.db")
            if (stored && database.exists()) SQLiteDatabase.openDatabase(database.path, null, SQLiteDatabase.OPEN_READWRITE).use {
                it.delete("reading_positions", "book_id=?", arrayOf(id.value))
            }
            fixture.delete()
            altered.delete()
        }
    }

    internal fun awaitSaved(id: CatalogBookId, edition: EditionFingerprint, cfi: String): dev.shadowgarden.app.progress.StoredReadingPosition {
        val deadline = SystemClock.elapsedRealtime() + 15_000
        while (SystemClock.elapsedRealtime() < deadline) {
            val found = ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) }
            if (found is ProgressLookup.Exact && found.stored.position.locator == cfi) return found.stored
            SystemClock.sleep(100)
        }
        throw AssertionError("Reader did not save its current location")
    }

    @Test fun readerActivityIsNotExported() {
        @Suppress("DEPRECATION")
        val info = context.packageManager.getActivityInfo(ComponentName(context, OfflineReaderActivity::class.java), 0)
        assertFalse(info.exported)
    }

    @Test fun searchesOfflineAndSavesOnlyAnOpenedResult() {
        val id = CatalogBookId("bk_" + UUID.randomUUID().toString().replace("-", "").take(22))
        val store = PrivateBookStore(File(context.noBackupFilesDir, "downloaded-books-v1"))
        val fixture = File(context.cacheDir, "reader-search-source-${UUID.randomUUID()}.epub")
        val altered = File(context.cacheDir, "reader-search-test-${UUID.randomUUID()}.epub")
        EpubFixture.create(fixture, true)
        addUntrustedContent(fixture, altered)
        var stored = false
        try {
            assertFalse("Test must not overwrite a saved book", store.contains(id))
            ReadingProgressStore(context).use { assertEquals(ProgressLookup.NoProgress, it.lookup(id, null, LocatorFormat.EPUBJS_CFI)) }
            val edition = altered.inputStream().use { store.replaceEpub(id, it) }
            stored = true
            val scenario = ActivityScenario.launch<OfflineReaderActivity>(OfflineReaderActivity.intent(context, CatalogVolume(id, "Generated search volume")))
            try {
                val view = awaitReader(scenario)
                awaitState(view) { it.optString("state") == "ready" && it.optString("cfi").isNotBlank() }
                evaluate(view, "document.getElementById('open-search').click(); 'ok'")
                submitSearch(view, "ab")
                assertEquals("Enter at least 3 characters.", awaitSearch(view) { it.optString("state") == "complete" }.getString("status"))
                assertEquals(ProgressLookup.NoProgress, ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) })

                submitSearch(view, "chapter 12 paragraph 73.")
                val found = awaitSearch(view) { it.optString("state") == "complete" }
                assertEquals(1, found.getInt("count"))
                assertTrue(found.getString("first").contains("Section 12"))
                assertTrue(found.getString("first").contains("Chapter 12 paragraph 73."))
                assertEquals(ProgressLookup.NoProgress, ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) })
                evaluate(view, "document.querySelector('#search-results button').click(); 'ok'")
                val selected = awaitState(view) { it.optString("href").contains("chapter12.xhtml") && it.optLong("seq") >= 1 && !it.optBoolean("pending") && !it.optBoolean("searchOpen") }
                val saved = awaitSaved(id, edition, selected.getString("saveCfi"))
                assertTrue("The selected paragraph must be visible", awaitBoolean(view, """(function(){
                    const f=document.querySelector('#viewer iframe'),v=document.getElementById('viewer');
                    if(!f || !f.contentDocument)return false;
                    const p=Array.from(f.contentDocument.querySelectorAll('p')).find(function(x){return x.textContent.indexOf('Chapter 12 paragraph 73.')>=0;});
                    if(!p)return false; const r=f.contentDocument.createRange();r.selectNodeContents(p);
                    const frame=f.getBoundingClientRect(),viewport=v.getBoundingClientRect();
                    return Array.from(r.getClientRects()).some(function(b){return frame.left+b.right>viewport.left && frame.left+b.left<viewport.right && frame.top+b.bottom>viewport.top && frame.top+b.top<viewport.bottom;});
                })()"""))

                scenario.recreate()
                val reopened = awaitReader(scenario)
                awaitState(reopened) { it.optString("state") == "ready" && it.optString("href").contains("chapter12.xhtml") }
                assertEquals("Opening must not rewrite the search result location", saved,
                    (ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) } as ProgressLookup.Exact).stored)
                evaluate(reopened, "document.getElementById('open-search').click(); 'ok'")
                assertEquals("\"\"", evaluate(reopened, "document.getElementById('search-query').value"))
                submitSearch(reopened, "unsafeExecuted")
                val excluded = awaitSearch(reopened) { it.optString("state") == "complete" }
                assertEquals(0, excluded.getInt("count"))
                assertEquals("No matching book text.", excluded.getString("status"))
                assertEquals("false", evaluate(reopened, "window.sgReader.unsafeExecuted === true"))
                submitSearch(reopened, "paragraph")
                val capped = awaitSearch(reopened) { it.optString("state") == "complete" }
                assertEquals(100, capped.getInt("count"))
                assertTrue(capped.getString("status").contains("limited"))
                evaluate(reopened, """(function(){const q=document.getElementById('search-query'),f=document.getElementById('search-form');
                    q.value='Chapter 1 paragraph 17';f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
                    q.value='Final chapter marker.';f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return 'ok';})()""")
                val latest = awaitSearch(reopened) { it.optString("state") == "complete" }
                assertEquals(1, latest.getInt("count"))
                assertTrue(latest.getString("first").contains("Final chapter marker."))
                scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
                awaitState(reopened) { !it.optBoolean("searchOpen") && it.optString("state") == "ready" }
                assertEquals("Searching and closing must not rewrite progress", saved,
                    (ReadingProgressStore(context).use { it.lookup(id, edition, LocatorFormat.EPUBJS_CFI) } as ProgressLookup.Exact).stored)
            } finally { scenario.close() }
        } finally {
            if (stored) store.remove(id)
            val database = context.getDatabasePath("reading-progress.db")
            if (stored && database.exists()) SQLiteDatabase.openDatabase(database.path, null, SQLiteDatabase.OPEN_READWRITE).use {
                it.delete("reading_positions", "book_id=?", arrayOf(id.value))
            }
            fixture.delete()
            altered.delete()
        }
    }

    private fun submitSearch(view: WebView, query: String) {
        evaluate(view, "(function(){document.getElementById('search-query').value=${JSONObject.quote(query)};" +
            "document.getElementById('search-form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return 'ok';})()")
    }

    private fun awaitSearch(view: WebView, predicate: (JSONObject) -> Boolean): JSONObject {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        while (SystemClock.elapsedRealtime() < deadline) {
            val raw = evaluate(view, "JSON.stringify({state:document.getElementById('search-panel').getAttribute('data-state'),status:document.getElementById('search-status').textContent,count:document.querySelectorAll('#search-results button').length,first:(document.querySelector('#search-results button')||{}).textContent||''})")
            val json = JSONObject(JSONTokener(raw).nextValue() as String)
            if (json.optString("state") == "error") throw AssertionError("Search failed for generated EPUB")
            if (predicate(json)) return json
            SystemClock.sleep(100)
        }
        throw AssertionError("Search did not complete")
    }

    internal fun awaitReader(scenario: ActivityScenario<OfflineReaderActivity>): WebView {
        val deadline = SystemClock.elapsedRealtime() + 30_000
        val found = AtomicReference<WebView>()
        while (SystemClock.elapsedRealtime() < deadline) {
            scenario.onActivity { it.readerView?.let(found::set) }
            found.get()?.let { return it }
            SystemClock.sleep(100)
        }
        throw AssertionError("Reader WebView did not start")
    }
    internal fun awaitState(view: WebView, predicate: (JSONObject) -> Boolean): JSONObject {
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
    internal fun evaluate(view: WebView, script: String): String {
        val result = AtomicReference<String>()
        val latch = CountDownLatch(1)
        instrumentation.runOnMainSync { view.evaluateJavascript(script) { result.set(it); latch.countDown() } }
        assertTrue("WebView evaluation timed out", latch.await(5, TimeUnit.SECONDS))
        return result.get()
    }
    private fun awaitBoolean(view: WebView, script: String): Boolean {
        val deadline = SystemClock.elapsedRealtime() + 15_000
        while (SystemClock.elapsedRealtime() < deadline) {
            if (evaluate(view, script) == "true") return true
            SystemClock.sleep(100)
        }
        return false
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

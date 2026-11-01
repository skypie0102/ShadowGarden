package dev.shadowgarden.app

import android.content.Context
import android.content.pm.PackageManager
import android.database.sqlite.SQLiteDatabase
import android.graphics.Bitmap
import android.os.Process
import android.os.SystemClock
import android.util.Log
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.catalog.CatalogSeries
import dev.shadowgarden.app.catalog.CatalogSource
import dev.shadowgarden.app.catalog.CatalogVolume
import dev.shadowgarden.app.catalog.CoverPath
import dev.shadowgarden.app.catalog.LibraryViewModel
import dev.shadowgarden.app.catalog.PrivateMainCatalogCache
import dev.shadowgarden.app.catalog.PrivateCoverDiskCache
import dev.shadowgarden.app.catalog.PublicCoverLoader
import dev.shadowgarden.app.books.PrivateBookStore
import dev.shadowgarden.app.books.OfflineReaderActivity
import dev.shadowgarden.app.books.OfflineReaderActivityTest
import dev.shadowgarden.app.books.BookTicket
import dev.shadowgarden.app.books.SignedBookTransfer
import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import dev.shadowgarden.app.progress.LocatorFormat
import dev.shadowgarden.app.progress.ProgressLookup
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPosition
import dev.shadowgarden.app.progress.ReadingProgressStore
import java.io.File
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.readium.r2.shared.publication.Locator
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody

/** Two-stage test-only experiment; the shell stops the app between invocations. */
@RunWith(AndroidJUnit4::class)
class ReaderProcessRecoveryTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val probe by lazy { context.getSharedPreferences(PROBE_PREFS, Context.MODE_PRIVATE) }
    private val epubFile by lazy { File(context.cacheDir, EPUB_FIXTURE) }
    private val readiumFile by lazy { File(context.cacheDir, ReadiumPrototypeActivity.FIXTURE_NAME) }
    private val catalogFile by lazy { File(context.filesDir, "main-catalog-process-test.json") }
    private val coverDirectory by lazy { File(context.cacheDir, "main-cover-process-test") }
    private val bookDirectory by lazy { File(context.noBackupFilesDir, "book-store-process-test") }
    private val catalogFixture by lazy {
        listOf(CatalogSeries("process-series", "Generated Series", "Fixture Author", "Ongoing",
            listOf(CatalogVolume(BOOK_ID, "Generated Volume"))))
    }
    private val readiumPreferences by lazy {
        context.getSharedPreferences(ReadiumPrototypeActivity.PREFERENCES, Context.MODE_PRIVATE)
    }

    @Test
    fun probe() {
        val phase = InstrumentationRegistry.getArguments().getString("processPhase")
        assumeTrue("Two-stage process probe is manual-only", phase in listOf("prepare", "restore", "cleanup"))
        when (phase) {
            "prepare" -> prepare()
            "restore" -> restore()
            "cleanup" -> cleanup()
        }
    }

    private fun prepare() {
        cleanup()
        assertOfflinePermission()
        EpubFixture.create(epubFile, true)
        EpubFixture.create(readiumFile, true)
        val epubHelper = EpubPrototypeTest()
        val epubScenario = ActivityScenario.launch(MainActivity::class.java)
        var prepared = false
        try {
            PrivateMainCatalogCache(catalogFile).write(catalogFixture)
            val image = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
            val bytes = try { ByteArrayOutputStream().use { output ->
                assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, output))
                output.toByteArray()
            } } finally { image.recycle() }
            PrivateCoverDiskCache(coverDirectory).write(COVER_PATH, bytes)
            val generated = epubFile.readBytes()
            val fakeHttp = OkHttpClient.Builder().addInterceptor { chain ->
                Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("generated fixture")
                    .header("Content-Type", "application/epub+zip").body(generated.toResponseBody()).build()
            }.build()
            val ticket = BookTicket(BOOK_ID, "/media/shadow-garden/books/generated.epub?sig=fixture.token", 2_000)
            val transferred = runBlocking { SignedBookTransfer(PrivateBookStore(bookDirectory), fakeHttp, { 1_000 })
                .download(BOOK_ID, ticket, fingerprint(epubFile)) }
            assertEquals(fingerprint(epubFile), transferred)
            val web = epubHelper.openHarness(epubScenario, epubFile, null, "", "", "epub-layout-restore.html", 280, 340, 100)
            val result = try { epubHelper.awaitResult(web) } finally { epubHelper.closeHarness(epubScenario, web) }
            assertEquals(ReadiumPrototypeActivity.PASSAGE, result.getString("text"))
            assertTrue("Selected EPUB.js passage must be visible", result.getBoolean("visible"))
            val cfi = result.getString("cfi")
            assertTrue(cfi.startsWith("epubcfi("))
            val currentWeb = epubHelper.openHarness(epubScenario, epubFile, null, "", "", "epub-current-location.html", 280, 340, 100)
            val current = try { epubHelper.awaitResult(currentWeb) } finally { epubHelper.closeHarness(epubScenario, currentWeb) }
            val currentCfi = current.getString("cfi")
            val currentParagraph = current.getInt("paragraph")
            assertTrue("EPUB.js must capture a current-page CFI", currentCfi.startsWith("epubcfi("))
            assertTrue("The EPUB.js sample should be inside the chapter", currentParagraph in 2..80)

            assertTrue(readiumPreferences.edit().clear()
                .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 280)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 340)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1f).commit())
            val readiumHelper = ReadiumPrototypeTest()
            val readiumScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            val selectedReadium: String
            val currentReadium: String
            val readiumParagraph: Int
            try {
                readiumHelper.awaitChapter(readiumScenario, "chapter1.xhtml", "Chapter 1 paragraph 1.")
                readiumScenario.onActivity { assertTrue("Readium must navigate to the selected passage", it.goToPassage()) }
                readiumHelper.awaitVisiblePassage(readiumScenario, 0.0, 280, 340)
                readiumScenario.onActivity { assertTrue("Readium passage locator must be saved", it.savePassage()) }
                selectedReadium = readiumPreferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                    ?: throw AssertionError("Readium selected locator was not saved")
                assertEquals(ReadiumPrototypeActivity.PASSAGE, Locator.fromJSON(JSONObject(selectedReadium))?.text?.highlight)
                val sample = readiumHelper.awaitStableViewport(readiumScenario, 0.0, 280, 340)
                readiumParagraph = sample.paragraph
                readiumScenario.onActivity { assertTrue("Readium current locator must be saved", it.saveLocation()) }
                currentReadium = readiumPreferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                    ?: throw AssertionError("Readium current locator was not saved")
                val savedLocator = Locator.fromJSON(JSONObject(currentReadium)) ?: throw AssertionError("Invalid current locator")
                assertEquals(sample.locator.href, savedLocator.href)
                assertEquals(sample.locator.locations.progression, savedLocator.locations.progression)
            } finally {
                readiumScenario.close()
            }
            ReadingProgressStore(context, PROCESS_DATABASE).use { store ->
                val epubPosition = ReadingPosition(BOOK_ID, fingerprint(epubFile), LocatorFormat.EPUBJS_CFI, currentCfi, 1_000)
                val readiumPosition = ReadingPosition(BOOK_ID, fingerprint(readiumFile), LocatorFormat.READIUM_LOCATOR, currentReadium, 1_000)
                assertEquals(ProgressSaveResult.Saved(1), store.save(epubPosition, null))
                assertEquals(ProgressSaveResult.Saved(1), store.save(readiumPosition, null))
            }
            val appBookId = CatalogBookId("bk_" + UUID.randomUUID().toString().replace("-", "").take(22))
            val appBooks = PrivateBookStore(File(context.noBackupFilesDir, "downloaded-books-v1"))
            assertFalse(appBooks.contains(appBookId))
            ReadingProgressStore(context).use { assertEquals(ProgressLookup.NoProgress, it.lookup(appBookId, null, LocatorFormat.EPUBJS_CFI)) }
            assertTrue(probe.edit().putString("app_book_id", appBookId.value).commit())
            val appEdition = epubFile.inputStream().use { appBooks.replaceEpub(appBookId, it) }
            val appHelper = OfflineReaderActivityTest()
            val appScenario = ActivityScenario.launch<OfflineReaderActivity>(OfflineReaderActivity.intent(context, CatalogVolume(appBookId, "Process fixture")))
            try {
                val view = appHelper.awaitReader(appScenario)
                appHelper.awaitState(view) { it.optString("state") == "ready" }
                appHelper.evaluate(view, "(function(){const c=document.getElementById('contents');c.selectedIndex=12;c.dispatchEvent(new Event('change',{bubbles:true}));return 'ok';})()")
                val location = appHelper.awaitState(view) { it.optString("href").contains("chapter12.xhtml") && it.optLong("seq") >= 1 && !it.optBoolean("pending") }
                val appCfi = location.getString("saveCfi")
                appHelper.awaitSaved(appBookId, appEdition, appCfi)
                assertTrue(probe.edit().putString("app_cfi", appCfi).commit())
            } finally { appScenario.close() }
            assertTrue(probe.edit().putInt("pid", Process.myPid()).putString("cfi", cfi)
                .putString("epub_current_cfi", currentCfi).putInt("epub_paragraph", currentParagraph)
                .putString("readium_selected", selectedReadium).putString("readium_current", currentReadium)
                .putInt("readium_paragraph", readiumParagraph).putString("epub_sha256", sha256(epubFile))
                .putString("readium_sha256", sha256(readiumFile)).commit())
            prepared = true
            Log.i("SGReaderProbe", "Process recovery: preparation complete")
        } finally {
            epubScenario.close()
            if (!prepared) cleanup()
        }
    }

    private fun restore() {
        try {
            assertOfflinePermission()
            val oldPid = probe.getInt("pid", -1)
            assertTrue("The preparation phase must save its process identity", oldPid > 0)
            assertNotEquals("Recovery must occur in a new app process", oldPid, Process.myPid())
            assertEquals("Saved catalog must survive a new offline process", catalogFixture,
                PrivateMainCatalogCache(catalogFile).read())
            val model = AtomicReference<LibraryViewModel>()
            instrumentation.runOnMainSync {
                model.set(LibraryViewModel(CatalogSource { throw IOException("offline fixture") }, PrivateMainCatalogCache(catalogFile)))
            }
            val deadline = SystemClock.elapsedRealtime() + 15_000
            while (model.get().state.value.loading && SystemClock.elapsedRealtime() < deadline) SystemClock.sleep(50)
            assertFalse("Offline catalog loading must finish", model.get().state.value.loading)
            assertEquals("Offline library must show the saved catalog", catalogFixture, model.get().state.value.series)
            assertTrue("Offline library must identify saved data", model.get().state.value.fromCache)
            val covers = PublicCoverLoader(disk = PrivateCoverDiskCache(coverDirectory))
            val savedCover = runBlocking { covers.cached(COVER_PATH) }
            assertNotNull("Saved cover must survive a new offline process", savedCover)
            assertSame("Fresh saved cover must load without networking", savedCover, runBlocking { covers.load(COVER_PATH) })
            PrivateBookStore(bookDirectory).open(BOOK_ID)!!.use { stored ->
                assertEquals("Stored book must survive a new offline process", fingerprint(epubFile), stored.edition)
                assertEquals(fingerprint(epubFile), EditionFingerprint.calculate(stored.input, 8_000_000))
            }
            assertEquals("The EPUB.js fixture must be unchanged", probe.getString("epub_sha256", null), sha256(epubFile))
            assertEquals("The Readium fixture must be unchanged", probe.getString("readium_sha256", null), sha256(readiumFile))
            val appBookId = CatalogBookId(probe.getString("app_book_id", null) ?: throw AssertionError("Missing app book ID"))
            val appCfi = probe.getString("app_cfi", null) ?: throw AssertionError("Missing app reader CFI")
            val appHelper = OfflineReaderActivityTest()
            val appScenario = ActivityScenario.launch<OfflineReaderActivity>(OfflineReaderActivity.intent(context, CatalogVolume(appBookId, "Process fixture")))
            try {
                val view = appHelper.awaitReader(appScenario)
                appHelper.awaitState(view) { it.optString("state") == "ready" && it.optString("href").contains("chapter12.xhtml") }
                appHelper.awaitSaved(appBookId, fingerprint(epubFile), appCfi)
            } finally { appScenario.close() }
            val cfi = probe.getString("cfi", null) ?: throw AssertionError("Missing selected CFI")
            val currentCfi = probe.getString("epub_current_cfi", null) ?: throw AssertionError("Missing current CFI")
            val expectedEpubParagraph = probe.getInt("epub_paragraph", 0)
            val selectedReadium = probe.getString("readium_selected", null) ?: throw AssertionError("Missing selected Readium locator")
            val currentReadium = probe.getString("readium_current", null) ?: throw AssertionError("Missing current Readium locator")
            val expectedReadiumParagraph = probe.getInt("readium_paragraph", 0)
            assertEquals(currentReadium, readiumPreferences.getString(ReadiumPrototypeActivity.LOCATION, null))
            ReadingProgressStore(context, PROCESS_DATABASE).use { store ->
                val epub = store.lookup(BOOK_ID, fingerprint(epubFile), LocatorFormat.EPUBJS_CFI) as ProgressLookup.Exact
                val readium = store.lookup(BOOK_ID, fingerprint(readiumFile), LocatorFormat.READIUM_LOCATOR) as ProgressLookup.Exact
                assertEquals(currentCfi, epub.stored.position.locator)
                assertEquals(currentReadium, readium.stored.position.locator)
                assertEquals(1L, epub.stored.revision)
                assertEquals(1L, readium.stored.revision)
                assertEquals(ProgressLookup.EditionUnknown, store.lookup(BOOK_ID, null, LocatorFormat.EPUBJS_CFI))
                val replacement = EditionFingerprint.calculate("replaced edition".byteInputStream(), 1_000)
                assertEquals(ProgressLookup.EditionChanged, store.lookup(BOOK_ID, replacement, LocatorFormat.EPUBJS_CFI))
            }

            val epubHelper = EpubPrototypeTest()
            val epubScenario = ActivityScenario.launch(MainActivity::class.java)
            try {
                val web = epubHelper.openHarness(epubScenario, epubFile, cfi, "", "", "epub-layout-restore.html", 280, 340, 100)
                val result = try { epubHelper.awaitResult(web) } finally { epubHelper.closeHarness(epubScenario, web) }
                assertEquals(cfi, result.getString("cfi"))
                assertEquals(ReadiumPrototypeActivity.PASSAGE, result.getString("text"))
                assertTrue("Saved EPUB.js passage must be visible after process termination", result.getBoolean("visible"))
                val currentWeb = epubHelper.openHarness(epubScenario, epubFile, currentCfi, "", "", "epub-current-location.html", 280, 340, 100)
                val current = try { epubHelper.awaitResult(currentWeb) } finally { epubHelper.closeHarness(epubScenario, currentWeb) }
                assertEquals("EPUB.js current location must restore the observed paragraph", expectedEpubParagraph, current.getInt("paragraph"))
                val changedWeb = epubHelper.openHarness(epubScenario, epubFile, currentCfi, "", "", "epub-current-location.html", 220, 260, 160)
                val changed = try { epubHelper.awaitResult(changedWeb) } finally { epubHelper.closeHarness(epubScenario, changedWeb) }
                assertEquals(220, changed.getInt("width"))
                assertEquals(260, changed.getInt("height"))
                assertTrue("EPUB.js text must actually be larger", changed.getDouble("fontSize") > current.getDouble("fontSize") * 1.4)
                Log.i("SGReaderProbe", "EPUB.js process reflow: before=$expectedEpubParagraph " +
                    "same=${current.getJSONArray("paragraphs")} changed=${changed.getJSONArray("paragraphs")} " +
                    "firstPreviouslyVisible=${containsParagraph(changed.getJSONArray("paragraphs"), expectedEpubParagraph)}")
            } finally {
                epubScenario.close()
            }
            val readiumHelper = ReadiumPrototypeTest()
            val readiumScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            val sameReadium: ReadiumPrototypeTest.ViewportSample
            try {
                sameReadium = readiumHelper.awaitStableViewport(readiumScenario, 0.0, 280, 340)
                assertEquals("Readium current locator must restore the observed paragraph", expectedReadiumParagraph, sameReadium.paragraph)
            } finally {
                readiumScenario.close()
            }
            assertTrue(readiumPreferences.edit().putString(ReadiumPrototypeActivity.LOCATION, currentReadium)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 220)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 260)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1.6f).commit())
            val changedScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            try {
                val changed = readiumHelper.awaitStableViewport(changedScenario, sameReadium.fontSize * 1.4, 220, 260)
                Log.i("SGReaderProbe", "Readium process reflow: before=$expectedReadiumParagraph " +
                    "same=${sameReadium.visibleParagraphs} changed=${changed.visibleParagraphs} " +
                    "firstPreviouslyVisible=${expectedReadiumParagraph in changed.visibleParagraphs}")
            } finally {
                changedScenario.close()
            }
            assertTrue(readiumPreferences.edit().putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 280)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 340)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1f).commit())
            assertTrue(readiumPreferences.edit().putString(ReadiumPrototypeActivity.LOCATION, selectedReadium).commit())
            val selectedScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            try {
                readiumHelper.awaitVisiblePassage(selectedScenario, 0.0, 280, 340)
            } finally {
                selectedScenario.close()
            }
            Log.i("SGReaderProbe", "Process recovery: selected passages and current-page paragraphs restored; " +
                "EPUB.js=$expectedEpubParagraph Readium=$expectedReadiumParagraph")
        } finally {
            cleanup()
        }
    }

    private fun cleanup() {
        val appBookId = probe.getString("app_book_id", null)?.let { runCatching { CatalogBookId(it) }.getOrNull() }
        if (appBookId != null) {
            PrivateBookStore(File(context.noBackupFilesDir, "downloaded-books-v1")).remove(appBookId)
            val database = context.getDatabasePath("reading-progress.db")
            if (database.exists()) SQLiteDatabase.openDatabase(database.path, null, SQLiteDatabase.OPEN_READWRITE).use {
                it.delete("reading_positions", "book_id=?", arrayOf(appBookId.value))
            }
        }
        probe.edit().clear().commit()
        readiumPreferences.edit().clear().commit()
        epubFile.delete()
        readiumFile.delete()
        context.deleteDatabase(PROCESS_DATABASE)
        android.util.AtomicFile(catalogFile).delete()
        coverDirectory.deleteRecursively()
        bookDirectory.deleteRecursively()
    }

    private fun fingerprint(file: File): EditionFingerprint =
        file.inputStream().use { EditionFingerprint.calculate(it, 8_000_000) }

    private fun containsParagraph(paragraphs: org.json.JSONArray, target: Int): Boolean =
        (0 until paragraphs.length()).any { paragraphs.getInt(it) == target }

    @Suppress("DEPRECATION")
    private fun assertOfflinePermission() {
        val permissions = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions.orEmpty()
        assertFalse("Reader prototype must not have network permission", permissions.contains("android.permission.INTERNET"))
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(8192)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    companion object {
        private const val PROBE_PREFS = "reader-process-probe-test"
        private const val EPUB_FIXTURE = "epub-process-probe-fixture.epub"
        private const val PROCESS_DATABASE = "reading-progress-process-test.db"
        private val BOOK_ID = CatalogBookId("bk_abcdefghijklmnopqrstuv")
        private val COVER_PATH = CoverPath("/media/shadow-garden/covers/process-fixture.png")
    }
}

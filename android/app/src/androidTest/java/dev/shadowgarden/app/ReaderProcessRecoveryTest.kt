package dev.shadowgarden.app

import android.content.Context
import android.content.pm.PackageManager
import android.os.Process
import android.util.Log
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.security.MessageDigest
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.readium.r2.shared.publication.Locator

/** Two-stage test-only experiment; the shell stops the app between invocations. */
@RunWith(AndroidJUnit4::class)
class ReaderProcessRecoveryTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val context = instrumentation.targetContext
    private val probe by lazy { context.getSharedPreferences(PROBE_PREFS, Context.MODE_PRIVATE) }
    private val epubFile by lazy { File(context.cacheDir, EPUB_FIXTURE) }
    private val readiumFile by lazy { File(context.cacheDir, ReadiumPrototypeActivity.FIXTURE_NAME) }
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
            assertEquals("The EPUB.js fixture must be unchanged", probe.getString("epub_sha256", null), sha256(epubFile))
            assertEquals("The Readium fixture must be unchanged", probe.getString("readium_sha256", null), sha256(readiumFile))
            val cfi = probe.getString("cfi", null) ?: throw AssertionError("Missing selected CFI")
            val currentCfi = probe.getString("epub_current_cfi", null) ?: throw AssertionError("Missing current CFI")
            val expectedEpubParagraph = probe.getInt("epub_paragraph", 0)
            val selectedReadium = probe.getString("readium_selected", null) ?: throw AssertionError("Missing selected Readium locator")
            val currentReadium = probe.getString("readium_current", null) ?: throw AssertionError("Missing current Readium locator")
            val expectedReadiumParagraph = probe.getInt("readium_paragraph", 0)
            assertEquals(currentReadium, readiumPreferences.getString(ReadiumPrototypeActivity.LOCATION, null))

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
            } finally {
                epubScenario.close()
            }
            val readiumHelper = ReadiumPrototypeTest()
            val readiumScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            try {
                val current = readiumHelper.awaitStableViewport(readiumScenario, 0.0, 280, 340)
                assertEquals("Readium current locator must restore the observed paragraph", expectedReadiumParagraph, current.paragraph)
            } finally {
                readiumScenario.close()
            }
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
        probe.edit().clear().commit()
        readiumPreferences.edit().clear().commit()
        epubFile.delete()
        readiumFile.delete()
    }

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
    }
}

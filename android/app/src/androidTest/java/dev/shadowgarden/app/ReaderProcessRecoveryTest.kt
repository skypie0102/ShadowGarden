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

            assertTrue(readiumPreferences.edit().clear()
                .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 280)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 340)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1f).commit())
            val readiumHelper = ReadiumPrototypeTest()
            val readiumScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            try {
                readiumHelper.awaitChapter(readiumScenario, "chapter1.xhtml", "Chapter 1 paragraph 1.")
                readiumScenario.onActivity { assertTrue("Readium must navigate to the selected passage", it.goToPassage()) }
                readiumHelper.awaitVisiblePassage(readiumScenario, 0.0, 280, 340)
                readiumScenario.onActivity { assertTrue("Readium passage locator must be saved", it.savePassage()) }
            } finally {
                readiumScenario.close()
            }
            val saved = readiumPreferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                ?: throw AssertionError("Readium selected locator was not saved")
            assertEquals(ReadiumPrototypeActivity.PASSAGE, Locator.fromJSON(JSONObject(saved))?.text?.highlight)
            assertTrue(probe.edit().putInt("pid", Process.myPid()).putString("cfi", cfi)
                .putString("readium", saved).putString("epub_sha256", sha256(epubFile))
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
            val cfi = probe.getString("cfi", null) ?: throw AssertionError("Missing saved CFI")
            val expectedReadium = probe.getString("readium", null) ?: throw AssertionError("Missing saved Readium locator")
            assertEquals(expectedReadium, readiumPreferences.getString(ReadiumPrototypeActivity.LOCATION, null))

            val epubHelper = EpubPrototypeTest()
            val epubScenario = ActivityScenario.launch(MainActivity::class.java)
            try {
                val web = epubHelper.openHarness(epubScenario, epubFile, cfi, "", "", "epub-layout-restore.html", 280, 340, 100)
                val result = try { epubHelper.awaitResult(web) } finally { epubHelper.closeHarness(epubScenario, web) }
                assertEquals(cfi, result.getString("cfi"))
                assertEquals(ReadiumPrototypeActivity.PASSAGE, result.getString("text"))
                assertTrue("Saved EPUB.js passage must be visible after process termination", result.getBoolean("visible"))
            } finally {
                epubScenario.close()
            }
            val readiumScenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
            try {
                ReadiumPrototypeTest().awaitVisiblePassage(readiumScenario, 0.0, 280, 340)
            } finally {
                readiumScenario.close()
            }
            Log.i("SGReaderProbe", "Process recovery: both selected passages restored in a new process")
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

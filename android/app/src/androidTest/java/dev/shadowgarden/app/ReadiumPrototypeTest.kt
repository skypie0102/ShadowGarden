package dev.shadowgarden.app

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.json.JSONTokener
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.readium.r2.shared.publication.Locator

/** Compares Readium with the EPUB.js test using the same generated fixture. */
@RunWith(AndroidJUnit4::class)
class ReadiumPrototypeTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val appContext = instrumentation.targetContext

    @Test
    fun opensLocalEpubAndRestoresChapterAfterRecreation() {
        runFixture(false, 1, "A quiet second chapter begins here.", 2)
    }

    @Test
    fun opensLongIllustratedEpubAndRestoresFinalChapter() {
        runFixture(true, 11, "Final chapter marker.", 12)
    }

    private fun runFixture(extended: Boolean, chapterIndex: Int, marker: String, tocCount: Int) {
        @Suppress("DEPRECATION")
        val requested = appContext.packageManager.getPackageInfo(
            appContext.packageName, PackageManager.GET_PERMISSIONS
        ).requestedPermissions.orEmpty()
        assertFalse("Prototype app must not have network access", requested.contains("android.permission.INTERNET"))

        val fixture = File(appContext.cacheDir, ReadiumPrototypeActivity.FIXTURE_NAME)
        val preferences = appContext.getSharedPreferences(ReadiumPrototypeActivity.PREFERENCES, Context.MODE_PRIVATE)
        preferences.edit().clear().commit()
        EpubFixture.create(fixture, extended)
        val scenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
        try {
            awaitChapter(scenario, "chapter1.xhtml", if (extended) "Chapter 1 paragraph 1." else "This is a generated technical fixture.")
            scenario.onActivity { assertEquals(tocCount, it.tableOfContentsSize()) }
            scenario.onActivity { assertTrue("Readium should accept the chapter navigation", it.goToChapter(chapterIndex)) }
            val href = "chapter${chapterIndex + 1}.xhtml"
            val before = awaitChapter(scenario, href, marker, extended)
            scenario.onActivity { assertTrue("Locator should be saved", it.saveLocation()) }
            val savedJson = preferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                ?: throw AssertionError("Readium locator was not saved")
            val saved = Locator.fromJSON(JSONObject(savedJson))
                ?: throw AssertionError("Saved Readium locator could not be parsed")
            assertEquals(before.href, saved.href)

            scenario.recreate()

            val restored = awaitChapter(scenario, href, marker, extended)
            assertEquals("Restored locator should target the saved resource", saved.href, restored.href)
            assertEquals("Restored locator should retain resource progression", saved.locations.progression, restored.locations.progression)
        } finally {
            scenario.close()
            preferences.edit().clear().commit()
            fixture.delete()
        }
    }

    private fun awaitChapter(
        scenario: ActivityScenario<ReadiumPrototypeActivity>, href: String, text: String, requireImage: Boolean = false
    ): Locator {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        var lastState = "not started"
        while (SystemClock.elapsedRealtime() < deadline) {
            val locator = AtomicReference<Locator?>()
            val failure = AtomicReference<String?>()
            val texts = CopyOnWriteArrayList<String>()
            val latch = AtomicReference<CountDownLatch>()
            scenario.onActivity { activity ->
                failure.set(activity.failure)
                locator.set(activity.navigator?.currentLocator?.value)
                val views = visibleWebViews(activity.window.decorView)
                val pending = CountDownLatch(views.size)
                latch.set(pending)
                views.forEach { webView ->
                    webView.evaluateJavascript("JSON.stringify({text: document.body ? document.body.innerText : '', image: !!(document.querySelector('img') && document.querySelector('img').complete && document.querySelector('img').naturalWidth > 0)})") { result ->
                        val value = runCatching { JSONTokener(result).nextValue() }.getOrNull()
                        val document = if (value is String) runCatching { JSONObject(value) }.getOrNull() else null
                        if (document != null && (!requireImage || document.optBoolean("image"))) texts.add(document.optString("text"))
                        pending.countDown()
                    }
                }
            }
            failure.get()?.let { throw AssertionError("Readium could not open the fixture: $it") }
            assertTrue("Reading WebView text timed out", latch.get().await(5, TimeUnit.SECONDS))
            val current = locator.get()
            lastState = "locator=${current?.href}; visible WebViews=${texts.size}"
            if (current != null && current.href.toString().endsWith(href) && texts.any { it.contains(text) }) return current
            SystemClock.sleep(100)
        }
        throw AssertionError("Readium did not render $href: $lastState")
    }

    private fun visibleWebViews(root: View): List<WebView> {
        val result = mutableListOf<WebView>()
        fun visit(view: View) {
            if (view is WebView && view.isShown && view.getGlobalVisibleRect(Rect())) result.add(view)
            if (view is ViewGroup) for (index in 0 until view.childCount) visit(view.getChildAt(index))
        }
        visit(root)
        return result
    }
}

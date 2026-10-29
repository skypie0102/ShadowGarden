package dev.shadowgarden.app

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.SystemClock
import android.util.Log
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
import org.junit.Ignore
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

    @Test
    fun restoresPassageAfterFontAndViewportChange() {
        val fixture = File(appContext.cacheDir, ReadiumPrototypeActivity.FIXTURE_NAME)
        val preferences = appContext.getSharedPreferences(ReadiumPrototypeActivity.PREFERENCES, Context.MODE_PRIVATE)
        preferences.edit().clear()
            .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 280)
            .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 340)
            .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1f).commit()
        EpubFixture.create(fixture, true)
        val scenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
        try {
            awaitChapter(scenario, "chapter1.xhtml", "Chapter 1 paragraph 1.")
            scenario.onActivity { assertTrue("Readium should accept passage navigation", it.goToPassage()) }
            val initialFontSize = awaitVisiblePassage(scenario, 0.0, 280, 340)
            scenario.onActivity { assertTrue("Selected passage should be saved", it.savePassage()) }
            val saved = preferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                ?: throw AssertionError("Passage locator was not saved")
            assertEquals(ReadiumPrototypeActivity.PASSAGE, Locator.fromJSON(JSONObject(saved))?.text?.highlight)
            assertTrue(preferences.edit()
                .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 220)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 260)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1.6f).commit())
            scenario.recreate()
            awaitVisiblePassage(scenario, initialFontSize * 1.4, 220, 260)
        } finally {
            scenario.close()
            preferences.edit().clear().commit()
            fixture.delete()
        }
    }

    @Ignore("Known passage visibility failure after reflow; see Android reader evaluation")
    @Test
    fun restoresCapturedCurrentLocationAfterLayoutChange() {
        val fixture = File(appContext.cacheDir, ReadiumPrototypeActivity.FIXTURE_NAME)
        val preferences = appContext.getSharedPreferences(ReadiumPrototypeActivity.PREFERENCES, Context.MODE_PRIVATE)
        preferences.edit().clear()
            .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 280)
            .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 340)
            .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1f).commit()
        EpubFixture.create(fixture, true)
        val scenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
        try {
            awaitChapter(scenario, "chapter1.xhtml", "Chapter 1 paragraph 1.")
            scenario.onActivity { assertTrue("Passage navigation should be accepted", it.goToPassage()) }
            val initialFontSize = awaitVisiblePassage(scenario, 0.0, 280, 340)
            // Wait for Readium to report a location inside the target resource,
            // rather than persisting its earlier chapter-start state.
            val deadline = SystemClock.elapsedRealtime() + 15_000
            var current: Locator? = null
            while (SystemClock.elapsedRealtime() < deadline) {
                scenario.onActivity { current = it.navigator?.currentLocator?.value }
                if (current?.href.toString().endsWith("chapter12.xhtml") &&
                    (current?.locations?.progression ?: 0.0) > 0.05) break
                SystemClock.sleep(100)
            }
            assertTrue("Readium should report a position inside chapter twelve: $current",
                current?.href.toString().endsWith("chapter12.xhtml") &&
                    (current?.locations?.progression ?: 0.0) > 0.05)
            scenario.onActivity { assertTrue("Current location should be saved", it.saveLocation()) }
            val saved = preferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                ?.let { Locator.fromJSON(JSONObject(it)) }
                ?: throw AssertionError("Current locator was not saved")
            assertTrue("Saved location must target chapter twelve", saved.href.toString().endsWith("chapter12.xhtml"))
            assertTrue("Saved location must be inside the chapter", (saved.locations.progression ?: 0.0) > 0.05)
            assertTrue(preferences.edit()
                .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 220)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 260)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1.6f).commit())
            scenario.recreate()
            awaitVisiblePassage(scenario, initialFontSize * 1.4, 220, 260)
        } finally {
            scenario.close()
            preferences.edit().clear().commit()
            fixture.delete()
        }
    }

    /** Records page-start observations; it does not claim exact passage recovery. */
    @Test
    fun observesCurrentLocationAcrossLayoutChanges() {
        val fixture = File(appContext.cacheDir, ReadiumPrototypeActivity.FIXTURE_NAME)
        val preferences = appContext.getSharedPreferences(ReadiumPrototypeActivity.PREFERENCES, Context.MODE_PRIVATE)
        preferences.edit().clear()
            .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 280)
            .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 340)
            .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1f).commit()
        EpubFixture.create(fixture, true)
        val scenario = ActivityScenario.launch(ReadiumPrototypeActivity::class.java)
        try {
            awaitChapter(scenario, "chapter1.xhtml", "Chapter 1 paragraph 1.")
            scenario.onActivity { assertTrue("Passage navigation should be accepted", it.goToPassage()) }
            awaitVisiblePassage(scenario, 0.0, 280, 340)
            val before = awaitStableViewport(scenario, 0.0, 280, 340)
            scenario.onActivity { assertTrue("Current location should be saved", it.saveLocation()) }
            val saved = preferences.getString(ReadiumPrototypeActivity.LOCATION, null)
                ?.let { Locator.fromJSON(JSONObject(it)) }
                ?: throw AssertionError("Current locator was not saved")
            assertEquals("The saved sample must match the observed stable locator", before.locator.href, saved.href)
            assertEquals(before.locator.locations.progression, saved.locations.progression)
            Log.i("SGReaderProbe", "Before recreation: paragraph=${before.paragraph}; saved=${saved.toJSON()}")

            scenario.recreate()
            val same = awaitStableViewport(scenario, 0.0, 280, 340)
            Log.i("SGReaderProbe", "Same layout: paragraph=${same.paragraph}; locator=${same.locator.toJSON()}")
            assertTrue(preferences.edit()
                .putInt(ReadiumPrototypeActivity.VIEWPORT_WIDTH, 220)
                .putInt(ReadiumPrototypeActivity.VIEWPORT_HEIGHT, 260)
                .putFloat(ReadiumPrototypeActivity.FONT_SIZE, 1.6f).commit())
            scenario.recreate()
            val changed = awaitStableViewport(scenario, before.fontSize * 1.4, 220, 260)
            // Only generated paragraph numbers and relative positions are logged.
            Log.i("SGReaderProbe", "Readium current locator: before=${before.paragraph}, " +
                "same=${same.paragraph}, changed=${changed.paragraph}; " +
                "progress=${saved.locations.progression}; sameProgress=${same.locator.locations.progression}; " +
                "changedProgress=${changed.locator.locations.progression}")
        } finally {
            scenario.close()
            preferences.edit().clear().commit()
            fixture.delete()
        }
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

    private fun awaitVisiblePassage(
        scenario: ActivityScenario<ReadiumPrototypeActivity>, minimumFontSize: Double, widthDp: Int, heightDp: Int
    ): Double {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        var lastState = "not started"
        while (SystemClock.elapsedRealtime() < deadline) {
            val states = CopyOnWriteArrayList<String>()
            val failure = AtomicReference<String?>()
            val pendingRef = AtomicReference<CountDownLatch>()
            val viewport = AtomicReference<String>()
            val locator = AtomicReference<Locator?>()
            scenario.onActivity { activity ->
                failure.set(activity.failure)
                locator.set(activity.navigator?.currentLocator?.value)
                val container = activity.findViewById<View>(R.id.readium_prototype_container)
                val density = activity.resources.displayMetrics.density
                viewport.set("${container.width}x${container.height}; expected=${(widthDp * density).toInt()}x${(heightDp * density).toInt()}")
                val dimensionsMatch = container.width == (widthDp * density).toInt() && container.height == (heightDp * density).toInt()
                val views = visibleWebViews(container)
                val pending = CountDownLatch(views.size)
                pendingRef.set(pending)
                views.forEach { webView ->
                    val clip = Rect()
                    webView.getGlobalVisibleRect(clip)
                    val screen = IntArray(2)
                    webView.getLocationOnScreen(screen)
                    val left = (clip.left - screen[0]).toDouble() / webView.width
                    val top = (clip.top - screen[1]).toDouble() / webView.height
                    val right = (clip.right - screen[0]).toDouble() / webView.width
                    val bottom = (clip.bottom - screen[1]).toDouble() / webView.height
                    val script = """JSON.stringify((function() {
                        const p = Array.from(document.querySelectorAll('p')).find(e => e.textContent.includes('Chapter 12 paragraph 40.'));
                        if (!p || !p.firstChild) return {found: false};
                        const range = document.createRange(); range.setStart(p.firstChild, 0); range.setEnd(p.firstChild, 24);
                        const rects = Array.from(range.getClientRects());
                        const visible = rects.some(r => r.right > innerWidth * $left && r.left < innerWidth * $right &&
                          r.bottom > innerHeight * $top && r.top < innerHeight * $bottom);
                        return {found: true, text: range.toString(), visible: visible,
                          fontSize: parseFloat(getComputedStyle(p).fontSize), width: innerWidth, height: innerHeight, rects: rects.map(r => [r.left,r.top,r.right,r.bottom])};
                    })())""".trimIndent()
                    webView.evaluateJavascript(script) { result ->
                        val value = runCatching { JSONTokener(result).nextValue() }.getOrNull()
                        val document = if (value is String) runCatching { JSONObject(value) }.getOrNull() else null
                        if (document != null) {
                            document.put("dimensionsMatch", dimensionsMatch)
                            states.add(document.toString())
                        }
                        pending.countDown()
                    }
                }
            }
            failure.get()?.let { throw AssertionError("Readium could not open the fixture: $it") }
            assertTrue("Reading WebView timed out", pendingRef.get().await(5, TimeUnit.SECONDS))
            lastState = "locator=${locator.get()?.href}; viewport=${viewport.get()}; views=$states"
            val found = states.map(::JSONObject).firstOrNull {
                it.optBoolean("dimensionsMatch") && it.optDouble("fontSize", 0.0) > minimumFontSize &&
                    it.optString("text") == ReadiumPrototypeActivity.PASSAGE && it.optBoolean("visible")
            }
            if (locator.get()?.href.toString().endsWith("chapter12.xhtml") && found != null) {
                return found.getDouble("fontSize")
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("Passage not visible at expected layout: $lastState")
    }

    private data class ViewportSample(val locator: Locator, val paragraph: Int, val fontSize: Double)

    private fun awaitStableViewport(
        scenario: ActivityScenario<ReadiumPrototypeActivity>, minimumFontSize: Double, widthDp: Int, heightDp: Int
    ): ViewportSample {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        var previous: ViewportSample? = null
        var stableSince = 0L
        var lastState = "not started"
        while (SystemClock.elapsedRealtime() < deadline) {
            val states = CopyOnWriteArrayList<String>()
            val failure = AtomicReference<String?>()
            val locator = AtomicReference<Locator?>()
            val pendingRef = AtomicReference<CountDownLatch>()
            val viewport = AtomicReference<String>()
            scenario.onActivity { activity ->
                failure.set(activity.failure)
                locator.set(activity.navigator?.currentLocator?.value)
                val container = activity.findViewById<View>(R.id.readium_prototype_container)
                val density = activity.resources.displayMetrics.density
                val dimensionsMatch = container.width == (widthDp * density).toInt() && container.height == (heightDp * density).toInt()
                viewport.set("${container.width}x${container.height}")
                val views = visibleWebViews(container)
                val pending = CountDownLatch(views.size)
                pendingRef.set(pending)
                views.forEach { webView ->
                    val clip = Rect()
                    webView.getGlobalVisibleRect(clip)
                    val screen = IntArray(2)
                    webView.getLocationOnScreen(screen)
                    val left = (clip.left - screen[0]).toDouble() / webView.width
                    val top = (clip.top - screen[1]).toDouble() / webView.height
                    val right = (clip.right - screen[0]).toDouble() / webView.width
                    val bottom = (clip.bottom - screen[1]).toDouble() / webView.height
                    val script = """JSON.stringify((function() {
                        const ps = Array.from(document.querySelectorAll('p'));
                        for (const p of ps) {
                          const match = /^Chapter 12 paragraph (\d+)\./.exec(p.textContent);
                          if (!match || !p.firstChild) continue;
                          const range = document.createRange();
                          range.setStart(p.firstChild, 0); range.setEnd(p.firstChild, match[0].length);
                          const visible = Array.from(range.getClientRects()).some(r =>
                            r.right > innerWidth * $left && r.left < innerWidth * $right &&
                            r.bottom > innerHeight * $top && r.top < innerHeight * $bottom);
                          if (visible) return {paragraph: Number(match[1]), fontSize: parseFloat(getComputedStyle(p).fontSize)};
                        }
                        return {};
                    })())""".trimIndent()
                    webView.evaluateJavascript(script) { result ->
                        val value = runCatching { JSONTokener(result).nextValue() }.getOrNull()
                        val document = if (value is String) runCatching { JSONObject(value) }.getOrNull() else null
                        if (document != null) {
                            document.put("dimensionsMatch", dimensionsMatch)
                            states.add(document.toString())
                        }
                        pending.countDown()
                    }
                }
            }
            failure.get()?.let { throw AssertionError("Readium could not open the fixture: $it") }
            assertTrue("Reading WebView timed out", pendingRef.get().await(5, TimeUnit.SECONDS))
            val current = locator.get()
            lastState = "locator=$current; viewport=${viewport.get()}; views=$states"
            val found = states.map(::JSONObject).firstOrNull {
                it.optBoolean("dimensionsMatch") && it.optInt("paragraph") in 1..80 &&
                    it.optDouble("fontSize", 0.0) > minimumFontSize
            }
            val sample = if (current != null && current.href.toString().endsWith("chapter12.xhtml") &&
                (current.locations.progression ?: 0.0) > 0.05 && found != null) {
                ViewportSample(current, found.getInt("paragraph"), found.getDouble("fontSize"))
            } else null
            if (sample != null && previous?.paragraph == sample.paragraph &&
                previous.locator.locations.progression == sample.locator.locations.progression) {
                if (SystemClock.elapsedRealtime() - stableSince >= 600) return sample
            } else {
                previous = sample
                stableSince = SystemClock.elapsedRealtime()
            }
            SystemClock.sleep(100)
        }
        throw AssertionError("No stable viewport sample: $lastState")
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

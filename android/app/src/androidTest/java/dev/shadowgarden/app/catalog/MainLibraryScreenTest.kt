package dev.shadowgarden.app.catalog

import androidx.compose.material3.MaterialTheme
import android.graphics.Bitmap
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainLibraryScreenTest {
    @get:Rule val composeRule = createComposeRule()
    private val calls = AtomicInteger()
    private val fixture = listOf(
        CatalogSeries("s1", "First Series", "An Author", "Complete", listOf(
            CatalogVolume(CatalogBookId("bk_aaaaaaaaaaaaaaaaaaaaaa"), "Special Volume"),
            CatalogVolume(CatalogBookId("bk_bbbbbbbbbbbbbbbbbbbbbb"), "Another Volume"))),
        CatalogSeries("s2", "Second Series", "Other Author", "Ongoing", emptyList())
    )

    @Test fun searchFindsVolumeTitlesAndSeriesOpensItsVolumes() {
        val model = model(CatalogSource { fixture })
        show(model)
        composeRule.waitUntil(20_000) { model.state.value.series != null }
        scrollTo("Search titles, authors, and volumes")
        composeRule.onNodeWithText("Search titles, authors, and volumes").performTextInput("Special Volume")
        scrollTo("First Series · An Author · 2 volumes")
        composeRule.onNodeWithText("First Series · An Author · 2 volumes").performClick()
        composeRule.onNodeWithText("First Series").assertIsDisplayed()
        scrollDetailTo("Special Volume")
        composeRule.onNodeWithText("Special Volume").assertIsDisplayed()
        scrollDetailTo("Another Volume")
        composeRule.onNodeWithText("Another Volume").assertIsDisplayed()
        scrollDetailTo("Back to Main library")
        composeRule.onNodeWithText("Back to Main library").performClick()
        assertEquals("Special Volume", model.state.value.query)
    }

    @Test fun offlineFiltersAndSortSurviveDetailNavigationAndCanBeCleared() {
        val model = model(CatalogSource { throw IOException("offline") }, FakeCache(fixture))
        show(model)
        composeRule.waitUntil(20_000) { !model.state.value.loading && model.state.value.fromCache }
        scrollTo("Volumes: All")
        composeRule.onNodeWithText("Volumes: All").performClick()
        composeRule.onNodeWithText("2–5 volumes").performClick()
        scrollTo("Sort: Catalog order")
        composeRule.onNodeWithText("Sort: Catalog order").performClick()
        composeRule.onNodeWithText("Title Z–A").performClick()
        scrollTo("First Series · An Author · 2 volumes")
        composeRule.onNodeWithText("First Series · An Author · 2 volumes").performClick()
        composeRule.onNodeWithText("Back to Main library").performClick()
        assertEquals(VolumeFilter.TWO_TO_FIVE, model.state.value.volumeFilter)
        assertEquals(LibrarySort.TITLE_DESC, model.state.value.sort)
        scrollTo("Search titles, authors, and volumes")
        composeRule.onNodeWithText("Search titles, authors, and volumes").performTextInput("no match")
        scrollTo("No matching series.")
        composeRule.onNodeWithText("No matching series.").assertIsDisplayed()
        scrollTo("Clear filters")
        composeRule.onNodeWithText("Clear filters").performClick()
        assertEquals("", model.state.value.query)
        assertEquals(VolumeFilter.ALL, model.state.value.volumeFilter)
        assertEquals(LibrarySort.TITLE_DESC, model.state.value.sort)
        scrollTo("Second Series · Other Author · 0 volumes")
        composeRule.onNodeWithText("Second Series · Other Author · 0 volumes").assertIsDisplayed()
    }

    @Test fun failedRefreshKeepsLastSuccessfulCatalog() {
        val model = model(CatalogSource {
            if (calls.incrementAndGet() == 1) fixture else throw IOException("offline fixture")
        })
        show(model)
        composeRule.waitUntil(20_000) { model.state.value.series != null }
        scrollTo("Refresh library")
        composeRule.onNodeWithText("Refresh library").performClick()
        composeRule.waitUntil(20_000) { model.state.value.error != null }
        scrollTo("Could not refresh. Showing the previously loaded library.")
        composeRule.onNodeWithText("Could not refresh. Showing the previously loaded library.").assertIsDisplayed()
        assertEquals(fixture, model.state.value.series)
    }

    @Test fun emptyAndOfflineAreDistinct() {
        val model = model(CatalogSource {
            if (calls.incrementAndGet() == 1) throw IOException("offline fixture") else emptyList()
        })
        show(model)
        composeRule.waitUntil(20_000) { model.state.value.error != null }
        scrollTo("Could not load the Main library. Check your connection and try again.")
        composeRule.onNodeWithText("Could not load the Main library. Check your connection and try again.").assertIsDisplayed()
        scrollTo("Refresh library")
        composeRule.onNodeWithText("Refresh library").performClick()
        composeRule.waitUntil(20_000) { model.state.value.series != null }
        scrollTo("The Main library is empty.")
        composeRule.onNodeWithText("The Main library is empty.").assertIsDisplayed()
    }

    @Test fun selectedSeriesShowsLoadingWhileANewModelLoads() {
        val current = mutableStateOf(model(CatalogSource { fixture }))
        composeRule.setContent { MaterialTheme { MainLibraryScreen(current.value) {} } }
        composeRule.waitUntil(20_000) { current.value.state.value.series != null }
        scrollTo("First Series · An Author · 2 volumes")
        composeRule.onNodeWithText("First Series · An Author · 2 volumes").performClick()
        composeRule.onNodeWithText("First Series").assertIsDisplayed()
        val gate = CountDownLatch(1)
        try {
            val reloading = model(CatalogSource { gate.await(30, TimeUnit.SECONDS); fixture })
            composeRule.runOnUiThread { current.value = reloading }
            composeRule.onNodeWithText("Loading Main library…").assertIsDisplayed()
            composeRule.onNodeWithText("This series is no longer available in the loaded library.").assertDoesNotExist()
            gate.countDown()
            composeRule.waitUntil(20_000) { reloading.state.value.series != null }
            composeRule.onNodeWithText("First Series").assertIsDisplayed()
        } finally { gate.countDown() }
    }

    @Test fun savedCatalogIsVisibleOfflineAndMarkedAsPotentiallyOutdated() {
        val cache = FakeCache(fixture)
        val model = model(CatalogSource { throw IOException("offline fixture") }, cache)
        show(model)
        composeRule.waitUntil(20_000) { !model.state.value.loading && model.state.value.fromCache }
        scrollTo("Showing saved Main library; it may be out of date.")
        composeRule.onNodeWithText("Showing saved Main library; it may be out of date.").assertIsDisplayed()
        scrollTo("Search titles, authors, and volumes")
        composeRule.onNodeWithText("Search titles, authors, and volumes").performTextInput("Special Volume")
        scrollTo("First Series · An Author · 2 volumes")
        composeRule.onNodeWithText("First Series · An Author · 2 volumes").performClick()
        composeRule.onNodeWithText("Showing saved Main library; it may be out of date.").assertIsDisplayed()
        assertEquals(fixture, model.state.value.series)
    }

    @Test fun successfulRefreshReplacesSavedCatalog() {
        val gate = CountDownLatch(1)
        val cache = FakeCache(fixture)
        val replacement = listOf(CatalogSeries("new", "Fresh Series", "", "Ongoing", emptyList()))
        try {
            val model = model(CatalogSource { gate.await(30, TimeUnit.SECONDS); replacement }, cache)
            show(model)
            composeRule.waitUntil(20_000) { model.state.value.fromCache }
            scrollTo("Showing saved Main library; it may be out of date.")
            composeRule.onNodeWithText("Showing saved Main library; it may be out of date.").assertIsDisplayed()
            gate.countDown()
            composeRule.waitUntil(20_000) { !model.state.value.loading }
            assertEquals(replacement, cache.data)
            assertEquals(replacement, model.state.value.series)
            assertEquals(false, model.state.value.fromCache)
        } finally { gate.countDown() }
    }

    @Test fun saveFailureKeepsLiveResultsAndReportsOfflineLimitation() {
        val cache = FakeCache(fixture, failWrite = true)
        val fresh = listOf(CatalogSeries("new", "Fresh Series", "", "Ongoing", emptyList()))
        val model = model(CatalogSource { fresh }, cache)
        show(model)
        composeRule.waitUntil(20_000) { !model.state.value.loading }
        scrollTo("Loaded the Main library, but could not save it for offline use.")
        composeRule.onNodeWithText("Loaded the Main library, but could not save it for offline use.").assertIsDisplayed()
        assertEquals(fresh, model.state.value.series)
        assertEquals(fixture, cache.data)
    }

    @Test fun corruptSavedCatalogAndOfflineNetworkAreReported() {
        val model = model(CatalogSource { throw IOException("offline") }, FakeCache(null, failRead = true))
        show(model)
        composeRule.waitUntil(20_000) { !model.state.value.loading }
        scrollTo("Could not load the Main library or read its saved copy. Check your connection and try again.")
        composeRule.onNodeWithText("Could not load the Main library or read its saved copy. Check your connection and try again.").assertIsDisplayed()
        assertEquals(null, model.state.value.series)
    }

    @Test fun refreshRetriesASavedCatalogAfterATemporaryReadFailure() {
        val cache = FakeCache(fixture, failRead = true)
        val model = model(CatalogSource { throw IOException("offline") }, cache)
        show(model)
        composeRule.waitUntil(20_000) { !model.state.value.loading }
        assertEquals(null, model.state.value.series)
        cache.failRead = false
        scrollTo("Refresh library")
        composeRule.onNodeWithText("Refresh library").performClick()
        composeRule.waitUntil(20_000) { !model.state.value.loading && model.state.value.fromCache }
        scrollTo("First Series · An Author · 2 volumes")
        composeRule.onNodeWithText("First Series · An Author · 2 volumes").assertIsDisplayed()
    }

    @Test fun coverAndFallbackRemainUsableInTheLibrary() {
        val valid = CoverPath("/media/shadow-garden/covers/fixture.png")
        val unavailable = CoverPath("/media/shadow-garden/covers/unavailable.png")
        val image = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        val entries = listOf(fixture[0].copy(cover = valid), fixture[1].copy(cover = unavailable))
        val model = model(CatalogSource { entries }, covers = CoverSource { path -> if (path == valid) image else null })
        show(model)
        composeRule.waitUntil(20_000) { model.state.value.series != null }
        scrollTo("First Series · An Author · 2 volumes")
        composeRule.waitUntil(20_000) {
            composeRule.onAllNodesWithTag("cover-loaded", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("First Series · An Author · 2 volumes").performClick()
        composeRule.onNodeWithText("First Series").assertIsDisplayed()
        composeRule.waitUntil(20_000) {
            composeRule.onAllNodesWithTag("cover-loaded", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
        scrollDetailTo("Back to Main library")
        composeRule.onNodeWithText("Back to Main library").performClick()
        scrollTo("Second Series · Other Author · 0 volumes")
        composeRule.onNodeWithText("Second Series · Other Author · 0 volumes").performClick()
        composeRule.onNodeWithText("Second Series").assertIsDisplayed()
        composeRule.waitUntil(20_000) {
            composeRule.onAllNodesWithTag("cover-placeholder", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
        }
    }

    @Test fun savedCoverIsShownWhileItsRefreshIsStillWaiting() {
        val valid = CoverPath("/media/shadow-garden/covers/cached.png")
        val bitmap = Bitmap.createBitmap(2, 2, Bitmap.Config.ARGB_8888)
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val covers = object : CoverSource {
            override suspend fun cached(path: CoverPath): Bitmap? = bitmap
            override suspend fun load(path: CoverPath): Bitmap? = withContext(Dispatchers.IO) {
                entered.countDown()
                release.await(20, TimeUnit.SECONDS)
                null
            }
        }
        try {
            val model = model(CatalogSource { listOf(fixture[0].copy(cover = valid)) }, covers = covers)
            show(model)
            composeRule.waitUntil(20_000) { model.state.value.series != null }
            scrollTo("First Series · An Author · 2 volumes")
            composeRule.waitUntil(20_000) {
                composeRule.onAllNodesWithTag("cover-loaded", useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()
            }
            assertEquals(true, entered.await(5, TimeUnit.SECONDS))
        } finally { release.countDown() }
    }

    private fun model(source: CatalogSource, cache: MainCatalogCache = NoTestCache,
                      covers: CoverSource = CoverSource { null }): LibraryViewModel {
        lateinit var model: LibraryViewModel
        InstrumentationRegistry.getInstrumentation().runOnMainSync { model = LibraryViewModel(source, cache, covers) }
        return model
    }
    private object NoTestCache : MainCatalogCache {
        override fun read(): List<CatalogSeries>? = null
        override fun write(series: List<CatalogSeries>) = Unit
    }
    private class FakeCache(var data: List<CatalogSeries>?, @Volatile var failRead: Boolean = false, val failWrite: Boolean = false) : MainCatalogCache {
        override fun read(): List<CatalogSeries>? {
            if (failRead) throw IOException("damaged fixture")
            return data
        }
        override fun write(series: List<CatalogSeries>) {
            if (failWrite) throw IOException("storage failure")
            data = series
        }
    }
    private fun show(model: LibraryViewModel) = composeRule.setContent { MaterialTheme { MainLibraryScreen(model) {} } }
    private fun scrollTo(text: String) {
        composeRule.onNodeWithTag("main-library-list").performScrollToNode(hasText(text))
    }
    private fun scrollDetailTo(text: String) {
        composeRule.onNodeWithTag("series-detail-list").performScrollToNode(hasText(text))
    }
}

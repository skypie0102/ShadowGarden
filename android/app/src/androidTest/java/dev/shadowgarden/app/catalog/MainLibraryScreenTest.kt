package dev.shadowgarden.app.catalog

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.IOException
import java.util.concurrent.atomic.AtomicInteger
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
        composeRule.onNodeWithText("Special Volume").assertIsDisplayed()
        composeRule.onNodeWithText("Another Volume").assertIsDisplayed()
        composeRule.onNodeWithText("Back to Main library").performClick()
        assertEquals("Special Volume", model.state.value.query)
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

    private fun model(source: CatalogSource): LibraryViewModel {
        lateinit var model: LibraryViewModel
        InstrumentationRegistry.getInstrumentation().runOnMainSync { model = LibraryViewModel(source) }
        return model
    }
    private fun show(model: LibraryViewModel) = composeRule.setContent { MaterialTheme { MainLibraryScreen(model) {} } }
    private fun scrollTo(text: String) {
        composeRule.onNodeWithTag("main-library-list").performScrollToNode(hasText(text))
    }
}

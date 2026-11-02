package dev.shadowgarden.app.catalog

import android.util.AtomicFile
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
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
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LibraryPreferencesTest {
    @get:Rule val composeRule = createComposeRule()
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test fun screenRestoresFilterAndSortWithoutPersistingSearch() {
        val file = File(context.filesDir, "library-preferences-test-${UUID.randomUUID()}")
        val store = PrivateLibraryPreferencesStore(file)
        var current by mutableStateOf(model(store))
        try {
            composeRule.setContent { MaterialTheme { MainLibraryScreen(current, {}) } }
            composeRule.waitUntil(20_000) { !current.state.value.preferencesLoading && current.state.value.series != null }
            scrollTo("Volumes: All")
            composeRule.onNodeWithText("Volumes: All").performClick()
            composeRule.onNodeWithText("2–5 volumes").performClick()
            scrollTo("Sort: Catalog order")
            composeRule.onNodeWithText("Sort: Catalog order").performClick()
            composeRule.onNodeWithText("Title Z–A").performClick()
            composeRule.waitUntil(20_000) { !current.state.value.preferencesSaving }
            assertEquals(LibraryPreferences(VolumeFilter.TWO_TO_FIVE, LibrarySort.TITLE_DESC), store.read())
            scrollTo("Search titles, authors, and volumes")
            composeRule.onNodeWithText("Search titles, authors, and volumes").performTextInput("temporary search")
            val reopened = model(PrivateLibraryPreferencesStore(file))
            composeRule.runOnIdle { current = reopened }
            composeRule.waitUntil(20_000) { !reopened.state.value.preferencesLoading }
            assertEquals("", reopened.state.value.query)
            assertEquals(VolumeFilter.TWO_TO_FIVE, reopened.state.value.volumeFilter)
            assertEquals(LibrarySort.TITLE_DESC, reopened.state.value.sort)
            scrollTo("Volumes: 2–5 volumes")
            composeRule.onNodeWithText("Volumes: 2–5 volumes").assertIsDisplayed()
            scrollTo("Sort: Title Z–A")
            composeRule.onNodeWithText("Sort: Title Z–A").assertIsDisplayed()
        } finally { AtomicFile(file).delete() }
    }

    @Test fun unreadableSettingsArePreservedAndRetryMergesSessionChoice() {
        val file = File(context.filesDir, "library-preferences-test-${UUID.randomUUID()}")
        val unknown = "future preferences format".toByteArray()
        file.writeBytes(unknown)
        val store = PrivateLibraryPreferencesStore(file)
        val model = model(store)
        try {
            composeRule.setContent { MaterialTheme { MainLibraryScreen(model, {}) } }
            composeRule.waitUntil(20_000) { model.state.value.preferencesError != null }
            val error = "Could not load library settings. Changes for this session will not be saved."
            composeRule.onNodeWithText(error).assertIsDisplayed()
            scrollTo("Volumes: All")
            composeRule.onNodeWithText("Volumes: All").performClick()
            composeRule.onNodeWithText("2–5 volumes").performClick()
            composeRule.waitForIdle()
            assertArrayEquals(unknown, file.readBytes())
            store.write(LibraryPreferences(VolumeFilter.ONE, LibrarySort.AUTHOR_ASC))
            composeRule.onNodeWithText("Retry library settings").performClick()
            composeRule.waitUntil(20_000) { !model.state.value.preferencesLoading && !model.state.value.preferencesSaving && model.state.value.preferencesError == null &&
                runCatching { store.read() }.getOrNull() == LibraryPreferences(VolumeFilter.TWO_TO_FIVE, LibrarySort.AUTHOR_ASC) }
            assertEquals(LibraryPreferences(VolumeFilter.TWO_TO_FIVE, LibrarySort.AUTHOR_ASC), store.read())
        } finally { AtomicFile(file).delete() }
    }

    @Test fun failedWriteCanBeRetriedAndRapidChangesKeepTheLatest() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val first = AtomicBoolean(true)
        val written = AtomicReference(LibraryPreferences())
        val store = object : LibraryPreferencesStore {
            override fun read() = LibraryPreferences()
            override fun write(preferences: LibraryPreferences) {
                if (first.getAndSet(false)) {
                    entered.countDown()
                    if (!release.await(30, TimeUnit.SECONDS)) throw IOException("fixture timeout")
                    throw IOException("fixture failure")
                }
                written.set(preferences)
            }
        }
        val model = model(store)
        try {
            composeRule.setContent { MaterialTheme { MainLibraryScreen(model, {}) } }
            composeRule.waitUntil(20_000) { !model.state.value.preferencesLoading }
            composeRule.runOnIdle { model.filterVolumes(VolumeFilter.ONE) }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            composeRule.runOnIdle {
                model.sortBy(LibrarySort.AUTHOR_DESC)
                model.filterVolumes(VolumeFilter.SIX_TO_TEN)
            }
            release.countDown()
            composeRule.waitUntil(20_000) { !model.state.value.preferencesSaving }
            assertEquals(LibraryPreferences(VolumeFilter.SIX_TO_TEN, LibrarySort.AUTHOR_DESC), written.get())
            assertEquals(null, model.state.value.preferencesError)
        } finally { release.countDown() }
    }

    @Test fun failedLatestWriteIsShownAndRetrySavesIt() {
        val fail = AtomicBoolean(true)
        val written = AtomicReference(LibraryPreferences())
        val store = object : LibraryPreferencesStore {
            override fun read() = LibraryPreferences()
            override fun write(preferences: LibraryPreferences) {
                if (fail.get()) throw IOException("fixture failure")
                written.set(preferences)
            }
        }
        val model = model(store)
        composeRule.setContent { MaterialTheme { MainLibraryScreen(model, {}) } }
        composeRule.waitUntil(20_000) { !model.state.value.preferencesLoading }
        composeRule.runOnIdle { model.sortBy(LibrarySort.VOLUMES_DESC) }
        composeRule.waitUntil(20_000) { model.state.value.preferencesError != null }
        val error = "Could not save library settings. Your choices are in use for this session."
        composeRule.onNodeWithText(error).assertIsDisplayed()
        fail.set(false)
        composeRule.onNodeWithText("Retry library settings").performClick()
        composeRule.waitUntil(20_000) { !model.state.value.preferencesSaving && model.state.value.preferencesError == null }
        assertEquals(LibraryPreferences(VolumeFilter.ALL, LibrarySort.VOLUMES_DESC), written.get())
    }

    @Test fun changeWhileLoadingDoesNotOverwriteTheOtherSavedChoice() {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val written = AtomicReference(LibraryPreferences(VolumeFilter.ONE, LibrarySort.TITLE_ASC))
        val store = object : LibraryPreferencesStore {
            override fun read(): LibraryPreferences {
                entered.countDown()
                if (!release.await(30, TimeUnit.SECONDS)) throw IOException("fixture timeout")
                return LibraryPreferences(VolumeFilter.ONE, LibrarySort.TITLE_ASC)
            }
            override fun write(preferences: LibraryPreferences) { written.set(preferences) }
        }
        val model = model(store)
        try {
            composeRule.setContent { MaterialTheme { MainLibraryScreen(model, {}) } }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            composeRule.runOnIdle { model.filterVolumes(VolumeFilter.SIX_TO_TEN) }
            release.countDown()
            val expected = LibraryPreferences(VolumeFilter.SIX_TO_TEN, LibrarySort.TITLE_ASC)
            composeRule.waitUntil(20_000) { !model.state.value.preferencesLoading && !model.state.value.preferencesSaving && written.get() == expected }
            assertEquals(expected, written.get())
        } finally { release.countDown() }
    }

    private fun scrollTo(text: String) = composeRule.onNodeWithTag("main-library-list").performScrollToNode(hasText(text))

    private fun model(preferences: LibraryPreferencesStore): LibraryViewModel {
        lateinit var model: LibraryViewModel
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            model = LibraryViewModel(CatalogSource { emptyList() }, object : MainCatalogCache {
                override fun read(): List<CatalogSeries>? = null
                override fun write(series: List<CatalogSeries>) = Unit
            }, CoverSource { null }, preferences)
        }
        return model
    }
}

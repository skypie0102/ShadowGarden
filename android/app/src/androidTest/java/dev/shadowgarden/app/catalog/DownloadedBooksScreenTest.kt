package dev.shadowgarden.app.catalog

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.books.PrivateBookStore
import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.LocatorFormat
import dev.shadowgarden.app.progress.ProgressLookup
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPosition
import dev.shadowgarden.app.progress.ReadingProgressStore
import dev.shadowgarden.app.progress.StoredReadingPosition
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DownloadedBooksScreenTest {
    @get:Rule val composeRule = createComposeRule()
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val known = CatalogBookId("bk_aaaaaaaaaaaaaaaaaaaaaa")
    private val orphan = CatalogBookId("bk_bbbbbbbbbbbbbbbbbbbbbb")

    @Test fun shelfOpensWithoutCatalogAndUpdatesTitlesWhenCatalogReturns() {
        val directory = File(context.noBackupFilesDir, "downloaded-shelf-test-${UUID.randomUUID()}")
        val store = PrivateBookStore(directory)
        store.replace(known, "generated known book".byteInputStream())
        store.replace(orphan, "generated unlisted book".byteInputStream())
        val online = AtomicBoolean(false)
        val catalog = listOf(CatalogSeries("series", "Generated series", "", "Ongoing", listOf(CatalogVolume(known, "Named volume"))))
        val model = model(CatalogSource { if (online.get()) catalog else throw IOException("offline fixture") })
        var showing by mutableStateOf(false)
        var selected: CatalogVolume? = null
        try {
            composeRule.setContent {
                MaterialTheme {
                    if (showing) DownloadedBooksScreen(model, store, { showing = false }, { selected = it })
                    else MainLibraryScreen(model, {}, onDownloaded = { showing = true })
                }
            }
            composeRule.waitUntil(20_000) { !model.state.value.loading && model.state.value.error != null }
            composeRule.onNodeWithTag("main-library-list").performScrollToNode(hasText("Downloaded books"))
            composeRule.onNodeWithText("Downloaded books").performClick()
            composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("2 saved EPUBs", substring = true).fetchSemanticsNodes().isNotEmpty() }
            composeRule.onNodeWithText("Catalog titles are unavailable; saved books can still be opened.").assertIsDisplayed()
            val unknownTitle = "Downloaded book · ${known.value}"
            composeRule.onNodeWithTag("downloaded-books-list").performScrollToNode(hasText(unknownTitle))
            composeRule.onNodeWithContentDescription("Read $unknownTitle offline").performClick()
            assertEquals(known, selected?.id)

            online.set(true)
            composeRule.runOnIdle { model.refresh() }
            composeRule.waitUntil(20_000) { model.state.value.series != null && !model.state.value.loading }
            composeRule.onNodeWithTag("downloaded-books-list").performScrollToNode(hasText("Named volume"))
            composeRule.onNodeWithText("Named volume").assertIsDisplayed()
            composeRule.onNodeWithText("Generated series").assertIsDisplayed()
            composeRule.onNodeWithContentDescription("Read Named volume offline").performClick()
            assertEquals(known, selected?.id)
            composeRule.onNodeWithTag("downloaded-books-list").performScrollToNode(hasText("Downloaded book · ${orphan.value}"))
            composeRule.onNodeWithText("Downloaded book · ${orphan.value}").assertIsDisplayed()
            composeRule.onNodeWithContentDescription("Read Downloaded book · ${orphan.value} offline").performClick()
            assertEquals(orphan, selected?.id)
            store.remove(orphan)
            composeRule.runOnIdle { model.refreshLocalBooks() }
            composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("1 saved EPUB", substring = true).fetchSemanticsNodes().isNotEmpty() }
            composeRule.onNodeWithText("Downloaded book · ${orphan.value}").assertDoesNotExist()
        } finally { directory.deleteRecursively() }
    }

    @Test fun storageErrorIsNotPresentedAsAnEmptyLibrary() {
        val file = File(context.cacheDir, "downloaded-shelf-file-${UUID.randomUUID()}")
        file.writeText("not a directory")
        val model = model(CatalogSource { emptyList() })
        try {
            composeRule.setContent { MaterialTheme { DownloadedBooksScreen(model, PrivateBookStore(file), {}, {}) } }
            composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("Could not load downloaded books. Try again.").fetchSemanticsNodes().isNotEmpty() }
            composeRule.onNodeWithText("Could not load downloaded books. Try again.").assertIsDisplayed()
            composeRule.onNodeWithText("No downloaded books yet.").assertDoesNotExist()
            composeRule.onNodeWithText("Retry downloads list").assertIsDisplayed()
        } finally { file.delete() }
    }

    @Test fun removesUnmatchedDownloadOnlyAfterConfirmationAndKeepsProgress() {
        val suffix = UUID.randomUUID().toString()
        val directory = File(context.noBackupFilesDir, "downloaded-shelf-removal-test-$suffix")
        val databaseName = "downloaded-shelf-removal-test-$suffix.db"
        val store = PrivateBookStore(directory)
        val bytes = "generated original edition".toByteArray()
        val edition = store.replace(orphan, bytes.inputStream())
        store.replace(known, "another saved book".byteInputStream())
        val position = ReadingPosition(orphan, edition, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)", 1_000)
        val model = model(CatalogSource { throw IOException("offline fixture") })
        val title = "Downloaded book · ${orphan.value}"
        val action = "Remove $title download"
        try {
            ReadingProgressStore(context, databaseName).use { progress ->
                assertEquals(ProgressSaveResult.Saved(1), progress.save(position, null))
                composeRule.setContent { MaterialTheme { DownloadedBooksScreen(model, store, {}, {}) } }
                composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("2 saved EPUBs", substring = true).fetchSemanticsNodes().isNotEmpty() }
                composeRule.onNodeWithTag("downloaded-books-list").performScrollToNode(hasContentDescription(action))
                composeRule.onNodeWithContentDescription(action).performClick()
                composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("Remove downloaded EPUB?").fetchSemanticsNodes().isNotEmpty() }
                composeRule.onNodeWithText("may not be possible to download it again", substring = true).assertIsDisplayed()
                composeRule.onNodeWithText("Cancel").performClick()
                assertTrue(store.contains(orphan))

                composeRule.onNodeWithContentDescription(action).performClick()
                composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("Remove downloaded EPUB?").fetchSemanticsNodes().isNotEmpty() }
                val replacement = store.replace(orphan, "generated replacement edition".byteInputStream())
                composeRule.onNodeWithText("Remove EPUB").performClick()
                val changedNotice = "The downloaded EPUB changed. Nothing was removed; review it and try again."
                composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText(changedNotice).fetchSemanticsNodes().isNotEmpty() }
                composeRule.onNodeWithText(changedNotice).assertIsDisplayed()
                store.open(orphan)!!.use { assertEquals(replacement, it.edition) }
                assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, 1)), progress.lookup(orphan, edition, LocatorFormat.EPUBJS_CFI))

                composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("2 saved EPUBs", substring = true).fetchSemanticsNodes().isNotEmpty() }
                composeRule.onNodeWithTag("downloaded-books-list").performScrollToNode(hasContentDescription(action))
                composeRule.onNodeWithContentDescription(action).performClick()
                composeRule.waitUntil(20_000) { composeRule.onAllNodesWithText("Remove downloaded EPUB?").fetchSemanticsNodes().isNotEmpty() }
                store.open(orphan)!!.use { opened ->
                    composeRule.onNodeWithText("Remove EPUB").performClick()
                    composeRule.waitUntil(20_000) { !store.contains(orphan) }
                    assertEquals("generated replacement edition", opened.input.readBytes().toString(Charsets.UTF_8))
                }
                assertFalse(store.contains(orphan))
                assertTrue(store.contains(known))
                assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, 1)), progress.lookup(orphan, edition, LocatorFormat.EPUBJS_CFI))
                store.replace(orphan, bytes.inputStream(), edition)
                assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, 1)), progress.lookup(orphan, edition, LocatorFormat.EPUBJS_CFI))
            }
        } finally { directory.deleteRecursively(); context.deleteDatabase(databaseName) }
    }

    private fun model(source: CatalogSource): LibraryViewModel {
        lateinit var model: LibraryViewModel
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            model = LibraryViewModel(source, object : MainCatalogCache {
                override fun read(): List<CatalogSeries>? = null
                override fun write(series: List<CatalogSeries>) = Unit
            }, CoverSource { null })
        }
        return model
    }
}

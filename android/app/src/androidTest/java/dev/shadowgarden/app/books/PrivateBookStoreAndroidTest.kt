package dev.shadowgarden.app.books

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.LocatorFormat
import dev.shadowgarden.app.progress.ProgressLookup
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPosition
import dev.shadowgarden.app.progress.ReadingProgressStore
import dev.shadowgarden.app.progress.StoredReadingPosition
import java.io.File
import java.util.UUID
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PrivateBookStoreAndroidTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val suffix = UUID.randomUUID().toString()
    private val directory = File(context.noBackupFilesDir, "book-store-test-$suffix")
    private val databaseName = "book-store-test-$suffix.db"
    private val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")

    @After fun cleanup() { directory.deleteRecursively(); context.deleteDatabase(databaseName) }

    @Test fun replacementAndRemovalKeepReadingProgress() {
        val books = PrivateBookStore(directory)
        val first = "generated edition one".toByteArray()
        val edition = books.replace(book, first.inputStream())
        assertTrue(directory.canonicalPath.startsWith(context.noBackupFilesDir.canonicalPath + File.separator))
        ReadingProgressStore(context, databaseName).use { progress ->
            val position = ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)", 1_000)
            assertEquals(ProgressSaveResult.Saved(1), progress.save(position, null))
            val replacement = books.replace(book, "generated edition two".byteInputStream())
            assertEquals(ProgressLookup.EditionChanged, progress.lookup(book, replacement, LocatorFormat.EPUBJS_CFI))
            assertTrue(books.remove(book))
            assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, 1)), progress.lookup(book, edition, LocatorFormat.EPUBJS_CFI))
            assertFalse(books.remove(book))
            books.replace(book, first.inputStream(), edition)
            books.open(book)!!.use { assertArrayEquals(first, it.input.readBytes()) }
            assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, 1)), progress.lookup(book, edition, LocatorFormat.EPUBJS_CFI))
        }
    }

    @Test fun openDescriptorSurvivesReplacementAndFailedWrite() {
        val books = PrivateBookStore(directory)
        val first = "original generated edition".toByteArray()
        val second = "new generated edition".toByteArray()
        val firstEdition = books.replace(book, first.inputStream())
        books.open(book)!!.use { opened ->
            val secondEdition = books.replace(book, second.inputStream())
            assertTrue(runCatching { books.replace(book, first.inputStream(), secondEdition) }.isFailure)
            assertEquals(firstEdition, opened.edition)
            assertArrayEquals(first, opened.input.readBytes())
            books.open(book)!!.use {
                assertEquals(secondEdition, it.edition)
                assertArrayEquals(second, it.input.readBytes())
            }
        }
    }
}

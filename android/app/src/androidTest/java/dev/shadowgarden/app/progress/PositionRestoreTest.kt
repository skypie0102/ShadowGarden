package dev.shadowgarden.app.progress

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayOutputStream
import java.util.UUID
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PositionRestoreTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val name = "position-restore-${UUID.randomUUID()}.db"
    private val sourceName = "position-source-${UUID.randomUUID()}.db"
    private lateinit var store: ReadingProgressStore
    private val original = EditionFingerprint.calculate("original".byteInputStream(), 100)
    private val replacement = EditionFingerprint.calculate("replacement".byteInputStream(), 100)
    private val bookA = CatalogBookId("bk_aaaaaaaaaaaaaaaaaaaaaa")
    private val bookB = CatalogBookId("bk_bbbbbbbbbbbbbbbbbbbbbb")
    private val bookC = CatalogBookId("bk_cccccccccccccccccccccc")
    private fun position(book: CatalogBookId, locator: String, edition: EditionFingerprint = original,
                         format: LocatorFormat = LocatorFormat.EPUBJS_CFI) =
        ReadingPosition(book, edition, format, locator, 100)
    private val existing by lazy { position(bookA, "old") }

    @Before fun setUp() { store = ReadingProgressStore(context, name) }
    @After fun tearDown() { store.close(); context.deleteDatabase(name); context.deleteDatabase(sourceName) }

    @Test fun previewAndKeepExistingPreserveOtherEditionsAndReaderSlots() {
        val same = position(bookB, "same")
        val changed = existing.copy(locator = "backup")
        val new = position(bookC, "new")
        val otherEdition = position(bookA, "other-edition", replacement)
        val otherReader = position(bookA, "other-reader", original, LocatorFormat.READIUM_LOCATOR)
        listOf(existing, same, otherEdition, otherReader).forEach { assertEquals(ProgressSaveResult.Saved(1), store.save(it, null)) }
        val preview = store.previewRestore(listOf(changed, same, new))
        assertEquals(listOf(PositionRestoreDisposition.CONFLICT, PositionRestoreDisposition.UNCHANGED, PositionRestoreDisposition.NEW),
            preview.entries.map { it.disposition })
        assertEquals(ProgressLookup.NoProgress, store.lookup(bookC, original, LocatorFormat.EPUBJS_CFI))
        assertTrue("Preview list must be immutable", runCatching { (preview.entries as MutableList).clear() }.isFailure)
        assertEquals(PositionRestoreResult.Applied(1, 0, 1, 1), store.restore(preview, PositionRestoreMode.KEEP_EXISTING))
        assertSaved(existing, 1)
        assertSaved(same, 1)
        assertSaved(new, 1)
        assertSaved(otherEdition, 1)
        assertSaved(otherReader, 1)
    }

    @Test fun explicitOverwriteUpdatesOnlyExactSlotAndIncrementsRevision() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(existing, null))
        val updated = existing.copy(locator = "backup", recordedAtMillis = 10)
        val preview = store.previewRestore(listOf(updated))
        assertEquals(PositionRestoreDisposition.CONFLICT, preview.entries.single().disposition)
        assertEquals(PositionRestoreResult.Applied(0, 1, 0, 0), store.restore(preview, PositionRestoreMode.OVERWRITE_CONFLICTS))
        assertSaved(updated, 2)
        assertEquals(ProgressSaveResult.Conflict(2), store.save(existing, 1))
        assertEquals(PositionRestoreResult.StalePreview, store.restore(preview, PositionRestoreMode.OVERWRITE_CONFLICTS))
    }

    @Test fun concurrentChangesInvalidateEntirePreviewIncludingNewSlots() {
        assertEquals(ProgressSaveResult.Saved(1), store.save(existing, null))
        val new = position(bookB, "backup-new")
        val preview = store.previewRestore(listOf(new, existing.copy(locator = "backup")))
        val other = ReadingProgressStore(context, name)
        try {
            val live = existing.copy(locator = "live")
            assertEquals(ProgressSaveResult.Saved(2), other.save(live, 1))
            assertEquals(PositionRestoreResult.StalePreview, store.restore(preview, PositionRestoreMode.OVERWRITE_CONFLICTS))
            assertSaved(live, 2)
            assertEquals(ProgressLookup.NoProgress, store.lookup(bookB, original, LocatorFormat.EPUBJS_CFI))
            val fresh = store.previewRestore(listOf(new, live))
            val concurrent = new.copy(locator = "other-device-local-write")
            assertEquals(ProgressSaveResult.Saved(1), other.save(concurrent, null))
            assertEquals(PositionRestoreResult.StalePreview, store.restore(fresh, PositionRestoreMode.KEEP_EXISTING))
            assertSaved(concurrent, 1)
            assertSaved(live, 2)
        } finally { other.close() }
    }

    @Test fun sqliteFailureRollsBackEarlierInserts() {
        val first = position(bookB, "first")
        val rejected = position(bookC, "rejected")
        val preview = store.previewRestore(listOf(first, rejected))
        val raw = android.database.sqlite.SQLiteDatabase.openDatabase(context.getDatabasePath(name).path, null,
            android.database.sqlite.SQLiteDatabase.OPEN_READWRITE)
        try {
            raw.execSQL("CREATE TRIGGER reject_test BEFORE INSERT ON reading_positions WHEN NEW.book_id='${bookC.value}' " +
                "BEGIN SELECT RAISE(ABORT, 'injected failure'); END")
            assertTrue("Database failure must be reported", runCatching { store.restore(preview, PositionRestoreMode.KEEP_EXISTING) }.isFailure)
            assertEquals(ProgressLookup.NoProgress, store.lookup(bookB, original, LocatorFormat.EPUBJS_CFI))
            assertEquals(ProgressLookup.NoProgress, store.lookup(bookC, original, LocatorFormat.EPUBJS_CFI))
        } finally { raw.close() }
    }

    @Test fun backupCanBePreviewedAndRestoredIntoAnIndependentDatabase() {
        val source = ReadingProgressStore(context, sourceName)
        try {
            val incoming = position(bookA, "source")
            val unread = position(bookB, "no longer in catalog", replacement)
            assertEquals(ProgressSaveResult.Saved(1), source.save(incoming, null))
            assertEquals(ProgressSaveResult.Saved(1), source.save(unread, null))
            val output = ByteArrayOutputStream()
            ReadingPositionBackup.write(output, source.snapshotPositions())
            val decoded = ReadingPositionBackup.read(output.toByteArray().inputStream())
            val preview = store.previewRestore(decoded)
            assertTrue(preview.entries.all { it.disposition == PositionRestoreDisposition.NEW })
            assertEquals(PositionRestoreResult.Applied(2, 0, 0, 0), store.restore(preview, PositionRestoreMode.KEEP_EXISTING))
            assertSaved(incoming, 1)
            assertSaved(unread, 1)
            assertEquals(ProgressLookup.EditionChanged, store.lookup(bookB, original, LocatorFormat.EPUBJS_CFI))
        } finally { source.close() }
    }

    @Test fun rejectsInvalidOrForeignPreviewsWithoutWriting() {
        val new = position(bookB, "backup")
        assertTrue(runCatching { store.previewRestore(listOf(new, new)) }.isFailure)
        val preview = store.previewRestore(listOf(new))
        val other = ReadingProgressStore(context, sourceName)
        try { assertTrue(runCatching { other.restore(preview, PositionRestoreMode.OVERWRITE_CONFLICTS) }.isFailure) }
        finally { other.close() }
        assertEquals(ProgressLookup.NoProgress, store.lookup(bookB, original, LocatorFormat.EPUBJS_CFI))
        assertTrue(runCatching { ReadingPositionBackup.read("{\"version\":1}".byteInputStream()) }.isFailure)
        assertEquals(ProgressLookup.NoProgress, store.lookup(bookB, original, LocatorFormat.EPUBJS_CFI))
    }

    private fun assertSaved(position: ReadingPosition, revision: Long) {
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, revision)),
            store.lookup(position.bookId, position.edition, position.format))
    }
}

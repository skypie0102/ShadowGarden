package dev.shadowgarden.app.progress

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReadingProgressStoreTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val databaseName = "reading-progress-test-${UUID.randomUUID()}.db"
    private val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val otherBook = CatalogBookId("bk_0123456789abcdefghijkl")
    private val original = EditionFingerprint.calculate("original fixture".byteInputStream(), 1_000)
    private val replacement = EditionFingerprint.calculate("replaced fixture".byteInputStream(), 1_000)
    private lateinit var store: ReadingProgressStore

    @Before fun setUp() { store = ReadingProgressStore(context, databaseName) }
    @After fun tearDown() { store.close(); context.deleteDatabase(databaseName) }

    @Test
    fun positionsPersistInPrivateStorageAcrossStoreReopen() {
        val position = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        assertEquals(ProgressLookup.NoProgress, store.lookup(book, original, LocatorFormat.EPUBJS_CFI))
        assertEquals(ProgressSaveResult.Saved(1), store.save(position, null))
        val database = context.getDatabasePath(databaseName)
        assertTrue(database.isFile)
        assertTrue(database.canonicalPath.startsWith(File(context.applicationInfo.dataDir).canonicalPath + File.separator))
        store.close()
        store = ReadingProgressStore(context, databaseName)
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(position, 1)), store.lookup(book, original, LocatorFormat.EPUBJS_CFI))
        assertEquals(ProgressLookup.NoProgress, store.lookup(otherBook, original, LocatorFormat.EPUBJS_CFI))
    }

    @Test
    fun unknownEditionChangedEditionAndReaderFormatNeverReturnTheOldLocator() {
        val epubPosition = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        assertEquals(ProgressSaveResult.Saved(1), store.save(epubPosition, null))
        assertEquals(ProgressLookup.EditionUnknown, store.lookup(book, null, LocatorFormat.EPUBJS_CFI))
        assertEquals(ProgressLookup.EditionChanged, store.lookup(book, replacement, LocatorFormat.EPUBJS_CFI))
        assertEquals(ProgressLookup.ReaderChanged, store.lookup(book, original, LocatorFormat.READIUM_LOCATOR))
        val newEdition = position(book, replacement, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/8)")
        val otherReader = position(book, original, LocatorFormat.READIUM_LOCATOR, "{\"href\":\"chapter.xhtml\"}")
        assertEquals(ProgressSaveResult.Saved(1), store.save(newEdition, null))
        assertEquals(ProgressSaveResult.Saved(1), store.save(otherReader, null))
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(epubPosition, 1)), store.lookup(book, original, LocatorFormat.EPUBJS_CFI))
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(newEdition, 1)), store.lookup(book, replacement, LocatorFormat.EPUBJS_CFI))
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(otherReader, 1)), store.lookup(book, original, LocatorFormat.READIUM_LOCATOR))
    }

    @Test
    fun staleUpdatesDoNotOverwriteNewerProgress() {
        val initial = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        val newer = initial.copy(locator = "epubcfi(/6/8)", recordedAtMillis = 20)
        val stale = initial.copy(locator = "epubcfi(/6/4)", recordedAtMillis = 30)
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        assertEquals(ProgressSaveResult.Conflict(1), store.save(newer, null))
        assertEquals(ProgressSaveResult.Saved(2), store.save(newer, 1))
        assertEquals(ProgressSaveResult.Conflict(2), store.save(stale, 1))
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(newer, 2)), store.lookup(book, original, LocatorFormat.EPUBJS_CFI))
    }

    @Test
    fun malformedStoredPositionRaisesAnErrorWithoutDeletingIt() {
        val position = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        assertEquals(ProgressSaveResult.Saved(1), store.save(position, null))
        val database = android.database.sqlite.SQLiteDatabase.openDatabase(
            context.getDatabasePath(databaseName).path, null, android.database.sqlite.SQLiteDatabase.OPEN_READWRITE
        )
        try {
            database.execSQL("UPDATE reading_positions SET locator=?", arrayOf("x".repeat(70_000)))
            assertTrue("Malformed stored progress must be reported", runCatching {
                store.lookup(book, original, LocatorFormat.EPUBJS_CFI)
            }.isFailure)
            database.rawQuery("SELECT length(locator) FROM reading_positions", null).use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertEquals(70_000, cursor.getInt(0))
            }
        } finally {
            database.close()
        }
    }

    @Test
    fun corruptedDatabaseIsReportedAndNotDeletedOrReplaced() {
        val position = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        assertEquals(ProgressSaveResult.Saved(1), store.save(position, null))
        store.close()
        val database = context.getDatabasePath(databaseName)
        val corrupted = "damaged test database".toByteArray()
        database.writeBytes(corrupted)
        store = ReadingProgressStore(context, databaseName)
        assertTrue("Corrupt storage must be reported", runCatching {
            store.lookup(book, original, LocatorFormat.EPUBJS_CFI)
        }.isFailure)
        assertTrue("The damaged database must remain available for recovery", database.isFile)
        assertTrue("The damaged database must not be overwritten", database.readBytes().contentEquals(corrupted))
    }

    @Test
    fun anUnknownReaderFormatIsPreservedWithoutReturningItsLocator() {
        // Let the store initialize its schema before inserting an unknown format.
        assertEquals(ProgressLookup.NoProgress, store.lookup(book, original, LocatorFormat.EPUBJS_CFI))
        val raw = android.database.sqlite.SQLiteDatabase.openDatabase(
            context.getDatabasePath(databaseName).path, null, android.database.sqlite.SQLiteDatabase.OPEN_READWRITE
        )
        try {
            raw.execSQL(
                "INSERT INTO reading_positions VALUES (?, ?, ?, ?, ?, ?, ?)",
                arrayOf(book.value, original.sha256, original.byteCount, "future-reader-v1", "future location", 10, 1)
            )
            assertEquals(ProgressLookup.ReaderChanged, store.lookup(book, original, LocatorFormat.EPUBJS_CFI))
            val current = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
            assertEquals(ProgressSaveResult.Saved(1), store.save(current, null))
            raw.rawQuery("SELECT COUNT(*) FROM reading_positions", null).use { cursor ->
                assertTrue(cursor.moveToFirst())
                assertEquals(2, cursor.getInt(0))
            }
        } finally {
            raw.close()
        }
    }

    @Test
    fun concurrentWritersCannotBothCommitTheSameRevision() {
        val initial = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        assertEquals(ProgressSaveResult.Saved(1), store.save(initial, null))
        val second = ReadingProgressStore(context, databaseName)
        assertEquals(ProgressLookup.Exact(StoredReadingPosition(initial, 1)), second.lookup(book, original, LocatorFormat.EPUBJS_CFI))
        val executor = Executors.newFixedThreadPool(2)
        val start = CountDownLatch(1)
        try {
            val firstUpdate = initial.copy(locator = "epubcfi(/6/4)")
            val secondUpdate = initial.copy(locator = "epubcfi(/6/8)")
            val results = listOf(store to firstUpdate, second to secondUpdate).map { (writer, value) ->
                executor.submit(Callable { start.await(); writer.save(value, 1) })
            }
            start.countDown()
            val outcomes = results.map { it.get(20, TimeUnit.SECONDS) }
            assertEquals(1, outcomes.count { it == ProgressSaveResult.Saved(2) })
            assertEquals(1, outcomes.count { it == ProgressSaveResult.Conflict(2) })
            val saved = store.lookup(book, original, LocatorFormat.EPUBJS_CFI) as ProgressLookup.Exact
            assertEquals(2L, saved.stored.revision)
            assertTrue(saved.stored.position == firstUpdate || saved.stored.position == secondUpdate)
        } finally {
            executor.shutdownNow()
            second.close()
        }
    }

    @Test
    fun closedStoreCannotReopenFromAnInFlightCaller() {
        store.close()
        val position = position(book, original, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)")
        assertTrue(runCatching { store.save(position, null) }.isFailure)
        assertTrue(runCatching { store.lookup(book, original, LocatorFormat.EPUBJS_CFI) }.isFailure)
        assertTrue(runCatching { store.previewRestore(listOf(position)) }.isFailure)
    }

    private fun position(id: CatalogBookId, edition: EditionFingerprint, format: LocatorFormat, locator: String) =
        ReadingPosition(id, edition, format, locator, 10)
}

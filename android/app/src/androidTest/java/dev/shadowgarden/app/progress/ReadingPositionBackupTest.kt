package dev.shadowgarden.app.progress

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class ReadingPositionBackupTest {
    private val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val edition = EditionFingerprint.calculate("fixture".byteInputStream(), 1_000)
    private val first = ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, "epubcfi(/6/2)", 123)
    private val second = first.copy(format = LocatorFormat.READIUM_LOCATOR, locator = "{\"text\":\"星 😀\"}")

    @Test fun roundTripPreservesPositionsAndLeavesStreamsOpen() {
        val output = object : ByteArrayOutputStream() {
            var closed = false
            override fun close() { closed = true; super.close() }
        }
        ReadingPositionBackup.write(output, listOf(first, second))
        assertFalse(output.closed)
        val input = object : ByteArrayInputStream(output.toByteArray()) {
            var closed = false
            override fun close() { closed = true; super.close() }
        }
        assertEquals(listOf(first, second), ReadingPositionBackup.read(input))
        assertFalse(input.closed)
        assertEquals(emptyList<ReadingPosition>(), decode("{\"kind\":\"shadowgarden-android-positions\",\"version\":1,\"positions\":[]}"))
    }

    @Test fun rejectsMalformedOrAmbiguousBackups() {
        val valid = encode(listOf(first))
        val row = valid.substringAfter("\"positions\":[").dropLast(2)
        val cases = listOf(
            "",
            valid.dropLast(1),
            valid + "{}",
            valid.replace("\"version\":1", "\"version\":2"),
            valid.replace("\"version\":1", "\"version\":1.0"),
            valid.replace("\"version\":1", "\"version\":\"1\""),
            valid.replace("\"version\":1", "\"version\":1,\"version\":1"),
            valid.replace("\"positions\":[", "\"extra\":true,\"positions\":["),
            valid.replace("\"locatorFormat\":\"epubjs-cfi-v1\"", "\"locatorFormat\":\"unknown\""),
            valid.replace("\"bookId\":\"${book.value}\"", "\"bookId\":\"bad\""),
            valid.replace("\"editionBytes\":${edition.byteCount}", "\"editionBytes\":-1"),
            valid.replace("\"recordedAtMillis\":123", "\"recordedAtMillis\":9223372036854775808"),
            valid.replace("\"locator\":\"epubcfi(/6/2)\"", "\"locator\":\"\\uD800\""),
            valid.replace(row, "$row,$row")
        )
        cases.forEachIndexed { index, text -> assertTrue("Malformed case $index must fail", runCatching { decode(text) }.isFailure) }
        assertTrue(runCatching { ReadingPositionBackup.read(byteArrayOf(0xc3.toByte(), 0x28).inputStream()) }.isFailure)
        assertTrue(runCatching { encode(listOf(first, first)) }.isFailure)
        assertTrue(runCatching { encode(listOf(first.copy(locator = "\uD800"))) }.isFailure)
    }

    @Test fun enforcesFileAndRecordLimitsWithoutAcceptingPartialInput() {
        val valid = encode(listOf(first))
        val oversized = valid + " ".repeat(ReadingPositionBackup.MAX_BYTES)
        assertTrue(runCatching { decode(oversized) }.isFailure)
        val record = valid.substringAfter("\"positions\":[").dropLast(2)
        val tooMany = "{\"kind\":\"shadowgarden-android-positions\",\"version\":1,\"positions\":[" +
            (0..ReadingPositionBackup.MAX_POSITIONS).joinToString(",") { index ->
                record.replace(book.value, "bk_" + index.toString().padStart(22, '0'))
            } + "]}"
        assertTrue(runCatching { decode(tooMany) }.isFailure)
        val huge = (0..64).map { index -> first.copy(
            bookId = CatalogBookId("bk_" + index.toString().padStart(22, '0')), locator = "x".repeat(64 * 1024)) }
        assertTrue(runCatching { encode(huge) }.isFailure)
    }

    @Test fun streamFailuresAreReported() {
        val failingInput = object : java.io.InputStream() { override fun read(): Int = throw IOException("read failure") }
        val failingOutput = object : java.io.OutputStream() { override fun write(value: Int) { throw IOException("write failure") } }
        assertTrue(runCatching { ReadingPositionBackup.read(failingInput) }.isFailure)
        assertTrue(runCatching { ReadingPositionBackup.write(failingOutput, listOf(first)) }.isFailure)
    }

    @Test fun snapshotExportsAllReaderSlotsAndRejectsUnknownRows() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "reading-backup-test-${UUID.randomUUID()}.db"
        val store = ReadingProgressStore(context, name)
        try {
            assertEquals(ProgressSaveResult.Saved(1), store.save(first, null))
            assertEquals(ProgressSaveResult.Saved(1), store.save(second, null))
            assertEquals(listOf(first, second).toSet(), decode(encode(store.snapshotPositions())).toSet())
            val raw = android.database.sqlite.SQLiteDatabase.openDatabase(
                context.getDatabasePath(name).path, null, android.database.sqlite.SQLiteDatabase.OPEN_READWRITE)
            try {
                raw.execSQL("INSERT INTO reading_positions VALUES (?, ?, ?, ?, ?, ?, ?)",
                    arrayOf(book.value, edition.sha256, edition.byteCount, "future-format", "future", 100, 1))
                assertTrue("Unknown records must not silently disappear from a backup", runCatching { store.snapshotPositions() }.isFailure)
                raw.rawQuery("SELECT COUNT(*) FROM reading_positions", null).use { cursor ->
                    assertTrue(cursor.moveToFirst())
                    assertEquals(3, cursor.getInt(0))
                }
            } finally { raw.close() }
        } finally { store.close(); context.deleteDatabase(name) }
    }

    @Test fun snapshotRejectsOversizedCollectionsWithoutChangingStoredPositions() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "reading-backup-limit-${UUID.randomUUID()}.db"
        val store = ReadingProgressStore(context, name)
        try {
            val longLocator = "x".repeat(64 * 1024)
            repeat(65) { index ->
                val position = first.copy(bookId = CatalogBookId("bk_" + index.toString().padStart(22, '0')), locator = longLocator)
                assertEquals(ProgressSaveResult.Saved(1), store.save(position, null))
            }
            assertTrue("An oversized snapshot must fail", runCatching { store.snapshotPositions() }.isFailure)
            val lastBook = CatalogBookId("bk_" + "64".padStart(22, '0'))
            val saved = store.lookup(lastBook, edition, LocatorFormat.EPUBJS_CFI) as ProgressLookup.Exact
            assertEquals(longLocator, saved.stored.position.locator)
        } finally { store.close(); context.deleteDatabase(name) }
    }

    private fun encode(positions: List<ReadingPosition>): String {
        val output = ByteArrayOutputStream()
        ReadingPositionBackup.write(output, positions)
        return output.toString("UTF-8")
    }
    private fun decode(text: String): List<ReadingPosition> = ReadingPositionBackup.read(text.byteInputStream())
}

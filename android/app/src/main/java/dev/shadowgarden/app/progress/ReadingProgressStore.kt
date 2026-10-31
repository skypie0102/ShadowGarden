package dev.shadowgarden.app.progress

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.database.sqlite.SQLiteOpenHelper
import java.io.Closeable

/**
 * App-private position storage. Call from an I/O thread and close when no longer needed.
 * This store does not parse locators, validate EPUBs, sync with the website, or restore backups.
 */
internal class ReadingProgressStore(
    context: Context,
    databaseName: String = DATABASE_NAME
) : Closeable {
    private val helper: Database

    init {
        require(DATABASE_FILE.matches(databaseName)) { "Invalid database name" }
        helper = Database(context.applicationContext, databaseName)
    }

    /** Exact progress is returned only for the same catalog book, EPUB bytes, and reader format. */
    @Synchronized
    fun lookup(bookId: CatalogBookId, edition: EditionFingerprint?, format: LocatorFormat): ProgressLookup {
        val db = helper.readableDatabase
        if (edition == null) return if (hasBook(db, bookId)) ProgressLookup.EditionUnknown else ProgressLookup.NoProgress
        val args = keyArgs(bookId, edition, format)
        db.rawQuery(
            "SELECT locator, recorded_at, revision FROM reading_positions WHERE book_id=? AND edition_sha256=? AND edition_bytes=? AND locator_format=?",
            args
        ).use { cursor ->
            if (cursor.moveToFirst()) {
                val position = ReadingPosition(bookId, edition, format, cursor.getString(0), cursor.getLong(1))
                return ProgressLookup.Exact(StoredReadingPosition(position, cursor.getLong(2)))
            }
        }
        return when {
            hasEdition(db, bookId, edition) -> ProgressLookup.ReaderChanged
            hasBook(db, bookId) -> ProgressLookup.EditionChanged
            else -> ProgressLookup.NoProgress
        }
    }

    /**
     * Compare-and-save one edition/format slot. Pass null only for a new slot;
     * stale updates return a conflict instead of overwriting newer progress.
     */
    @Synchronized
    fun save(position: ReadingPosition, expectedRevision: Long?): ProgressSaveResult {
        require(expectedRevision == null || expectedRevision > 0) { "Invalid expected revision" }
        val db = helper.writableDatabase
        val args = keyArgs(position.bookId, position.edition, position.format)
        db.beginTransaction()
        try {
            val current = db.rawQuery(
                "SELECT revision FROM reading_positions WHERE book_id=? AND edition_sha256=? AND edition_bytes=? AND locator_format=?",
                args
            ).use { cursor -> if (cursor.moveToFirst()) cursor.getLong(0) else null }
            if (current != expectedRevision) {
                db.setTransactionSuccessful()
                return ProgressSaveResult.Conflict(current)
            }
            if (current == Long.MAX_VALUE) throw SQLiteException("Progress revision exhausted")
            val next = (current ?: 0L) + 1L
            val values = ContentValues().apply {
                put("locator", position.locator)
                put("recorded_at", position.recordedAtMillis)
                put("revision", next)
            }
            if (current == null) {
                values.put("book_id", position.bookId.value)
                values.put("edition_sha256", position.edition.sha256)
                values.put("edition_bytes", position.edition.byteCount)
                values.put("locator_format", position.format.storageId)
                db.insertOrThrow("reading_positions", null, values)
            } else {
                val changed = db.update(
                    "reading_positions", values,
                    "book_id=? AND edition_sha256=? AND edition_bytes=? AND locator_format=? AND revision=?",
                    args + current.toString()
                )
                if (changed != 1) throw SQLiteException("Progress update was not applied")
            }
            db.setTransactionSuccessful()
            return ProgressSaveResult.Saved(next)
        } finally {
            db.endTransaction()
        }
    }

    /** A consistent position-only snapshot. Unknown or damaged rows fail rather than being omitted. */
    @Synchronized
    fun snapshotPositions(): List<ReadingPosition> {
        val positions = mutableListOf<ReadingPosition>()
        var locatorBytes = 0L
        val db = helper.writableDatabase
        db.beginTransactionNonExclusive()
        try {
            db.rawQuery(
                "SELECT book_id, edition_sha256, edition_bytes, locator_format, locator, recorded_at, revision " +
                    "FROM reading_positions ORDER BY book_id, edition_sha256, edition_bytes, locator_format LIMIT ?",
                arrayOf((ReadingPositionBackup.MAX_POSITIONS + 1).toString())
            ).use { cursor ->
                while (cursor.moveToNext()) {
                    if (positions.size == ReadingPositionBackup.MAX_POSITIONS) throw SQLiteException("Too many positions for backup")
                    if (listOf(0, 1, 3, 4).any { cursor.getType(it) != Cursor.FIELD_TYPE_STRING } ||
                        listOf(2, 5, 6).any { cursor.getType(it) != Cursor.FIELD_TYPE_INTEGER }) {
                        throw SQLiteException("Invalid stored position type")
                    }
                    val format = LocatorFormat.entries.firstOrNull { it.storageId == cursor.getString(3) }
                        ?: throw SQLiteException("Unsupported stored reader format")
                    val position = ReadingPosition(CatalogBookId(cursor.getString(0)),
                        EditionFingerprint(cursor.getString(1), cursor.getLong(2)), format, cursor.getString(4), cursor.getLong(5))
                    StoredReadingPosition(position, cursor.getLong(6)) // Validate revision; do not export it.
                    locatorBytes += position.locator.toByteArray(Charsets.UTF_8).size
                    if (locatorBytes > ReadingPositionBackup.MAX_BYTES) throw SQLiteException("Positions exceed backup size limit")
                    positions.add(position)
                }
            }
            db.setTransactionSuccessful()
            return positions
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    override fun close() = helper.close()

    private fun hasBook(db: SQLiteDatabase, bookId: CatalogBookId): Boolean =
        db.rawQuery("SELECT 1 FROM reading_positions WHERE book_id=? LIMIT 1", arrayOf(bookId.value))
            .use { it.moveToFirst() }

    private fun hasEdition(db: SQLiteDatabase, bookId: CatalogBookId, edition: EditionFingerprint): Boolean =
        db.rawQuery(
            "SELECT 1 FROM reading_positions WHERE book_id=? AND edition_sha256=? AND edition_bytes=? LIMIT 1",
            arrayOf(bookId.value, edition.sha256, edition.byteCount.toString())
        ).use { it.moveToFirst() }

    private fun keyArgs(bookId: CatalogBookId, edition: EditionFingerprint, format: LocatorFormat): Array<String> =
        arrayOf(bookId.value, edition.sha256, edition.byteCount.toString(), format.storageId)

    // SQLiteOpenHelper's default corruption handler deletes the database. Preserve
    // the damaged file so the caller can report the failure and recovery remains possible.
    private class Database(context: Context, name: String) : SQLiteOpenHelper(
        context, name, null, 1, DatabaseErrorHandler { db -> if (db.isOpen) db.close() }
    ) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """CREATE TABLE reading_positions (
                    book_id TEXT NOT NULL,
                    edition_sha256 TEXT NOT NULL,
                    edition_bytes INTEGER NOT NULL CHECK(edition_bytes >= 0),
                    locator_format TEXT NOT NULL,
                    locator TEXT NOT NULL CHECK(length(locator) > 0),
                    recorded_at INTEGER NOT NULL CHECK(recorded_at >= 0),
                    revision INTEGER NOT NULL CHECK(revision > 0),
                    PRIMARY KEY(book_id, edition_sha256, edition_bytes, locator_format)
                )""".trimIndent()
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            throw SQLiteException("Unsupported reading progress database upgrade")
        }
    }

    private companion object {
        const val DATABASE_NAME = "reading-progress.db"
        val DATABASE_FILE = Regex("^[A-Za-z0-9._-]{1,128}$")
    }
}

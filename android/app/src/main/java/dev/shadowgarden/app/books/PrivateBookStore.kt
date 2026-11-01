package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest

/** An open file and fingerprint of the same bytes. Close when finished. */
internal class OpenBook internal constructor(val input: FileInputStream, val edition: EditionFingerprint) : Closeable {
    override fun close() = input.close()
}

internal enum class BookRemovalResult { REMOVED, NOT_FOUND, EDITION_CHANGED }

/**
 * App-private byte storage foundation. The caller supplies a private no-backup
 * directory and runs these blocking methods off the UI thread. The EPUB entry
 * point checks only ZIP structure; reader validation remains necessary.
 * Coordination is limited to one app process. This class does not download,
 * authorize, parse, or render books and does not change reading progress.
 */
internal class PrivateBookStore(private val directory: File, private val maxBytes: Long = MAX_BOOK_BYTES) {
    init { require(maxBytes > 0 && maxBytes <= MAX_BOOK_BYTES) }

    /**
     * Reads but does not close input. An optional trusted fingerprint detects an
     * incomplete or altered transfer. checkCancelled may throw to abort safely.
     */
    fun replace(bookId: CatalogBookId, input: InputStream, expected: EditionFingerprint? = null,
                checkCancelled: () -> Unit = {}): EditionFingerprint = replaceInternal(bookId, input, expected, checkCancelled, false)

    /** Rejects malformed ZIP structures before replacing an existing book. */
    fun replaceEpub(bookId: CatalogBookId, input: InputStream, expected: EditionFingerprint? = null,
                    checkCancelled: () -> Unit = {}): EditionFingerprint = replaceInternal(bookId, input, expected, checkCancelled, true)

    private fun replaceInternal(bookId: CatalogBookId, input: InputStream, expected: EditionFingerprint?,
                                checkCancelled: () -> Unit, validateEpub: Boolean): EditionFingerprint = synchronized(LOCK) {
        if (expected != null && (expected.byteCount <= 0 || expected.byteCount > maxBytes)) throw IOException("Invalid expected book size")
        if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Could not create book directory")
        val target = file(bookId, ".epub")
        val temporary = file(bookId, ".part")
        if (temporary.exists() && !temporary.delete()) throw IOException("Could not remove interrupted book transfer")
        try {
            val digest = MessageDigest.getInstance("SHA-256")
            var count = 0L
            val fingerprint = FileOutputStream(temporary).use { output ->
                val buffer = ByteArray(32 * 1024)
                while (true) {
                    checkCancelled()
                    val read = input.read(buffer)
                    if (read < 0) break
                    if (read == 0) {
                        val byte = input.read()
                        if (byte < 0) break
                        if (count == maxBytes) throw IOException("Book exceeds size limit")
                        output.write(byte)
                        digest.update(byte.toByte())
                        count++
                    } else {
                        if (read.toLong() > maxBytes - count) throw IOException("Book exceeds size limit")
                        output.write(buffer, 0, read)
                        digest.update(buffer, 0, read)
                        count += read
                    }
                }
                if (count == 0L) throw IOException("Book is empty")
                val fingerprint = EditionFingerprint(digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }, count)
                if (expected != null && fingerprint != expected) throw IOException("Book does not match expected edition")
                checkCancelled()
                output.fd.sync()
                fingerprint
            }
            checkCancelled()
            if (validateEpub) EpubStructureCheck.validate(temporary, checkCancelled)
            checkCancelled()
            if (!temporary.renameTo(target)) throw IOException("Could not replace book")
            fingerprint
        } finally { temporary.delete() }
    }

    /** Fingerprints the opened file itself, then rewinds it; replacement won't change its descriptor. */
    fun open(bookId: CatalogBookId): OpenBook? = synchronized(LOCK) {
        val target = file(bookId, ".epub")
        if (!target.exists()) return@synchronized null
        val input = FileInputStream(target)
        try {
            val edition = EditionFingerprint.calculate(input, maxBytes)
            if (edition.byteCount == 0L) throw IOException("Book is empty")
            input.channel.position(0)
            OpenBook(input, edition)
        } catch (error: Throwable) {
            input.close()
            throw error
        }
    }

    /** A lightweight presence check; opening the book still verifies its fingerprint. */
    fun contains(bookId: CatalogBookId): Boolean = synchronized(LOCK) {
        val target = file(bookId, ".epub")
        target.isFile && target.length() in 1..maxBytes
    }

    /** Removes only this book's file; reading positions are stored separately. */
    fun remove(bookId: CatalogBookId): Boolean = synchronized(LOCK) {
        val target = file(bookId, ".epub")
        if (!target.exists()) false else if (target.delete()) true else throw IOException("Could not remove book")
    }

    /** Remove only the edition the user reviewed, even if a download replaced it meanwhile. */
    fun removeIfEdition(bookId: CatalogBookId, expected: EditionFingerprint): BookRemovalResult = synchronized(LOCK) {
        val opened = open(bookId) ?: return@synchronized BookRemovalResult.NOT_FOUND
        val actual = opened.use { it.edition }
        if (actual != expected) return@synchronized BookRemovalResult.EDITION_CHANGED
        if (!file(bookId, ".epub").delete()) throw IOException("Could not remove book")
        BookRemovalResult.REMOVED
    }

    private fun file(bookId: CatalogBookId, extension: String): File {
        val result = File(directory, bookId.value + extension)
        if (result.canonicalFile.parentFile != directory.canonicalFile) throw IOException("Invalid book file")
        return result
    }

    companion object {
        // Matches the website's current EPUB upload limit.
        const val MAX_BOOK_BYTES = 50L * 1024 * 1024
        private val LOCK = Any()
    }
}

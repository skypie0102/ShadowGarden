package dev.shadowgarden.app.progress

import java.io.IOException
import java.io.InputStream
import java.security.MessageDigest

/** A website catalog identity. It is not a file path or a title. */
internal data class CatalogBookId(val value: String) {
    init {
        require(BOOK_ID.matches(value)) { "Invalid catalog book ID" }
    }

    private companion object {
        val BOOK_ID = Regex("^bk_[A-Za-z0-9_-]{22}$")
    }
}

/** SHA-256 of the exact EPUB bytes. This does not validate an EPUB or keep its file immutable. */
internal data class EditionFingerprint(val sha256: String, val byteCount: Long) {
    init {
        require(SHA256.matches(sha256)) { "Invalid edition fingerprint" }
        require(byteCount >= 0) { "Invalid edition size" }
    }

    companion object {
        private val SHA256 = Regex("^[0-9a-f]{64}$")
        private val HEX = "0123456789abcdef".toCharArray()

        /** Reads but does not close [input]. Fails rather than returning a partial fingerprint. */
        @Throws(IOException::class)
        fun calculate(input: InputStream, maxBytes: Long): EditionFingerprint {
            require(maxBytes >= 0) { "Invalid size limit" }
            val digest = MessageDigest.getInstance("SHA-256")
            val buffer = ByteArray(32 * 1024)
            var count = 0L
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                if (read == 0) {
                    val next = input.read()
                    if (next < 0) break
                    if (count == maxBytes) throw IOException("Edition exceeds the configured size limit")
                    digest.update(next.toByte())
                    count++
                } else {
                    if (read.toLong() > maxBytes - count) throw IOException("Edition exceeds the configured size limit")
                    digest.update(buffer, 0, read)
                    count += read
                }
            }
            val bytes = digest.digest()
            val encoded = CharArray(bytes.size * 2)
            bytes.forEachIndexed { index, byte ->
                val value = byte.toInt() and 0xff
                encoded[index * 2] = HEX[value ushr 4]
                encoded[index * 2 + 1] = HEX[value and 0x0f]
            }
            return EditionFingerprint(String(encoded), count)
        }
    }
}

/** Formats are intentionally distinct: a location cannot be transferred between readers implicitly. */
internal enum class LocatorFormat(val storageId: String) {
    EPUBJS_CFI("epubjs-cfi-v1"),
    READIUM_LOCATOR("readium-locator-v1")
}

/** The locator is opaque; its owning reader must validate and interpret it. */
internal data class ReadingPosition(
    val bookId: CatalogBookId,
    val edition: EditionFingerprint,
    val format: LocatorFormat,
    val locator: String,
    val recordedAtMillis: Long
) {
    init {
        require(locator.isNotBlank() && '\u0000' !in locator) { "Invalid reader location" }
        require(locator.length <= MAX_LOCATOR_BYTES && locator.toByteArray(Charsets.UTF_8).size <= MAX_LOCATOR_BYTES) {
            "Reader location is too large"
        }
        require(recordedAtMillis >= 0) { "Invalid recording time" }
    }

    private companion object {
        const val MAX_LOCATOR_BYTES = 64 * 1024
    }
}

internal data class StoredReadingPosition(val position: ReadingPosition, val revision: Long) {
    init { require(revision > 0) { "Invalid progress revision" } }
}

internal sealed interface ProgressLookup {
    data class Exact(val stored: StoredReadingPosition) : ProgressLookup
    data object NoProgress : ProgressLookup
    data object EditionUnknown : ProgressLookup
    data object EditionChanged : ProgressLookup
    data object ReaderChanged : ProgressLookup
}

internal sealed interface ProgressSaveResult {
    data class Saved(val revision: Long) : ProgressSaveResult
    /** The caller's snapshot is stale; no stored position was changed. */
    data class Conflict(val currentRevision: Long?) : ProgressSaveResult
}

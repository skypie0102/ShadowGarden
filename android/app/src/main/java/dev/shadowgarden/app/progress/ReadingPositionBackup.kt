package dev.shadowgarden.app.progress

import android.util.JsonReader
import android.util.JsonToken
import android.util.JsonWriter
import java.io.FilterInputStream
import java.io.FilterOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.nio.charset.CodingErrorAction

/** Experimental position-only interchange. It neither closes streams nor modifies the store. */
internal object ReadingPositionBackup {
    const val MAX_BYTES = 4 * 1024 * 1024
    const val MAX_POSITIONS = 5_000
    private const val KIND = "shadowgarden-android-positions"
    private const val VERSION = 1L

    /** Write to a private temporary file first: a failure can leave [output] partially written. */
    @Throws(IOException::class)
    fun write(output: OutputStream, positions: List<ReadingPosition>) {
        require(positions.size <= MAX_POSITIONS) { "Too many positions" }
        require(positions.map { it.key() }.toSet().size == positions.size) { "Duplicate position" }
        val encoder = Charsets.UTF_8.newEncoder()
            .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
        val writer = JsonWriter(OutputStreamWriter(LimitedOutput(output), encoder))
        writer.beginObject().name("kind").value(KIND).name("version").value(VERSION).name("positions").beginArray()
        for (position in positions) {
            writer.beginObject()
                .name("bookId").value(position.bookId.value)
                .name("editionSha256").value(position.edition.sha256)
                .name("editionBytes").value(position.edition.byteCount)
                .name("locatorFormat").value(position.format.storageId)
                .name("locator").value(position.locator)
                .name("recordedAtMillis").value(position.recordedAtMillis)
                .endObject()
        }
        writer.endArray().endObject()
        writer.flush()
    }

    /** Fully validate before returning. A decoded backup is not automatically restored. */
    @Throws(IOException::class)
    fun read(input: InputStream): List<ReadingPosition> {
        val decoder = Charsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
        val reader = JsonReader(InputStreamReader(LimitedInput(input), decoder))
        reader.isLenient = false
        val keys = mutableSetOf<String>()
        var kind: String? = null
        var version: Long? = null
        var positions: List<ReadingPosition>? = null
        reader.beginObject()
        while (reader.hasNext()) {
            when (val key = uniqueName(reader, keys)) {
                "kind" -> kind = reader.strictString()
                "version" -> version = reader.nonNegativeInteger()
                "positions" -> positions = readPositions(reader)
                else -> throw IOException("Unknown backup field: $key")
            }
        }
        reader.endObject()
        if (reader.peek() != JsonToken.END_DOCUMENT) throw IOException("Trailing backup data")
        if (kind != KIND || version != VERSION || positions == null) throw IOException("Unsupported or incomplete backup")
        return positions
    }

    private fun readPositions(reader: JsonReader): List<ReadingPosition> {
        val positions = mutableListOf<ReadingPosition>()
        val identities = mutableSetOf<PositionKey>()
        reader.beginArray()
        while (reader.hasNext()) {
            if (positions.size == MAX_POSITIONS) throw IOException("Too many positions")
            val position = readPosition(reader)
            if (!identities.add(position.key())) throw IOException("Duplicate position")
            positions.add(position)
        }
        reader.endArray()
        return positions
    }

    private fun readPosition(reader: JsonReader): ReadingPosition {
        val keys = mutableSetOf<String>()
        var book: String? = null
        var sha: String? = null
        var bytes: Long? = null
        var format: String? = null
        var locator: String? = null
        var recorded: Long? = null
        reader.beginObject()
        while (reader.hasNext()) {
            when (val key = uniqueName(reader, keys)) {
                "bookId" -> book = reader.strictString()
                "editionSha256" -> sha = reader.strictString()
                "editionBytes" -> bytes = reader.nonNegativeInteger()
                "locatorFormat" -> format = reader.strictString()
                "locator" -> locator = reader.strictString()
                "recordedAtMillis" -> recorded = reader.nonNegativeInteger()
                else -> throw IOException("Unknown position field: $key")
            }
        }
        reader.endObject()
        try {
            val foundFormat = LocatorFormat.entries.firstOrNull { it.storageId == format }
                ?: throw IOException("Unsupported reader format")
            return ReadingPosition(CatalogBookId(book ?: throw IOException("Missing book ID")),
                EditionFingerprint(sha ?: throw IOException("Missing edition hash"), bytes ?: throw IOException("Missing edition size")),
                foundFormat, locator ?: throw IOException("Missing locator"), recorded ?: throw IOException("Missing recording time"))
        } catch (error: IllegalArgumentException) {
            throw IOException("Invalid position", error)
        }
    }

    private fun uniqueName(reader: JsonReader, seen: MutableSet<String>): String {
        val name = reader.nextName()
        if (!seen.add(name)) throw IOException("Duplicate field: $name")
        return name
    }

    private fun JsonReader.strictString(): String {
        if (peek() != JsonToken.STRING) throw IOException("Expected a string")
        val value = nextString()
        var index = 0
        while (index < value.length) {
            val char = value[index++]
            if (Character.isHighSurrogate(char)) {
                if (index == value.length || !Character.isLowSurrogate(value[index++])) throw IOException("Invalid Unicode")
            } else if (Character.isLowSurrogate(char)) throw IOException("Invalid Unicode")
        }
        return value
    }

    private fun JsonReader.nonNegativeInteger(): Long {
        if (peek() != JsonToken.NUMBER) throw IOException("Expected an integer")
        val value = nextString()
        if (!INTEGER.matches(value)) throw IOException("Expected a non-negative integer")
        return value.toLongOrNull() ?: throw IOException("Integer out of range")
    }

    private data class PositionKey(val book: CatalogBookId, val edition: EditionFingerprint, val format: LocatorFormat)
    private fun ReadingPosition.key() = PositionKey(bookId, edition, format)
    private val INTEGER = Regex("^(0|[1-9][0-9]*)$")

    private class LimitedInput(input: InputStream) : FilterInputStream(input) {
        private var count = 0L
        override fun read(): Int {
            val value = `in`.read()
            if (value >= 0 && ++count > MAX_BYTES) throw IOException("Backup exceeds size limit")
            return value
        }
        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            if (length == 0) return 0
            val amount = minOf(length.toLong(), MAX_BYTES.toLong() - count + 1).toInt()
            val read = `in`.read(buffer, offset, amount)
            if (read > 0) {
                count += read
                if (count > MAX_BYTES) throw IOException("Backup exceeds size limit")
            }
            return read
        }
    }

    private class LimitedOutput(output: OutputStream) : FilterOutputStream(output) {
        private var count = 0L
        override fun write(value: Int) {
            if (count == MAX_BYTES.toLong()) throw IOException("Backup exceeds size limit")
            out.write(value)
            count++
        }
        override fun write(buffer: ByteArray, offset: Int, length: Int) {
            if (length.toLong() > MAX_BYTES - count) throw IOException("Backup exceeds size limit")
            out.write(buffer, offset, length)
            count += length
        }
    }
}

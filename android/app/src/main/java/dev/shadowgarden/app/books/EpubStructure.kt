package dev.shadowgarden.app.books

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction

internal data class EpubStructure(val entries: Int, val declaredUncompressedBytes: Long)

/** A bounded ZIP structure check, not EPUBCheck or a safety guarantee for a reader. */
internal object EpubStructureCheck {
    private const val MAX_ENTRIES = 10_000
    private const val MAX_UNCOMPRESSED = 256L * 1024 * 1024
    private const val END_SIZE = 22
    private const val CENTRAL_SIZE = 46
    private const val LOCAL_SIZE = 30

    @Throws(IOException::class)
    fun validate(file: File, checkCancelled: () -> Unit = {}): EpubStructure {
        RandomAccessFile(file, "r").use { zip ->
            val length = zip.length()
            if (length < 58 || length > PrivateBookStore.MAX_BOOK_BYTES) invalid()
            val tailLength = minOf(length, 65_557).toInt()
            val tailStart = length - tailLength
            val tail = read(zip, tailStart, tailLength, length)
            var endIndex = tailLength - END_SIZE
            while (endIndex >= 0 && !(u32(tail, endIndex) == 0x06054b50L &&
                    endIndex + END_SIZE + u16(tail, endIndex + 20) == tailLength)) endIndex--
            if (endIndex < 0) invalid()
            val end = tailStart + endIndex
            val count = u16(tail, endIndex + 10)
            val centralSize = u32(tail, endIndex + 12)
            val centralStart = u32(tail, endIndex + 16)
            if (u16(tail, endIndex + 4) != 0 || u16(tail, endIndex + 6) != 0 ||
                u16(tail, endIndex + 8) != count || count !in 3..MAX_ENTRIES ||
                centralStart + centralSize != end) invalid()

            val first = read(zip, 0, LOCAL_SIZE, centralStart)
            if (u32(first, 0) != 0x04034b50L || u16(first, 8) != 0 || u16(first, 26) != 8 ||
                u32(first, 18) != 20L || u32(first, 22) != 20L) invalid()
            val firstExtra = u16(first, 28)
            val firstBytes = read(zip, LOCAL_SIZE.toLong(), 8 + firstExtra + 20, centralStart)
            if (!firstBytes.copyOfRange(0, 8).contentEquals("mimetype".toByteArray()) ||
                !firstBytes.copyOfRange(8 + firstExtra, firstBytes.size).contentEquals("application/epub+zip".toByteArray())) invalid()

            val names = HashSet<String>()
            val regions = ArrayList<Pair<Long, Long>>(count)
            var cursor = centralStart
            var total = 0L
            var mimeFound = false
            repeat(count) {
                checkCancelled()
                val central = read(zip, cursor, CENTRAL_SIZE, end)
                if (u32(central, 0) != 0x02014b50L) invalid()
                val flags = u16(central, 8)
                val method = u16(central, 10)
                val crc = u32(central, 16)
                val compressed = u32(central, 20)
                val uncompressed = u32(central, 24)
                val nameLength = u16(central, 28)
                val extraLength = u16(central, 30)
                val commentLength = u16(central, 32)
                val localOffset = u32(central, 42)
                if (flags and 0x2041 != 0 || method !in listOf(0, 8) || nameLength == 0 ||
                    u16(central, 34) != 0 || compressed == 0xffffffffL || uncompressed == 0xffffffffL || localOffset == 0xffffffffL) invalid()
                val nameBytes = read(zip, cursor + CENTRAL_SIZE, nameLength, end)
                val name = try { Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(nameBytes)).toString() }
                catch (_: Exception) { invalid() }
                val segments = name.split('/')
                if (name.startsWith('/') || '\\' in name || '\u0000' in name ||
                    segments.withIndex().any { (index, part) -> part == "." || part == ".." || (part.isEmpty() && index != segments.lastIndex) } ||
                    !names.add(name)) invalid()
                val local = read(zip, localOffset, LOCAL_SIZE, centralStart)
                if (u32(local, 0) != 0x04034b50L || u16(local, 6) != flags || u16(local, 8) != method ||
                    u16(local, 26) != nameLength) invalid()
                if (!read(zip, localOffset + LOCAL_SIZE, nameLength, centralStart).contentEquals(nameBytes)) invalid()
                if (flags and 8 == 0 && (u32(local, 14) != crc || u32(local, 18) != compressed || u32(local, 22) != uncompressed)) invalid()
                val dataStart = localOffset + LOCAL_SIZE + nameLength + u16(local, 28)
                val dataEnd = dataStart + compressed
                if (dataStart > centralStart || dataEnd > centralStart) invalid()
                regions.add(localOffset to dataEnd)
                if (name == "mimetype") {
                    if (localOffset != 0L || method != 0 || compressed != 20L || uncompressed != 20L) invalid()
                    mimeFound = true
                }
                total += uncompressed
                if (total > MAX_UNCOMPRESSED) invalid()
                cursor += CENTRAL_SIZE + nameLength + extraLength + commentLength
                if (cursor > end) invalid()
            }
            val sorted = regions.sortedBy { it.first }
            if (sorted.zipWithNext().any { (a, b) -> a.second > b.first } || cursor != end || !mimeFound ||
                "META-INF/container.xml" !in names || names.none { it.endsWith(".opf") }) invalid()
            checkCancelled()
            return EpubStructure(count, total)
        }
    }

    private fun read(zip: RandomAccessFile, offset: Long, count: Int, end: Long): ByteArray {
        if (offset < 0 || count < 0 || offset > end || count.toLong() > end - offset) invalid()
        val result = ByteArray(count)
        zip.seek(offset)
        zip.readFully(result)
        return result
    }
    private fun u16(bytes: ByteArray, offset: Int): Int = (bytes[offset].toInt() and 0xff) or ((bytes[offset + 1].toInt() and 0xff) shl 8)
    private fun u32(bytes: ByteArray, offset: Int): Long = u16(bytes, offset).toLong() or (u16(bytes, offset + 2).toLong() shl 16)
    private fun invalid(): Nothing = throw IOException("Unsupported EPUB ZIP structure")
}

package dev.shadowgarden.app.catalog

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.security.MessageDigest

internal data class StoredCover(val bytes: ByteArray, val writtenAtMillis: Long)
internal interface CoverDiskCache {
    fun read(path: CoverPath): StoredCover?
    fun write(path: CoverPath, bytes: ByteArray)
}

/** Disposable app-cache files; current coordination assumes one app process. */
internal class PrivateCoverDiskCache(
    private val directory: File,
    private val maxBytes: Long = 24L * 1024 * 1024,
    private val maxEntries: Int = 96
) : CoverDiskCache {
    init { require(maxBytes > 0 && maxEntries > 0) }

    override fun read(path: CoverPath): StoredCover? = synchronized(FILE_LOCK) {
        if (!directory.isDirectory) return@synchronized null
        cleanupTemps()
        val file = fileFor(path)
        if (!safeFile(file) || !file.isFile || file.length() !in 1..MAX_COVER_BYTES.toLong()) return@synchronized null
        val bytes = FileInputStream(file).use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8_192)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                if (count == 0) continue
                if (count > MAX_COVER_BYTES - total) throw IOException("Cached cover is too large")
                total += count
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        }
        if (bytes.isEmpty()) null else StoredCover(bytes, file.lastModified())
    }

    override fun write(path: CoverPath, bytes: ByteArray) = synchronized(FILE_LOCK) {
        if (bytes.isEmpty() || bytes.size > MAX_COVER_BYTES || bytes.size.toLong() > maxBytes) throw IOException("Cover exceeds cache limit")
        if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Could not create cover cache")
        cleanupTemps()
        val target = fileFor(path)
        val temp = File(directory, target.name.removeSuffix(".img") + ".tmp")
        if (!safeFile(target) || !safeFile(temp)) throw IOException("Invalid cache file")
        try {
            FileOutputStream(temp).use { output -> output.write(bytes); output.fd.sync() }
            if (!temp.renameTo(target)) throw IOException("Could not replace cached cover")
            prune(target)
        } finally { temp.delete() }
    }

    private fun prune(protected: File) {
        val entries = directory.listFiles().orEmpty().filter { ENTRY.matches(it.name) && safeFile(it) && it.isFile }
            .sortedWith(compareBy<File> { if (it == protected) Long.MAX_VALUE else it.lastModified() }.thenBy { it.name })
        var bytes = entries.sumOf { it.length().coerceAtLeast(0) }
        var count = entries.size
        for (entry in entries) {
            if (bytes <= maxBytes && count <= maxEntries) return
            val size = entry.length().coerceAtLeast(0)
            if (!entry.delete()) {
                protected.delete()
                throw IOException("Could not trim cover cache")
            }
            bytes -= size
            count--
        }
    }

    private fun cleanupTemps() {
        directory.listFiles().orEmpty().filter { TEMP.matches(it.name) && safeFile(it) }.forEach { it.delete() }
    }

    private fun safeFile(file: File): Boolean = file.canonicalFile.parentFile == directory.canonicalFile

    private fun fileFor(path: CoverPath): File {
        val digest = MessageDigest.getInstance("SHA-256").digest(path.value.toByteArray(Charsets.UTF_8))
        val hex = digest.joinToString("") { "%02x".format(it.toInt() and 0xff) }
        return File(directory, "$hex.img")
    }

    private companion object {
        val FILE_LOCK = Any()
        val ENTRY = Regex("^[0-9a-f]{64}\\.img$")
        val TEMP = Regex("^[0-9a-f]{64}\\.tmp$")
    }
}

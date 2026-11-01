package dev.shadowgarden.app.catalog

import android.util.AtomicFile
import android.util.JsonWriter
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileNotFoundException
import java.io.FilterOutputStream
import java.io.IOException
import java.io.OutputStream
import java.io.OutputStreamWriter
import java.nio.charset.CodingErrorAction

internal interface MainCatalogCache {
    fun read(): List<CatalogSeries>?
    fun write(series: List<CatalogSeries>)
}

/** Private, position-free Main catalog snapshot. Call on an I/O thread. */
internal class PrivateMainCatalogCache(private val file: File) : MainCatalogCache {
    private val atomic = AtomicFile(file)

    override fun read(): List<CatalogSeries>? = synchronized(FILE_LOCK) {
        val hadFile = file.exists() || File(file.path + ".bak").exists() || File(file.path + ".new").exists()
        val stream = try { atomic.openRead() } catch (error: FileNotFoundException) {
            if (!hadFile) return@synchronized null
            throw error
        }
        stream.use { CatalogParser.read(it) }
    }

    override fun write(series: List<CatalogSeries>) = synchronized(FILE_LOCK) {
        // Stage and validate the complete, bounded snapshot before opening the old file.
        val bytes = ByteArrayOutputStream()
        val encoder = Charsets.UTF_8.newEncoder().onMalformedInput(CodingErrorAction.REPORT)
            .onUnmappableCharacter(CodingErrorAction.REPORT)
        val writer = JsonWriter(OutputStreamWriter(LimitedOutput(bytes), encoder))
        writer.beginObject().name("series").beginArray()
        for (entry in series) {
            writer.beginObject().name("id").value(entry.id).name("title").value(entry.title)
                .name("author").value(entry.author).name("status").value(entry.status)
                .name("cover").value(entry.cover?.value).name("volumes").beginArray()
            for (volume in entry.volumes) {
                writer.beginObject().name("bookId").value(volume.id.value).name("title").value(volume.title)
                    .name("cover").value(volume.cover?.value).endObject()
            }
            writer.endArray().endObject()
        }
        writer.endArray().endObject()
        writer.flush()
        val encoded = bytes.toByteArray()
        if (CatalogParser.read(encoded.inputStream()) != series) throw IOException("Invalid catalog snapshot")
        val output = atomic.startWrite()
        try {
            output.write(encoded)
            atomic.finishWrite(output)
        } catch (error: Throwable) {
            try { atomic.failWrite(output) } catch (cleanup: Throwable) { error.addSuppressed(cleanup) }
            throw error
        }
    }

    private class LimitedOutput(output: OutputStream) : FilterOutputStream(output) {
        private var count = 0
        override fun write(value: Int) {
            if (count == CatalogParser.MAX_BYTES) throw IOException("Catalog snapshot is too large")
            out.write(value)
            count++
        }
        override fun write(buffer: ByteArray, offset: Int, length: Int) {
            if (length > CatalogParser.MAX_BYTES - count) throw IOException("Catalog snapshot is too large")
            out.write(buffer, offset, length)
            count += length
        }
    }

    private companion object { val FILE_LOCK = Any() }
}

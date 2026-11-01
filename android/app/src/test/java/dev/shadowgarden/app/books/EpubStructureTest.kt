package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.util.concurrent.CancellationException
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class EpubStructureTest {
    @get:Rule val files = TemporaryFolder()
    private val id = CatalogBookId("bk_abcdefghijklmnopqrstuv")

    @Test fun acceptsGeneratedEpubWithStoredMimetypeAndDeflatedEntries() {
        val bytes = epub()
        val file = files.newFile().apply { writeBytes(bytes) }
        val info = EpubStructureCheck.validate(file)
        assertEquals(4, info.entries)
        assertTrue(info.declaredUncompressedBytes >= 20)
        val store = PrivateBookStore(files.newFolder())
        val edition = store.replaceEpub(id, bytes.inputStream())
        store.open(id)!!.use { assertEquals(edition, it.edition); assertArrayEquals(bytes, it.input.readBytes()) }
    }

    @Test fun rejectsWrongMimetypeMissingPartsAndUnsafeNames() {
        val fixtures = listOf(
            epub(mime = "application/not-an-epub"), epub(includeContainer = false),
            epub(includeOpf = false), epub(chapterName = "../escape.xhtml"),
            epub(chapterName = "/absolute.xhtml"), epub(chapterName = "part\\escape.xhtml"),
            epub(chapterName = "part//chapter.xhtml")
        )
        fixtures.forEachIndexed { index, bytes ->
            try { assertRejected(bytes) } catch (error: AssertionError) { throw AssertionError("Unsafe fixture $index was accepted", error) }
        }
    }

    @Test fun rejectsTruncatedArchivesInconsistentHeadersAndOversizedDeclarations() {
        val bytes = epub()
        assertRejected(bytes.copyOf(bytes.size - 1))
        val central = find(bytes, byteArrayOf(0x50, 0x4b, 0x01, 0x02))
        assertTrue(central > 0)
        assertRejected(bytes.copyOf().apply { this[central + 8] = (this[central + 8].toInt() or 1).toByte() })
        assertRejected(bytes.copyOf().apply { this[central + 46] = 'x'.code.toByte() })
        assertRejected(bytes.copyOf().apply { repeat(4) { this[central + 24 + it] = 0x7f } })
        assertRejected(bytes.copyOf().apply { this[0] = 0 })
    }

    @Test fun invalidOrCancelledReplacementPreservesExistingFile() {
        val directory = files.newFolder()
        val store = PrivateBookStore(directory)
        val original = epub()
        store.replaceEpub(id, original.inputStream())
        assertTrue(runCatching { store.replaceEpub(id, "not a zip".byteInputStream()) }.isFailure)
        var checks = 0
        assertTrue(runCatching { store.replaceEpub(id, original.inputStream()) {
            // The four copy-stage checks pass; cancel during ZIP validation.
            if (++checks == 5) throw CancellationException()
        } }.isFailure)
        store.open(id)!!.use { assertArrayEquals(original, it.input.readBytes()) }
        assertFalse(directory.resolve(id.value + ".part").exists())
    }

    private fun assertRejected(bytes: ByteArray) {
        val file = files.newFile().apply { writeBytes(bytes) }
        try { EpubStructureCheck.validate(file); throw AssertionError("Expected invalid archive") }
        catch (_: IOException) { }
    }

    private fun epub(mime: String = "application/epub+zip", includeContainer: Boolean = true,
                     includeOpf: Boolean = true, chapterName: String = "chapter.xhtml"): ByteArray {
        val result = ByteArrayOutputStream()
        ZipOutputStream(result).use { zip ->
            val mimeBytes = mime.toByteArray()
            zip.putNextEntry(ZipEntry("mimetype").apply {
                method = ZipEntry.STORED; size = mimeBytes.size.toLong(); compressedSize = size
                crc = CRC32().apply { update(mimeBytes) }.value
            })
            zip.write(mimeBytes); zip.closeEntry()
            fun add(name: String, value: String) {
                zip.putNextEntry(ZipEntry(name)); zip.write(value.toByteArray()); zip.closeEntry()
            }
            if (includeContainer) add("META-INF/container.xml", "<container/>")
            if (includeOpf) add("book.opf", "<package/>")
            add(chapterName, "<html>Generated</html>")
        }
        return result.toByteArray()
    }
    private fun find(bytes: ByteArray, pattern: ByteArray): Int =
        (0..bytes.size - pattern.size).firstOrNull { index -> pattern.indices.all { bytes[index + it] == pattern[it] } } ?: -1
}

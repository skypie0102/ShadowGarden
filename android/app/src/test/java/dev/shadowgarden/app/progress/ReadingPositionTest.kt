package dev.shadowgarden.app.progress

import java.io.ByteArrayInputStream
import java.io.IOException
import java.io.InputStream
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import java.io.ByteArrayOutputStream
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ReadingPositionTest {
    @Test
    fun fingerprintUsesTheExactBytesAndDoesNotCloseTheCallerStream() {
        var closed = false
        val stream = object : ByteArrayInputStream("abc".toByteArray()) {
            override fun close() { closed = true; super.close() }
        }
        val result = EditionFingerprint.calculate(stream, 3)
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", result.sha256)
        assertEquals(3L, result.byteCount)
        assertTrue(!closed)
    }

    @Test
    fun sameSizeDifferentEpubBytesHaveDifferentIdentities() {
        val first = generatedEpub("original text")
        val second = generatedEpub("replaced text")
        assertEquals(first.size, second.size)
        val a = EditionFingerprint.calculate(first.inputStream(), first.size.toLong())
        val repeated = EditionFingerprint.calculate(first.inputStream(), first.size.toLong())
        val b = EditionFingerprint.calculate(second.inputStream(), second.size.toLong())
        assertEquals(a, repeated)
        assertNotEquals(a, b)
    }

    @Test
    fun byteLimitAndReadFailuresNeverReturnPartialFingerprints() {
        assertThrows(IOException::class.java) { EditionFingerprint.calculate("abcd".byteInputStream(), 3) }
        assertThrows(IllegalArgumentException::class.java) { EditionFingerprint.calculate("".byteInputStream(), -1) }
        val broken = object : InputStream() {
            private var count = 0
            override fun read(): Int {
                if (count++ == 0) return 42
                throw IOException("fixture failure")
            }
        }
        assertThrows(IOException::class.java) { EditionFingerprint.calculate(broken, 50) }
    }

    @Test
    fun zeroLengthReadsDoNotSpinOrDropBytes() {
        val source = object : InputStream() {
            private val remaining = byteArrayOf(97, 98, 99)
            private var index = 0
            private var first = true
            override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
                if (first) { first = false; return 0 }
                if (index == remaining.size) return -1
                val count = minOf(length, remaining.size - index)
                remaining.copyInto(buffer, offset, index, index + count)
                index += count
                return count
            }
            override fun read(): Int = if (index == remaining.size) -1 else remaining[index++].toInt() and 0xff
        }
        assertEquals(EditionFingerprint.calculate("abc".byteInputStream(), 3), EditionFingerprint.calculate(source, 3))
    }

    @Test
    fun invalidIdsFingerprintsAndLocationsAreRejected() {
        assertThrows(IllegalArgumentException::class.java) { CatalogBookId("../book.epub") }
        assertThrows(IllegalArgumentException::class.java) { EditionFingerprint("A".repeat(64), 1) }
        assertThrows(IllegalArgumentException::class.java) { EditionFingerprint("a".repeat(64), -1) }
        val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")
        val edition = EditionFingerprint("a".repeat(64), 42)
        assertThrows(IllegalArgumentException::class.java) { ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, " ", 0) }
        assertThrows(IllegalArgumentException::class.java) { ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, "x\u0000y", 0) }
        assertThrows(IllegalArgumentException::class.java) { ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, "é".repeat(33_000), 0) }
        assertThrows(IllegalArgumentException::class.java) { ReadingPosition(book, edition, LocatorFormat.EPUBJS_CFI, "cfi", -1) }
    }

    private fun generatedEpub(text: String): ByteArray {
        val output = ByteArrayOutputStream()
        ZipOutputStream(output).use { zip ->
            val mimetype = "application/epub+zip".toByteArray()
            val mimeEntry = ZipEntry("mimetype").apply {
                time = 0
                method = ZipEntry.STORED
                size = mimetype.size.toLong()
                compressedSize = size
                crc = CRC32().apply { update(mimetype) }.value
            }
            zip.putNextEntry(mimeEntry)
            zip.write(mimetype)
            zip.closeEntry()
            zip.setLevel(0)
            fun entry(name: String, content: String) {
                zip.putNextEntry(ZipEntry(name).apply { time = 0 })
                zip.write(content.toByteArray())
                zip.closeEntry()
            }
            entry("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
            entry("book.opf", """<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">fixture</dc:identifier><dc:title>Fixture</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-31T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>""")
            entry("nav.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">One</a></li></ol></nav></body></html>""")
            entry("chapter.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><p>$text</p></body></html>""")
        }
        return output.toByteArray()
    }
}

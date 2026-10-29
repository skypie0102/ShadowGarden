package dev.shadowgarden.app

import java.io.File
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Original generated fixture shared by both reader candidates. */
internal object EpubFixture {
    fun create(file: File) {
        val mimetype = "application/epub+zip".toByteArray()
        ZipOutputStream(file.outputStream()).use { zip ->
            val checksum = CRC32().apply { update(mimetype) }
            zip.putNextEntry(ZipEntry("mimetype").apply {
                method = ZipEntry.STORED
                size = mimetype.size.toLong()
                compressedSize = size
                crc = checksum.value
            })
            zip.write(mimetype)
            zip.closeEntry()
            fun entry(name: String, contents: String) {
                zip.putNextEntry(ZipEntry(name))
                zip.write(contents.toByteArray(Charsets.UTF_8))
                zip.closeEntry()
            }
            entry("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
            entry("book.opf", """<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">android-epub-prototype</dc:identifier><dc:title>Android EPUB prototype</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-29T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>""")
            entry("nav.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">One</a></li><li><a href="chapter2.xhtml">Two</a></li></ol></nav></body></html>""")
            entry("chapter1.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><h1>Chapter one</h1><p>This is a generated technical fixture.</p></body></html>""")
            entry("chapter2.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head><body><h1>Chapter two</h1><p>A quiet second chapter begins here.</p></body></html>""")
        }
    }
}

package dev.shadowgarden.app

import java.io.File
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** Original generated fixture shared by both reader candidates. */
internal object EpubFixture {
    fun create(file: File, extended: Boolean = false) {
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
            if (extended) {
                val chapters = (1..12).joinToString("") { number ->
                    """<item id="c$number" href="chapter$number.xhtml" media-type="application/xhtml+xml"/>"""
                }
                val spine = (1..12).joinToString("") { """<itemref idref="c$it"/>""" }
                val toc = (1..12).joinToString("") { """<li><a href="chapter$it.xhtml">Chapter $it</a></li>""" }
                entry("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
                entry("book.opf", """<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">android-extended-fixture</dc:identifier><dc:title>Generated long illustrated fixture</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-29T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="image" href="illustration.png" media-type="image/png"/>$chapters</manifest><spine>$spine</spine></package>""")
                entry("nav.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol>$toc</ol></nav></body></html>""")
                for (number in 1..12) {
                    val paragraphs = (1..80).joinToString("") { paragraph ->
                        "<p>Chapter $number paragraph $paragraph. The garden path winds past trees and lanterns. This original test text provides repeated content for pagination and navigation.</p>"
                    }
                    val illustration = if (number == 12) """<p>Final chapter marker.</p><img src="illustration.png" alt="Generated illustration"/>""" else ""
                    entry("chapter$number.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter $number</title></head><body><h1>Chapter $number</h1>$illustration$paragraphs</body></html>""")
                }
                // Draw an original illustration so no external content is needed.
                val bitmap = Bitmap.createBitmap(256, 192, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                canvas.drawColor(Color.rgb(232, 224, 200))
                val paint = Paint().apply { color = Color.rgb(120, 145, 109) }
                canvas.drawRect(0f, 130f, 256f, 192f, paint)
                paint.color = Color.rgb(242, 196, 109)
                canvas.drawCircle(200f, 43f, 25f, paint)
                paint.color = Color.rgb(71, 103, 90)
                canvas.drawRect(75f, 60f, 145f, 150f, paint)
                zip.putNextEntry(ZipEntry("illustration.png"))
                check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, zip))
                bitmap.recycle()
                zip.closeEntry()
                return
            }
            entry("META-INF/container.xml", """<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>""")
            entry("book.opf", """<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">android-epub-prototype</dc:identifier><dc:title>Android EPUB prototype</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-10-29T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" properties="nav" media-type="application/xhtml+xml"/><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>""")
            entry("nav.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><ol><li><a href="chapter1.xhtml">One</a></li><li><a href="chapter2.xhtml">Two</a></li></ol></nav></body></html>""")
            entry("chapter1.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>One</title></head><body><h1>Chapter one</h1><p>This is a generated technical fixture.</p></body></html>""")
            entry("chapter2.xhtml", """<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Two</title></head><body><h1>Chapter two</h1><p>A quiet second chapter begins here.</p></body></html>""")
        }
    }
}

package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.BufferedSource
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class SignedBookTransferTest {
    @get:Rule val files = TemporaryFolder()
    private val id = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val other = CatalogBookId("bk_0123456789abcdefghijkl")
    private val signed = "/media/shadow-garden/books/fixture/book.epub?sig=fixture.token"
    private fun ticket(url: String = signed, book: CatalogBookId = id, expiry: Long = 2_000) = BookTicket(book, url, expiry)
    private fun client(interceptor: Interceptor) = OkHttpClient.Builder().addInterceptor(interceptor).build()
    private fun response(chain: Interceptor.Chain, status: Int = 200, type: String = "application/epub+zip", body: ResponseBody) =
        Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(status).message("fixture")
            .header("Content-Type", type).body(body).build()
    private fun body(bytes: ByteArray) = bytes.toResponseBody("application/epub+zip".toMediaType())

    @Test fun streamsSignedResponseIntoCheckedPrivateStorage() = runBlocking {
        val bytes = epub("one")
        val store = PrivateBookStore(files.newFolder())
        val calls = AtomicInteger()
        val transfer = SignedBookTransfer(store, client { chain ->
            calls.incrementAndGet()
            assertEquals("https://shadowgarden-bon.pages.dev$signed", chain.request().url.toString())
            assertEquals("identity", chain.request().header("Accept-Encoding"))
            assertNull(chain.request().header("Cookie"))
            assertNull(chain.request().header("Authorization"))
            response(chain, body = body(bytes))
        }, nowSeconds = { 1_000 })
        val edition = transfer.download(id, ticket())
        store.open(id)!!.use { assertEquals(edition, it.edition); assertArrayEquals(bytes, it.input.readBytes()) }
        assertEquals(1, calls.get())
        assertFalse(ticket().toString().contains("fixture.token"))
    }

    @Test fun refusesInvalidExpiredAndForeignTicketsBeforeNetwork() = runBlocking {
        val calls = AtomicInteger()
        val transfer = SignedBookTransfer(PrivateBookStore(files.newFolder()), client { chain ->
            calls.incrementAndGet(); response(chain, body = body(epub("ignored")))
        }, nowSeconds = { 1_000 })
        val invalid = listOf(
            ticket(book = other), ticket("https://evil.example$signed"), ticket("//evil.example$signed"),
            ticket("/media/shadow-garden/books/../secret.epub?sig=fixture.token"),
            ticket("/media/shadow-garden/books/%2e%2e/secret.epub?sig=fixture.token"),
            ticket("/media/shadow-garden/books//book.epub?sig=fixture.token"),
            ticket("/media/shadow-garden/covers/book.epub?sig=fixture.token"),
            ticket("$signed&extra=1"), ticket("$signed#fragment"), ticket("/media/shadow-garden/books/book.epub?sig=onlyone")
        )
        invalid.forEach { value -> assertFailure(TransferFailure.INVALID_TICKET) { transfer.download(id, value) } }
        assertFailure(TransferFailure.EXPIRED_TICKET) { transfer.download(id, ticket(expiry = 1_000)) }
        assertEquals(0, calls.get())
    }

    @Test fun rejectsHttpFailuresWrongContentAndBadLengthsWithoutLosingOldBook() = runBlocking {
        val directory = files.newFolder()
        val store = PrivateBookStore(directory)
        val previous = epub("old")
        store.replaceEpub(id, previous.inputStream())
        val bytes = epub("new")
        val scenarios = listOf(403, 404, 302, 206, 500)
        scenarios.forEach { status ->
            val transfer = SignedBookTransfer(store, client { chain -> response(chain, status, body = body(bytes)) }, { 1_000 })
            val reason = when (status) { 403 -> TransferFailure.TICKET_REJECTED; 404 -> TransferFailure.NOT_FOUND; else -> TransferFailure.RESPONSE }
            assertFailure(reason) { transfer.download(id, ticket()) }
        }
        val wrongType = SignedBookTransfer(store, client { chain -> response(chain, type = "text/html", body = body(bytes)) }, { 1_000 })
        assertFailure(TransferFailure.RESPONSE) { wrongType.download(id, ticket()) }
        val wrongEncoding = SignedBookTransfer(store, client { chain ->
            response(chain, body = body(bytes)).newBuilder().header("Content-Encoding", "gzip").build()
        }, { 1_000 })
        assertFailure(TransferFailure.RESPONSE) { wrongEncoding.download(id, ticket()) }
        val oversized = object : ResponseBody() {
            private val source = Buffer().write(bytes)
            override fun contentType(): MediaType = "application/epub+zip".toMediaType()
            override fun contentLength() = PrivateBookStore.MAX_BOOK_BYTES + 1
            override fun source(): BufferedSource = source
        }
        val tooLarge = SignedBookTransfer(store, client { chain -> response(chain, body = oversized) }, { 1_000 })
        assertFailure(TransferFailure.RESPONSE) { tooLarge.download(id, ticket()) }
        val badLength = object : ResponseBody() {
            private val source = Buffer().write(bytes)
            override fun contentType(): MediaType = "application/epub+zip".toMediaType()
            override fun contentLength() = bytes.size.toLong() + 1
            override fun source(): BufferedSource = source
        }
        val truncated = SignedBookTransfer(store, client { chain -> response(chain, body = badLength) }, { 1_000 })
        assertFailure(TransferFailure.TRANSFER_OR_STORAGE) { truncated.download(id, ticket()) }
        val badBook = SignedBookTransfer(store, client { chain -> response(chain, body = body("not an epub".toByteArray())) }, { 1_000 })
        assertFailure(TransferFailure.TRANSFER_OR_STORAGE) { badBook.download(id, ticket()) }
        store.open(id)!!.use { assertArrayEquals(previous, it.input.readBytes()) }
        assertFalse(directory.resolve(id.value + ".part").exists())
    }

    @Test fun unknownResponseLengthIsStreamedAndValidated() = runBlocking {
        val bytes = epub("streamed")
        val unknown = object : ResponseBody() {
            private val source = Buffer().write(bytes)
            override fun contentType(): MediaType = "application/epub+zip".toMediaType()
            override fun contentLength() = -1L
            override fun source(): BufferedSource = source
        }
        val store = PrivateBookStore(files.newFolder())
        val transfer = SignedBookTransfer(store, client { chain -> response(chain, body = unknown) }, { 1_000 })
        transfer.download(id, ticket())
        store.open(id)!!.use { assertArrayEquals(bytes, it.input.readBytes()) }
    }

    @Test fun cancellationCancelsTheRequestAndDoesNotReplaceExistingBook() = runBlocking {
        val directory = files.newFolder()
        val store = PrivateBookStore(directory)
        val previous = epub("old")
        store.replaceEpub(id, previous.inputStream())
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val done = CountDownLatch(1)
        val canceled = AtomicBoolean()
        val transfer = SignedBookTransfer(store, client { chain ->
            entered.countDown(); release.await(10, TimeUnit.SECONDS)
            canceled.set(chain.call().isCanceled()); done.countDown()
            response(chain, body = body(epub("new")))
        }, { 1_000 })
        try {
            val job = async { transfer.download(id, ticket()) }
            assertTrue(withContext(Dispatchers.IO) { entered.await(5, TimeUnit.SECONDS) })
            job.cancelAndJoin()
            release.countDown()
            assertTrue(withContext(Dispatchers.IO) { done.await(5, TimeUnit.SECONDS) })
            assertTrue(canceled.get())
            store.open(id)!!.use { assertArrayEquals(previous, it.input.readBytes()) }
        } finally { release.countDown() }
    }

    private suspend fun assertFailure(reason: TransferFailure, block: suspend () -> Unit) {
        try { block(); throw AssertionError("Expected transfer failure") }
        catch (error: BookTransferException) {
            assertEquals(reason, error.failure)
            assertFalse(error.toString().contains("fixture.token"))
        }
    }
    private fun epub(text: String): ByteArray {
        val result = ByteArrayOutputStream()
        ZipOutputStream(result).use { zip ->
            val mime = "application/epub+zip".toByteArray()
            zip.putNextEntry(ZipEntry("mimetype").apply {
                method = ZipEntry.STORED; size = mime.size.toLong(); compressedSize = size
                crc = CRC32().apply { update(mime) }.value
            })
            zip.write(mime); zip.closeEntry()
            listOf("META-INF/container.xml" to "<container/>", "book.opf" to "<package/>", "chapter.xhtml" to text).forEach { (name, value) ->
                zip.putNextEntry(ZipEntry(name)); zip.write(value.toByteArray()); zip.closeEntry()
            }
        }
        return result.toByteArray()
    }
}

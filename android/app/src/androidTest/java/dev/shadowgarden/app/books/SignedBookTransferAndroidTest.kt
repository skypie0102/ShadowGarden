package dev.shadowgarden.app.books

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.EpubFixture
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.File
import java.util.UUID
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SignedBookTransferAndroidTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val directory = File(context.noBackupFilesDir, "transfer-test-${UUID.randomUUID()}")
    private val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val ticket = BookTicket(book, "/media/shadow-garden/books/generated.epub?sig=fixture.token", 2_000)
    @After fun cleanup() { directory.deleteRecursively() }

    @Test fun generatedTransferIsSavedAndRejectedTicketKeepsIt() = runBlocking {
        directory.mkdirs()
        val fixture = File(directory, "generated.epub")
        EpubFixture.create(fixture, true)
        val bytes = fixture.readBytes()
        val store = PrivateBookStore(directory)
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("fixture")
                .header("Content-Type", "application/epub+zip").body(bytes.toResponseBody()).build()
        }.build()
        val edition = SignedBookTransfer(store, http, { 1_000 }).download(book, ticket)
        val rejected = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(403).message("fixture")
                .body(ByteArray(0).toResponseBody()).build()
        }.build()
        try { SignedBookTransfer(store, rejected, { 1_000 }).download(book, ticket); throw AssertionError("Expected rejection") }
        catch (error: BookTransferException) { assertEquals(TransferFailure.TICKET_REJECTED, error.failure) }
        store.open(book)!!.use { assertEquals(edition, it.edition); assertArrayEquals(bytes, it.input.readBytes()) }
        assertTrue(!File(directory, book.value + ".part").exists())
    }
}

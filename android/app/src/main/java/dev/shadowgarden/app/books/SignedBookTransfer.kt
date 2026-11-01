package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.CancellationException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Authenticator
import okhttp3.Call
import okhttp3.Callback
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/** Issued by the server after verification; never log or persist the signed URL. */
internal class BookTicket(val bookId: CatalogBookId, internal val relativeUrl: String, val expiresAtSeconds: Long) {
    override fun toString(): String = "BookTicket(redacted)"
}

internal enum class TransferFailure { INVALID_TICKET, EXPIRED_TICKET, TICKET_REJECTED, NOT_FOUND, RESPONSE, TRANSFER_OR_STORAGE }
internal class BookTransferException(val failure: TransferFailure) : IOException("Book transfer failed: $failure")

/** A single ticketed transfer. Does not obtain tickets or implement verification or retries. */
internal class SignedBookTransfer(
    private val store: PrivateBookStore,
    client: OkHttpClient = OkHttpClient(),
    private val nowSeconds: () -> Long = { System.currentTimeMillis() / 1_000 }
) {
    // The injected client is a test seam; production uses normal platform TLS.
    private val http = client.newBuilder().followRedirects(false).followSslRedirects(false)
        .cookieJar(CookieJar.NO_COOKIES).authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
        .cache(null).retryOnConnectionFailure(false).connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS).callTimeout(2, TimeUnit.MINUTES).build()

    /** Caller owns ticket acquisition and renewal. Cancellation cancels the HTTP call. */
    suspend fun download(bookId: CatalogBookId, ticket: BookTicket, expected: EditionFingerprint? = null): EditionFingerprint {
        val path = checkedPath(bookId, ticket)
        return suspendCancellableCoroutine { continuation ->
            val request = Request.Builder().url(ORIGIN + path).header("Accept", "application/epub+zip")
                .header("Accept-Encoding", "identity").get().build()
            val call = http.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, error: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(BookTransferException(TransferFailure.TRANSFER_OR_STORAGE))
                }
                override fun onResponse(call: Call, response: Response) {
                    try {
                        val result = response.use {
                            if (!continuation.isActive) throw CancellationException()
                            when (it.code) {
                                403 -> throw BookTransferException(TransferFailure.TICKET_REJECTED)
                                404 -> throw BookTransferException(TransferFailure.NOT_FOUND)
                                200 -> Unit
                                else -> throw BookTransferException(TransferFailure.RESPONSE)
                            }
                            val type = it.header("Content-Type")?.substringBefore(';')?.trim()?.lowercase()
                            val encoding = it.header("Content-Encoding")?.trim()?.lowercase()
                            val body = it.body ?: throw BookTransferException(TransferFailure.RESPONSE)
                            val length = body.contentLength()
                            if (type != "application/epub+zip" || (encoding != null && encoding != "identity") ||
                                length == 0L || length > PrivateBookStore.MAX_BOOK_BYTES ||
                                (expected != null && length >= 0 && expected.byteCount != length)) {
                                throw BookTransferException(TransferFailure.RESPONSE)
                            }
                            val input = LengthCheckedInput(body.byteStream(), length)
                            store.replaceEpub(bookId, input, expected) {
                                if (!continuation.isActive) throw CancellationException()
                            }
                        }
                        if (continuation.isActive) continuation.resume(result)
                    } catch (error: CancellationException) {
                        if (continuation.isActive) continuation.resumeWithException(error)
                    } catch (error: Exception) {
                        // Do not propagate network exceptions that may include the signed URL.
                        if (continuation.isActive) continuation.resumeWithException(
                            if (error is BookTransferException) error else BookTransferException(TransferFailure.TRANSFER_OR_STORAGE))
                    }
                }
            })
        }
    }

    private fun checkedPath(bookId: CatalogBookId, ticket: BookTicket): String {
        val url = ticket.relativeUrl
        if (ticket.bookId != bookId || url.length > 9_300 || !SIGNED_PATH.matches(url))
            throw BookTransferException(TransferFailure.INVALID_TICKET)
        val path = url.substringBefore('?')
        val key = path.removePrefix("/media/")
        val signature = url.substringAfter("?sig=")
        if (key.length > 1_024 || signature.length > 8_192 ||
            key.split('/').any { it.isEmpty() || it == "." || it == ".." })
            throw BookTransferException(TransferFailure.INVALID_TICKET)
        if (ticket.expiresAtSeconds <= nowSeconds()) throw BookTransferException(TransferFailure.EXPIRED_TICKET)
        return url
    }

    private class LengthCheckedInput(private val input: InputStream, private val expectedLength: Long) : InputStream() {
        private var count = 0L
        override fun read(): Int {
            val byte = input.read()
            if (byte < 0) complete() else add(1)
            return byte
        }
        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            val read = input.read(buffer, offset, length)
            if (read < 0) complete() else add(read)
            return read
        }
        private fun add(read: Int) {
            count += read
            if (expectedLength >= 0 && count > expectedLength) throw IOException("Unexpected response length")
        }
        private fun complete() {
            if (expectedLength >= 0 && count != expectedLength) throw IOException("Unexpected response length")
        }
    }

    private companion object {
        const val ORIGIN = "https://shadowgarden-bon.pages.dev"
        val SIGNED_PATH = Regex("^/media/shadow-garden/books/[A-Za-z0-9_./-]+\\.epub\\?sig=[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$")
    }
}

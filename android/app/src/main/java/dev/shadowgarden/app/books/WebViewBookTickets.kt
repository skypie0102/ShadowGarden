package dev.shadowgarden.app.books

import android.net.Uri
import android.webkit.WebView
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.IOException
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import org.json.JSONTokener

internal enum class TicketRequestFailure { WRONG_PAGE, ACCESS_UNAVAILABLE, ACCESS_FAILED, INVALID_RESPONSE, TIMEOUT }
internal class TicketRequestException(val failure: TicketRequestFailure) : IOException("Book access failed: $failure")

/**
 * Calls the site's existing book-access flow in a caller-owned visible WebView.
 * The caller must block untrusted top-level navigation, remove JS interfaces,
 * cancel/destroy the view on dismissal, and handle its lifecycle on the main thread.
 * This is an integration boundary, not a complete Garden Pass UI.
 */
internal class WebViewBookTickets(
    private val webView: WebView,
    private val nowSeconds: () -> Long = { System.currentTimeMillis() / 1_000 },
    private val timeoutMillis: Long = 180_000,
    private val pollMillis: Long = 200
) {
    init { require(timeoutMillis > 0 && pollMillis > 0) }

    suspend fun request(bookId: CatalogBookId): BookTicket = withContext(Dispatchers.Main.immediate) {
        val slot = JSONObject.quote(UUID.randomUUID().toString())
        val book = JSONObject.quote(bookId.value)
        val started = withTimeoutOrNull(timeoutMillis) {
            try {
                requirePage()
                val initial = evaluate("""
                    (function(){
                      if(location.origin!=="https://shadowgarden-bon.pages.dev" || location.pathname!=="/series.html") return "wrong";
                      if(!window.ShadowGardenBookAccess || typeof window.ShadowGardenBookAccess.resolve!=="function") return "unavailable";
                      const slots=window.__sgAndroidTicketsV1 || (window.__sgAndroidTicketsV1=Object.create(null));
                      slots[$slot]={state:"pending"};
                      Promise.resolve().then(()=>window.ShadowGardenBookAccess.resolve($book,{force:true})).then(
                        result=>{if(slots[$slot]) slots[$slot]={state:"ready",bookId:result.bookId,url:result.url,expiresAt:result.expiresAt};},
                        ()=>{if(slots[$slot]) slots[$slot]={state:"error"};});
                      return "started";
                    })()
                """.trimIndent())
                when (decodeString(initial)) {
                    "started" -> Unit
                    "wrong" -> throw TicketRequestException(TicketRequestFailure.WRONG_PAGE)
                    else -> throw TicketRequestException(TicketRequestFailure.ACCESS_UNAVAILABLE)
                }
                while (true) {
                    delay(pollMillis)
                    val value = evaluate("""
                        (function(){
                          if(location.origin!=="https://shadowgarden-bon.pages.dev" || location.pathname!=="/series.html") return JSON.stringify({state:"wrong"});
                          const slots=window.__sgAndroidTicketsV1;
                          return JSON.stringify((slots && slots[$slot]) || {state:"missing"});
                        })()
                    """.trimIndent())
                    val result = decodeObject(value)
                    when (result.optString("state")) {
                        "pending" -> Unit
                        "ready" -> return@withTimeoutOrNull ticketFrom(result, bookId)
                        "wrong" -> throw TicketRequestException(TicketRequestFailure.WRONG_PAGE)
                        "error" -> throw TicketRequestException(TicketRequestFailure.ACCESS_FAILED)
                        else -> throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
                    }
                }
                @Suppress("UNREACHABLE_CODE") throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
            } finally {
                // Site resolve() has no cancellation API: the owner must dismiss/destroy the view.
                if (isExpectedPage()) try {
                    webView.evaluateJavascript("if(window.__sgAndroidTicketsV1) delete window.__sgAndroidTicketsV1[$slot]", null)
                } catch (_: RuntimeException) { }
            }
        }
        started ?: throw TicketRequestException(TicketRequestFailure.TIMEOUT)
    }

    private fun ticketFrom(result: JSONObject, bookId: CatalogBookId): BookTicket {
        val returnedId = result.opt("bookId") as? String ?: throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
        val url = result.opt("url") as? String ?: throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
        val expires = when (val value = result.opt("expiresAt")) {
            is Int -> value.toLong()
            is Long -> value
            else -> throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
        }
        if (returnedId != bookId.value) throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
        val ticket = BookTicket(bookId, url, expires)
        try { BookTicketPolicy.checkedPath(bookId, ticket, nowSeconds()) }
        catch (_: BookTransferException) { throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE) }
        return ticket
    }

    private fun requirePage() {
        if (!isExpectedPage() || !webView.settings.javaScriptEnabled || webView.settings.allowFileAccess ||
            webView.settings.allowContentAccess) throw TicketRequestException(TicketRequestFailure.WRONG_PAGE)
    }
    private fun isExpectedPage(): Boolean {
        val url = webView.url ?: return false
        val uri = Uri.parse(url)
        return uri.scheme == "https" && uri.host.equals("shadowgarden-bon.pages.dev", true) &&
            (uri.port == -1 || uri.port == 443) && uri.userInfo == null && uri.encodedPath == "/series.html" && uri.fragment == null
    }

    private suspend fun evaluate(script: String): String {
        requirePage()
        val value = suspendCancellableCoroutine<String> { continuation ->
            try {
                webView.evaluateJavascript(script) { result -> if (continuation.isActive) continuation.resume(result ?: "null") }
            } catch (_: RuntimeException) {
                if (continuation.isActive) continuation.resumeWithException(TicketRequestException(TicketRequestFailure.ACCESS_UNAVAILABLE))
            }
        }
        requirePage()
        if (value.length > 24_000) throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE)
        return value
    }
    private fun decodeString(value: String): String = try { JSONTokener(value).nextValue() as? String ?: "" }
        catch (_: Exception) { "" }
    private fun decodeObject(value: String): JSONObject = try {
        JSONObject(decodeString(value))
    } catch (_: Exception) { throw TicketRequestException(TicketRequestFailure.INVALID_RESPONSE) }
}

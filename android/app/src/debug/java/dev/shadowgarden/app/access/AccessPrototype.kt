package dev.shadowgarden.app.access

import java.net.URI

/** Test-only protocol sketch. No HTTP, WebView, cookies or production UI are implemented here. */
internal data class Challenge(val siteKey: String, val action: String)
internal data class Ticket(val bookId: String, val url: String, val expiresAt: Long)
internal sealed interface TicketResult {
    data class Issued(val ticket: Ticket) : TicketResult
    data class HumanRequired(val challenge: Challenge) : TicketResult
    data class Failed(val status: Int) : TicketResult
}
internal data class DownloadResult(val status: Int, val bytes: ByteArray = byteArrayOf())
internal data class UnlockResult(val status: Int, val expiresAt: Long = 0)

/** Fakeable boundary; a future implementation must enforce TLS, cookies, origin and redirects. */
internal interface AccessTransport {
    fun requestTicket(bookId: String): TicketResult
    fun verifyHuman(token: String): Boolean
    fun download(uri: URI): DownloadResult
    fun unlockKeeper(keeperToken: String, turnstileToken: String): UnlockResult
    fun keeperStatus(keeperToken: String): Int
    fun revokeKeeper(): Boolean
}

internal class AccessFailure(message: String) : Exception(message)

/** A deliberately synchronous experiment, not an Android networking implementation. */
internal class AccessPrototype(private val origin: URI, private val transport: AccessTransport, private val now: () -> Long) {
    private var keeperToken: String? = null
    private var keeperExpiresAt = 0L
    val keeperUnlocked: Boolean get() = keeperToken != null && now() < keeperExpiresAt

    init {
        require(origin.scheme == "https" && origin.host != null && origin.userInfo == null &&
            origin.path.orEmpty().let { it == "" || it == "/" } && origin.query == null && origin.fragment == null)
    }

    /** Retries one rejected download with a new ticket. Verification is never accepted locally. */
    fun download(bookId: String, solve: (Challenge) -> String?): ByteArray {
        require(Regex("^bk_[A-Za-z0-9_-]{22}$").matches(bookId))
        repeat(2) { attempt ->
            val ticket = issueTicket(bookId, solve)
            val uri = validateTicket(bookId, ticket)
            val response = transport.download(uri)
            if (response.status == 200) return response.bytes
            if (response.status != 403 || attempt != 0) throw AccessFailure("Download failed")
        }
        throw AccessFailure("Download failed")
    }

    private fun issueTicket(bookId: String, solve: (Challenge) -> String?): Ticket {
        var verified = false
        while (true) {
            when (val response = transport.requestTicket(bookId)) {
                is TicketResult.Issued -> return response.ticket
                is TicketResult.Failed -> throw AccessFailure("Ticket request failed")
                is TicketResult.HumanRequired -> {
                    if (verified || response.challenge.action != "book_access" || response.challenge.siteKey.isBlank()) {
                        throw AccessFailure("Invalid or repeated human challenge")
                    }
                    val token = solve(response.challenge) ?: throw AccessFailure("Verification cancelled")
                    if (token.isBlank() || !transport.verifyHuman(token)) throw AccessFailure("Verification failed")
                    verified = true
                }
            }
        }
    }

    private fun validateTicket(bookId: String, ticket: Ticket): URI {
        val uri = try { origin.resolve(ticket.url) } catch (_: IllegalArgumentException) { throw AccessFailure("Invalid ticket URL") }
        val port = if (uri.port == -1) 443 else uri.port
        val expectedPort = if (origin.port == -1) 443 else origin.port
        if (ticket.bookId != bookId || ticket.expiresAt <= now() || uri.scheme != "https" ||
            !uri.host.equals(origin.host, ignoreCase = true) || port != expectedPort ||
            uri.userInfo != null || uri.fragment != null || uri.rawPath != uri.normalize().rawPath ||
            !uri.rawPath.orEmpty().startsWith("/media/shadow-garden/books/") ||
            uri.rawPath.contains('%') || !Regex("(?:^|&)sig=[^&]+").containsMatchIn(uri.rawQuery.orEmpty())) {
            throw AccessFailure("Invalid ticket")
        }
        return uri
    }

    fun unlockKeeper(credential: String, challenge: Challenge, solve: (Challenge) -> String?): Boolean {
        // Always clear prior state before attempting a new unlock.
        keeperToken = null
        keeperExpiresAt = 0
        if (credential.isBlank() || challenge.action != "admin_access" || challenge.siteKey.isBlank()) return false
        val turnstileToken = solve(challenge)?.takeIf { it.isNotBlank() } ?: return false
        val result = transport.unlockKeeper(credential, turnstileToken)
        if (result.status != 200 || result.expiresAt <= now()) return false
        keeperToken = credential
        keeperExpiresAt = result.expiresAt
        return true
    }

    fun keeperStatus(): Boolean {
        val token = keeperToken
        if (token == null || !keeperUnlocked) {
            keeperToken = null
            keeperExpiresAt = 0
            return false
        }
        val status = transport.keeperStatus(token)
        if (status == 401) {
            keeperToken = null
            keeperExpiresAt = 0
        }
        return status == 200
    }

    /** Lock is local immediately; false reports that server revocation did not complete. */
    fun lockKeeper(): Boolean {
        keeperToken = null
        keeperExpiresAt = 0
        return transport.revokeKeeper()
    }
}

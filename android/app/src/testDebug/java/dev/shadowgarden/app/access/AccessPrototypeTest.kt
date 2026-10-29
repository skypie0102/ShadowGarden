package dev.shadowgarden.app.access

import java.net.URI
import org.junit.Assert.*
import org.junit.Test

class AccessPrototypeTest {
    private val book = "bk_1234567890123456789012"
    private val challenge = Challenge("test-site-key", "book_access")
    private val adminChallenge = Challenge("test-site-key", "admin_access")
    private var clock = 1_000L
    private val transport = FakeTransport()
    private val access = AccessPrototype(URI("https://test.invalid"), transport) { clock }

    @Test fun humanChallengeIsVerifiedByTransportBeforeTicketIsRetried() {
        transport.tickets.add(TicketResult.HumanRequired(challenge))
        transport.tickets.add(issued())
        transport.downloads.add(DownloadResult(200, "fixture".toByteArray()))
        assertArrayEquals("fixture".toByteArray(), access.download(book) { "test-response" })
        assertEquals(listOf("ticket", "verify", "ticket", "download"), transport.calls)
    }

    @Test fun rejectedCancelledAndRepeatedChallengesFailClosed() {
        transport.tickets.add(TicketResult.HumanRequired(challenge))
        transport.verified = false
        assertFailure { access.download(book) { "bad-response" } }
        assertEquals(listOf("ticket", "verify"), transport.calls)
        transport.reset()
        transport.tickets.add(TicketResult.HumanRequired(challenge))
        assertFailure { access.download(book) { null } }
        assertEquals(listOf("ticket"), transport.calls)
        transport.reset()
        transport.tickets.add(TicketResult.HumanRequired(challenge))
        transport.tickets.add(TicketResult.HumanRequired(challenge))
        assertFailure { access.download(book) { "test-response" } }
        assertEquals(listOf("ticket", "verify", "ticket"), transport.calls)
    }

    @Test fun rejectedDownloadRenewsOnceAndDoesNotLoopOnFailure() {
        transport.tickets.add(issued()); transport.tickets.add(issued())
        transport.downloads.add(DownloadResult(403)); transport.downloads.add(DownloadResult(200, byteArrayOf(7)))
        assertArrayEquals(byteArrayOf(7), access.download(book) { null })
        assertEquals(listOf("ticket", "download", "ticket", "download"), transport.calls)
        transport.reset()
        transport.tickets.add(issued()); transport.tickets.add(issued())
        transport.downloads.add(DownloadResult(403)); transport.downloads.add(DownloadResult(403))
        assertFailure { access.download(book) { null } }
        assertEquals(listOf("ticket", "download", "ticket", "download"), transport.calls)
    }

    @Test fun renewalCanRequireHumanVerificationAgain() {
        transport.tickets.add(issued())
        transport.tickets.add(TicketResult.HumanRequired(challenge))
        transport.tickets.add(issued())
        transport.downloads.add(DownloadResult(403))
        transport.downloads.add(DownloadResult(200, byteArrayOf(8)))
        assertArrayEquals(byteArrayOf(8), access.download(book) { "test-response" })
        assertEquals(listOf("ticket", "download", "ticket", "verify", "ticket", "download"), transport.calls)
    }

    @Test fun malformedOrForeignTicketsNeverReachDownloadTransport() {
        val badTickets = listOf(
            ticket(url = "https://elsewhere.invalid/media/shadow-garden/books/book.epub?sig=x"),
            ticket(url = "http://test.invalid/media/shadow-garden/books/book.epub?sig=x"),
            ticket(url = "//test.invalid:444/media/shadow-garden/books/book.epub?sig=x"),
            ticket(url = "/media/shadow-garden/books/../other.epub?sig=x"),
            ticket(url = "/media/shadow-garden/books/%2e%2e/other.epub?sig=x"),
            ticket(url = "/media/shadow-garden/books/book.epub"),
            ticket(url = "/media/shadow-garden/books/book.epub?sig=x#fragment"),
            ticket(expiresAt = clock), ticket(bookId = "bk_abcdefghijklmnopqrstuv")
        )
        badTickets.forEach { value ->
            transport.reset(); transport.tickets.add(TicketResult.Issued(value))
            assertFailure { access.download(book) { null } }
            assertEquals(listOf("ticket"), transport.calls)
        }
    }

    @Test fun keeperRequiresServerUnlockAndLockRevokesAfterClearingLocalState() {
        assertTrue(access.unlockKeeper("test-keeper-key", adminChallenge) { "test-response" })
        assertTrue(access.keeperStatus())
        transport.onRevoke = { assertFalse(access.keeperUnlocked) }
        assertTrue(access.lockKeeper()); assertFalse(access.keeperStatus())
        assertEquals(listOf("unlock", "status", "revoke"), transport.calls)
    }

    @Test fun keeperDenialExpiryAndRevocationFailureStayLocked() {
        transport.unlockStatus = 401
        assertFalse(access.unlockKeeper("test-key", adminChallenge) { "test-response" })
        assertFalse(access.keeperStatus())
        transport.unlockStatus = 200
        assertTrue(access.unlockKeeper("test-key", adminChallenge) { "test-response" })
        transport.status = 401
        assertFalse(access.keeperStatus()); assertFalse(access.keeperUnlocked)
        assertTrue(access.unlockKeeper("test-key", adminChallenge) { "test-response" })
        clock = 2_000
        assertFalse(access.keeperStatus()); assertFalse(access.keeperUnlocked)
        transport.revokeSuccess = false
        assertFalse(access.lockKeeper()); assertFalse(access.keeperUnlocked)
    }

    @Test fun wrongChallengeOrCancelledKeeperVerificationNeverUnlocks() {
        assertFalse(access.unlockKeeper("test-key", challenge) { "test-response" })
        assertFalse(access.unlockKeeper("test-key", adminChallenge) { null })
        assertTrue(transport.calls.isEmpty())
    }

    private fun ticket(bookId: String = book, url: String = "/media/shadow-garden/books/book.epub?sig=test", expiresAt: Long = 1_900) = Ticket(bookId, url, expiresAt)
    private fun issued() = TicketResult.Issued(ticket())
    private fun assertFailure(block: () -> Unit) {
        try { block(); fail("Expected access to fail") } catch (_: AccessFailure) { }
    }

    private class FakeTransport : AccessTransport {
        val calls = mutableListOf<String>()
        val tickets = ArrayDeque<TicketResult>()
        val downloads = ArrayDeque<DownloadResult>()
        var verified = true
        var unlockStatus = 200
        var status = 200
        var revokeSuccess = true
        var onRevoke: () -> Unit = {}
        fun reset() { calls.clear(); tickets.clear(); downloads.clear(); verified = true }
        override fun requestTicket(bookId: String): TicketResult { calls.add("ticket"); return tickets.removeFirst() }
        override fun verifyHuman(token: String): Boolean { calls.add("verify"); return verified }
        override fun download(uri: URI): DownloadResult { calls.add("download"); return downloads.removeFirst() }
        override fun unlockKeeper(keeperToken: String, turnstileToken: String): UnlockResult { calls.add("unlock"); return UnlockResult(unlockStatus, 1_900) }
        override fun keeperStatus(keeperToken: String): Int { calls.add("status"); return status }
        override fun revokeKeeper(): Boolean { calls.add("revoke"); onRevoke(); return revokeSuccess }
    }
}

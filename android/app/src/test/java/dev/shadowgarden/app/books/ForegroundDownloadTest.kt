package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ForegroundDownloadTest {
    private val id = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val ticket = BookTicket(id, "/media/shadow-garden/books/a.epub?sig=fixture.token", 2_000)
    private val edition = EditionFingerprint.calculate("fixture".byteInputStream(), 100)

    @Test fun obtainsTicketBeforeTransferAndReportsSaved() = runBlocking {
        val events = mutableListOf<String>()
        val result = runForegroundDownload(
            requestTicket = { events.add("ticket"); ticket },
            transfer = { value -> assertTrue(value === ticket); events.add("transfer"); edition },
            onDownloading = { events.add("downloading") }
        )
        assertEquals(listOf("ticket", "downloading", "transfer"), events)
        assertEquals(DownloadPhase.SAVED, result.phase)
        assertTrue(result.message.contains("save your reading position locally"))
    }

    @Test fun verificationAndTransferFailuresGiveSafeRetryMessages() = runBlocking {
        var transferred = false
        val access = runForegroundDownload(
            requestTicket = { throw TicketRequestException(TicketRequestFailure.ACCESS_FAILED) },
            transfer = { transferred = true; edition }, onDownloading = {}
        )
        assertEquals(DownloadPhase.FAILED, access.phase)
        assertFalse(transferred)
        val expired = runForegroundDownload(
            requestTicket = { ticket }, transfer = { throw BookTransferException(TransferFailure.TICKET_REJECTED) }, onDownloading = {}
        )
        assertEquals(DownloadPhase.FAILED, expired.phase)
        assertTrue(expired.message.contains("Retry"))
        assertFalse(expired.message.contains("fixture.token"))
        val missing = runForegroundDownload(
            requestTicket = { ticket }, transfer = { throw BookTransferException(TransferFailure.NOT_FOUND) }, onDownloading = {}
        )
        assertTrue(missing.message.contains("no longer available"))
    }

    @Test fun cancellationPropagatesWithoutStartingTransfer() = runBlocking {
        var transferred = false
        try {
            runForegroundDownload(requestTicket = { throw CancellationException() },
                transfer = { transferred = true; edition }, onDownloading = {})
            throw AssertionError("Expected cancellation")
        } catch (_: CancellationException) { }
        assertFalse(transferred)
    }
}

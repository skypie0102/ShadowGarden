package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.EditionFingerprint
import kotlinx.coroutines.CancellationException

internal suspend fun runForegroundDownload(
    requestTicket: suspend () -> BookTicket,
    transfer: suspend (BookTicket) -> EditionFingerprint,
    onDownloading: () -> Unit
): DownloadState = try {
    val ticket = requestTicket()
    onDownloading()
    transfer(ticket)
    DownloadState(DownloadPhase.SAVED, "Saved on this device. Reading in the app is still in development; uninstalling the app removes saved books.")
} catch (error: CancellationException) { throw error }
catch (error: BookTransferException) {
    DownloadState(DownloadPhase.FAILED, when (error.failure) {
        TransferFailure.TICKET_REJECTED, TransferFailure.EXPIRED_TICKET -> "Book access expired. Retry to request access again."
        TransferFailure.NOT_FOUND -> "This book is no longer available in the current catalog."
        else -> "The EPUB could not be saved. Check your connection and storage, then retry."
    })
} catch (_: Exception) {
    DownloadState(DownloadPhase.FAILED, "Garden Pass did not complete. Check your connection and retry.")
}

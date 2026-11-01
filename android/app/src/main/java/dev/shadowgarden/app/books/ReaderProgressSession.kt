package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import dev.shadowgarden.app.progress.LocatorFormat
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPosition
import java.io.Closeable
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch

internal interface ReaderPositionWriter : Closeable {
    fun save(position: ReadingPosition, expectedRevision: Long?): ProgressSaveResult
}

internal enum class ReaderSaveResult { SAVED, CONFLICT, FAILED, INVALID, CLOSED }

/** Serializes writes for one open edition; stale revisions are never overwritten. */
internal class ReaderProgressSession(
    private val bookId: CatalogBookId,
    private val edition: EditionFingerprint,
    private var revision: Long?,
    private val writer: ReaderPositionWriter,
    private val nowMillis: () -> Long = { System.currentTimeMillis().coerceAtLeast(0) }
) {
    private data class Request(val cfi: String, val result: CompletableDeferred<ReaderSaveResult>)
    private val requests = Channel<Request>(Channel.UNLIMITED)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    init {
        scope.launch {
            var conflicted = false
            try {
                for (request in requests) {
                    val result = if (conflicted) ReaderSaveResult.CONFLICT else try {
                        val position = ReadingPosition(bookId, edition, LocatorFormat.EPUBJS_CFI, request.cfi, nowMillis())
                        when (val saved = writer.save(position, revision)) {
                            is ProgressSaveResult.Saved -> { revision = saved.revision; ReaderSaveResult.SAVED }
                            is ProgressSaveResult.Conflict -> { conflicted = true; ReaderSaveResult.CONFLICT }
                        }
                    } catch (_: Exception) { ReaderSaveResult.FAILED }
                    request.result.complete(result)
                }
            } finally { try { writer.close() } catch (_: Exception) { } }
        }
    }

    /** A cancelled caller does not cancel a write that has already been queued. */
    suspend fun save(cfi: String): ReaderSaveResult {
        if (!validReaderCfi(cfi)) return ReaderSaveResult.INVALID
        val reply = CompletableDeferred<ReaderSaveResult>()
        if (requests.trySend(Request(cfi, reply)).isFailure) return ReaderSaveResult.CLOSED
        return reply.await()
    }

    /** Drains accepted writes and closes the store on the I/O worker. */
    fun close() { requests.close() }
}

internal fun validReaderCfi(value: String): Boolean = value.length in 11..65_536 &&
    value.startsWith("epubcfi(") && value.endsWith(')') &&
    value.none { it.isISOControl() } && value.toByteArray(Charsets.UTF_8).size <= 65_536

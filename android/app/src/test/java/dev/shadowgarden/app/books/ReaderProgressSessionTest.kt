package dev.shadowgarden.app.books

import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPosition
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderProgressSessionTest {
    private val id = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val edition = EditionFingerprint.calculate("fixture".byteInputStream(), 100)
    private val one = "epubcfi(/6/2!/4/2:1)"
    private val two = "epubcfi(/6/4!/4/2:2)"

    @Test fun usesTheLastCommittedRevisionAndClosesAfterDraining() = runBlocking {
        val revisions = mutableListOf<Long?>()
        val closed = CountDownLatch(1)
        val writer = object : ReaderPositionWriter {
            override fun save(position: ReadingPosition, expectedRevision: Long?): ProgressSaveResult {
                assertEquals(id, position.bookId); assertEquals(edition, position.edition)
                revisions.add(expectedRevision)
                return ProgressSaveResult.Saved((expectedRevision ?: 0) + 1)
            }
            override fun close() { closed.countDown() }
        }
        val session = ReaderProgressSession(id, edition, null, writer, { 5 })
        assertEquals(ReaderSaveResult.SAVED, session.save(one))
        assertEquals(ReaderSaveResult.SAVED, session.save(two))
        session.close()
        assertTrue(withContext(Dispatchers.IO) { closed.await(5, TimeUnit.SECONDS) })
        assertEquals(listOf(null, 1L), revisions)
        assertEquals(ReaderSaveResult.CLOSED, session.save(one))
    }

    @Test fun staleRevisionStopsFurtherWritesAndFailuresCanRetry() = runBlocking {
        var calls = 0
        val writer = object : ReaderPositionWriter {
            override fun save(position: ReadingPosition, expectedRevision: Long?): ProgressSaveResult = when (++calls) {
                1 -> throw IOException("fixture")
                2 -> ProgressSaveResult.Conflict(4)
                else -> throw AssertionError("Conflict must stop subsequent writes")
            }
            override fun close() = Unit
        }
        val session = ReaderProgressSession(id, edition, 2, writer)
        try {
            assertEquals(ReaderSaveResult.FAILED, session.save(one))
            assertEquals(ReaderSaveResult.CONFLICT, session.save(two))
            assertEquals(ReaderSaveResult.CONFLICT, session.save(one))
            assertEquals(2, calls)
            assertEquals(ReaderSaveResult.INVALID, session.save("not a CFI"))
        } finally { session.close() }
    }

    @Test fun cancellingTheWaitingCallerDoesNotDiscardAnAcceptedWrite() = runBlocking {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val closed = CountDownLatch(1)
        var written = false
        val writer = object : ReaderPositionWriter {
            override fun save(position: ReadingPosition, expectedRevision: Long?): ProgressSaveResult {
                entered.countDown(); release.await(5, TimeUnit.SECONDS); written = true
                return ProgressSaveResult.Saved(1)
            }
            override fun close() { closed.countDown() }
        }
        val session = ReaderProgressSession(id, edition, null, writer)
        try {
            val job = async(Dispatchers.Default) { session.save(one) }
            assertTrue(withContext(Dispatchers.IO) { entered.await(5, TimeUnit.SECONDS) })
            job.cancelAndJoin()
            session.close()
            release.countDown()
            assertTrue(withContext(Dispatchers.IO) { closed.await(5, TimeUnit.SECONDS) })
            assertTrue(written)
            assertFalse(validReaderCfi("epubcfi(\n)"))
        } finally { release.countDown(); session.close() }
    }
}

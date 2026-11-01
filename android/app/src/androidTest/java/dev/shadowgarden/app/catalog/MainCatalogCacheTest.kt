package dev.shadowgarden.app.catalog

import android.util.AtomicFile
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.File
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainCatalogCacheTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val file = File(context.filesDir, "main-catalog-test-${UUID.randomUUID()}.json")
    private val cache = PrivateMainCatalogCache(file)
    private val book = CatalogBookId("bk_abcdefghijklmnopqrstuv")
    private val original = listOf(CatalogSeries("s1", "Original", "Author", "Complete", listOf(CatalogVolume(book, "Volume"))))
    private val replacement = listOf(CatalogSeries("s2", "Replacement", "Author", "Ongoing", emptyList()))

    @After fun cleanUp() { AtomicFile(file).delete() }

    @Test fun snapshotSurvivesReopenAndContainsOnlyDisplayedPublicFields() {
        assertEquals(null, cache.read())
        val raw = """{"series":[{"id":"s1","title":"Original","author":"Author","status":"Complete","cover":"https://example.invalid/cover","privateToken":"secret-fixture","volumes":[{"bookId":"${book.value}","title":"Volume","file":"private-fixture.epub"}]}]}"""
        val parsed = CatalogParser.read(raw.byteInputStream())
        cache.write(parsed)
        assertEquals(original, PrivateMainCatalogCache(file).read())
        assertTrue(file.canonicalPath.startsWith(context.filesDir.canonicalPath + File.separator))
        val saved = file.readText()
        assertFalse(saved.contains("secret-fixture"))
        assertFalse(saved.contains("private-fixture.epub"))
        assertFalse(saved.contains("example.invalid"))
    }

    @Test fun invalidOrOversizedReplacementLeavesLastGoodSnapshot() {
        cache.write(original)
        val duplicate = original + original
        assertTrue(runCatching { cache.write(duplicate) }.isFailure)
        assertEquals(original, cache.read())
        val longTitle = "x".repeat(4_096)
        val oversized = (0 until 520).map { CatalogSeries("s$it", longTitle, "", "Ongoing", emptyList()) }
        assertTrue(runCatching { cache.write(oversized) }.isFailure)
        assertEquals(original, cache.read())
    }

    @Test fun corruptSnapshotIsReportedAndPreservedForInspection() {
        file.writeText("{broken")
        assertTrue(runCatching { cache.read() }.isFailure)
        assertEquals("{broken", file.readText())
        cache.write(original)
        assertEquals(original, cache.read())
    }

    @Test fun interruptedAtomicReplacementRecoversThePreviousSnapshot() {
        cache.write(original)
        val interrupted = AtomicFile(file).startWrite()
        interrupted.write("{partial".toByteArray())
        interrupted.close() // Simulate a process ending before finishWrite.
        assertEquals(original, PrivateMainCatalogCache(file).read())
    }

    @Test fun independentInstancesNeverObservePartialConcurrentWrites() {
        cache.write(original)
        val other = PrivateMainCatalogCache(file)
        val start = CountDownLatch(1)
        val executor = Executors.newFixedThreadPool(3)
        try {
            val first = executor.submit(Callable { start.await(); repeat(12) { cache.write(original) } })
            val second = executor.submit(Callable { start.await(); repeat(12) { other.write(replacement) } })
            val reader = executor.submit(Callable {
                start.await()
                repeat(24) { assertTrue(other.read() in listOf(original, replacement)) }
            })
            start.countDown()
            listOf(first, second, reader).forEach { it.get(30, TimeUnit.SECONDS) }
        } finally { executor.shutdownNow() }
    }
}

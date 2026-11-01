package dev.shadowgarden.app.catalog

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CoverDiskCacheTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private val directory = File(context.cacheDir, "cover-disk-test-${UUID.randomUUID()}")
    private val a = CoverPath("/media/shadow-garden/covers/a.png")
    private val b = CoverPath("/media/shadow-garden/covers/b.png")
    private val c = CoverPath("/media/shadow-garden/covers/c.png")

    @After fun cleanUp() { directory.deleteRecursively() }

    @Test fun storesAndReopensUnderAHashedPrivateFilename() {
        val cache = PrivateCoverDiskCache(directory)
        assertNull(cache.read(a))
        val bytes = "generated-image".toByteArray()
        cache.write(a, bytes)
        assertArrayEquals(bytes, PrivateCoverDiskCache(directory).read(a)?.bytes)
        val file = directory.listFiles()!!.single()
        assertTrue(file.name.matches(Regex("^[0-9a-f]{64}\\.img$")))
        assertFalse(file.name.contains("a.png"))
        assertTrue(file.canonicalPath.startsWith(context.cacheDir.canonicalPath + File.separator))
    }

    @Test fun evictsOldestCommittedFilesWithinBothLimits() {
        val cache = PrivateCoverDiskCache(directory, maxBytes = 30, maxEntries = 2)
        cache.write(a, ByteArray(10) { 1 })
        assertTrue(directory.listFiles()!!.single().setLastModified(System.currentTimeMillis() - 10_000))
        cache.write(b, ByteArray(10) { 2 })
        cache.write(c, ByteArray(10) { 3 })
        assertNull(cache.read(a))
        assertNotNull(cache.read(b))
        assertNotNull(cache.read(c))
        assertTrue(directory.listFiles()!!.filter { it.extension == "img" }.sumOf { it.length() } <= 30)
        assertEquals(2, directory.listFiles()!!.count { it.extension == "img" })
    }

    @Test fun rejectsOversizedReplacementWithoutDiscardingTheOldFile() {
        val cache = PrivateCoverDiskCache(directory, maxBytes = 10, maxEntries = 2)
        val original = ByteArray(8) { 7 }
        cache.write(a, original)
        assertTrue(runCatching { cache.write(a, ByteArray(11)) }.isFailure)
        assertTrue(runCatching { cache.write(a, ByteArray(MAX_COVER_BYTES + 1)) }.isFailure)
        assertArrayEquals(original, cache.read(a)?.bytes)
    }

    @Test fun interruptedTemporaryFileIsRemovedWithoutTouchingOtherFiles() {
        val cache = PrivateCoverDiskCache(directory)
        val original = "original".toByteArray()
        cache.write(a, original)
        val image = directory.listFiles()!!.single()
        val temporary = File(directory, image.name.removeSuffix(".img") + ".tmp").apply { writeText("partial") }
        val unrelated = File(directory, "unrelated.tmp").apply { writeText("keep") }
        assertArrayEquals(original, cache.read(a)?.bytes)
        assertFalse(temporary.exists())
        assertTrue(unrelated.isFile)
    }

    @Test fun independentInstancesDoNotExposePartialConcurrentWrites() {
        val first = PrivateCoverDiskCache(directory)
        val second = PrivateCoverDiskCache(directory)
        val old = ByteArray(1_024) { 1 }
        val fresh = ByteArray(1_024) { 2 }
        first.write(a, old)
        val start = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(3)
        try {
            val one = pool.submit(Callable { start.await(); repeat(12) { first.write(a, old) } })
            val two = pool.submit(Callable { start.await(); repeat(12) { second.write(a, fresh) } })
            val reader = pool.submit(Callable {
                start.await()
                repeat(24) {
                    val bytes = second.read(a)?.bytes
                    assertTrue(bytes != null && (bytes.contentEquals(old) || bytes.contentEquals(fresh)))
                }
            })
            start.countDown()
            listOf(one, two, reader).forEach { it.get(30, TimeUnit.SECONDS) }
        } finally { pool.shutdownNow() }
    }
}

package dev.shadowgarden.app.catalog

import android.graphics.Bitmap
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.ByteArrayOutputStream
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody
import okhttp3.Request
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.BufferedSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PublicCoverLoaderTest {
    private val path = CoverPath("/media/shadow-garden/covers/fixture/cover-thumb.png")

    @Test fun acceptsOnlySafeSameOriginCoverPaths() {
        assertEquals(path, CoverPath.from(path.value))
        val rejected = listOf(
            "https://evil.example/media/shadow-garden/covers/a.png", "//evil.example/a.png",
            "/media/shadow-garden/books/a.epub", "/media/shadow-garden/covers/../books/a.png",
            "/media/shadow-garden/covers/a//b.png", "/media/shadow-garden/covers/%2e%2e/a.png",
            "/media/shadow-garden/covers/a.png?token=secret", "/media/shadow-garden/covers/a.png#fragment",
            "/media/shadow-garden/covers/a.svg", "/MEDIA/shadow-garden/covers/a.png"
        )
        rejected.forEach { assertNull("Unsafe cover path must be ignored", CoverPath.from(it)) }
        assertTrue(runCatching { CoverPath(rejected.first()) }.isFailure)
    }

    @Test fun loadsSamplesAndMemoryCachesThePublicCover() = runBlocking {
        val requests = AtomicInteger()
        val observed = AtomicReference<Request>()
        val png = png(1_024, 512)
        val loader = PublicCoverLoader(client { chain ->
            requests.incrementAndGet()
            observed.set(chain.request())
            response(chain, 200, "image/png", png.toResponseBody("image/png".toMediaType()))
        })
        val image = loader.load(path)
        assertNotNull(image)
        assertTrue(image!!.width <= 384 && image.height <= 384)
        assertSame(image, loader.load(path))
        assertEquals(1, requests.get())
        assertEquals("https://shadowgarden-bon.pages.dev${path.value}", observed.get().url.toString())
        assertNull(observed.get().header("Cookie"))
        assertNull(observed.get().header("Authorization"))
    }

    @Test fun rejectsErrorsUnexpectedTypesOversizedAndInvalidImages() = runBlocking {
        val valid = png(2, 2)
        val cases = listOf(
            Triple(302, "image/png", valid), Triple(403, "image/png", valid),
            Triple(200, "text/plain", valid), Triple(200, "image/png", "bad image".toByteArray()),
            Triple(200, "image/png", png(9_000, 1))
        )
        cases.forEach { (code, type, bytes) ->
            val loader = PublicCoverLoader(client { chain -> response(chain, code, type, bytes.toResponseBody(type.toMediaType())) })
            assertNull(loader.load(path))
        }
        val oversized = object : ResponseBody() {
            private val content = Buffer().write(ByteArray(2 * 1024 * 1024 + 1))
            override fun contentType(): MediaType = "image/png".toMediaType()
            override fun contentLength(): Long = -1
            override fun source(): BufferedSource = content
        }
        val loader = PublicCoverLoader(client { chain -> response(chain, 200, "image/png", oversized) })
        assertNull(loader.load(path))
    }

    @Test fun failedCoverLoadsCanBeRetried() = runBlocking {
        val attempts = AtomicInteger()
        val valid = png(2, 2)
        val loader = PublicCoverLoader(client { chain ->
            val bytes = if (attempts.incrementAndGet() == 1) "invalid".toByteArray() else valid
            response(chain, 200, "image/png", bytes.toResponseBody("image/png".toMediaType()))
        })
        assertNull(loader.load(path))
        assertNotNull(loader.load(path))
        assertEquals(2, attempts.get())
    }

    @Test fun expiredCoverRetriesAndKeepsTheOldImageIfOffline() = runBlocking {
        val attempts = AtomicInteger()
        val clock = AtomicLong(0)
        val valid = png(2, 2)
        val loader = PublicCoverLoader(client { chain ->
            val code = if (attempts.incrementAndGet() == 2) 503 else 200
            response(chain, code, "image/png", valid.toResponseBody("image/png".toMediaType()))
        }, now = { clock.get() })
        val first = loader.load(path)
        assertNotNull(first)
        clock.set(60 * 60 * 1_000L + 1)
        assertSame(first, loader.load(path))
        assertNotNull(loader.load(path))
        assertEquals(3, attempts.get())
    }

    @Test fun canceledCoverLoadCancelsItsHttpCall() = runBlocking {
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        val observed = CountDownLatch(1)
        val canceled = AtomicBoolean(false)
        val loader = PublicCoverLoader(client { chain ->
            entered.countDown()
            release.await(10, TimeUnit.SECONDS)
            canceled.set(chain.call().isCanceled())
            observed.countDown()
            response(chain, 200, "image/png", png(2, 2).toResponseBody("image/png".toMediaType()))
        })
        try {
            val job = launch { loader.load(path) }
            assertTrue(withContext(Dispatchers.IO) { entered.await(5, TimeUnit.SECONDS) })
            job.cancelAndJoin()
            release.countDown()
            assertTrue(withContext(Dispatchers.IO) { observed.await(5, TimeUnit.SECONDS) })
            assertTrue(canceled.get())
        } finally { release.countDown() }
    }

    @Test fun limitsConcurrentCoverRequests() = runBlocking {
        val active = AtomicInteger()
        val peak = AtomicInteger()
        val entered = CountDownLatch(4)
        val release = CountDownLatch(1)
        val valid = png(2, 2)
        val loader = PublicCoverLoader(client { chain ->
            val count = active.incrementAndGet()
            peak.updateAndGet { maxOf(it, count) }
            entered.countDown()
            release.await(10, TimeUnit.SECONDS)
            active.decrementAndGet()
            response(chain, 200, "image/png", valid.toResponseBody("image/png".toMediaType()))
        })
        try {
            val jobs = (0 until 6).map { index ->
                async { loader.load(CoverPath("/media/shadow-garden/covers/fixture-$index.png")) }
            }
            assertTrue(withContext(Dispatchers.IO) { entered.await(5, TimeUnit.SECONDS) })
            assertEquals(4, peak.get())
            release.countDown()
            assertTrue(jobs.awaitAll().all { it != null })
            assertTrue(peak.get() <= 4)
        } finally { release.countDown() }
    }

    private fun png(width: Int, height: Int): ByteArray {
        val image = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        return try { ByteArrayOutputStream().use { output ->
            assertTrue(image.compress(Bitmap.CompressFormat.PNG, 100, output))
            output.toByteArray()
        } } finally { image.recycle() }
    }
    private fun client(interceptor: Interceptor) = OkHttpClient.Builder().followRedirects(false)
        .followSslRedirects(false).addInterceptor(interceptor).build()
    private fun response(chain: Interceptor.Chain, code: Int, type: String, body: ResponseBody) = Response.Builder()
        .request(chain.request()).protocol(Protocol.HTTP_1_1).code(code).message("fixture")
        .header("Content-Type", type).body(body).build()
}

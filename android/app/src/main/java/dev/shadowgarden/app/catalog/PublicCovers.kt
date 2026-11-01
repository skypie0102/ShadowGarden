package dev.shadowgarden.app.catalog

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.LruCache
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/** A public same-origin cover path, never a book path or an arbitrary URL. */
internal data class CoverPath(val value: String) {
    init { require(allowed(value)) { "Invalid cover path" } }

    companion object {
        private const val PREFIX = "/media/shadow-garden/covers/"
        private val NAME = Regex("^[A-Za-z0-9_./-]+\\.(webp|png|jpg|jpeg|gif)$", RegexOption.IGNORE_CASE)
        private fun allowed(value: String): Boolean {
            if (!value.startsWith(PREFIX) || value.removePrefix("/media/").length > 1_024) return false
            val tail = value.removePrefix(PREFIX)
            return NAME.matches(tail) && tail.split('/').none { it.isEmpty() || it == "." || it == ".." }
        }
        fun from(value: Any?): CoverPath? {
            val path = value as? String ?: return null
            return if (allowed(path)) CoverPath(path) else null
        }
    }
}

internal const val MAX_COVER_BYTES = 2 * 1024 * 1024

internal fun interface CoverSource {
    suspend fun load(path: CoverPath): Bitmap?
    suspend fun cached(path: CoverPath): Bitmap? = null
}

/** Public covers only. Cache and network failures never block the library. */
internal class PublicCoverLoader(
    private val http: OkHttpClient = defaultClient(),
    private val now: () -> Long = { SystemClock.elapsedRealtime() },
    private val disk: CoverDiskCache? = null,
    private val wallNow: () -> Long = { System.currentTimeMillis() }
) : CoverSource {
    private val permits = Semaphore(4)
    private data class CachedCover(val bitmap: Bitmap, val savedAt: Long)
    private val cache = object : LruCache<String, CachedCover>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: CachedCover): Int = value.bitmap.byteCount.coerceAtLeast(1)
    }

    override suspend fun cached(path: CoverPath): Bitmap? {
        cache.get(path.value)?.let { return it.bitmap }
        val storage = disk ?: return null
        return try {
            permits.withPermit {
                cache.get(path.value)?.bitmap ?: run {
                    val loaded = withContext(Dispatchers.IO) {
                        val stored = storage.read(path) ?: return@withContext null
                        val bitmap = decodeBytes(stored.bytes) ?: return@withContext null
                        val wall = wallNow()
                        val age = if (stored.writtenAtMillis <= 0 || stored.writtenAtMillis > wall) CACHE_MILLIS
                            else (wall - stored.writtenAtMillis).coerceAtMost(CACHE_MILLIS)
                        CachedCover(bitmap, now() - age)
                    }
                    if (loaded == null) null else synchronized(cache) {
                        val existing = cache.get(path.value)
                        if (existing != null) { loaded.bitmap.recycle(); existing.bitmap }
                        else { cache.put(path.value, loaded); loaded.bitmap }
                    }
                }
            }
        } catch (error: CancellationException) { throw error }
        catch (_: Exception) { null }
    }

    override suspend fun load(path: CoverPath): Bitmap? {
        if (cache.get(path.value) == null) cached(path)
        val previous = cache.get(path.value)
        if (previous != null && fresh(previous)) return previous.bitmap
        return try {
            permits.withPermit {
                val current = cache.get(path.value)
                if (current != null && fresh(current)) current.bitmap else {
                    val fetched = fetch(path)
                    if (fetched != null) {
                        cache.put(path.value, CachedCover(fetched.bitmap, now()))
                        try { withContext(Dispatchers.IO) { disk?.write(path, fetched.bytes) } }
                        catch (error: CancellationException) { throw error }
                        catch (_: Exception) { /* The in-memory cover remains usable. */ }
                    }
                    fetched?.bitmap ?: current?.bitmap ?: previous?.bitmap
                }
            }
        } catch (error: CancellationException) { throw error }
        catch (_: Exception) { previous?.bitmap }
    }

    private fun fresh(entry: CachedCover): Boolean {
        val age = now() - entry.savedAt
        return age >= 0 && age < CACHE_MILLIS
    }

    private data class FetchedCover(val bitmap: Bitmap, val bytes: ByteArray)

    private suspend fun fetch(path: CoverPath): FetchedCover? = suspendCancellableCoroutine { continuation ->
        val request = Request.Builder().url(ORIGIN + path.value).header("Accept", "image/webp,image/png,image/jpeg,image/gif").get().build()
        val call = http.newCall(request)
        continuation.invokeOnCancellation { call.cancel() }
        call.enqueue(object : Callback {
            override fun onFailure(call: Call, error: IOException) {
                if (continuation.isActive) continuation.resume(null)
            }
            override fun onResponse(call: Call, response: Response) {
                val result = try { response.use { decode(it) } } catch (_: Exception) { null }
                if (continuation.isActive) continuation.resume(result) else result?.bitmap?.recycle()
            }
        })
    }

    private fun decode(response: Response): FetchedCover? {
        if (response.code != 200) return null
        val contentType = response.header("Content-Type")?.substringBefore(';')?.trim()?.lowercase()
        if (contentType !in IMAGE_TYPES) return null
        val body = response.body ?: return null
        if (body.contentLength() > MAX_COVER_BYTES) return null
        val bytes = readBounded(body.byteStream())
        val bitmap = decodeBytes(bytes) ?: return null
        return FetchedCover(bitmap, bytes)
    }

    private fun decodeBytes(bytes: ByteArray): Bitmap? {
        if (bytes.isEmpty() || bytes.size > MAX_COVER_BYTES) return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val width = bounds.outWidth
        val height = bounds.outHeight
        if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION ||
            width.toLong() * height > MAX_PIXELS || bounds.outMimeType !in IMAGE_TYPES) return null
        var sample = 1
        while (width / sample > TARGET_DIMENSION || height / sample > TARGET_DIMENSION) sample *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sample; inScaled = false }
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options) ?: return null
        if (bitmap.width > 512 || bitmap.height > 512) {
            bitmap.recycle()
            return null
        }
        return bitmap
    }

    private fun readBounded(input: InputStream): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            if (count == 0) {
                val byte = input.read()
                if (byte < 0) break
                if (++total > MAX_COVER_BYTES) throw IOException("Cover is too large")
                output.write(byte)
            } else {
                if (count > MAX_COVER_BYTES - total) throw IOException("Cover is too large")
                total += count
                output.write(buffer, 0, count)
            }
        }
        return output.toByteArray()
    }

    companion object {
        private const val ORIGIN = "https://shadowgarden-bon.pages.dev"
        private const val MAX_DIMENSION = 8_192
        private const val MAX_PIXELS = 32_000_000L
        private const val TARGET_DIMENSION = 384
        private const val CACHE_MILLIS = 60 * 60 * 1_000L
        private val IMAGE_TYPES = setOf("image/webp", "image/png", "image/jpeg", "image/gif")
        private fun defaultClient() = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
            .callTimeout(25, TimeUnit.SECONDS).build()
    }
}

package dev.shadowgarden.app.catalog

import dev.shadowgarden.app.progress.CatalogBookId
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.json.JSONTokener

internal data class CatalogVolume(val id: CatalogBookId, val title: String)
internal data class CatalogSeries(val id: String, val title: String, val author: String, val status: String, val volumes: List<CatalogVolume>)
internal fun interface CatalogSource { fun load(): List<CatalogSeries> }

/** Public Main catalog only; no cookies, redirects, credentials or arbitrary URLs. */
internal class MainCatalogClient(private val http: OkHttpClient = defaultClient()) : CatalogSource {
    override fun load(): List<CatalogSeries> {
        val request = Request.Builder().url(CATALOG_URL).header("Accept", "application/json").get().build()
        http.newCall(request).execute().use { response ->
            if (response.code != 200) throw IOException("Catalog request failed: ${response.code}")
            val body = response.body ?: throw IOException("Catalog response is empty")
            return CatalogParser.read(body.byteStream())
        }
    }

    companion object {
        const val CATALOG_URL = "https://shadowgarden-bon.pages.dev/media/shadow-garden/data/catalog.json"
        private fun defaultClient() = OkHttpClient.Builder().followRedirects(false).followSslRedirects(false)
            .connectTimeout(10, TimeUnit.SECONDS).readTimeout(15, TimeUnit.SECONDS)
            .callTimeout(25, TimeUnit.SECONDS).build()
    }
}

/** Decodes the public catalog, keeping only the fields needed by the early library. */
internal object CatalogParser {
    const val MAX_BYTES = 2 * 1024 * 1024
    private const val MAX_SERIES = 5_000
    private const val MAX_VOLUMES = 30_000

    fun read(input: InputStream): List<CatalogSeries> {
        val bytes = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            if (count == 0) {
                val byte = input.read()
                if (byte < 0) break
                if (++total > MAX_BYTES) throw IOException("Catalog is too large")
                bytes.write(byte)
            } else {
                total += count
                if (total > MAX_BYTES) throw IOException("Catalog is too large")
                bytes.write(buffer, 0, count)
            }
        }
        try {
            val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString()
            checkDepth(text)
            val json = JSONTokener(text)
            val root = json.nextValue() as? JSONObject ?: throw IOException("Invalid catalog")
            if (json.nextClean() != '\u0000') throw IOException("Trailing catalog data")
            val list = root.opt("series") as? JSONArray ?: throw IOException("Catalog series are missing")
            if (list.length() > MAX_SERIES) throw IOException("Too many series")
            val seriesIds = mutableSetOf<String>()
            val bookIds = mutableSetOf<String>()
            var volumeCount = 0
            return (0 until list.length()).map { index ->
                val item = list.opt(index) as? JSONObject ?: throw IOException("Invalid series")
                val id = item.requiredText("id", 512)
                if (!seriesIds.add(id)) throw IOException("Duplicate series")
                val title = item.requiredText("title", 4_096)
                val author = item.optionalText("author", 4_096)
                val status = normalizeStatus(item.optionalText("status", 256))
                val volumes = item.opt("volumes") as? JSONArray ?: throw IOException("Missing volumes")
                volumeCount += volumes.length()
                if (volumeCount > MAX_VOLUMES) throw IOException("Too many volumes")
                val entries = (0 until volumes.length()).map { volumeIndex ->
                    val volume = volumes.opt(volumeIndex) as? JSONObject ?: throw IOException("Invalid volume")
                    val bookId = volume.requiredText("bookId", 25)
                    if (!bookIds.add(bookId)) throw IOException("Duplicate book")
                    CatalogVolume(CatalogBookId(bookId), volume.requiredText("title", 4_096))
                }
                CatalogSeries(id, title, author, status, entries)
            }
        } catch (error: IOException) {
            throw error
        } catch (error: Exception) {
            throw IOException("Invalid catalog", error)
        }
    }

    private fun checkDepth(text: String) {
        var depth = 0
        var quoted = false
        var escaped = false
        for (char in text) {
            if (char == '\u0000') throw IOException("Invalid catalog character")
            if (quoted) {
                if (escaped) escaped = false
                else if (char == '\\') escaped = true
                else if (char == '"') quoted = false
            } else when (char) {
                '"' -> quoted = true
                '{', '[' -> if (++depth > 64) throw IOException("Catalog nesting is too deep")
                '}', ']' -> if (--depth < 0) throw IOException("Invalid catalog nesting")
            }
        }
        if (depth != 0 || quoted) throw IOException("Incomplete catalog")
    }

    private fun JSONObject.requiredText(key: String, limit: Int): String {
        val value = opt(key) as? String ?: throw IOException("Missing $key")
        if (value.isBlank() || value.length > limit || '\u0000' in value) throw IOException("Invalid $key")
        return value
    }
    private fun JSONObject.optionalText(key: String, limit: Int): String {
        val value = opt(key)
        if (value == null || value == JSONObject.NULL) return ""
        val text = value as? String ?: throw IOException("Invalid $key")
        if (text.length > limit || '\u0000' in text) throw IOException("Invalid $key")
        return text
    }
    private fun normalizeStatus(value: String): String = when (value.trim().lowercase()) {
        "complete", "completed", "finished" -> "Complete"
        "hiatus", "on hiatus", "paused" -> "Hiatus"
        "dropped", "cancelled", "canceled", "discontinued" -> "Dropped"
        else -> "Ongoing"
    }
}

package dev.shadowgarden.app.catalog

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainCatalogTest {
    private val one = "bk_aaaaaaaaaaaaaaaaaaaaaa"
    private val two = "bk_bbbbbbbbbbbbbbbbbbbbbb"
    private val valid = """{"generatedAt":"fixture","series":[{"id":"series-a","title":"A Series","author":"An Author","status":"completed","volumes":[{"bookId":"$one","title":"Volume One"},{"bookId":"$two","title":"Volume Two"}]}]}"""

    @Test fun requestsOnlyThePublicMainCatalogAndMapsSeriesAndVolumes() {
        var requests = 0
        val http = client { chain ->
            requests++
            assertEquals(MainCatalogClient.CATALOG_URL, chain.request().url.toString())
            assertEquals("GET", chain.request().method)
            assertNull(chain.request().header("Authorization"))
            assertNull(chain.request().header("Cookie"))
            response(chain, 200, valid)
        }
        val series = MainCatalogClient(http).load().single()
        assertEquals(1, requests)
        assertEquals("series-a", series.id)
        assertEquals("A Series", series.title)
        assertEquals("An Author", series.author)
        assertEquals("Complete", series.status)
        assertEquals(listOf("Volume One", "Volume Two"), series.volumes.map { it.title })
        assertEquals(listOf(one, two), series.volumes.map { it.id.value })
    }

    @Test fun malformedAndAmbiguousCatalogsAreRejected() {
        val cases = listOf(
            "{}", "{\"series\":null}", valid.dropLast(1), valid + "garbage",
            valid.replace(one, "bad"), valid.replace(two, one),
            valid.replace("\"series-a\"", "\"\""),
            valid.replace("\"volumes\":[", "\"volumes\":null,\"discard\":[")
        )
        cases.forEachIndexed { index, data ->
            assertTrue("Invalid catalog $index should fail", runCatching { CatalogParser.read(data.byteInputStream()) }.isFailure)
        }
        assertTrue(runCatching { CatalogParser.read(byteArrayOf(0xc3.toByte(), 0x28).inputStream()) }.isFailure)
        assertTrue(runCatching { CatalogParser.read(("[".repeat(65) + "]".repeat(65)).byteInputStream()) }.isFailure)
        assertTrue(runCatching { CatalogParser.read((" ".repeat(2 * 1024 * 1024) + valid).byteInputStream()) }.isFailure)
        assertTrue(runCatching { CatalogParser.read(object : java.io.InputStream() {
            override fun read(): Int = throw IOException("fixture read failure")
        }) }.isFailure)
    }

    @Test fun emptyMainCatalogAndMissingOptionalMetadataAreValid() {
        assertEquals(emptyList<CatalogSeries>(), CatalogParser.read("{\"series\":[]}".byteInputStream()))
        val basic = """{"series":[{"id":"s","title":"Title","volumes":[]}]}"""
        val series = CatalogParser.read(basic.byteInputStream()).single()
        assertEquals("", series.author)
        assertEquals("Ongoing", series.status)
        assertTrue(series.volumes.isEmpty())
    }

    @Test fun rejectedOrRedirectedRequestsDoNotReturnAList() {
        for (code in listOf(302, 403, 503)) {
            val http = client { chain -> response(chain, code, "{}") }
            assertTrue("HTTP $code must fail", runCatching { MainCatalogClient(http).load() }.isFailure)
        }
    }

    private fun client(interceptor: Interceptor) = OkHttpClient.Builder().followRedirects(false)
        .followSslRedirects(false).callTimeout(5, TimeUnit.SECONDS).addInterceptor(interceptor).build()
    private fun response(chain: Interceptor.Chain, code: Int, body: String) = Response.Builder()
        .request(chain.request()).protocol(Protocol.HTTP_1_1).code(code).message("fixture")
        .body(body.toResponseBody("application/json".toMediaType())).build()
}

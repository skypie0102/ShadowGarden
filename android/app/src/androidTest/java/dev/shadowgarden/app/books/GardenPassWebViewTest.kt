package dev.shadowgarden.app.books

import android.net.Uri
import android.content.ComponentName
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class GardenPassWebViewTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()

    @Test fun locksNavigationAndBlocksUntrustedResources() {
        instrumentation.runOnMainSync {
            val expected = GardenPassWebView.pageFor("fixture")
            val web = GardenPassWebView.create(instrumentation.targetContext, expected, {}, {})
            try {
                assertTrue(web.settings.javaScriptEnabled)
                assertFalse(web.settings.allowFileAccess)
                assertFalse(web.settings.allowContentAccess)
                assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, web.settings.mixedContentMode)
                val client = web.webViewClient
                val page = request(expected.toString(), true)
                assertFalse(client.shouldOverrideUrlLoading(web, page))
                assertNull(client.shouldInterceptRequest(web, page))
                val badPages = listOf(
                    "https://evil.invalid/series.html?scope=main",
                    "http://shadowgarden-bon.pages.dev/series.html?scope=main",
                    "https://shadowgarden-bon.pages.dev/reader.html?scope=main",
                    "https://shadowgarden-bon.pages.dev/series.html?scope=adult",
                    "https://user@shadowgarden-bon.pages.dev/series.html?scope=main",
                    "https://shadowgarden-bon.pages.dev:444/series.html?scope=main"
                )
                badPages.forEach { url ->
                    assertTrue(client.shouldOverrideUrlLoading(web, request(url, true)))
                    assertNotNull(client.shouldInterceptRequest(web, request(url, true)))
                }
                val turnstile = request("https://challenges.cloudflare.com/turnstile/v0/api.js", false)
                assertFalse(client.shouldOverrideUrlLoading(web, turnstile))
                assertNull(client.shouldInterceptRequest(web, turnstile))
                val external = request("https://evil.invalid/widget.js", false)
                assertTrue(client.shouldOverrideUrlLoading(web, external))
                assertNotNull(client.shouldInterceptRequest(web, external))
                val adult = request("https://shadowgarden-bon.pages.dev/media/shadow-garden/data/adult-catalog.json", false)
                assertNotNull(client.shouldInterceptRequest(web, adult))
            } finally { web.destroy() }
        }
    }

    @Test fun downloadActivityIsNotExported() {
        val context = instrumentation.targetContext
        @Suppress("DEPRECATION")
        val activity = context.packageManager.getActivityInfo(ComponentName(context, DownloadActivity::class.java), 0)
        assertFalse(activity.exported)
    }

    private fun request(value: String, main: Boolean) = object : WebResourceRequest {
        override fun getUrl(): Uri = Uri.parse(value)
        override fun isForMainFrame(): Boolean = main
        override fun isRedirect(): Boolean = false
        override fun hasGesture(): Boolean = false
        override fun getMethod(): String = "GET"
        override fun getRequestHeaders(): Map<String, String> = emptyMap()
    }
}

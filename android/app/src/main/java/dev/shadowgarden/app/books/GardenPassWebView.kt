package dev.shadowgarden.app.books

import android.annotation.SuppressLint
import android.content.Context
import android.net.Uri
import android.net.http.SslError
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/** The verification page has no JavaScript bridge and cannot navigate away. */
internal object GardenPassWebView {
    fun pageFor(seriesId: String): Uri = Uri.parse("https://shadowgarden-bon.pages.dev/series.html")
        .buildUpon().appendQueryParameter("id", seriesId).appendQueryParameter("scope", "main").build()

    fun isPage(uri: Uri, expected: Uri): Boolean = secureHost(uri, "shadowgarden-bon.pages.dev") &&
        uri.encodedPath == "/series.html" && uri.encodedQuery == expected.encodedQuery && uri.fragment == null

    fun isResource(uri: Uri): Boolean {
        if (secureHost(uri, "challenges.cloudflare.com")) return true
        if (!secureHost(uri, "shadowgarden-bon.pages.dev")) return false
        // The site's missing-series fallback can otherwise query the Adult catalog.
        return uri.path !in setOf("/media/shadow-garden/data/adult-catalog.json", "/data/adult-catalog.json")
    }

    private fun secureHost(uri: Uri, host: String): Boolean = uri.scheme == "https" &&
        uri.host.equals(host, true) && (uri.port == -1 || uri.port == 443) && uri.userInfo == null

    @SuppressLint("SetJavaScriptEnabled")
    fun create(context: Context, page: Uri, onReady: (WebView) -> Unit, onFailure: () -> Unit): WebView = WebView(context).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
        webChromeClient = WebChromeClient()
        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                if (request.isForMainFrame) !isPage(request.url, page) else !isResource(request.url)

            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                if ((request.isForMainFrame && !isPage(request.url, page)) || !isResource(request.url))
                    WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArray(0).inputStream())
                else null

            override fun onPageFinished(view: WebView, url: String) {
                if (isPage(Uri.parse(url), page)) onReady(view)
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) onFailure()
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame) onFailure()
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
                handler.cancel()
                onFailure()
            }
        }
    }
}

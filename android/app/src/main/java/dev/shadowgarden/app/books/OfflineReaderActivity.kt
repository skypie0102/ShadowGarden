package dev.shadowgarden.app.books

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import dev.shadowgarden.app.catalog.CatalogVolume
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Experimental local-only reader. Reading position is not yet persisted. */
internal class OfflineReaderActivity : ComponentActivity() {
    internal var readerView: WebView? = null
        private set
    private var openBook: OpenBook? = null
    private lateinit var content: LinearLayout
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val id = intent.getStringExtra(EXTRA_BOOK_ID)
        val title = intent.getStringExtra(EXTRA_BOOK_TITLE)
        if (id == null || title.isNullOrBlank() || title.length > 4_096) { finish(); return }
        val bookId = try { CatalogBookId(id) } catch (_: IllegalArgumentException) { finish(); return }
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(Button(this).apply { text = "Back to series"; setOnClickListener { finish() } })
        content.addView(TextView(this).apply { text = title; textSize = 18f })
        status = TextView(this).apply { text = "Opening saved EPUB…"; textSize = 16f }
        content.addView(status)
        setContentView(content)
        val store = PrivateBookStore(File(noBackupFilesDir, "downloaded-books-v1"))
        lifecycleScope.launch(Dispatchers.IO) {
            var candidate: OpenBook? = null
            try {
                candidate = store.open(bookId)
                val opened = candidate
                if (opened == null) {
                    withContext(Dispatchers.Main) { status.text = "Saved book unavailable. Download it again." }
                    return@launch
                }
                withContext(Dispatchers.Main) {
                    if (!isFinishing && !isDestroyed) {
                        val web = createReader(opened)
                        openBook = opened
                        candidate = null
                        readerView = web
                        status.visibility = android.view.View.GONE
                        content.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
                        web.loadUrl(READER_URL)
                    }
                }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                withContext(Dispatchers.Main) { if (!isFinishing && !isDestroyed) status.text = "Could not open the saved EPUB." }
            } finally { candidate?.close() }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createReader(book: OpenBook): WebView {
        val claimed = AtomicBoolean(false)
        return WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    request.isForMainFrame || request.url.scheme !in setOf("about", "blob", "data")

                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse {
                    val uri = request.url
                    if (request.method != "GET" || !readerOrigin(uri)) return blocked()
                    return try {
                        when (uri.path) {
                            "/index.html" -> WebResourceResponse("text/html", "utf-8", assets.open("offline-reader.html"))
                            "/jszip.min.js", "/epub.min.js" -> WebResourceResponse("text/javascript", "utf-8", assets.open(uri.path!!.removePrefix("/")))
                            "/book.epub" -> if (claimed.compareAndSet(false, true)) WebResourceResponse("application/epub+zip", null, book.input) else blocked()
                            else -> blocked()
                        }
                    } catch (_: Exception) { blocked() }
                }
            }
        }
    }

    override fun onDestroy() {
        readerView?.let { web ->
            web.stopLoading()
            (web.parent as? ViewGroup)?.removeView(web)
            web.destroy()
        }
        readerView = null
        openBook?.close()
        openBook = null
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_BOOK_ID = "book_id"
        private const val EXTRA_BOOK_TITLE = "book_title"
        private const val READER_URL = "https://reader.shadowgarden.invalid/index.html"
        fun intent(context: Context, volume: CatalogVolume): Intent = Intent(context, OfflineReaderActivity::class.java)
            .putExtra(EXTRA_BOOK_ID, volume.id.value).putExtra(EXTRA_BOOK_TITLE, volume.title)
        private fun readerOrigin(uri: Uri): Boolean = uri.scheme == "https" && uri.host == "reader.shadowgarden.invalid" &&
            (uri.port == -1 || uri.port == 443) && uri.userInfo == null && uri.query == null && uri.fragment == null
        private fun blocked() = WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), ByteArray(0).inputStream())
    }
}

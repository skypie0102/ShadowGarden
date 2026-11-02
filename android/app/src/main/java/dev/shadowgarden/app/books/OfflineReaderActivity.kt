package dev.shadowgarden.app.books

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
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
import androidx.activity.OnBackPressedCallback
import androidx.lifecycle.lifecycleScope
import dev.shadowgarden.app.catalog.CatalogVolume
import dev.shadowgarden.app.progress.CatalogBookId
import dev.shadowgarden.app.progress.EditionFingerprint
import dev.shadowgarden.app.progress.LocatorFormat
import dev.shadowgarden.app.progress.ProgressLookup
import dev.shadowgarden.app.progress.ProgressSaveResult
import dev.shadowgarden.app.progress.ReadingPosition
import dev.shadowgarden.app.progress.ReadingProgressStore
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlinx.coroutines.isActive
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import org.json.JSONTokener

/** Experimental local-only reader with app-private reading positions. */
internal class OfflineReaderActivity : ComponentActivity() {
    internal var readerView: WebView? = null
        private set
    private var openBook: OpenBook? = null
    private lateinit var content: LinearLayout
    private lateinit var status: TextView
    private var progress: ReaderProgressSession? = null
    private var savedSequence = 0L
    private var closing = false
    private var handlingBack = false
    private var conflicted = false
    private val saveMutex = Mutex()

    internal fun progressNotice(): String = status.text.toString()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val id = intent.getStringExtra(EXTRA_BOOK_ID)
        val title = intent.getStringExtra(EXTRA_BOOK_TITLE)
        if (id == null || title.isNullOrBlank() || title.length > 4_096) { finish(); return }
        val bookId = try { CatalogBookId(id) } catch (_: IllegalArgumentException) { finish(); return }
        content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        content.addView(Button(this).apply { text = "Back to series"; setOnClickListener { saveAndFinish() } })
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = closeSearchOrFinish()
        })
        content.addView(TextView(this).apply { text = title; textSize = 18f })
        status = TextView(this).apply { text = "Opening saved EPUB…"; textSize = 16f }
        content.addView(status)
        setContentView(content)
        val store = PrivateBookStore(File(noBackupFilesDir, "downloaded-books-v1"))
        lifecycleScope.launch(Dispatchers.IO) {
            var candidate: OpenBook? = null
            var pendingProgress: ReaderProgressSession? = null
            try {
                candidate = store.open(bookId)
                val opened = candidate
                if (opened == null) {
                    withContext(Dispatchers.Main) { status.text = "Saved book unavailable. Download it again." }
                    return@launch
                }
                val prepared = prepareProgress(bookId, opened.edition)
                pendingProgress = prepared.session
                withContext(Dispatchers.Main) {
                    if (!isFinishing && !isDestroyed) {
                        val web = createReader(opened, prepared.resumeCfi)
                        openBook = opened
                        candidate = null
                        progress = pendingProgress
                        pendingProgress = null
                        readerView = web
                        status.text = prepared.notice
                        content.addView(web, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
                        web.loadUrl(READER_URL)
                        observeProgress(web)
                    }
                }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                withContext(Dispatchers.Main) { if (!isFinishing && !isDestroyed) status.text = "Could not open the saved EPUB." }
            } finally { candidate?.close(); pendingProgress?.close() }
        }
    }

    private data class PreparedProgress(val resumeCfi: String?, val session: ReaderProgressSession?, val notice: String)
    private data class ReaderSnapshot(val state: String, val sequence: Long, val cfi: String, val pending: Boolean)

    private fun prepareProgress(bookId: CatalogBookId, edition: EditionFingerprint): PreparedProgress {
        var store: ReadingProgressStore? = null
        try {
            store = ReadingProgressStore(applicationContext)
            val found = store.lookup(bookId, edition, LocatorFormat.EPUBJS_CFI)
            val saved = (found as? ProgressLookup.Exact)?.stored
            if (saved != null && !validReaderCfi(saved.position.locator)) {
                store.close()
                return PreparedProgress(null, null, "The saved position is invalid and has been preserved. Progress cannot be saved in this session.")
            }
            val ownedStore = store
            val writer = object : ReaderPositionWriter {
                override fun save(position: ReadingPosition, expectedRevision: Long?): ProgressSaveResult =
                    ownedStore.save(position, expectedRevision)
                override fun close() = ownedStore.close()
            }
            val session = ReaderProgressSession(bookId, edition, saved?.revision, writer)
            val notice = when (found) {
                is ProgressLookup.Exact -> "Restoring saved position…"
                ProgressLookup.EditionChanged -> "This EPUB is a different edition; its previous position is preserved."
                ProgressLookup.ReaderChanged -> "The previous position was saved by a different reader and is preserved."
                ProgressLookup.EditionUnknown -> "The previous edition is unknown; its position is preserved."
                ProgressLookup.NoProgress -> "Reading progress saves on this device."
            }
            return PreparedProgress(saved?.position?.locator, session, notice)
        } catch (_: Exception) {
            try { store?.close() } catch (_: Exception) { }
            return PreparedProgress(null, null, "Could not load reading progress. Progress cannot be saved in this session.")
        }
    }

    private suspend fun snapshot(web: WebView): ReaderSnapshot? {
        val raw = withTimeoutOrNull(1_500) {
            suspendCancellableCoroutine<String> { continuation ->
                try {
                    web.evaluateJavascript("JSON.stringify(window.sgReader || {})") { value ->
                        if (continuation.isActive) continuation.resume(value ?: "null")
                    }
                } catch (_: RuntimeException) {
                    if (continuation.isActive) continuation.resume("null")
                }
            }
        } ?: return null
        if (raw.length > 196_608) return null
        return try {
            val encoded = JSONTokener(raw).nextValue() as? String ?: return null
            val json = JSONObject(encoded)
            ReaderSnapshot(json.optString("state"), json.optLong("seq", 0), json.optString("saveCfi"), json.optBoolean("pending"))
        } catch (_: Exception) { null }
    }

    private fun closeSearchOrFinish() {
        if (handlingBack || closing) return
        val web = readerView ?: return saveAndFinish()
        handlingBack = true
        lifecycleScope.launch {
            val closed = withTimeoutOrNull(1_500) {
                suspendCancellableCoroutine<String> { continuation ->
                    try {
                        web.evaluateJavascript("Boolean(window.sgReader && window.sgReader.searchOpen && window.sgCloseSearch && (window.sgCloseSearch(), true))") { value ->
                            if (continuation.isActive) continuation.resume(value ?: "false")
                        }
                    } catch (_: RuntimeException) {
                        if (continuation.isActive) continuation.resume("false")
                    }
                }
            } == "true"
            handlingBack = false
            if (!closed && !isFinishing && !isDestroyed) saveAndFinish()
        }
    }

    private suspend fun saveSnapshot(snapshot: ReaderSnapshot): ReaderSaveResult = saveMutex.withLock {
        if (snapshot.sequence <= savedSequence) return@withLock ReaderSaveResult.SAVED
        if (conflicted) return@withLock ReaderSaveResult.CONFLICT
        val result = progress?.save(snapshot.cfi) ?: ReaderSaveResult.FAILED
        when (result) {
            ReaderSaveResult.SAVED -> {
                savedSequence = maxOf(savedSequence, snapshot.sequence)
                status.text = "Reading position saved on this device."
            }
            ReaderSaveResult.CONFLICT -> {
                conflicted = true
                status.text = "Position changed elsewhere on this device. Reopen the reader to load it."
            }
            else -> status.text = "Could not save the position. Your last saved position is preserved."
        }
        result
    }

    private fun observeProgress(web: WebView) {
        lifecycleScope.launch {
            while (isActive && readerView === web) {
                val current = snapshot(web)
                if (current != null && !closing) {
                    if (current.state == "restore-error" && status.text == "Restoring saved position…") {
                        status.text = "The saved position was kept. Choose Start from beginning to replace it."
                    } else if (current.state == "ready") {
                        if (status.text == "Restoring saved position…") status.text = "Reading progress saves on this device."
                        if (!current.pending && current.sequence > savedSequence && !conflicted) saveSnapshot(current)
                    }
                }
                delay(500)
            }
        }
    }

    override fun onPause() {
        super.onPause()
        val web = readerView ?: return
        if (!closing && !isFinishing) lifecycleScope.launch {
            val current = snapshot(web)
            if (current != null && current.state == "ready" && !current.pending && current.sequence > savedSequence) {
                saveSnapshot(current)
            }
        }
    }

    private fun saveAndFinish() {
        if (closing) return
        closing = true
        val web = readerView
        web?.isEnabled = false
        lifecycleScope.launch {
            var current = web?.let { snapshot(it) }
            val deadline = SystemClock.elapsedRealtime() + 2_000
            while (current?.pending == true && SystemClock.elapsedRealtime() < deadline) {
                delay(100)
                current = web?.let { snapshot(it) }
            }
            val result = when {
                web == null -> ReaderSaveResult.SAVED
                current == null || current.pending -> ReaderSaveResult.FAILED
                current.state != "ready" -> ReaderSaveResult.SAVED
                else -> saveSnapshot(current)
            }
            if (result == ReaderSaveResult.SAVED) finish()
            else {
                closing = false
                web?.isEnabled = true
                AlertDialog.Builder(this@OfflineReaderActivity)
                    .setMessage("Your current reading position could not be saved. Your previous saved position is unchanged.")
                    .setPositiveButton("Try again") { _, _ -> saveAndFinish() }
                    .setNegativeButton("Leave without saving") { _, _ -> finish() }
                    .setNeutralButton("Keep reading", null)
                    .show()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createReader(book: OpenBook, resumeCfi: String?): WebView {
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
                            "/jszip.min.js", "/epub.min.js", "/offline-search.js" -> WebResourceResponse("text/javascript", "utf-8", assets.open(uri.path!!.removePrefix("/")))
                            "/resume.json" -> WebResourceResponse("application/json", "utf-8",
                                JSONObject().put("cfi", resumeCfi ?: JSONObject.NULL).toString().byteInputStream())
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
        progress?.close()
        progress = null
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

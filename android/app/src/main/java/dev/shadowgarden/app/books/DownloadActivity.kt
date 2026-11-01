package dev.shadowgarden.app.books

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import dev.shadowgarden.app.catalog.CatalogVolume
import dev.shadowgarden.app.catalog.CatalogSeries
import dev.shadowgarden.app.progress.CatalogBookId
import java.io.File
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Foreground-only experimental download. No ticket or book content enters an intent. */
internal class DownloadActivity : ComponentActivity() {
    private lateinit var bookId: CatalogBookId
    private var bookTitle = ""
    private var seriesId = ""
    private val store by lazy { PrivateBookStore(File(noBackupFilesDir, "downloaded-books-v1")) }
    private var activeView by mutableStateOf<WebView?>(null)
    private var state by mutableStateOf(DownloadState(DownloadPhase.CONNECTING, "Connecting to the Garden…"))
    private var requestJob: Job? = null
    private var pageTimeout: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val id = intent.getStringExtra(EXTRA_BOOK_ID)
        val title = intent.getStringExtra(EXTRA_BOOK_TITLE)
        val series = intent.getStringExtra(EXTRA_SERIES_ID)
        if (id == null || title.isNullOrBlank() || title.length > 4_096 ||
            series.isNullOrBlank() || series.length > 512 || '\u0000' in series) { finish(); return }
        bookId = try { CatalogBookId(id) } catch (_: IllegalArgumentException) { finish(); return }
        bookTitle = title
        seriesId = series
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                DownloadScreen(bookTitle, state, activeView, onRetry = ::startAttempt, onClose = ::finish)
            }
        }
        if (savedInstanceState == null) startAttempt()
        else state = DownloadState(DownloadPhase.INTERRUPTED, "The download stopped when the screen changed. Retry to continue.")
    }

    private fun startAttempt() {
        if (state.phase.active && activeView != null) return
        requestJob?.cancel()
        pageTimeout?.cancel()
        closeWebView()
        state = DownloadState(DownloadPhase.CONNECTING, "Connecting to the Garden…")
        val page = GardenPassWebView.pageFor(seriesId)
        val web = GardenPassWebView.create(this, page, onReady = ::pageReady, onFailure = {
            if (state.phase == DownloadPhase.CONNECTING || state.phase == DownloadPhase.AUTHORIZING) {
                fail("Could not open the Garden Pass. Check your connection and retry.")
            }
        })
        activeView = web
        pageTimeout = lifecycleScope.launch {
            delay(30_000)
            if (activeView === web && state.phase == DownloadPhase.CONNECTING)
                fail("Connecting to the Garden timed out. Check your connection and retry.")
        }
        web.loadUrl(page.toString())
    }

    private fun pageReady(web: WebView) {
        if (activeView !== web || state.phase != DownloadPhase.CONNECTING) return
        pageTimeout?.cancel()
        state = DownloadState(DownloadPhase.AUTHORIZING, "Complete the Garden Pass below if prompted.")
        requestJob = lifecycleScope.launch {
            val result = runForegroundDownload(
                requestTicket = { WebViewBookTickets(web).request(bookId) },
                transfer = { ticket -> SignedBookTransfer(store).download(bookId, ticket) },
                onDownloading = {
                    closeWebView()
                    state = DownloadState(DownloadPhase.DOWNLOADING, "Downloading EPUB…")
                }
            )
            closeWebView()
            state = result
        }
    }

    private fun fail(message: String) {
        pageTimeout?.cancel()
        requestJob?.cancel()
        closeWebView()
        state = DownloadState(DownloadPhase.FAILED, message)
    }

    private fun closeWebView() {
        val web = activeView ?: return
        activeView = null
        web.stopLoading()
        (web.parent as? ViewGroup)?.removeView(web)
        web.destroy()
    }

    override fun onStop() {
        if (state.phase.active) {
            pageTimeout?.cancel()
            requestJob?.cancel()
            closeWebView()
            state = DownloadState(DownloadPhase.INTERRUPTED, "The download stopped when the app left the screen. Retry to continue.")
        }
        super.onStop()
    }

    override fun onDestroy() {
        pageTimeout?.cancel()
        requestJob?.cancel()
        closeWebView()
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_BOOK_ID = "book_id"
        private const val EXTRA_BOOK_TITLE = "book_title"
        private const val EXTRA_SERIES_ID = "series_id"
        fun intent(context: Context, series: CatalogSeries, volume: CatalogVolume): Intent = Intent(context, DownloadActivity::class.java)
            .putExtra(EXTRA_BOOK_ID, volume.id.value).putExtra(EXTRA_BOOK_TITLE, volume.title).putExtra(EXTRA_SERIES_ID, series.id)
    }
}

internal enum class DownloadPhase(val active: Boolean) {
    CONNECTING(true), AUTHORIZING(true), DOWNLOADING(true), SAVED(false), FAILED(false), INTERRUPTED(false)
}
internal data class DownloadState(val phase: DownloadPhase, val message: String)

@Composable
internal fun DownloadScreen(title: String, state: DownloadState, webView: WebView?, onRetry: () -> Unit, onClose: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Download EPUB", style = MaterialTheme.typography.headlineMedium)
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text(state.message, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        if (state.phase.active) Text("Keep this screen open. Downloads stop when the app leaves this screen.")
        if (webView != null) AndroidView(factory = { webView }, modifier = Modifier.weight(1f).fillMaxWidth())
        if (state.phase == DownloadPhase.FAILED || state.phase == DownloadPhase.INTERRUPTED)
            Button(onClick = onRetry, modifier = Modifier.fillMaxWidth()) { Text("Retry download") }
        OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
            Text(if (state.phase.active) "Cancel download" else "Back to series")
        }
    }
}

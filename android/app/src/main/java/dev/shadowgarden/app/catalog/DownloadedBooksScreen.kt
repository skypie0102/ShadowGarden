package dev.shadowgarden.app.catalog

import android.text.format.Formatter
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.shadowgarden.app.books.PrivateBookStore
import dev.shadowgarden.app.books.BookRemovalResult
import dev.shadowgarden.app.books.SavedBooks
import dev.shadowgarden.app.progress.EditionFingerprint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch

private data class ShelfRemoval(val volume: CatalogVolume, val edition: EditionFingerprint, val missingFromCatalog: Boolean)

@Composable
internal fun DownloadedBooksScreen(model: LibraryViewModel, books: PrivateBookStore,
                                   onBack: () -> Unit, onRead: (CatalogVolume) -> Unit) {
    val state by model.state.collectAsState()
    val context = LocalContext.current
    var listing by remember(books) { mutableStateOf<SavedBooks?>(null) }
    var error by remember(books) { mutableStateOf<String?>(null) }
    var loading by remember(books) { mutableStateOf(true) }
    var retry by remember(books) { mutableIntStateOf(0) }
    var removalBusy by remember(books) { mutableStateOf(false) }
    var removalMessage by remember(books) { mutableStateOf<String?>(null) }
    var confirmation by remember(books) { mutableStateOf<ShelfRemoval?>(null) }
    val scope = rememberCoroutineScope()
    BackHandler(enabled = removalBusy || confirmation != null) { if (!removalBusy) confirmation = null }
    LaunchedEffect(books, state.bookGeneration, retry) {
        loading = true
        listing = null
        error = null
        try { listing = withContext(Dispatchers.IO) { books.listSaved() } }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { error = "Could not load downloaded books. Try again." }
        finally { loading = false }
    }
    val catalog = remember(state.series) {
        buildMap {
            state.series?.forEach { series -> series.volumes.forEach { volume -> put(volume.id, series.title to volume) } }
        }
    }
    Column(modifier = Modifier.fillMaxSize()) {
        val notice = if (removalBusy) "Updating downloaded EPUB…" else removalMessage
        notice?.let { message -> Text(message, modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp)
            .semantics { liveRegion = LiveRegionMode.Polite }) }
        LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth().testTag("downloaded-books-list"), contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { TextButton(onClick = onBack, enabled = !removalBusy) { Text("Back to Main library") } }
            item { Text("Downloaded books", style = MaterialTheme.typography.headlineMedium) }
            item { Text("Books saved on this device can be opened offline. Reading positions remain separate from the website.") }
            if (state.series == null) item { Text("Catalog titles are unavailable; saved books can still be opened.") }
            else if (state.fromCache) item { Text("Titles are from the saved catalog and may be out of date.") }
            if (loading) item { Text("Loading downloaded books…", modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
            error?.let { message ->
                item { Text(message, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
                item { Button(onClick = { retry++ }) { Text("Retry downloads list") } }
            }
            listing?.let { saved ->
                if (saved.unavailableCount > 0) item { Text("Some downloaded files are unavailable or have an invalid size. They have not been removed.") }
                if (saved.books.isEmpty() && saved.unavailableCount == 0) item { Text("No downloaded books yet.") }
                if (saved.books.isNotEmpty()) {
                    val total = saved.books.sumOf { it.byteCount }
                    item { Text("${saved.books.size} saved EPUB${if (saved.books.size == 1) "" else "s"} · ${Formatter.formatFileSize(context, total)}") }
                    items(saved.books, key = { it.id.value }) { book ->
                        val match = catalog[book.id]
                        val volume = match?.second ?: CatalogVolume(book.id, "Downloaded book · ${book.id.value}")
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(volume.title, style = MaterialTheme.typography.titleMedium)
                            if (match == null) Text("Title unavailable in the current catalog") else Text(match.first)
                            Text(Formatter.formatFileSize(context, book.byteCount))
                            Button(onClick = { onRead(volume) }, enabled = !removalBusy,
                                modifier = Modifier.semantics { contentDescription = "Read ${volume.title} offline" }) { Text("Read offline") }
                            TextButton(enabled = !removalBusy, onClick = {
                                removalBusy = true
                                removalMessage = null
                                scope.launch {
                                    try {
                                        val edition = withContext(Dispatchers.IO) { books.open(volume.id)?.use { it.edition } }
                                        if (edition == null) {
                                            removalMessage = "The downloaded EPUB is already unavailable. Reading positions are kept."
                                            model.refreshLocalBooks()
                                        } else confirmation = ShelfRemoval(volume, edition, match == null)
                                    } catch (cancelled: CancellationException) { throw cancelled }
                                    catch (_: Exception) { removalMessage = "Could not check the downloaded EPUB. Nothing was removed." }
                                    finally { removalBusy = false }
                                }
                            }, modifier = Modifier.semantics { contentDescription = "Remove ${volume.title} download" }) { Text("Remove download") }
                        }
                    }
                }
            }
        }
    }
    confirmation?.let { pending ->
        AlertDialog(
            onDismissRequest = { confirmation = null },
            title = { Text("Remove downloaded EPUB?") },
            text = { Text("Remove ${pending.volume.title} from this device? Reading positions and existing backups will be kept. To resume, you will need the same EPUB edition again." +
                if (pending.missingFromCatalog) " This book is not listed in the current catalog view, so it may not be possible to download it again." else "") },
            confirmButton = { TextButton(onClick = {
                confirmation = null
                removalBusy = true
                scope.launch {
                    try {
                        val result = withContext(Dispatchers.IO) { books.removeIfEdition(pending.volume.id, pending.edition) }
                        removalMessage = when (result) {
                            BookRemovalResult.REMOVED -> "Downloaded EPUB removed. Reading positions are kept."
                            BookRemovalResult.NOT_FOUND -> "The downloaded EPUB was already removed. Reading positions are kept."
                            BookRemovalResult.EDITION_CHANGED -> "The downloaded EPUB changed. Nothing was removed; review it and try again."
                        }
                        model.refreshLocalBooks()
                    } catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { removalMessage = "Could not remove the downloaded EPUB. Reading positions are kept." }
                    finally { removalBusy = false }
                }
            }) { Text("Remove EPUB") } },
            dismissButton = { TextButton(onClick = { confirmation = null }) { Text("Cancel") } }
        )
    }
}

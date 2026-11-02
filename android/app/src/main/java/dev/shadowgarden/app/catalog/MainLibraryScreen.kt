package dev.shadowgarden.app.catalog

import androidx.activity.compose.BackHandler
import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import dev.shadowgarden.app.books.PrivateBookStore
import dev.shadowgarden.app.books.BookRemovalResult
import dev.shadowgarden.app.progress.EditionFingerprint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch

private data class PendingBookRemoval(val volume: CatalogVolume, val edition: EditionFingerprint)

@Composable
internal fun MainLibraryScreen(model: LibraryViewModel, onBackup: () -> Unit,
                               books: PrivateBookStore? = null, onRead: ((CatalogVolume) -> Unit)? = null,
                               onDownloaded: (() -> Unit)? = null,
                               onDownload: ((CatalogSeries, CatalogVolume) -> Unit)? = null) {
    val state by model.state.collectAsState()
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var removalBusy by remember { mutableStateOf(false) }
    var confirmation by remember { mutableStateOf<PendingBookRemoval?>(null) }
    var removalMessage by remember(selectedId) { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    BackHandler(enabled = selectedId != null && confirmation == null) { if (!removalBusy) selectedId = null }
    val selected = state.series?.firstOrNull { it.id == selectedId }
    if (selectedId != null) {
        Column(modifier = Modifier.fillMaxSize()) {
            val notice = if (removalBusy) "Updating downloaded EPUB…" else removalMessage
            notice?.let { message -> Text(message, modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp)
                .semantics { liveRegion = LiveRegionMode.Polite }) }
            LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth().testTag("series-detail-list"), contentPadding = PaddingValues(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)) {
                item { TextButton(onClick = { selectedId = null }, enabled = !removalBusy) { Text("Back to Main library") } }
                if (selected == null) {
                    when {
                        state.loading -> item { Text("Loading Main library…") }
                        state.series == null -> {
                            item { Text(state.error ?: "The Main library has not loaded yet.") }
                            item { Button(onClick = model::refresh) { Text("Retry library") } }
                        }
                        else -> item { Text("This series is no longer available in the loaded library.") }
                    }
                } else {
                    item { Text(selected.title, style = MaterialTheme.typography.headlineMedium) }
                    if (state.fromCache) item { Text("Showing saved Main library; it may be out of date.") }
                    state.error?.let { error -> item { Text(error) } }
                    item { CoverThumbnail(selected.cover, state.coverGeneration, model, Modifier.size(120.dp, 170.dp)) }
                    if (selected.author.isNotBlank()) item { Text("By ${selected.author}") }
                    item { Text(selected.status) }
                    item { Text("Volumes", style = MaterialTheme.typography.titleLarge) }
                    item { Text("Offline reading and downloads are experimental. Reading positions are saved on this device.") }
                    if (selected.volumes.isEmpty()) item { Text("No volumes are currently listed.") }
                    items(selected.volumes, key = { it.id.value }) { volume ->
                        var saved by remember(volume.id, books) { mutableStateOf<Boolean?>(null) }
                        LaunchedEffect(volume.id, state.bookGeneration, books) {
                            saved = if (books == null) false else try {
                                withContext(Dispatchers.IO) { books.contains(volume.id) }
                            } catch (error: CancellationException) { throw error }
                            catch (_: Exception) { null }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            CoverThumbnail(volume.cover ?: selected.cover, state.coverGeneration, model, Modifier.size(56.dp, 80.dp))
                            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(volume.title)
                                if (saved == true) Text("Saved on this device", style = MaterialTheme.typography.labelMedium)
                                if (saved == true && onRead != null) Button(onClick = { onRead(volume) }, enabled = !removalBusy,
                                    modifier = Modifier.semantics { contentDescription = "Read ${volume.title} offline" }) {
                                    Text("Read offline")
                                }
                                if (onDownload != null) OutlinedButton(onClick = { onDownload(selected, volume) }, enabled = !removalBusy,
                                    modifier = Modifier.semantics {
                                        contentDescription = if (saved == true) "Download ${volume.title} again" else "Download ${volume.title}"
                                    }) {
                                    Text(if (saved == true) "Download again" else "Download EPUB")
                                }
                                if (saved == true && books != null) TextButton(enabled = !removalBusy, onClick = {
                                    removalBusy = true
                                    removalMessage = null
                                    scope.launch {
                                        try {
                                            val edition = withContext(Dispatchers.IO) { books.open(volume.id)?.use { it.edition } }
                                            if (edition == null) {
                                                removalMessage = "The downloaded EPUB is already unavailable. Reading positions are kept."
                                                model.refreshLocalBooks()
                                            } else confirmation = PendingBookRemoval(volume, edition)
                                        } catch (error: CancellationException) { throw error }
                                        catch (_: Exception) { removalMessage = "Could not check the downloaded EPUB. Nothing was removed." }
                                        finally { removalBusy = false }
                                    }
                                }, modifier = Modifier.semantics { contentDescription = "Remove ${volume.title} download" }) {
                                    Text("Remove download")
                                }
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
                text = { Text("Remove ${pending.volume.title} from this device? Reading positions and existing backups will be kept. Download the same EPUB edition to resume.") },
                confirmButton = { TextButton(onClick = {
                    confirmation = null
                    removalBusy = true
                    scope.launch {
                        try {
                            val result = withContext(Dispatchers.IO) { requireNotNull(books).removeIfEdition(pending.volume.id, pending.edition) }
                            removalMessage = when (result) {
                                BookRemovalResult.REMOVED -> "Downloaded EPUB removed. Reading positions are kept."
                                BookRemovalResult.NOT_FOUND -> "The downloaded EPUB was already removed. Reading positions are kept."
                                BookRemovalResult.EDITION_CHANGED -> "The downloaded EPUB changed. Nothing was removed; review it and try again."
                            }
                            model.refreshLocalBooks()
                        } catch (error: CancellationException) { throw error }
                        catch (_: Exception) { removalMessage = "Could not remove the downloaded EPUB. Reading positions are kept." }
                        finally { removalBusy = false }
                    }
                }) { Text("Remove EPUB") } },
                dismissButton = { TextButton(onClick = { confirmation = null }) { Text("Cancel") } }
            )
        }
        return
    }
    val query = state.query.trim()
    val filtered = remember(state.series, query, state.volumeFilter, state.sort) {
        state.series?.let { selectSeries(it, query, state.volumeFilter, state.sort) }
    }
    Column(modifier = Modifier.fillMaxSize()) {
        val preferenceNotice = when {
            state.preferencesLoading -> "Loading library settings…"
            state.preferencesSaving -> "Saving library settings…"
            else -> state.preferencesError
        }
        preferenceNotice?.let { message -> Text(message, modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp)
            .semantics { liveRegion = LiveRegionMode.Polite }) }
        if (state.preferencesError != null) TextButton(onClick = model::retryPreferences, modifier = Modifier.padding(horizontal = 16.dp)) {
            Text("Retry library settings")
        }
        LazyColumn(modifier = Modifier.weight(1f).fillMaxWidth().testTag("main-library-list"), contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { Text("Shadow Garden", style = MaterialTheme.typography.headlineMedium) }
            item { Text("Android app in development", style = MaterialTheme.typography.titleMedium) }
            item { Text("Main library", style = MaterialTheme.typography.titleLarge) }
            item { Text("The Main library saves its latest catalog on this device. Offline reading and downloads are experimental; the Adult library and Keeper are in development.") }
            item { OutlinedButton(onClick = onBackup, modifier = Modifier.fillMaxWidth()) { Text("Reading-position backup") } }
            if (onDownloaded != null) item { OutlinedButton(onClick = onDownloaded, modifier = Modifier.fillMaxWidth()) { Text("Downloaded books") } }
            item {
                OutlinedTextField(value = state.query, onValueChange = model::search,
                    label = { Text("Search titles, authors, and volumes") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            }
            item { LibraryMenu("Volumes: ${state.volumeFilter.label}", VolumeFilter.entries, { it.label }, model::filterVolumes, !state.preferencesLoading) }
            item { LibraryMenu("Sort: ${state.sort.label}", LibrarySort.entries, { it.label }, model::sortBy, !state.preferencesLoading) }
            item { Button(onClick = model::refresh, enabled = !state.loading) { Text("Refresh library") } }
            if (state.loading) item { Text("Loading Main library…", modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
            if (state.fromCache) item { Text("Showing saved Main library; it may be out of date.") }
            state.error?.let { error -> item { Text(error, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) } }
            if (filtered != null && filtered.isEmpty() && !state.loading) {
                item { Text(if (query.isEmpty() && state.volumeFilter == VolumeFilter.ALL) "The Main library is empty." else "No matching series.") }
                if (query.isNotEmpty() || state.volumeFilter != VolumeFilter.ALL) {
                    item { TextButton(onClick = model::clearFilters) { Text("Clear filters") } }
                }
            }
            if (filtered != null) items(filtered, key = { it.id }) { series ->
                OutlinedButton(onClick = { selectedId = series.id }, modifier = Modifier.fillMaxWidth()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        CoverThumbnail(series.cover, state.coverGeneration, model, Modifier.size(56.dp, 80.dp))
                        Text(buildString {
                            append(series.title)
                            if (series.author.isNotBlank()) append(" · ").append(series.author)
                            append(" · ").append(series.volumes.size).append(if (series.volumes.size == 1) " volume" else " volumes")
                        }, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun <T> LibraryMenu(label: String, options: List<T>, optionLabel: (T) -> String, onSelect: (T) -> Unit, enabled: Boolean) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) { Text(label) }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { option ->
                DropdownMenuItem(text = { Text(optionLabel(option)) }, onClick = { expanded = false; onSelect(option) })
            }
        }
    }
}

@Composable
private fun CoverThumbnail(path: CoverPath?, generation: Long, model: LibraryViewModel, modifier: Modifier = Modifier) {
    var bitmap by remember(path) { mutableStateOf<Bitmap?>(null) }
    var loading by remember(path) { mutableStateOf(path != null) }
    LaunchedEffect(path, generation, model) {
        loading = path != null
        if (path == null) bitmap = null else {
            model.cachedCover(path)?.let { bitmap = it }
            val loaded = model.cover(path)
            if (loaded != null || bitmap == null) bitmap = loaded
        }
        loading = false
    }
    val image = bitmap
    if (image == null) {
        Box(modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant).testTag("cover-placeholder"),
            contentAlignment = Alignment.Center) {
            Text(if (loading) "Loading cover" else "Cover unavailable", style = MaterialTheme.typography.labelSmall)
        }
    } else {
        Image(bitmap = image.asImageBitmap(), contentDescription = null, contentScale = ContentScale.Crop,
            modifier = modifier.testTag("cover-loaded"))
    }
}

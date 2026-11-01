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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext

@Composable
internal fun MainLibraryScreen(model: LibraryViewModel, onBackup: () -> Unit,
                               books: PrivateBookStore? = null, onRead: ((CatalogVolume) -> Unit)? = null,
                               onDownload: ((CatalogSeries, CatalogVolume) -> Unit)? = null) {
    val state by model.state.collectAsState()
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(enabled = selectedId != null) { selectedId = null }
    val selected = state.series?.firstOrNull { it.id == selectedId }
    if (selectedId != null) {
        LazyColumn(modifier = Modifier.fillMaxSize().testTag("series-detail-list"), contentPadding = PaddingValues(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item { TextButton(onClick = { selectedId = null }) { Text("Back to Main library") } }
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
                item { Text("Offline reading and downloads are experimental. Reading position is not saved yet.") }
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
                            if (saved == true && onRead != null) Button(onClick = { onRead(volume) },
                                modifier = Modifier.semantics { contentDescription = "Read ${volume.title} offline" }) {
                                Text("Read offline")
                            }
                            if (onDownload != null) OutlinedButton(onClick = { onDownload(selected, volume) },
                                modifier = Modifier.semantics {
                                    contentDescription = if (saved == true) "Download ${volume.title} again" else "Download ${volume.title}"
                                }) {
                                Text(if (saved == true) "Download again" else "Download EPUB")
                            }
                        }
                    }
                }
            }
        }
        return
    }
    val query = state.query.trim()
    val filtered = remember(state.series, query, state.volumeFilter, state.sort) {
        state.series?.let { selectSeries(it, query, state.volumeFilter, state.sort) }
    }
    LazyColumn(modifier = Modifier.fillMaxSize().testTag("main-library-list"), contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text("Shadow Garden", style = MaterialTheme.typography.headlineMedium) }
        item { Text("Android app in development", style = MaterialTheme.typography.titleMedium) }
        item { Text("Main library", style = MaterialTheme.typography.titleLarge) }
        item { Text("The Main library saves its latest catalog on this device. Offline reading and downloads are experimental; the Adult library and Keeper are in development.") }
        item { OutlinedButton(onClick = onBackup, modifier = Modifier.fillMaxWidth()) { Text("Reading-position backup") } }
        item {
            OutlinedTextField(value = state.query, onValueChange = model::search,
                label = { Text("Search titles, authors, and volumes") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
        item { LibraryMenu("Volumes: ${state.volumeFilter.label}", VolumeFilter.entries, { it.label }, model::filterVolumes) }
        item { LibraryMenu("Sort: ${state.sort.label}", LibrarySort.entries, { it.label }, model::sortBy) }
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

@Composable
private fun <T> LibraryMenu(label: String, options: List<T>, optionLabel: (T) -> String, onSelect: (T) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) { Text(label) }
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

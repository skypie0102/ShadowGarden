package dev.shadowgarden.app.catalog

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

@Composable
internal fun MainLibraryScreen(model: LibraryViewModel, onBackup: () -> Unit) {
    val state by model.state.collectAsState()
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    BackHandler(enabled = selectedId != null) { selectedId = null }
    val selected = state.series?.firstOrNull { it.id == selectedId }
    if (selectedId != null) {
        LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(24.dp),
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
                if (selected.author.isNotBlank()) item { Text("By ${selected.author}") }
                item { Text(selected.status) }
                item { Text("Volumes", style = MaterialTheme.typography.titleLarge) }
                item { Text("Reading and downloads are still in development.") }
                if (selected.volumes.isEmpty()) item { Text("No volumes are currently listed.") }
                items(selected.volumes, key = { it.id.value }) { volume -> Text(volume.title) }
            }
        }
        return
    }
    val query = state.query.trim()
    val filtered = state.series?.filter { series ->
        query.isEmpty() || series.title.contains(query, true) || series.author.contains(query, true) ||
            series.volumes.any { it.title.contains(query, true) }
    }
    LazyColumn(modifier = Modifier.fillMaxSize().testTag("main-library-list"), contentPadding = PaddingValues(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { Text("Shadow Garden", style = MaterialTheme.typography.headlineMedium) }
        item { Text("Android app in development", style = MaterialTheme.typography.titleMedium) }
        item { Text("Main library", style = MaterialTheme.typography.titleLarge) }
        item { Text("The Main library saves its latest catalog on this device. The reader, downloads, Adult library, and Keeper are in development.") }
        item { OutlinedButton(onClick = onBackup, modifier = Modifier.fillMaxWidth()) { Text("Reading-position backup") } }
        item {
            OutlinedTextField(value = state.query, onValueChange = model::search,
                label = { Text("Search titles, authors, and volumes") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
        item { Button(onClick = model::refresh, enabled = !state.loading) { Text("Refresh library") } }
        if (state.loading) item { Text("Loading Main library…", modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) }
        if (state.fromCache) item { Text("Showing saved Main library; it may be out of date.") }
        state.error?.let { error -> item { Text(error, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }) } }
        if (filtered != null && filtered.isEmpty() && !state.loading) {
            item { Text(if (query.isEmpty()) "The Main library is empty." else "No matching series.") }
        }
        if (filtered != null) items(filtered, key = { it.id }) { series ->
            OutlinedButton(onClick = { selectedId = series.id }, modifier = Modifier.fillMaxWidth()) {
                Text(buildString {
                    append(series.title)
                    if (series.author.isNotBlank()) append(" · ").append(series.author)
                    append(" · ").append(series.volumes.size).append(if (series.volumes.size == 1) " volume" else " volumes")
                })
            }
        }
    }
}

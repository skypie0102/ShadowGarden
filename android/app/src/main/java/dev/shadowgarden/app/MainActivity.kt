package dev.shadowgarden.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import dev.shadowgarden.app.progress.PositionBackupEvent
import dev.shadowgarden.app.progress.PositionBackupViewModel
import dev.shadowgarden.app.progress.PositionRestoreMode

class MainActivity : ComponentActivity() {
    private val backup by lazy {
        ViewModelProvider(this, object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T {
                require(modelClass == PositionBackupViewModel::class.java)
                return PositionBackupViewModel(application) as T
            }
        })[PositionBackupViewModel::class.java]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { ShadowGardenApp(backup) }
    }
}

@Composable
internal fun ShadowGardenApp(backup: PositionBackupViewModel) {
    MaterialTheme(colorScheme = darkColorScheme()) {
        Surface(modifier = Modifier.fillMaxSize()) {
            PositionBackupScreen(backup)
        }
    }
}

@Composable
internal fun PositionBackupScreen(backup: PositionBackupViewModel) {
    val state by backup.state.collectAsState()
    var confirmOverwrite by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(state.preview) {
        if (state.preview == null) confirmOverwrite = false
    }
    val exportPicker = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) {
        backup.exportDestination(it)
    }
    val restorePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) {
        backup.restoreSource(it)
    }
    LaunchedEffect(backup) {
        backup.events.collect { event ->
            try {
                when (event) {
                    PositionBackupEvent.CHOOSE_EXPORT -> exportPicker.launch("shadowgarden-reading-positions.json")
                    PositionBackupEvent.CHOOSE_RESTORE -> restorePicker.launch(arrayOf("*/*"))
                }
            } catch (_: Exception) {
                backup.pickerUnavailable()
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Shadow Garden", style = MaterialTheme.typography.headlineMedium)
        Text("Android app in development", style = MaterialTheme.typography.titleMedium)
        Text("The library, offline reader, and Keeper are still in development. Reading positions will be saved on this device when the reader is ready.")
        Text("Reading-position backup", style = MaterialTheme.typography.titleLarge)
        Text("Back up positions saved in this Android app. Browser progress is separate. Backup files contain positions only; they do not include EPUBs, bookmarks, or other reading settings.")
        Text("Uninstalling the app removes its local data. Keep backup files in a separate location.")
        Button(onClick = backup::prepareExport, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
            Text("Export positions")
        }
        OutlinedButton(onClick = backup::chooseRestore, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
            Text("Restore positions")
        }
        state.message?.let { message ->
            Text(message, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
        state.preview?.let { preview ->
            Text("Review backup", style = MaterialTheme.typography.titleLarge)
            Text("New: ${preview.new}   Unchanged: ${preview.unchanged}   Conflicts: ${preview.conflicts.size}")
            Text("A conflict means this device already has a different position for the same book edition and reader. Positions absent from the backup will be kept.")
            Text("Using a restored position will require the matching EPUB edition and a compatible reader.")
            if (preview.conflicts.isNotEmpty()) {
                Text("Conflicting positions. Book titles are not available yet; scroll to review the book IDs, editions, and readers.")
                LazyColumn(modifier = Modifier.fillMaxWidth().heightIn(max = 200.dp)) {
                    items(preview.conflicts) { conflict ->
                        Text("${conflict.bookId} · edition ${conflict.edition} · ${conflict.reader}", modifier = Modifier.padding(vertical = 4.dp))
                    }
                }
            }
            Button(onClick = { backup.applyRestore(PositionRestoreMode.KEEP_EXISTING) },
                enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                Text("Restore and keep existing")
            }
            if (preview.conflicts.isNotEmpty()) {
                OutlinedButton(onClick = { confirmOverwrite = true }, enabled = !state.busy, modifier = Modifier.fillMaxWidth()) {
                    Text("Overwrite conflicts")
                }
            }
            TextButton(onClick = backup::dismissPreview, enabled = !state.busy) { Text("Cancel restore") }
        }
    }
    if (confirmOverwrite && state.preview != null && !state.busy) {
        AlertDialog(
            onDismissRequest = { confirmOverwrite = false },
            title = { Text("Overwrite conflicting positions?") },
            text = { Text("The backup will replace the conflicting positions on this device. Other positions will be kept.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmOverwrite = false
                    backup.applyRestore(PositionRestoreMode.OVERWRITE_CONFLICTS)
                }) { Text("Overwrite positions") }
            },
            dismissButton = { TextButton(onClick = { confirmOverwrite = false }) { Text("Cancel") } }
        )
    }
}

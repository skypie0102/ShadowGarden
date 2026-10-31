package dev.shadowgarden.app.progress

import android.app.Application
import android.content.ContentResolver
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal data class RestoreConflict(val bookId: String, val edition: String, val reader: String)
internal data class RestoreSummary(val new: Int, val unchanged: Int, val conflicts: List<RestoreConflict>)
internal data class PositionBackupUiState(val busy: Boolean = false, val message: String? = null, val preview: RestoreSummary? = null)
internal enum class PositionBackupEvent { CHOOSE_EXPORT, CHOOSE_RESTORE }

/** Owns only an in-memory pending export and preview. Neither survives process death. */
internal class PositionBackupViewModel(
    application: Application,
    private val store: ReadingProgressStore = ReadingProgressStore(application)
) : AndroidViewModel(application) {
    private val mutableState = MutableStateFlow(PositionBackupUiState())
    val state = mutableState.asStateFlow()
    private val eventChannel = Channel<PositionBackupEvent>(Channel.BUFFERED)
    val events = eventChannel.receiveAsFlow()
    private var pendingExport: ByteArray? = null
    private var preview: PositionRestorePreview? = null

    fun prepareExport() {
        if (state.value.busy) return
        mutableState.value = state.value.copy(busy = true, message = "Preparing backup…")
        viewModelScope.launch {
            try {
                val bytes = withContext(Dispatchers.IO) {
                    val positions = store.snapshotPositions()
                    if (positions.isEmpty()) null else ByteArrayOutputStream().use { output ->
                        ReadingPositionBackup.write(output, positions)
                        output.toByteArray()
                    }
                }
                if (bytes == null) {
                    mutableState.value = state.value.copy(busy = false, message = "There are no saved reading positions to back up yet.")
                } else {
                    pendingExport = bytes
                    mutableState.value = state.value.copy(message = "Choose where to save the backup.")
                    eventChannel.trySend(PositionBackupEvent.CHOOSE_EXPORT)
                }
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                pendingExport = null
                mutableState.value = state.value.copy(busy = false, message = "Could not prepare the backup. Your saved positions were not changed.")
            }
        }
    }

    fun exportDestination(uri: Uri?) {
        val bytes = pendingExport
        pendingExport = null
        if (uri == null) {
            mutableState.value = state.value.copy(busy = false, message = "Backup canceled.")
            return
        }
        if (bytes == null) {
            mutableState.value = state.value.copy(busy = false, message = "Backup was interrupted. Please try again.")
            return
        }
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) {
            mutableState.value = state.value.copy(busy = false, message = "The selected destination is not a document. Please try again.")
            return
        }
        mutableState.value = state.value.copy(busy = true, message = "Saving backup…")
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val output = getApplication<Application>().contentResolver.openOutputStream(uri, "wt")
                        ?: throw IOException("No output stream")
                    output.use { it.write(bytes); it.flush() }
                }
                mutableState.value = state.value.copy(busy = false, message = "Reading-position backup saved.")
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                mutableState.value = state.value.copy(busy = false,
                    message = "Backup failed. The selected file may be incomplete; please try again.")
            }
        }
    }

    fun chooseRestore() {
        if (state.value.busy) return
        preview = null
        mutableState.value = state.value.copy(busy = true, message = "Choose a reading-position backup.", preview = null)
        eventChannel.trySend(PositionBackupEvent.CHOOSE_RESTORE)
    }

    fun restoreSource(uri: Uri?) {
        if (uri == null) {
            mutableState.value = state.value.copy(busy = false, message = "Restore canceled.")
            return
        }
        if (uri.scheme != ContentResolver.SCHEME_CONTENT) {
            preview = null
            mutableState.value = state.value.copy(busy = false, preview = null,
                message = "The selected file is not a document. Please try again.")
            return
        }
        preview = null
        mutableState.value = state.value.copy(busy = true, message = "Checking backup…", preview = null)
        viewModelScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val input = getApplication<Application>().contentResolver.openInputStream(uri)
                        ?: throw IOException("No input stream")
                    val positions = input.use { ReadingPositionBackup.read(it) }
                    store.previewRestore(positions)
                }
                preview = result
                val entries = result.entries
                val conflicts = entries.filter { it.disposition == PositionRestoreDisposition.CONFLICT }
                val summary = RestoreSummary(
                    entries.count { it.disposition == PositionRestoreDisposition.NEW },
                    entries.count { it.disposition == PositionRestoreDisposition.UNCHANGED },
                    conflicts.map { entry ->
                        RestoreConflict(entry.incoming.bookId.value, entry.incoming.edition.sha256.take(12),
                            when (entry.incoming.format) {
                                LocatorFormat.EPUBJS_CFI -> "EPUB.js"
                                LocatorFormat.READIUM_LOCATOR -> "Readium"
                            })
                    }
                )
                mutableState.value = state.value.copy(busy = false, message = "Review the backup before restoring.", preview = summary)
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                preview = null
                mutableState.value = state.value.copy(busy = false, preview = null,
                    message = "Could not read this backup. It may be invalid, too large, or unavailable. Your saved positions were not changed.")
            }
        }
    }

    fun applyRestore(mode: PositionRestoreMode) {
        if (state.value.busy) return
        val selected = preview ?: return
        mutableState.value = state.value.copy(busy = true, message = "Restoring positions…")
        viewModelScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { store.restore(selected, mode) }
                preview = null
                val message = when (result) {
                    is PositionRestoreResult.Applied -> "Restore complete: ${result.inserted} added, ${result.overwritten} overwritten, ${result.unchanged} unchanged, ${result.kept} kept."
                    PositionRestoreResult.StalePreview -> "Saved positions changed after the preview. Choose the backup again to review it."
                }
                mutableState.value = state.value.copy(busy = false, message = message, preview = null)
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                mutableState.value = state.value.copy(busy = false,
                    message = "Restore failed. Review your saved positions before trying again.")
            }
        }
    }

    fun dismissPreview() {
        if (state.value.busy) return
        preview = null
        mutableState.value = state.value.copy(preview = null, message = "Restore canceled.")
    }

    fun pickerUnavailable() {
        pendingExport = null
        mutableState.value = state.value.copy(busy = false, message = "The system file picker could not be opened.")
    }

    override fun onCleared() {
        pendingExport = null
        preview = null
        eventChannel.close()
        // Closing can wait for an in-flight SQLite transaction; do not block the UI thread.
        CoroutineScope(Dispatchers.IO).launch { store.close() }
        super.onCleared()
    }
}

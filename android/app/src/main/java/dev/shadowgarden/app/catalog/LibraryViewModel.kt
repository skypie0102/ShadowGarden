package dev.shadowgarden.app.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal data class LibraryState(
    val loading: Boolean = false,
    val series: List<CatalogSeries>? = null,
    val fromCache: Boolean = false,
    val coverGeneration: Long = 0,
    val bookGeneration: Long = 0,
    val query: String = "",
    val volumeFilter: VolumeFilter = VolumeFilter.ALL,
    val sort: LibrarySort = LibrarySort.CATALOG,
    val preferencesLoading: Boolean = false,
    val preferencesSaving: Boolean = false,
    val preferencesError: String? = null,
    val error: String? = null
)

internal class LibraryViewModel(
    private val source: CatalogSource = MainCatalogClient(),
    private val cache: MainCatalogCache,
    private val covers: CoverSource = PublicCoverLoader(),
    private val preferences: LibraryPreferencesStore? = null
) : ViewModel() {
    private val mutableState = MutableStateFlow(LibraryState())
    val state = mutableState.asStateFlow()

    private data class PreferenceWrite(val version: Long, val value: LibraryPreferences)
    private val preferenceWrites = Channel<PreferenceWrite>(Channel.CONFLATED)
    private var preferencesWritable = false
    private var filterTouchedBeforeLoad = false
    private var sortTouchedBeforeLoad = false
    private var writeVersion = 0L

    init {
        if (preferences != null) {
            viewModelScope.launch {
                for (request in preferenceWrites) {
                    val failed = try { withContext(Dispatchers.IO) { preferences.write(request.value) }; false }
                    catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { true }
                    if (request.version == writeVersion) mutableState.value = state.value.copy(
                        preferencesSaving = false,
                        preferencesError = if (failed) "Could not save library settings. Your choices are in use for this session." else null
                    )
                }
            }
            loadPreferences()
        }
        refresh()
    }

    fun search(query: String) { mutableState.value = state.value.copy(query = query) }
    fun filterVolumes(filter: VolumeFilter) {
        mutableState.value = state.value.copy(volumeFilter = filter)
        if (!preferencesWritable && preferences != null) filterTouchedBeforeLoad = true
        queuePreferences()
    }
    fun sortBy(sort: LibrarySort) {
        mutableState.value = state.value.copy(sort = sort)
        if (!preferencesWritable && preferences != null) sortTouchedBeforeLoad = true
        queuePreferences()
    }
    fun clearFilters() {
        mutableState.value = state.value.copy(query = "", volumeFilter = VolumeFilter.ALL)
        if (!preferencesWritable && preferences != null) filterTouchedBeforeLoad = true
        queuePreferences()
    }
    fun refreshLocalBooks() { mutableState.value = state.value.copy(bookGeneration = state.value.bookGeneration + 1) }

    suspend fun cover(path: CoverPath) = covers.load(path)
    suspend fun cachedCover(path: CoverPath) = covers.cached(path)

    fun retryPreferences() {
        if (state.value.preferencesLoading || state.value.preferencesSaving) return
        if (preferencesWritable) queuePreferences() else loadPreferences()
    }

    private fun loadPreferences() {
        val store = preferences ?: return
        if (state.value.preferencesLoading || preferencesWritable) return
        mutableState.value = state.value.copy(preferencesLoading = true, preferencesError = null)
        viewModelScope.launch {
            try {
                val saved = withContext(Dispatchers.IO) { store.read() }
                val touched = filterTouchedBeforeLoad || sortTouchedBeforeLoad
                mutableState.value = state.value.copy(
                    volumeFilter = if (filterTouchedBeforeLoad) state.value.volumeFilter else saved.filter,
                    sort = if (sortTouchedBeforeLoad) state.value.sort else saved.sort,
                    preferencesLoading = false,
                    preferencesError = null
                )
                preferencesWritable = true
                filterTouchedBeforeLoad = false
                sortTouchedBeforeLoad = false
                if (touched) queuePreferences()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) {
                mutableState.value = state.value.copy(preferencesLoading = false,
                    preferencesError = "Could not load library settings. Changes for this session will not be saved.")
            }
        }
    }

    private fun queuePreferences() {
        if (!preferencesWritable || preferences == null) return
        val version = ++writeVersion
        val current = state.value
        mutableState.value = current.copy(preferencesSaving = true, preferencesError = null)
        if (preferenceWrites.trySend(PreferenceWrite(version, LibraryPreferences(current.volumeFilter, current.sort))).isFailure) {
            mutableState.value = state.value.copy(preferencesSaving = false,
                preferencesError = "Could not save library settings. Your choices are in use for this session.")
        }
    }

    fun refresh() {
        if (state.value.loading) return
        val readCache = state.value.series == null
        mutableState.value = state.value.copy(loading = true, error = null, coverGeneration = state.value.coverGeneration + 1)
        viewModelScope.launch {
            var cacheReadFailed = false
            if (readCache) {
                try {
                    val saved = withContext(Dispatchers.IO) { cache.read() }
                    if (saved != null) mutableState.value = state.value.copy(series = saved, fromCache = true)
                } catch (error: CancellationException) { throw error }
                catch (_: Exception) { cacheReadFailed = true }
            }
            try {
                val series = withContext(Dispatchers.IO) { source.load() }
                val saved = try {
                    withContext(Dispatchers.IO) { cache.write(series) }
                    true
                } catch (error: CancellationException) { throw error }
                catch (_: Exception) { false }
                mutableState.value = state.value.copy(loading = false, series = series, fromCache = false,
                    coverGeneration = state.value.coverGeneration + 1,
                    error = if (saved) null else "Loaded the Main library, but could not save it for offline use.")
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                mutableState.value = state.value.copy(loading = false,
                    error = when {
                        state.value.series == null && cacheReadFailed -> "Could not load the Main library or read its saved copy. Check your connection and try again."
                        state.value.series == null -> "Could not load the Main library. Check your connection and try again."
                        state.value.fromCache -> "Could not refresh the saved Main library. Check your connection and try again."
                        else -> "Could not refresh. Showing the previously loaded library."
                    })
            }
        }
    }
}

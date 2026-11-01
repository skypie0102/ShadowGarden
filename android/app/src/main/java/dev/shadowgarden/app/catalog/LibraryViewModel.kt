package dev.shadowgarden.app.catalog

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
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
    val error: String? = null
)

internal class LibraryViewModel(
    private val source: CatalogSource = MainCatalogClient(),
    private val cache: MainCatalogCache,
    private val covers: CoverSource = PublicCoverLoader()
) : ViewModel() {
    private val mutableState = MutableStateFlow(LibraryState())
    val state = mutableState.asStateFlow()

    init { refresh() }

    fun search(query: String) { mutableState.value = state.value.copy(query = query) }
    fun filterVolumes(filter: VolumeFilter) { mutableState.value = state.value.copy(volumeFilter = filter) }
    fun sortBy(sort: LibrarySort) { mutableState.value = state.value.copy(sort = sort) }
    fun clearFilters() { mutableState.value = state.value.copy(query = "", volumeFilter = VolumeFilter.ALL) }
    fun refreshLocalBooks() { mutableState.value = state.value.copy(bookGeneration = state.value.bookGeneration + 1) }

    suspend fun cover(path: CoverPath) = covers.load(path)
    suspend fun cachedCover(path: CoverPath) = covers.cached(path)

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

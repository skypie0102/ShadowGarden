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
    val query: String = "",
    val error: String? = null
)

internal class LibraryViewModel(private val source: CatalogSource = MainCatalogClient()) : ViewModel() {
    private val mutableState = MutableStateFlow(LibraryState())
    val state = mutableState.asStateFlow()

    init { refresh() }

    fun search(query: String) { mutableState.value = state.value.copy(query = query) }

    fun refresh() {
        if (state.value.loading) return
        mutableState.value = state.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val series = withContext(Dispatchers.IO) { source.load() }
                mutableState.value = state.value.copy(loading = false, series = series, error = null)
            } catch (error: CancellationException) { throw error }
            catch (_: Exception) {
                mutableState.value = state.value.copy(loading = false,
                    error = if (state.value.series == null) "Could not load the Main library. Check your connection and try again."
                    else "Could not refresh. Showing the previously loaded library.")
            }
        }
    }
}

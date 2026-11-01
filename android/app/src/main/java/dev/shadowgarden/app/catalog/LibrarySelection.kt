package dev.shadowgarden.app.catalog

internal enum class VolumeFilter(val label: String) {
    ALL("All"), ONE("1 volume"), TWO_TO_FIVE("2–5 volumes"), SIX_TO_TEN("6–10 volumes"), ELEVEN_PLUS("11+ volumes");

    fun matches(count: Int): Boolean = when (this) {
        ALL -> true
        ONE -> count == 1
        TWO_TO_FIVE -> count in 2..5
        SIX_TO_TEN -> count in 6..10
        ELEVEN_PLUS -> count >= 11
    }
}

internal enum class LibrarySort(val label: String) {
    CATALOG("Catalog order"), TITLE_ASC("Title A–Z"), TITLE_DESC("Title Z–A"),
    AUTHOR_ASC("Author A–Z"), AUTHOR_DESC("Author Z–A"),
    VOLUMES_DESC("Most volumes"), VOLUMES_ASC("Fewest volumes")
}

/** Selects only from the loaded catalog; does not mutate its saved order. */
internal fun selectSeries(series: List<CatalogSeries>, query: String, filter: VolumeFilter, sort: LibrarySort): List<CatalogSeries> {
    val term = query.trim()
    val selected = series.filter { entry ->
        filter.matches(entry.volumes.size) && (term.isEmpty() || entry.title.contains(term, true) ||
            entry.author.contains(term, true) || entry.volumes.any { it.title.contains(term, true) })
    }
    val byTitle = compareBy<CatalogSeries, String>(String.CASE_INSENSITIVE_ORDER) { it.title }
    return when (sort) {
        LibrarySort.CATALOG -> selected
        LibrarySort.TITLE_ASC -> selected.sortedWith(byTitle)
        LibrarySort.TITLE_DESC -> selected.sortedWith(byTitle.reversed())
        LibrarySort.AUTHOR_ASC -> selected.sortedWith(compareBy<CatalogSeries, String>(String.CASE_INSENSITIVE_ORDER) { it.author }.then(byTitle))
        LibrarySort.AUTHOR_DESC -> selected.sortedWith(compareByDescending<CatalogSeries, String>(String.CASE_INSENSITIVE_ORDER) { it.author }.then(byTitle))
        LibrarySort.VOLUMES_DESC -> selected.sortedWith(compareByDescending<CatalogSeries> { it.volumes.size }.then(byTitle))
        LibrarySort.VOLUMES_ASC -> selected.sortedWith(compareBy<CatalogSeries> { it.volumes.size }.then(byTitle))
    }
}

package dev.shadowgarden.app.catalog

import dev.shadowgarden.app.progress.CatalogBookId
import org.junit.Assert.assertEquals
import org.junit.Test

class LibrarySelectionTest {
    private fun entry(id: String, title: String, author: String, count: Int) = CatalogSeries(
        id, title, author, "Ongoing", (1..count).map {
            CatalogVolume(CatalogBookId("bk_" + ('a' + it).toString().repeat(22)), "Volume $it")
        }
    )
    private val items = listOf(entry("b", "beta", "Zed", 0), entry("c", "Gamma", "amy", 2),
        entry("a", "Alpha", "amy", 1), entry("d", "Delta", "Zed", 11))

    @Test fun combinesSearchAndVolumeRangesWithoutMutatingCatalogOrder() {
        assertEquals(listOf("c"), selectSeries(items, " volume 2 ", VolumeFilter.TWO_TO_FIVE, LibrarySort.CATALOG).map { it.id })
        assertEquals(listOf("d"), selectSeries(items, "ZED", VolumeFilter.ELEVEN_PLUS, LibrarySort.CATALOG).map { it.id })
        assertEquals(emptyList<String>(), selectSeries(items, "beta", VolumeFilter.ONE, LibrarySort.CATALOG).map { it.id })
        assertEquals(listOf("b", "c", "a", "d"), items.map { it.id })
    }

    @Test fun volumeRangeBoundariesIncludeOnlyTheRequestedCounts() {
        val counts = listOf(0, 1, 2, 5, 6, 10, 11, 12)
        assertEquals(counts, counts.filter(VolumeFilter.ALL::matches))
        assertEquals(listOf(1), counts.filter(VolumeFilter.ONE::matches))
        assertEquals(listOf(2, 5), counts.filter(VolumeFilter.TWO_TO_FIVE::matches))
        assertEquals(listOf(6, 10), counts.filter(VolumeFilter.SIX_TO_TEN::matches))
        assertEquals(listOf(11, 12), counts.filter(VolumeFilter.ELEVEN_PLUS::matches))
    }

    @Test fun sortsTitlesAuthorsAndVolumeCountsWithTitleTies() {
        fun order(sort: LibrarySort) = selectSeries(items, "", VolumeFilter.ALL, sort).map { it.id }
        assertEquals(listOf("b", "c", "a", "d"), order(LibrarySort.CATALOG))
        assertEquals(listOf("a", "b", "d", "c"), order(LibrarySort.TITLE_ASC))
        assertEquals(listOf("c", "d", "b", "a"), order(LibrarySort.TITLE_DESC))
        assertEquals(listOf("a", "c", "b", "d"), order(LibrarySort.AUTHOR_ASC))
        assertEquals(listOf("b", "d", "a", "c"), order(LibrarySort.AUTHOR_DESC))
        assertEquals(listOf("b", "a", "c", "d"), order(LibrarySort.VOLUMES_ASC))
        assertEquals(listOf("d", "c", "a", "b"), order(LibrarySort.VOLUMES_DESC))
    }
}

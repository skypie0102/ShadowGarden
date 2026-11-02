package dev.shadowgarden.app.catalog

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream

internal data class LibraryPreferences(
    val filter: VolumeFilter = VolumeFilter.ALL,
    val sort: LibrarySort = LibrarySort.CATALOG
)

internal interface LibraryPreferencesStore {
    fun read(): LibraryPreferences
    fun write(preferences: LibraryPreferences)
}

/** A bounded, versioned local format. Unknown settings are not silently rewritten. */
internal object LibraryPreferencesCodec {
    private const val HEADER = "shadowgarden-library-preferences-v1"
    private const val MAX_BYTES = 512

    fun encode(preferences: LibraryPreferences): ByteArray =
        "$HEADER\nfilter=${preferences.filter.name}\nsort=${preferences.sort.name}\n".toByteArray(Charsets.US_ASCII)

    fun decode(input: InputStream): LibraryPreferences {
        val bytes = ByteArrayOutputStream()
        while (true) {
            val next = input.read()
            if (next < 0) break
            if (bytes.size() == MAX_BYTES || (next != 10 && next !in 32..126)) throw IOException("Invalid library preferences")
            bytes.write(next)
        }
        val lines = bytes.toString(Charsets.US_ASCII.name()).split('\n')
        if (lines.size != 4 || lines[0] != HEADER || lines[3].isNotEmpty() ||
            !lines[1].startsWith("filter=") || !lines[2].startsWith("sort=")) throw IOException("Invalid library preferences")
        val filter = VolumeFilter.entries.firstOrNull { it.name == lines[1].removePrefix("filter=") }
            ?: throw IOException("Unsupported library filter")
        val sort = LibrarySort.entries.firstOrNull { it.name == lines[2].removePrefix("sort=") }
            ?: throw IOException("Unsupported library sort")
        return LibraryPreferences(filter, sort)
    }
}

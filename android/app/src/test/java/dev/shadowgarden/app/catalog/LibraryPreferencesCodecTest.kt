package dev.shadowgarden.app.catalog

import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryPreferencesCodecTest {
    @Test fun allSelectionsRoundTrip() {
        for (filter in VolumeFilter.entries) for (sort in LibrarySort.entries) {
            val preferences = LibraryPreferences(filter, sort)
            assertEquals(preferences, LibraryPreferencesCodec.decode(LibraryPreferencesCodec.encode(preferences).inputStream()))
        }
    }

    @Test fun rejectsUnsupportedMalformedAndOversizedInput() {
        val valid = LibraryPreferencesCodec.encode(LibraryPreferences()).toString(Charsets.US_ASCII)
        val invalid = listOf(
            valid.replace("preferences-v1", "preferences-v2"),
            valid.replace("filter=ALL", "filter=FUTURE"),
            valid.replace("sort=CATALOG", "sort=FUTURE"),
            valid + "extra\n",
            valid.dropLast(1),
            valid.replace("filter=ALL", "filter=ALL\u0000"),
            "x".repeat(513)
        )
        for (text in invalid) assertTrue(runCatching { LibraryPreferencesCodec.decode(text.byteInputStream()) }.exceptionOrNull() is IOException)
    }
}

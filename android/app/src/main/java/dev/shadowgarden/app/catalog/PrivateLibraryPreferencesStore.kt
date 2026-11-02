package dev.shadowgarden.app.catalog

import android.util.AtomicFile
import java.io.File
import java.io.FileNotFoundException
import java.nio.file.Files
import java.nio.file.LinkOption

/** Independent app-private preferences; call on an I/O thread. */
internal class PrivateLibraryPreferencesStore(private val file: File) : LibraryPreferencesStore {
    private val atomic = AtomicFile(file)

    override fun read(): LibraryPreferences = synchronized(FILE_LOCK) {
        val hadFile = listOf(file, File(file.path + ".bak"), File(file.path + ".new"))
            .any { !Files.notExists(it.toPath(), LinkOption.NOFOLLOW_LINKS) }
        val stream = try { atomic.openRead() } catch (error: FileNotFoundException) {
            if (!hadFile) return@synchronized LibraryPreferences()
            throw error
        }
        stream.use { LibraryPreferencesCodec.decode(it) }
    }

    override fun write(preferences: LibraryPreferences) = synchronized(FILE_LOCK) {
        val output = atomic.startWrite()
        try {
            output.write(LibraryPreferencesCodec.encode(preferences))
            atomic.finishWrite(output)
        } catch (error: Throwable) {
            try { atomic.failWrite(output) } catch (cleanup: Throwable) { error.addSuppressed(cleanup) }
            throw error
        }
    }

    private companion object { val FILE_LOCK = Any() }
}

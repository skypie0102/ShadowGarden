package dev.shadowgarden.app

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileNotFoundException

/** Debug-only, private provider for instrumentation fixtures in the app cache. */
class BackupTestProvider : ContentProvider() {
    override fun onCreate(): Boolean = true
    override fun getType(uri: Uri): String = "application/json"
    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val name = uri.lastPathSegment ?: throw FileNotFoundException("Missing fixture")
        if (!name.startsWith("backup-ui-") || name.contains('/') || name.contains('\\') || mode !in listOf("r", "wt")) {
            throw FileNotFoundException("Invalid fixture")
        }
        val root = requireNotNull(context).cacheDir.canonicalFile
        val file = File(root, name).canonicalFile
        if (file.parentFile != root) throw FileNotFoundException("Invalid fixture")
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode))
    }
    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = throw UnsupportedOperationException()
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException()
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = throw UnsupportedOperationException()
}

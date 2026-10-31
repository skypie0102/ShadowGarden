package dev.shadowgarden.app.progress

import java.util.Collections

/** A preview is tied to its originating store instance and is never itself a confirmation. */
internal class PositionRestorePreview internal constructor(
    internal val owner: Any,
    entries: List<PositionRestoreEntry>
) {
    val entries: List<PositionRestoreEntry> = Collections.unmodifiableList(entries.toList())
}

internal enum class PositionRestoreDisposition { NEW, UNCHANGED, CONFLICT }

internal data class PositionRestoreEntry internal constructor(
    val incoming: ReadingPosition,
    val disposition: PositionRestoreDisposition,
    internal val expected: StoredReadingPosition?
)

/** Neither mode deletes slots absent from the backup. */
internal enum class PositionRestoreMode { KEEP_EXISTING, OVERWRITE_CONFLICTS }

internal sealed interface PositionRestoreResult {
    data class Applied(val inserted: Int, val overwritten: Int, val unchanged: Int, val kept: Int) : PositionRestoreResult
    /** No changes were applied; obtain and confirm a new preview. */
    data object StalePreview : PositionRestoreResult
}

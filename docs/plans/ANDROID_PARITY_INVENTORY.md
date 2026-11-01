# Android feature parity inventory

Baseline: repository source at `92f14c6` (website v2.30.0). This inventory
maps existing website behavior to proposed Android surfaces and observable
acceptance cases. Statuses distinguish implemented pieces from remaining work.
Reader and Keeper behavior may use a different mobile layout;
the interaction and security outcomes remain the target. Check the current
website and update this inventory if its behavior changes.

Website owners and details: [Library and Keeper architecture](../guides/WEBSITE_ARCHITECTURE.md),
[reading journey](../guides/READING_JOURNEY.md), [reader architecture](../guides/READER_ARCHITECTURE.md),
[reader controls](../guides/READER_CONTROLS.md), [settings](../guides/READER_SETTINGS.md),
[read aloud](../guides/READER_TTS.md), [Keeper uploads](../guides/KEEPER_UPLOADS.md),
and [API contracts](../guides/API_CONTRACTS.md).

## Library and series

| Status | Website behavior | Proposed Android surface | Acceptance cases |
| --- | --- | --- | --- |
| Planned | Main and separately age-gated Adult catalogs, acknowledgement/reset and scope-specific presentation | Library switch and adult gate | Decline returns to Main; entering and resetting acknowledgement affect only Android; correct scope and age warning remain on navigation. |
| Partial | Catalog loading, errors, series covers/metadata, volume counts, grid/compact views | Library | Early Main catalog loading, public cover thumbnails with a bounded offline cache, saved catalog, errors and volume counts exist. Adult scope, full metadata and layouts remain open. Main and Adult must load independently; errors and empty results are distinguishable and retryable. |
| Partial | Search by title, author, tag and volume; author, translator, genre, year, volume-count, status and exact-tag filters; popular tags, reset and sort options | Search and filter sheet | Early Main search covers titles, authors and volume titles. Filters, tags and sort remain open; combined filters must match website results on a shared fixture. |
| Planned | Pinned series and pinned-only navigation; Recently Added and newest view | Library and pins | Pin/unpin survives restart; pinned-only and recently added use correct series, scope and ordering. |
| Planned | Continue reading, reading status, progress context and next-volume suggestions | Library and series | Unread, in-progress, finished, out-of-order completion and unavailable EPUB cases select the correct volume; no fabricated percentage for unknown progress. |
| Planned | Series synopsis, credits and links, volume order, grid/list, cover badges and Read/Continue/Read Again/Download | Series and volume details | Metadata and order match catalog; read-again confirmation clears only the selected progress/finished state and preserves bookmarks; unavailable files cannot be opened. |
| Planned | Garden Pass human verification and ticket-protected book access | Access prompt and download/open flow | Verification and expiry follow the server contract; errors/retry are clear; tickets or cookies are not stored in backups or logs. |
| Planned | External links, navigation back to the correct library/series | App navigation and external-link confirmation | Return paths retain Main/Adult scope and selected series; external destination requires informed action. |

## Reader

| Status | Website behavior | Proposed Android surface | Acceptance cases |
| --- | --- | --- | --- |
| Planned | Pages and Continuous reading, page/scroll controls and progress seek | Reader | Touch navigation and seek work in both modes; switching flow retains the semantic location; completion and next-volume actions work. |
| Planned | Table of contents, chapter context, book text search and results | Reader contents/search | Nested chapters and text matches open the intended passage; cancel/new search does not navigate from stale results. |
| Planned | Saved progress, volume completion, bookmarks and read-again reset | Reader and series | Restart returns to the saved location; bookmarks navigate and can be removed; reset retains bookmarks and other books' state. |
| Planned | Flow, typeface, font size, line height, alignment, text width, swipe preference, four themes and device-default reset | Reader settings | Settings apply, persist and reset independently of progress; layout reflow keeps the location; scope and accessibility remain correct. |
| Planned | Double-tap image focus/zoom and return; first-use guidance | Reader image viewer | An illustration can be opened, zoomed and dismissed, returning to the same reading position. |
| Planned | EPUB internal links, publisher footnotes/notes and external-link confirmation | Reader dialogs/navigation | Internal references and footnotes open the intended content; dismiss returns correctly; external links require confirmation. Publisher notes are distinct from proposed user annotations. |
| Planned | Online Edge read aloud: English voices, speed, previous/next passage, play/pause, read from here, follow and media controls | Reader speech controls | Playback, following and suspension behave correctly; provider errors allow retry without blocking reading; audio focus and lock-screen controls are tested on real Android hardware. |
| Planned | Fullscreen and reader lifecycle/error feedback | Reader | System bars and return controls remain accessible; process recreation and failed source loads do not silently lose a saved position. |

## Keeper

All Keeper writes need isolated fixtures and retain the existing authenticated
session, server validation and applicable revision preconditions. Mobile
screens are proposed groupings; they do not require reproducing desktop layout.

| Status | Website behavior | Proposed Android surface | Acceptance cases |
| --- | --- | --- | --- |
| Planned | Keeper token, Turnstile verification, unlock, lock and session revocation | Keeper gate and session controls | Invalid/expired sessions fail closed; lock cancels owned requests and clears sensitive state; no secret is embedded or logged. |
| Planned | Search/filter Main, Adult and all; refresh and open series | Keeper library | Search and scope show the correct catalog; errors and refresh retain safe editor state. |
| Planned | New Books batch/targeted upload, EPUB inspection, metadata/cover editing and review | Upload queue and editor | File picker supports multiple EPUBs; invalid files are blocked; destination and metadata are explicit; targeted batches cannot escape their series/scope. |
| Planned | Duplicate handling: upload, skip, replace existing or add separate as applicable | Upload review | Each choice has the website's effect; similar warnings are advisory; cross-series replacement is rejected. |
| Planned | Queue processing, per-file progress/results, retry, cancellation and retained skipped/invalid items | Upload queue/results | Partial failure is distinct from structural failure; retry excludes successes; changing target requires confirmation; stale/locked session cannot continue a batch. |
| Planned | Edit series metadata, genres/tags, description and Main/Adult scope | Series editor | Save uses the displayed revision; stale edits show a conflict without discarding drafts; changing scope preserves identity. |
| Planned | Edit volume metadata, replace EPUB, move series/volume to Trash, add books to a series | Series/volume editor | Replacement preserves book identity and editorial metadata; stale revision fails; destructive actions require confirmation and Trash retains recovery. |
| Planned | Translation credits and sanitized external links; select/reset series banner | Series editor | Changes persist in the selected series and scope; unsafe links are rejected; banner choices and reset work. |
| Planned | Health and deep object checks; cover optimization; genre/tag audit and normalization | Maintenance | Checks distinguish incomplete from healthy; mutations have clear outcomes and respect revisions/limits. |
| Planned | Catalog snapshots: create, page history, restore and delete selected snapshots | Catalog history | Checksum/revision safeguards and confirmations remain; a failed restore does not silently replace the catalog. |
| Planned | Trash listing, restore and permanent purge, including retryable media cleanup | Trash and recovery | Confirmation and recovery boundaries are clear; protected references remain safe; interrupted purge can be continued. |
| Planned | Recovery readiness, validated snapshot restore and abuse cooldown controls | Recovery and security | Readiness reports incomplete checks; snapshot restore uses checksum and revision; cooldown release affects only the selected public limit. |

## Android-specific additions

| Status | Feature | Acceptance cases |
| --- | --- | --- |
| Planned | Download manager and offline library | Protected downloads retry after interruption/expired ticket; opening downloaded EPUBs works offline; deleting bytes leaves progress intact. |
| Partial | Local reading data and manual export/restore | An early position-only backup screen exists. Reader integration, a complete personal-data backup and device acceptance remain open. App data is separate from browser state; invalid backups must not corrupt existing data; a restored matching edition must resume correctly. EPUBs and Keeper credentials are excluded from the initial progress backup. |
| Planned | Storage and lifecycle behavior | Process death, rotation, low storage and app restart preserve committed state and expose failures. |

Offline text-to-speech, personal highlights/notes, reminders and other proposed
enhancements are not website parity requirements. Their scope is deferred in
the [Android roadmap](ANDROID_ROADMAP.md).

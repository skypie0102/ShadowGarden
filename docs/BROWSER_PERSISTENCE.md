# Browser persistence after failed writes

Baseline: main `f76b688`, v2.16.1 implementation. This audit increment is merged
for v2.17.0 through [PR #35](https://github.com/skypie0102/ShadowGarden/pull/35)
as `129a1d2`. Production remains the verified v2.16.0 deployment until a new
release is explicitly recorded.

## Reproduced failures

Eight controls fail on the baseline. Saving a bookmark or progress can update
the source-path record before its public-book-ID alias fails. Clearing progress
can remove only some aliases. Finished toggles can update compatibility markers
while leaving their shared map unchanged, or update the map after a marker
failure. Settings can update one preference record and retain the old gesture
record. Read Again can clear Finished status and then fail to clear progress.
An unavailable localStorage object can also report a successful write/removal.

These failures are reproduced with disposable data and deterministic quota or
security exceptions. They are not claims that the owner's browser has exhausted
its storage or that the production catalog was affected. This state lives in
the browser; no D1 or B2 format or contents change.

## Ownership and behavior

`domain/storage.js` owns grouped synchronous `writeChanges` operations. Each
change supplies a key and either a string, a removal (`null`), or a function
that derives its replacement from the exact original string. The helper:

1. Gets storage explicitly and snapshots every key before writing any value.
2. Prepares/serializes all replacements before the first write.
3. Rejects a value changed since its snapshot before overwriting that key.
4. Applies changed values and verifies the resulting group.
5. On failure, attempts to restore only values still equal to this attempt's
   replacement. It removes newly created records before restoring originals.

A failed snapshot/serialization writes nothing. A failed later write rolls back
earlier owned changes where storage permits it. Missing storage returns false.
Single-key writes/removals use the same checked policy. Callers publish success
events only after a verified successful group.

| Owner | Group |
| --- | --- |
| `domain/progress.js` | All progress aliases, for either save or clear |
| `domain/bookmarks.js` | All bookmark aliases |
| `domain/reading-state.js` | Shared Finished map plus all compatibility markers; Finished migration also updates both identities in one group |
| `reader/storage.js` | Reader settings plus legacy gesture settings |
| `reading-state.resetReadingAliases` | Finished map, markers and progress removal in one Read Again operation |

Public Read Again and reader startup `restart=1` use that same reset operation.
Bookmarks and other books' Finished entries remain. Reset events are emitted
after both progress and Finished state are committed; observers see the complete
new state. Failed operations emit no success event. Failure messages no longer
promise that data is unchanged when the browser might also refuse restoration.

The Finished-map update derives from its strict original read rather than a
fallback empty map. A blocked read or malformed map therefore cannot silently
erase other books' state. Existing array-form Finished data remains readable and
is converted to the already-supported object map when successfully updated.

All existing key names, bookmark/progress/settings shapes and identity aliases
remain. This introduces no journal, new database, storage-format migration or
background retry loop. Active reader presentation continues to work when a save
fails; a failed save does not become a claimed durable success.

## Limits

Web Storage has no multi-key transaction or cross-tab lock. This helper provides
checked writes and conditional rollback, not isolation or crash atomicity.
Another tab can still race between comparison and write, and native storage
events may expose intermediate values to that tab. A page/process crash can
interrupt the group. If the browser blocks restoration too, a partial update
can remain; the helper returns false and reports the restoration failure.
Rollback never replaces another context's observed later value to force the
old snapshot back into place.

Strict all-or-nothing behavior through crashes or arbitrary concurrent writers
would require a transactional canonical store and a compatible migration plan.
That remains a separate architectural decision. Do not describe this increment
as localStorage becoming transactional.

## Validation and release

The Node controls cover all eight baseline failures; each Finished write
position; successful compound reset; strict snapshot/serialization failure;
malformed map retention; observed concurrent writes; rejected rollback; and
Finished migration failure/success. Three browser cases use the real storage
services, bookmark controller, completion switch and public Read Again flow.
They inject a storage exception, check visible feedback, reload the page and
verify durable state. A successful reset retry preserves bookmarks and publishes
events containing consistent final state.

[CI run 39337221966](https://github.com/skypie0102/ShadowGarden/actions/runs/39337221966)
passes on attempt 1: asset/provenance audit, 285 Node tests, static build,
binding-aware Functions package and 492 browser passes. Eight existing platform
skips remain; there are no automatic test retries. All three new browser cases
pass in every profile. The tested source is `88c825ab453d11c41205e335deec523222b84aee`;
its tree exactly matches merge `129a1d25cec760283987938e218345ac3e417b96`:
`3c34fe0a6482dceb4bb4e0d609c676c6e749d3bb`.

| Profile | Passed | Existing skips |
| --- | ---: | ---: |
| Desktop Chromium | 100 | 0 |
| Mobile Chromium | 100 | 0 |
| Desktop Firefox | 98 | 2 |
| Desktop WebKit | 98 | 2 |
| Mobile WebKit | 96 | 4 |

The merged main build is prepared with v2.17.0 metadata at `/data/version.json`.
The compiled Functions package passes actual D1/variable binding checks and
matches the configured compatibility date/flags. It is deployed on 2026-10-20 as
`f86f42ef-b710-40f8-bf6a-011c47b875e5`, clean source `129a1d2`. Both live catalogs
match D1, all seven changed static modules match the build, both Library footers
show v2.17.0, challenge configuration responds and unauthenticated Keeper access
returns 401. The Adult content warning remains intact; no acknowledgement was
submitted. The rollback target is v2.16.0,
`8212de19-5ccb-40bd-9241-14b9427ea565`.

The existing plugin issued valid upload tokens. Its runtime's asset requests
returned 403, but the local upload helper succeeded with a plugin-issued token,
uploaded eight changed files and revalidated all 164 unique hashes. No second
sign-in or permission change was required. [The transport record](PAGES_UPLOAD_TRANSPORT.md)
explains the supported request flow and the observed execution-path difference.

The refreshed D1 document matches the verified v2.16.0 release at revision 8;
all eight actual snapshot hashes match their stored checksums. Production
bindings/compatibility settings are unchanged. No production database, media,
credential or configuration write was performed. This adds no physical-device
or authenticated real-book acceptance claim.
[Verification evidence](persistence-verification-2.17.0.json) records the merge,
tests, refreshed before/after baseline and live publication separately.

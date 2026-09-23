# ShadowGarden reconstruction log

## 2026-09-23 — evidence intake and project restoration

Source: the supplied `shadowgarden-static-recovered.zip` and original
`recovered-site.zip`, crawled from `shadowgarden-bon.pages.dev`.

**Recovered:** 148 public deployment files; six HTML pages; CSS, browser JavaScript,
EPUB.js/JSZip bundles, favicon; four catalog JSON files; ten cover images;
data-source and version metadata. Original version 2.11.0, commit
`12e27d7468f1a259419d2ed76aec95a289e7af9f`, branch main.
The dynamic public catalog contains one series and five book identifiers; the
main catalog is empty. Those are the archive contents, not proof that the live
storage account contains no other works.

**Routing evidence:** `recovery-info/FUNCTION_ROUTES.md` transcribes 15 deployed
routes. The raw Cloudflare manifest and worker bundle are not in either archive.
`recovery-info/provenance.json` records archive and original file SHA-256 hashes.

**Inferred replacements:** source organized under `public/`; Pages Functions under
`functions/`; shared backend under `server/`; dependency lock, Wrangler config,
build/audit scripts and tests. Backend contracts come from the recovered client.
Original server source has not been recovered and new implementations must not
be described as identical to it.

**Storage decision:** Backblaze B2 is evidenced by `data/source.json` and the admin
workflows. D1 is a NEW reconstruction dependency for transactional catalogs,
snapshots, revocable admin sessions and rate limits; it is not an inferred original
binding. This prevents racing catalog writes from silently overwriting each other.
Recovered catalogs remain a read-only fallback without a configured database.

**Still missing:** original function code, build scripts and Git history; raw
routing manifest; Cloudflare project/account settings and binding identifiers;
secrets; private book-ID-to-B2-key mappings; five EPUB binaries; historical
backups, trash, and security telemetry. Public book IDs cannot be reversed to
private object paths. No access control is bypassed to obtain those files.

**Repository access:** project instruction names
`https://github.com/shdwmnrchbks/ShadowGarden`; authenticated lookup returns 404
and git cannot authenticate. Repository discovery also finds a new empty
`skypie0102/ShadowGarden` with write access. Destination clarification is pending;
no existing remote history has been overwritten.

Implementation and audit results are appended as work completes.

## 2026-09-23 — backend reconstruction

- Implemented all 15 observed routes, with method restrictions, JSON errors,
  same-origin checks and authenticated admin access.
- Added server-side Turnstile action/hostname verification, signed human/admin
  sessions, admin revocation, exact-object book tickets and protected media.
- Reconstructed B2 native API reads/uploads and D1 catalog mutations, backups,
  trash restore, translations, banner selection, taxonomy and cover maintenance.
- Added persistent pseudonymous cooldown telemetry. This is an inferred basic
  policy; the original tripwire scoring rules and telemetry were not recovered.
- Permanent purge and the undocumented recovery POST explicitly return 501.
  Purge controls are disabled; neither operation pretends to have succeeded.
- Patched the recovered admin core for revision guards and immutable upload keys.
  Book replacement preserves public identity and snapshots' original media.
- Added bounded EPUB ZIP validation, upload key reservation and an offline,
  revision-guarded private mapping restore generator.
- Restored build scripts, pinned package lock, a local Wrangler configuration,
  an explicit D1 seed, CI and deployment documentation. Original versions and
  build settings remain evidence-only, distinct from the new configuration.

## 2026-09-23 — audit checkpoint

- Passed asset/syntax/JSON audit: 148 recovered files, 146 byte-identical,
  two documented modifications, 207 literal references and 15 route files.
- Passed all 22 backend tests with real SQLite and mocked provider APIs.
- Verified the private mapping generator's successful and stale revision paths.
- Parsed six HTML documents with no duplicate IDs.
- Built static output and compiled Pages Functions successfully.
- Executed the initial D1 migration and idempotent seed locally. No original
  database or live B2/Cloudflare resource was mutated.
- npm reported no dependency vulnerabilities at this checkpoint. This does not
  audit recovered vendor bundles against their missing original lockfiles.
- Full preview/visual QA is blocked by environment limitations: Wrangler dev's
  network-interface enumeration failed; direct Miniflare probes stalled and were
  stopped; Chromium was unavailable and its download was invalid/truncated.
- Real B2/Turnstile integration and the missing original EPUBs remain unverified.
- Added `docs/API_CONTRACTS.md`, `docs/DEPLOYMENT.md`, `docs/AUDIT.md` and
  `docs/MISSING_COMPONENTS.md` with explicit recovery boundaries.

## Resume point

This checkpoint is recorded as a new local Git root commit; the original Git
history is not present. A source archive with a Git bundle preserves the checkpoint
while remote publication is blocked. The earlier project instruction named `shdwmnrchbks/ShadowGarden`, which
returned 404 on two authenticated checks. `skypie0102/ShadowGarden` is connected,
empty and writable. The user’s subsequent “continue” authorizes proceeding with
that proposed destination. The next
production step is to restore actual bindings and private media/mappings, then
perform real-browser and provider integration checks before switching traffic.

## 2026-09-24 — publication resumed

- Continued with `skypie0102/ShadowGarden` after the user’s response to the
  destination question. Verified it is still empty and the connection has write access.
- The reconstructed source checkpoint is `ce2b14a1c5ebae6c7884d3ddcfe94802b05b372a`.
- Publication uses GitHub’s authenticated Git API because this workspace has no
  shell Git credential helper. Remote commits therefore receive new identities;
  file/blob hashes will be compared to the local tree to verify exact content.
- No original Cloudflare deployment, database, B2 bucket or private book was changed.

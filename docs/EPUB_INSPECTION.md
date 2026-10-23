# Keeper local EPUB inspection — v2.18.10

This batch expands the local inspection service and corrects false missing-file
results for percent-encoded archive names. The service still produces data-only
reports; queue/editor behavior, upload decisions and backend validation retain
their existing owners.

## Finding and correction

`admin/epub-inspection.js` decoded a complete reference before separating its
query and fragment. For example, `Text/chapter%231.xhtml` became
`Text/chapter#1.xhtml` and was then truncated to `Text/chapter`. A present spine
document could be reported missing and block the upload. Encoded hashes in cover
names or internal resources could similarly produce false warnings.

The resolver now separates literal query/fragment delimiters first, then decodes
the path once. Existing dot-segment/root-escape checks still run on decoded path
data. The change preserves UTF-8 names, actual fragments/queries, missing-file
rejection, external-spine rejection and the existing size limit. It adds no
remote fetch or archive write.

This ordering follows [RFC 3986 §2.4](https://www.rfc-editor.org/rfc/rfc3986#section-2.4).
The [EPUB 3.3 filename restrictions](https://www.w3.org/TR/epub-33/)
do not prohibit `#`; references must distinguish filename data from URL delimiters.
See also [URLs in the OCF container](https://www.w3.org/TR/epub-33/).
This focused resolver correction is not a full EPUB conformance checker.

## Readability and validation

Pinned external Prettier 3.6.2 expands the existing service without changing its
mechanical-stage normalized Babel AST or ordered normalized comments. Lines over
180 columns decrease from six to zero. The final resolver correction is recorded
separately from that formatting stage in
[source evidence](epub-inspection-equivalence.json). No dependency, schema,
configuration, storage format, reader code or upload limit changes.

Twelve Node controls run the real inspection body against the pinned JSZip,
generated ZIP bytes and deterministic XML boundary fixtures. Only the
origin-relative taxonomy import is resolved to its local module. Detached
baseline `6dea3a7` passes seven and fails five. All twelve pass after correction;
the focused inspection/Upload suite passes all 35 cases. Controls cover encoded
file/directory/Unicode names, covers and internal references, exact archive
hash/cover bytes, ordinary paths/queries/fragments, missing entries, decoded
traversal, external spine URLs, single decoding, missing containers and the
pre-read size guard. Node XML fixtures are isolated controls, not a substitute
for browser XML parsing.

Three browser cases exercise actual Keeper markup, the real DOMParser, local
archive selection and SHA-256. The encoded fixture combines a hashed directory,
Unicode chapter name and encoded cover/image paths. An ordinary publication
retains query/fragment behavior; a publication with a missing spine entry stays
blocked. All books are generated technical fixtures, and admin APIs are
intercepted. No live uploads, catalog/provider writes or new physical-device,
credential or provider acceptance is claimed.

Local `npm run check` passes the asset/provenance audit, all 448 Node tests,
static build and binding/compatibility-aware Functions package.

The tested source is `f5396fea3290ac0840f4a7a169de2bacdcec7d48` and tree
`9b3777b647cba62339690354e5d2a2f26bf62d40`. Squash merge `5ab282221c7f825517b91dcb28472e523d88e510`
has exactly that tested tree.

The [PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/39955586173) and
[checked main release](https://github.com/skypie0102/ShadowGarden/actions/runs/40034070015)
both pass **448 Node tests** and **696 browser cases** across five profiles,
with nine documented platform skips and zero test retries. All three new
inspection cases pass in every profile. The separate Chromium Library-startup
profile passes on the PR and is excluded from the 696 cases.

The automatic workflow publishes **v2.18.10**, source `5ab2822`, deployment
`a9acfe26-d51f-4fc6-821e-6b972234cafe`, to [live ShadowGarden](https://shadowgarden-bon.pages.dev).
The release completes in one publication attempt, retaining the original
pre-publication baseline and v2.18.9 rollback. The version check uses one request
over 96 ms. Canonical source/version, both D1-derived
catalogs and the changed inspection module pass verification. Independent public
HTTP checks match the same version/source and exact module bytes. The exact
revision-9 catalog document, all nine snapshots and recorded settings remain
unchanged, with zero database writes. The retained rollback is
`e5178997-51bf-4597-872b-181ba415e04a`. See
[verification evidence](epub-inspection-verification.json).

No performance improvement or complete EPUB/ZIP security audit is claimed.

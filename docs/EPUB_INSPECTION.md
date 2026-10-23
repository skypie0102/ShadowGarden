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
The [EPUB 3.3 filename restrictions](https://www.w3.org/TR/epub-33/#sec-container-filenames)
do not prohibit `#`; references must distinguish filename data from URL delimiters.
See also [URLs in the OCF container](https://www.w3.org/TR/epub-33/#sec-container-iri).
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
static build and binding/compatibility-aware Functions package. Full PR/main CI
and production verification are pending. No performance improvement or complete
EPUB/ZIP security audit is claimed.

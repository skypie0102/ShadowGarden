# Completed work and historical evidence

These records preserve completed implementations, dated release verification and
superseded recovery/provisioning notes. The [active plans](../README.md#active-work)
are the source of current work. A historical “pending” statement retains its
original date; later completion notes supersede it. An evidence limit is not a
claim that an old bug is still present.

| Collection | Contents and completion |
| --- | --- |
| [Plans](plans/) | Reader refactor, Reader maintenance M1–M5 (deployed by v2.12.8), Website W1–W6 (v2.14.0) |
| [Audits](audits/) | Recovery audit, October codebase audit completed through v2.18.13, Reader review and scroll investigation |
| [Completed increments](completed/) | Keeper ownership/readability/CSS, EPUB inspection, Library readiness, upload buffering, persistence, protected transport and browser-runtime work |
| [Releases](releases/) | Project/Reader/Website release history, public reading actions and [Reader controls v2.29.0](releases/READER_CONTROLS_2.29.0.md) and [Phase 4 visual consistency v2.29.1](releases/VISUAL_ACCESSIBILITY_2.29.1.md) and [Series state labels v2.29.2](releases/SERIES_STATE_LABEL_2.29.2.md) |
| [Recovery](recovery/) | Reconstruction log, initial missing-components boundary, old manual production takeover and separate test-project setup; superseded by current operations |
| [Incidents](incidents/) | Dated deployment incident and recovery evidence |
| [Evidence](evidence/) | Original machine-readable measurements, source identities and sanitized verification reports |

The [path map](path-map.json) records all moved paths, including the original
root reconstruction log. The 70 original evidence JSON files are preserved
byte-for-byte; later releases append sanitized reports. [SHA256SUMS](evidence/SHA256SUMS)
records all retained report digests; from the repository root, verify with:

```sh
(cd docs/archive/evidence && sha256sum --check SHA256SUMS)
```

Paths and “current” versions inside evidence JSON describe the recorded run and
are intentionally retained. Markdown links are rebased to their new locations.
`recovery-info/` remains in place because its provenance and route inventories
are used by the asset/build guards. Vendor license records also retain their
original locations.

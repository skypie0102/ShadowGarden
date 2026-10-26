# Website refactor

> Website increments W1–W6 are complete and verified in v2.14.0. See the [documentation index](../../README.md) for active work and current operations.

Scope: main Library, Adult Library, series pages, shared navigation/access UI,
and Garden Keeper. The completed reader maintenance remains a separate boundary.
The reported reader reset bug is a focused correction, not a new reader rewrite.

## Baseline and invariants

Baseline: `75aaad5` / production v2.12.8. Inspection found these concrete ownership
problems rather than a need to replace the existing domain or Keeper workflows:

- `book-access.js` mixed ticket policy, identity migration, widget loading,
  injected CSS and dialog interaction. Its green dialog diverged from the main
  Library's midnight palette.
- `site-flavor.js` walks body text, observes every text mutation and wraps native
  alerts/confirmations. Renderers should author their final copy directly.
- `nav.css` also owns site-wide themes, overriding older green defaults in
  `site.css`; navigation and palette ownership are mixed.
- `library.js` mixes URL persistence, filter control creation, incremental loading
  and rendering. Model/renderers already provide useful boundaries to retain.
- Keeper has explicit registered workflows but `admin-batch.js` still combines
  queue state, preflight, preview rendering and upload orchestration.

Preserve existing URLs, book identities, storage keys, age acknowledgement,
filters/history, reading marks, downloads and Keeper revision/conflict checks.
Keep protected access and cancellation semantics. Do not migrate or seed the live
D1 database, change B2 objects, expose secrets, or alter reader layout/scroll logic.

## Increments and acceptance

| Increment | Work | Acceptance |
| --- | --- | --- |
| W1 — access presentation | Extract Garden Pass dialog and static CSS from ticket policy; author its final copy directly; correct midnight/rose contexts | Reset defaults regression, main/adult dialog colors, cancellation, rejected verification retry, one shared challenge, successful ticket retry; full existing suite |
| W2 — direct copy | Move each remaining flavor transformation to its owning template/renderer/workflow; retire the body observer and native-dialog wrappers | Preserve rendered copy and all destructive consequences; normal/error/empty states and Keeper confirmation flows |
| W3 — themes | Move public palette ownership out of navigation; replace superseded base colors and contextual overrides with explicit shared tokens | Main/adult/series/Keeper screenshots at mobile and desktop widths; no horizontal overflow or navigation regression |
| W4 — Library controller | Separate URL/filter state from page composition; retain the existing catalog model/renderers and explicit batched rendering owner | Search, contextual filters, history/back, pin/status refresh, pagination and age-gate return links |
| W5 — Keeper batch | Extract local EPUB inspection and publish explicit queue/status/view events while retaining client and workflow contracts | Preflight failures, cancellation, partial success/retry, revision conflicts, retained-media safety and upload limits |
| W6 — closeout | Remove obsolete glue, document public interfaces, review duplicate CSS and repeated work using observed cases | Full five-profile browser suite, audit/build/binding guards; guarded production rollout and honest live-check evidence |

Do not replace functioning boundaries just to rename files. Each increment needs
an observable simplification and behavior coverage before merge. Record newly
found defects separately; avoid adding broad catch-all overrides or sleeps.

## W1 implementation

`public/garden-pass.js` now owns the widget loader, dialog, status/focus and widget
cleanup. `book-access.js` keeps native fetch, verification transport, shared
challenge coordination, ticket retries/cache, identity migration and downloads.
`garden-pass.css` owns context-specific dialog styles; reader and series shells
load it directly. Six post-render text substitutions are removed for this dialog.

`reader/settings.js` supplies one device-aware default for initialization,
sanitizing missing/invalid flow and reset, while respecting saved choices.
`book-session.js` uses that same settings policy for the pre-authorization shell.
Continuous is the mobile default; desktop uses Pages. Existing rendering and
scroll algorithms are unchanged.

W1 is deployed as v2.13.0 from `5389ebe` on 2026-10-18. All 217 Node tests
and 407 browser cases pass across five profiles (eight existing platform skips).
The live midnight dialog, main footer, fourteen source hashes, unchanged D1
document/snapshots and actual/saved bindings are verified. See the
[website release record](../releases/WEBSITE_RELEASE.md). W2–W6 are implemented and verified in v2.14.0.

## W2–W6 implementation

The current website sweep moves live copy and confirmations directly into their
owners, retires `site-flavor.js`, separates themes from navigation and verification
CSS from session code, shares widget loading, and extracts Library URL state.
The three filter controls already present in both Library shells no longer have
fallback DOM-injection implementations.

Keeper preflight has its own local inspection service. Upload state and render
notifications replace model-inference DOM observers; the obsolete polling
completion shim is retired. Upload buttons are no longer cloned, and file
selection no longer suppresses nonexistent legacy listeners. Terminal status is
published after transaction completion and its final queue render. Existing
registered Keeper workflows/client, incremental catalog rendering, reader layout
and motion behavior are retained.

The [architecture guide](../../guides/WEBSITE_ARCHITECTURE.md) documents these final boundaries
and event contracts. This is a frontend ownership refactor, not a framework
migration or visual redesign. Full verification is complete and the refactor is deployed as v2.14.0 from
`ff5bb9c`. All 220 Node tests and 422 browser cases pass across five profiles
(eight existing skips). Live UI/source/configuration checks pass and production
data is unchanged. See the [release record](../releases/WEBSITE_RELEASE.md).

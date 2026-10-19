# Website ownership

The public website and Keeper use plain JavaScript delivery and the Pages
Functions API. Book identities, browser storage formats and backend authorization
remain stable. Existing links continue to work when series move between shelves.

| Boundary | Owner | Responsibilities |
| --- | --- | --- |
| Library page | `library.js` | Composition, control events, batched rendering and reading/preference refresh |
| Query persistence | `public/library-location.js` | Parse/serialize filters, preserve unrelated query parameters and fragments, count active filters |
| Catalog behavior | `library-model.js`, `library-renderers.js`, `domain/` | Filter/sort/contextual counts, markup, reading identities and persisted preferences |
| Series page | `series.js`, `series-renderers.js` | Context, series composition and markup; shared volume actions remain in `public/volume-actions.js` |
| Public access | `book-access.js` | Ticket/cache/retry policy, native verification transport, identity migration and downloads |
| Garden Pass | `public/garden-pass.js`, `garden-pass.css` | Dialog, status/focus/widget lifetime and midnight/rose presentation |
| Verification script | `public/turnstile.js` | One cached explicit-widget loader for Keeper and Garden Pass; failed script elements/listeners are removed so retry can start cleanly |
| Public themes | `site-theme.css` | Midnight main and rose adult palette/context rules, previously mixed into navigation |
| Navigation | `nav.js`, `nav.css` | Navigation interaction and layout; no site palette ownership |
| Keeper root/client | `admin/core.js`, `admin/app.js` | Shared client, state, workflow composition, UI helpers and semantic events |
| Keeper session | `admin/auth-session.js`, `admin-security.css` | Authentication/cooldown policy and static verification panel presentation |
| EPUB inspection | `admin/epub-inspection.js` | Local ZIP/XML/spine/navigation/cover/DRM inspection; returns data-only metadata/reports, no queue DOM or uploads |
| Upload engine | `admin-batch.js` | Queue/editor changes, duplicate choices and serial upload transaction |
| Upload workflow | `admin-upload-workflow.js` | Queue review, upload progress/completion/retry and uploaded-series view |
| Upload presentation | `admin-batch-editor.js`, `admin-upload-presentation.js`, `admin/upload-*.js` | Focused queue/editor/validation/similarity presentation and safety policy consumers |
| Keeper data workflows | `admin/*-workflow.js` | Library, history, Trash, maintenance, recovery, translation and abuse behavior through the shared revision-aware client |

## Catalog and session contracts

`data-source.js` loads the configured live catalogs. A failed/invalid source
configuration reports an outage; bundled catalogs require explicit local mode.
`domain/catalog.js` resolves a series against current catalog membership. The
`adult-` ID prefix remains a compatibility hint. Explicit `nsfw: false` is respected,
and shared URL builders add `scope=main|adult` only when current membership differs
from that prefix. Legacy links resolve across both catalogs without changing IDs.
The resolved scope owns themes, pinned navigation, Garden Pass, reader
acknowledgement and return/next/restart links. Age-gate Enter stays disabled until
its handler is installed; the Series controller exclusively owns loading status.

`AdminClient` owns API timeouts, caller cancellation and session generations.
Locking aborts owned requests, clears editor/revision/mapping state and prevents
late responses from updating the interface. `auth-session.js` owns challenge/widget
lifetime and rejects obsolete callbacks. Invalid successful API response bodies
are errors. Every cover upload attempt gets a fresh immutable coordinate; logical
cover/book mappings are committed only after upload success. Server reservations
and snapshot/object immutability still enforce storage safety.

Catalog History loads ten inspected summaries per request through the shared
snapshot-history service. Its cursor/retained total are separate from the loaded
rows; retry preserves them, while refresh/session lock cancels obsolete pages.
Recovery readiness owns an overall read deadline and keeps incomplete checks
unverified. [Maintenance budgets](MAINTENANCE_BUDGETS.md) records the server owners,
API details, measurements and limits; purge/reference protection remains separate.

## Direct copy and presentation

Templates and renderers author their final copy. There is no global text walker,
body-wide text observer, alert wrapper or confirm wrapper. Destructive warnings
remain explicit in the workflow that owns the action. Static stylesheets own
verification presentation; widgets do not inject style text.

`site.css` supplies shared layout and non-context constants. `site-theme.css`
supplies the public context palette at the same cascade position as the prior
rules. Component styles and adult-specific artwork remain separate. A broad CSS
redesign would need independent visual requirements and is not part of this
behavior-preserving refactor.

## Upload event contract

- `upload:queue-rendered`: the engine rendered queue state, or the workflow
  removed a queue row. Consumers can refresh editor selection, similarity,
  safety guidance, reports and workflow views without observing DOM mutations.
- `upload:state`: `detail = {label, kind}`; `keeper.state.uploadStatus` owns the
  current status. The core helper publishes only actual state transitions.
- `upload:view-rendered`: workflow review/completion/chooser markup is ready.
  Presentation/report consumers may decorate that view.
- `upload:review-rendered`: the review owner has updated its summary; the preflight
  report can decorate the final summary rather than watch its text/children.
- `upload:completed`: the lifecycle bridge invalidates the Library from a
  terminal upload state, retaining the existing completion consumer contract.

Notifications retain microtask scheduling at the consumer boundary. Upload ends
only after the transaction stops and its final queue render completes, then the
engine publishes the terminal status. The old 160 ms polling completion shim is
removed. File selection and Upload buttons keep their original DOM identities;
there are no obsolete listeners to suppress by cloning or stopping selection
propagation.

Visual motion observers and the Library's incremental-loading IntersectionObserver
remain: they observe visual state/viewport entry, rather than infer upload model
changes from arbitrary DOM edits. The compatibility exports on the Keeper root
are still consumed by its classic scripts; they are explicit current interfaces,
not silently replaced copies of the API client.

## Validation

Node tests cover URL round trips, explicit choice/preference precedence, repeated
tags, unrelated age-gate return URLs/fragments and active filters. Browser tests
exercise real page controllers, direct empty copy, native dialog identity,
midnight/rose palettes, unchanged picker/button nodes, valid and invalid EPUB
inspection, queue removal, failed upload retry and completion/clearing. Network
substitution is limited to disposable upload/catalog responses; normal Keeper
session verification still uses the isolated real Pages/D1 fixture.

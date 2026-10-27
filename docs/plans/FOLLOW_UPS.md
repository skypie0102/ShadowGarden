# Follow-ups and acceptance limits

The [UI/UX roadmap](UI_UX_ROADMAP.md) is the current implementation queue. The
following items are separate decisions or evidence limits, not unfinished steps
of the completed Reader/Website refactors or October audit.

| Item | Current status | What would justify the next step |
| --- | --- | --- |
| Android/Soul and iOS background Read Aloud | Automated native-media/hidden-page coverage passes; physical screen-lock acceptance for v2.27.0 is separate | Check real devices with an authorized book; record browser/OS and power settings. A website cannot override OS suspension. See the [speech guide](../guides/READER_TTS.md). |
| Phase 3 physical-device acceptance | Reader controls v2.29.0 are released with generated-book browser coverage; physical-device acceptance remains separate | Check real Android/iOS devices in both flows: settings Reset/reload, chapter/search/bookmarks and illustration focus/return. See the [controls guide](../guides/READER_CONTROLS.md) and [release evidence](../archive/releases/READER_CONTROLS_2.29.0.md). |
| Continuous width-change restoration | A generated-book mobile Chromium comparison also reproduces section drift with the released v2.28.7 Reader assets (`c07e341c50c39149c4c0a26a5c6a8345e3b677c3`); Phase 3 does not claim resize-position acceptance | After the page map finishes, navigate to Chapter 4 through contents/search, reopen contents and change 393px → 320px. Compare visible prose and saved CFI, then investigate restoration without allowing stale corrections to override newer input. |
| Optional offline speech provider | Deferred product work; Edge is the implemented provider | Decide the model, download/storage budget and supported devices before implementation. |
| Upload process/native memory and throughput | v2.18.8 bounds application buffers and per-isolate admission; total native/RSS peaks and equal-throughput production gains were not established | Reproduce a remaining memory or throughput problem, then profile a design retaining immutable keys, validation, hashes, retries and catalog adoption. [Completed buffer work](../archive/completed/UPLOAD_BUFFER_BUDGET.md). |
| Browser storage durability | Grouped writes roll back checked failures but are not crash-atomic or isolated across tabs | Reproduce a user-visible failure before changing storage or concurrency contracts. [Persistence scope](../archive/completed/BROWSER_PERSISTENCE.md). |
| Mandatory revision headers for legacy clients | Existing optional-header compatibility is intentional | Make a migration/deprecation decision before tightening the [API contract](../guides/API_CONTRACTS.md). |
| Historical M5a scroll witness and media readiness fallback | The original witness remains causally unattributed; later sizing/boundary faults have controlled fixes, and M1–M5 are complete | Obtain a fresh reproducible fault or equivalent readiness coverage before replacing compatibility behavior. [Completed maintenance](../archive/plans/READER_MAINTENANCE.md), [scroll audit](../archive/audits/READER_SCROLL_AUDIT.md). |

Older “remaining work” paragraphs must be read with subsequent records. The
unknown-length/concurrent upload-buffer follow-up in v2.16.1 was implemented in
v2.18.8; Keeper readability, queue ownership, target context and editor races were
addressed in later October increments. Do not reopen them from an earlier report.
The old separate test-project provisioning notes are [recovery history](../archive/recovery/TEST_DEPLOYMENT.md);
current CI uses disposable local Pages/D1 fixtures and production uses the guarded
main workflow. No additional cloud resources are needed for the active UI work.

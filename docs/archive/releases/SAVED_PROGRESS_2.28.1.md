# Saved reading context — v2.28.1

[PR #81](https://github.com/skypie0102/ShadowGarden/pull/81) merged as
`1b86a4e7af1584304bf40d984fcb55957b55e335` on 2026-10-27. Its merged tree matches
the reviewed source. Library banner, Recently Added, Series hero and volume
metadata share recorded percentage/page/chapter context without inventing a
percentage. Legacy timestamp-free saves retain Continue reading, useful context
wraps, chapter markup stays plain text and cross-tab updates refresh the views.
Viewing these pages preserves saved state and bookmarks.

The [reviewed PR run](https://github.com/skypie0102/ShadowGarden/actions/runs/40420301901)
passes 534 Node tests and 1,081 browser cases across all five profiles, with nine
existing skips, zero failures and zero retries. All 20 added browser cases pass.
Both regression controls reproduce their faults on the previous main source.

The [main release run](https://github.com/skypie0102/ShadowGarden/actions/runs/40442393441)
passes all 15 shards and its aggregate gate. The first upload became canonical,
but its immediate served-byte check rejected `library-features.css`. Later
independent public GETs match all six changed assets exactly; the underlying
cause of the transient mismatch was not established. The publication job was
retried while retaining the completed browser results.

Attempt 2 publishes deployment `5890616d-1fa6-4370-aa9d-6c1d1b94ba70` from the
exact merged source and passes its fresh pre/post-publication comparison:
catalog revision 18, all 17 snapshots and configuration are preserved, with zero
database writes. Its [sanitized report](../evidence/saved-progress-release-2.28.1.json)
checks the version, both catalogs and the stable footer module. Because the
first upload already made this source canonical, retry-time asset selection
uses that fallback. The separate [public asset report](../evidence/saved-progress-assets-2.28.1.json)
therefore verifies all six original changed assets byte-for-byte against the
merge source, as well as the exact public version/source/main identity.

Synopsis/list presentation and download hierarchy are the next source increment;
their implementation and release acceptance remain separate from this record.

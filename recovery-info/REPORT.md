# ShadowGarden Static Recovery Report

Recovered from the live Cloudflare Pages deployment using publicly served assets.

- Reconstructed files: **148**
- Unique successful deployment paths: **148**
- Version: **2.11.0**
- Original branch: **main**
- Original commit: `12e27d7468f1a259419d2ed76aec95a289e7af9f`
- Built at: **2026-09-11T14:36:09+08:00**

## Important limitations

- This is the deployed static output, not the original pre-build source tree.
- Cloudflare Pages Function implementation source is not exposed through normal public crawling. The routing manifest identifies those functions, but their server-side code still needs recovery/reconstruction.
- Protected EPUBs are behind `/book-access` and human verification, so this crawl recovered public metadata/covers but not protected book files.
- Cloudflare bindings/secrets are not recoverable from public assets.

## Literal same-origin references not recovered

- `/assets/js/admin/blob`
- `/assets/js/admin/q.objectUrl`
- `/assets/js/admin/series`
- `/assets/js/admin/url`
- `/assets/js/adult`
- `/assets/js/blob`
- `/assets/js/bytes`
- `/assets/js/domain/bytes`
- `/assets/js/domain/path`
- `/assets/js/domain/raw`
- `/assets/js/domain/seriesId`
- `/assets/js/historyMode`
- `/assets/js/href`
- `/assets/js/item.coverBlob`
- `/assets/js/loaded.url`
- `/assets/js/location.href`
- `/assets/js/q.objectUrl`
- `/assets/js/reader/location.href`
- `/assets/js/reader/ret`
- `/assets/js/reader/seriesId`
- `/assets/js/reader/session`
- `/assets/js/reader/session.adult`
- `/assets/js/reader/session.seriesId`
- `/assets/js/record`
- `/assets/js/record.blob`
- `/assets/js/requestedAdult`
- `/assets/js/series`
- `/assets/js/series.id`
- `/assets/js/session`
- `/assets/js/session.seriesId`
- `/assets/js/url`
- `/assets/js/value`
- `/assets/vendor/e`
- `/assets/vendor/i`
- `/assets/vendor/t`
- `/assets/vendor/this.cover`

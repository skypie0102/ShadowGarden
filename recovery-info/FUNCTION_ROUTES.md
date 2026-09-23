# Cloudflare Pages Functions routes observed in deployment

The deployment routing manifest reported these function routes:

- POST `/admin-api/backup` -> `functions/admin-api/backup.js:onRequestPost`
- POST `/admin-api/catalog` -> `functions/admin-api/catalog.js:onRequestPost`
- GET/POST `/admin-api/library` -> `functions/admin-api/library.js`
- GET/POST `/admin-api/maintenance` -> `functions/admin-api/maintenance.js`
- GET/POST `/admin-api/recovery` -> `functions/admin-api/recovery.js`
- GET `/admin-api/recovery-readiness` -> `functions/admin-api/recovery-readiness.js:onRequestGet`
- GET/POST `/admin-api/series-banner` -> `functions/admin-api/series-banner.js`
- POST `/admin-api/status` -> `functions/admin-api/status.js:onRequestPost`
- POST `/admin-api/translations` -> `functions/admin-api/translations.js:onRequestPost`
- POST `/admin-api/upload` -> `functions/admin-api/upload.js:onRequestPost`
- ANY `/admin-api/abuse` -> `functions/admin-api/abuse.js:onRequest`
- ANY `/media/:path*` -> `functions/media/[[path]].js:onRequest`
- ANY `/admin-access` -> `functions/admin-access.js:onRequest`
- ANY `/book-access` -> `functions/book-access.js:onRequest`
- ANY `/human-access` -> `functions/human-access.js:onRequest`

These files are **not** included as guessed implementations. They need to be recovered from another source or reconstructed from frontend behavior and Cloudflare resource configuration.

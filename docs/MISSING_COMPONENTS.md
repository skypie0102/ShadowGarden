# Recovery boundary

| Component | Status | What completes recovery |
| --- | --- | --- |
| Public HTML/CSS/JS/vendor bundles | Recovered | Original pre-build sources remain unknown |
| Catalog snapshots and covers | Recovered | Confirm against current B2 account inventory |
| Function route inventory | Recovered transcription | Raw Cloudflare routing manifest if available |
| Pages Functions implementation | Inferred replacement | Original deployment worker/source bundle, if retrievable |
| Build/package/Wrangler setup | Inferred replacement | Original build settings and manifests |
| D1 metadata schema | New design | Provision a separate database, migrate and seed explicitly |
| Original EPUB files | Missing (5 referenced) | Authorized B2 download or owner-supplied originals |
| Private book-to-object map | Missing | Private catalog export or B2 inventory matched to known IDs |
| Production secrets/bindings | Missing | Configure through the owner's Cloudflare/B2 accounts |
| Original backups/trash | Missing | Export from original storage before changing retention |
| Original security telemetry/policy | Missing | Original code/configuration; basic replacement is documented |
| Permanent B2 purge | Unavailable | Verify object reachability and original retention semantics first |
| Undocumented recovery POST | Unavailable | Recover its request/response contract and mutation semantics |
| Git history before recovery | Missing | An original Git clone/bundle or accessible GitHub repository |
| Target repository | Published and verified | skypie0102/ShadowGarden main; reconstruction commit 20dd2ec, CI passed |

No credential values, private object paths, file contents or historical commits
were invented. Original public IDs and metadata were preserved.

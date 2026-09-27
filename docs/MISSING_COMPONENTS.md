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
| Replacement snapshot integrity and damaged-catalog recovery | Implemented; 7 new regression cases pass locally | Expanded desktop/mobile recovery verification pending CI |
| Original security telemetry/policy | Missing | Original code/configuration; basic replacement is documented |
| Browser/Pages/D1 workflow verification | Ten cases verified in CI; fourteen-case expansion pending | Live provider tests and actual EPUB rendering still require original private resources |
| Recovered-screen visual review | Reviewed (10 fixture captures) | Run 36316245127; real books and production fonts remain outside this scope |
| Original-book reader verification | Outstanding | Restore the five EPUBs and mappings, then check reading and navigation with live services |
| Permanent B2 purge | Unavailable | Verify object reachability and original retention semantics first |
| Undocumented recovery POST | Unavailable | Recover its request/response contract and mutation semantics |
| Git history before recovery | Missing | An original Git clone/bundle or accessible GitHub repository |
| Target repository | Published and verified | skypie0102/ShadowGarden main; browser/visual checkpoint a0b4632, CI passed |

No credential values, private object paths, file contents or historical commits
were invented. Original public IDs and metadata were preserved.

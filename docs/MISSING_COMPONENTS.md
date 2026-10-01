# Recovery boundary

| Component | Status | What completes recovery |
| --- | --- | --- |
| Public HTML/CSS/JS/vendor bundles | Recovered | Original pre-build sources remain unknown |
| Catalog snapshots and covers | Recovered | Confirm against current B2 account inventory |
| Function route inventory | Recovered transcription | Raw Cloudflare routing manifest if available |
| Pages Functions implementation | Inferred replacement | Original deployment worker/source bundle, if retrievable |
| Build/package/Wrangler setup | Inferred replacement | Original build settings and manifests |
| D1 metadata schema | New design | Provision a separate database, migrate and seed explicitly |
| Original EPUB files | Out of scope: owner confirmed five disposable test books | Use new test media or the empty seed |
| Original private book-to-object map | Not needed for disposable test data | New uploads create their own mappings; optional legacy import is documented |
| Production secrets/bindings | Eight encrypted names supplied; aliases and split B2 keys supported | Values remain private; verify capabilities, bucket identifiers, independent session secret and D1 binding before deployment |
| Original backups/trash | Missing | Export from original storage before changing retention |
| Replacement snapshot integrity and damaged-catalog recovery | Verified within the 47 backend/client and 14 browser cases | New reconstruction behavior; original storage schema/history still missing |
| Original security telemetry/policy | Missing | Original code/configuration; basic replacement is documented |
| Browser/Pages/D1 workflow verification | Verified in CI (14 cases), run 36375221866 | Live provider checks require configured deployment resources and any authorized test EPUB |
| Recovered-screen visual review | Reviewed (established screens plus new purge/recovery controls) | Latest run 36375221866; live-provider reading and production fonts remain deployment checks |
| Reader/provider integration | Deployment check | Test an authorized EPUB with configured B2/Turnstile; original books are not required |
| Permanent B2 purge | Implemented replacement | Durable jobs, all-snapshot reachability, exact-version deletion and retry controls |
| Recovery POST | Implemented replacement | Explicit snapshot selection, checksum/revision guards and exact safety backup |
| Git history before recovery | Missing | An original Git clone/bundle or accessible GitHub repository |
| Target repository | Published and verified | skypie0102/ShadowGarden main; completion checkpoint be25028, CI passed |

No credential values, private object paths, file contents or historical commits
were invented. Original public IDs and metadata were preserved.

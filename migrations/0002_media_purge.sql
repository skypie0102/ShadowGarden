-- Explicit, resumable purge policy for the reconstructed application.
CREATE TABLE purge_jobs (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  removed_count INTEGER NOT NULL, lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE purge_items (
  job_id TEXT NOT NULL REFERENCES purge_jobs(id), object_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','retained','failed','deleted','static')),
  detail TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL,
  PRIMARY KEY(job_id,object_key)
);
CREATE TABLE media_retirements (
  object_key TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES purge_jobs(id),
  created_at TEXT NOT NULL, deleted_at TEXT
);
ALTER TABLE media_uploads ADD COLUMN reservation_id TEXT;
CREATE TABLE media_upload_activity (object_key TEXT PRIMARY KEY, token TEXT NOT NULL, expires_at INTEGER NOT NULL);

-- The reachability test and reservation run in one SQLite statement. References
-- in every retained snapshot count, including damaged snapshots and old maps.
CREATE TRIGGER retirement_preserves_references BEFORE INSERT ON media_retirements
WHEN EXISTS(SELECT 1 FROM library_state, json_tree(library_state.document) AS ref WHERE ref.type='text' AND ref.value IN (NEW.object_key,'/media/'||NEW.object_key))
  OR EXISTS(SELECT 1 FROM snapshots, json_tree(snapshots.document) AS ref WHERE ref.type='text' AND ref.value IN (NEW.object_key,'/media/'||NEW.object_key))
BEGIN SELECT RAISE(ABORT,'media_referenced'); END;
CREATE TRIGGER retirement_preserves_uploads BEFORE INSERT ON media_retirements
WHEN EXISTS(SELECT 1 FROM media_upload_activity WHERE object_key=NEW.object_key AND expires_at>unixepoch())
BEGIN SELECT RAISE(ABORT,'upload_in_progress'); END;

-- Retired coordinates cannot be adopted between reachability inspection and
-- provider deletion, or reintroduced by a later restore or private-map import.
CREATE TRIGGER catalog_insert_preserves_retired_media BEFORE INSERT ON library_state
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.document) AS ref JOIN media_retirements AS retired ON ref.value=retired.object_key OR ref.value='/media/'||retired.object_key WHERE ref.type='text')
BEGIN SELECT RAISE(ABORT,'media_retired'); END;
CREATE TRIGGER catalog_preserves_retired_media BEFORE UPDATE OF document ON library_state
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.document) AS ref JOIN media_retirements AS retired ON ref.value=retired.object_key OR ref.value='/media/'||retired.object_key WHERE ref.type='text')
BEGIN SELECT RAISE(ABORT,'media_retired'); END;
CREATE TRIGGER snapshot_preserves_retired_media BEFORE INSERT ON snapshots
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.document) AS ref JOIN media_retirements AS retired ON ref.value=retired.object_key OR ref.value='/media/'||retired.object_key WHERE ref.type='text')
BEGIN SELECT RAISE(ABORT,'media_retired'); END;
CREATE TRIGGER snapshot_update_preserves_retired_media BEFORE UPDATE OF document ON snapshots
WHEN EXISTS(SELECT 1 FROM json_tree(NEW.document) AS ref JOIN media_retirements AS retired ON ref.value=retired.object_key OR ref.value='/media/'||retired.object_key WHERE ref.type='text')
BEGIN SELECT RAISE(ABORT,'media_retired'); END;
CREATE TRIGGER upload_preserves_retired_media BEFORE INSERT ON media_uploads
WHEN EXISTS(SELECT 1 FROM media_retirements WHERE object_key=NEW.object_key)
BEGIN SELECT RAISE(ABORT,'media_retired'); END;

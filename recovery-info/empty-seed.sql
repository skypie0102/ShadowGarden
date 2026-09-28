-- Start a new library without the recovered demonstration catalog.
-- Safe to rerun: never replaces an existing library.
INSERT OR IGNORE INTO library_state(id,revision,document,updated_at)
VALUES(1,0,'{"main":[],"adult":[],"books":{},"trash":[]}',strftime('%Y-%m-%dT%H:%M:%fZ','now'));

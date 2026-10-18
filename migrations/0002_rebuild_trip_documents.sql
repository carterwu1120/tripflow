-- The production trip_documents table was created without updated_by_email
-- (an earlier draft of 0001 was applied before the column was added), while
-- fresh databases get it from 0001. SQLite has no ADD COLUMN IF NOT EXISTS,
-- so rebuild the table: the copy selects only columns every version has, so
-- this runs on both shapes and keeps existing rows.
CREATE TABLE trip_documents_rebuilt (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by_email TEXT NOT NULL DEFAULT ''
);

INSERT INTO trip_documents_rebuilt (id, data, version, updated_at)
SELECT id, data, version, updated_at FROM trip_documents;

DROP TABLE trip_documents;

ALTER TABLE trip_documents_rebuilt RENAME TO trip_documents;

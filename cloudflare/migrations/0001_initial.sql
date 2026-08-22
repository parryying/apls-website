CREATE TABLE IF NOT EXISTS drafts (
  editor_email TEXT PRIMARY KEY,
  base_sha TEXT NOT NULL,
  payload TEXT NOT NULL,
  changed_sections TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  editor_email TEXT NOT NULL,
  branch TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  head_sha TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS submissions_editor_updated
  ON submissions(editor_email, updated_at DESC);
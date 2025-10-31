CREATE TABLE IF NOT EXISTS watchlist_tmdb (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_id bigint NOT NULL,
  added_at timestamptz DEFAULT now(),
  UNIQUE (user_id, tmdb_id)
);

ALTER TABLE watchlist_tmdb ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own" ON watchlist_tmdb
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert own" ON watchlist_tmdb
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own" ON watchlist_tmdb
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ix_watchlist_tmdb_user ON watchlist_tmdb(user_id);
CREATE INDEX IF NOT EXISTS ix_watchlist_tmdb_tmdb ON watchlist_tmdb(tmdb_id);



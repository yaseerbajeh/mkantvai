/*
  # Create Watchlist Table

  1. New Tables
    - `watchlist`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid) - Reference to auth.users
      - `content_id` (uuid) - Reference to content table
      - `added_at` (timestamptz) - Timestamp when added
      - Unique constraint on (user_id, content_id) to prevent duplicates

  2. Security
    - Enable RLS on `watchlist` table
    - Users can only view their own watchlist
    - Users can only add/remove from their own watchlist

  3. Indexes
    - Create index on user_id for faster queries
*/

CREATE TABLE IF NOT EXISTS watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  UNIQUE(user_id, content_id)
);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;

-- Users can only view their own watchlist
CREATE POLICY "Users can view their own watchlist"
  ON watchlist
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can add to their own watchlist
CREATE POLICY "Users can add to their own watchlist"
  ON watchlist
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own watchlist
CREATE POLICY "Users can remove from their own watchlist"
  ON watchlist
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_content_id ON watchlist(content_id);


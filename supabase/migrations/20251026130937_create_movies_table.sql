/*
  # Create Movies Table

  1. New Tables
    - `movies`
      - `id` (uuid, primary key) - Unique identifier for each movie
      - `title` (text) - Movie/series title
      - `description` (text) - Plot description
      - `year` (integer) - Release year
      - `type` (text) - Either 'movie' or 'series'
      - `genre` (text[]) - Array of genres (Action, Comedy, Drama, Sci-Fi, Thriller, etc.)
      - `platform` (text[]) - Array of streaming platforms (Netflix, Amazon Prime, Disney+, etc.)
      - `rating` (decimal) - IMDb rating (0-10)
      - `poster_url` (text) - URL to movie poster image
      - `created_at` (timestamptz) - Timestamp of record creation

  2. Security
    - Enable RLS on `movies` table
    - Add policy for public read access (anyone can view movies)
    - No write policies needed initially (admin-only via service role)

  3. Indexes
    - Create indexes on frequently filtered columns (year, type, rating) for better query performance
*/

CREATE TABLE IF NOT EXISTS movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  year integer NOT NULL,
  type text NOT NULL CHECK (type IN ('movie', 'series')),
  genre text[] NOT NULL DEFAULT '{}',
  platform text[] NOT NULL DEFAULT '{}',
  rating decimal(3,1) CHECK (rating >= 0 AND rating <= 10),
  poster_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE movies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view movies"
  ON movies
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type);
CREATE INDEX IF NOT EXISTS idx_movies_rating ON movies(rating);
CREATE INDEX IF NOT EXISTS idx_movies_genre ON movies USING GIN(genre);
CREATE INDEX IF NOT EXISTS idx_movies_platform ON movies USING GIN(platform);
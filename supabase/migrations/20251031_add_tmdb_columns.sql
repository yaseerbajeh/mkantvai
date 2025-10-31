/*
  # Add TMDB columns to content table

  1. New Columns
    - `tmdb_id` (integer, nullable, unique) - TMDB movie/TV ID
    - `backdrop_url` (text, nullable) - TMDB backdrop image URL

  2. Indexes
    - Create unique index on tmdb_id for fast lookups
*/

-- Add tmdb_id column (nullable, unique)
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS tmdb_id INTEGER;

-- Add backdrop_url column (nullable)
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS backdrop_url TEXT;

-- Create unique index on tmdb_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_tmdb_id ON content(tmdb_id) WHERE tmdb_id IS NOT NULL;

-- Create index for faster queries when filtering by tmdb_id
CREATE INDEX IF NOT EXISTS idx_content_tmdb_id_lookup ON content(tmdb_id) WHERE tmdb_id IS NOT NULL;


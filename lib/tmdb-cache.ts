// Simple in-memory cache for TMDB details (24h TTL)

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const cache = new Map<string, CacheEntry>();

export function getCachedTmdbDetails(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // Expired, remove from cache
    cache.delete(key);
    return null;
  }

  return entry.data;
}

export function setCachedTmdbDetails(key: string, data: any): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function generateCacheKey(tmdbId: number, type: string, language: string = 'ar'): string {
  return `tmdb:${type}:${tmdbId}:${language}`;
}

// Note: Expired entries are automatically cleaned up when accessed via getCachedTmdbDetails
// This is more efficient for serverless environments than periodic cleanup


/**
 * Query cache using sessionStorage for temporary client-side caching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class QueryCache {
  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds
   */
  static set<T>(key: string, data: T, ttl: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    try {
      sessionStorage.setItem(`query-cache:${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns The cached data or null if not found or expired
   */
  static get<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(`query-cache:${key}`);
      if (!item) return null;

      const entry: CacheEntry<T> = JSON.parse(item);
      const age = Date.now() - entry.timestamp;

      // Check if expired
      if (age > entry.ttl) {
        this.clear(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error);
      return null;
    }
  }

  /**
   * Get the age of a cached entry in milliseconds
   * @param key - Cache key
   * @returns The age in milliseconds or null if not found
   */
  static getAge(key: string): number | null {
    try {
      const item = sessionStorage.getItem(`query-cache:${key}`);
      if (!item) return null;

      const entry: CacheEntry<unknown> = JSON.parse(item);
      return Date.now() - entry.timestamp;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear a specific cache entry
   * @param key - Cache key
   */
  static clear(key: string): void {
    sessionStorage.removeItem(`query-cache:${key}`);
  }

  /**
   * Clear all cache entries
   */
  static clearAll(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach((key) => {
      if (key.startsWith('query-cache:')) {
        sessionStorage.removeItem(key);
      }
    });
  }
}

/**
 * Format cache age in human-readable format
 * @param ageMs - Age in milliseconds
 * @returns Formatted string
 */
export function formatCacheAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
}

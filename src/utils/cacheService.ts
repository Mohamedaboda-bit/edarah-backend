import crypto from 'crypto';

export interface CacheConfig {
  queryResultTTL: number; // 24 hours in milliseconds
  sqlQueryTTL: number;    // 7 days in milliseconds
  embeddingTTL: number;   // 30 days in milliseconds
  maxCacheSize: number;   // Maximum number of cached items per user
}

export interface CachedItem {
  data: any;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  queryResults: { total: number; hits: number };
  sqlQueries: { total: number; hits: number };
  embeddings: { total: number; hits: number };
}

export class CacheService {
  private static config: CacheConfig = {
    queryResultTTL: 24 * 60 * 60 * 1000, // 24 hours
    sqlQueryTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
    embeddingTTL: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxCacheSize: 1000 // per user
  };

  // In-memory cache stores
  private static queryResultCache = new Map<string, CachedItem>();
  private static sqlQueryCache = new Map<string, CachedItem>();
  private static embeddingCache = new Map<string, CachedItem>();

  /**
   * Generate hash for question (normalized)
   */
  static generateQuestionHash(question: string): string {
    const normalized = question.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Generate hash for schema
   */
  static generateSchemaHash(schema: any): string {
    const schemaString = JSON.stringify(schema, Object.keys(schema).sort());
    return crypto.createHash('sha256').update(schemaString).digest('hex');
  }

  /**
   * Generate hash for content (for embeddings)
   */
  static generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate cache key for query results
   */
  private static getQueryResultKey(userId: string, databaseId: string, question: string, schemaVersion: string): string {
    const questionHash = this.generateQuestionHash(question);
    return `qr:${userId}:${databaseId}:${questionHash}:${schemaVersion}`;
  }

  /**
   * Generate cache key for SQL queries
   */
  private static getSqlQueryKey(userId: string, databaseId: string, question: string, schema: any): string {
    const questionHash = this.generateQuestionHash(question);
    const schemaHash = this.generateSchemaHash(schema);
    return `sql:${userId}:${databaseId}:${questionHash}:${schemaHash}`;
  }

  /**
   * Generate cache key for embeddings
   */
  private static getEmbeddingKey(content: string): string {
    const contentHash = this.generateContentHash(content);
    return `emb:${contentHash}`;
  }

  /**
   * Check if query result is cached
   */
  static getCachedQueryResult(
    userId: string,
    databaseId: string,
    question: string,
    schemaVersion: string
  ): any | null {
    try {
      const key = this.getQueryResultKey(userId, databaseId, question, schemaVersion);
      const cached = this.queryResultCache.get(key);

      if (cached && Date.now() < cached.expiresAt) {
        // Update hit count and last accessed
        cached.hitCount++;
        cached.lastAccessed = Date.now();
        this.queryResultCache.set(key, cached);

        console.log(`Cache HIT for query result: ${key}`);
        return cached.data;
      }

      if (cached && Date.now() >= cached.expiresAt) {
        // Remove expired item
        this.queryResultCache.delete(key);
      }

      console.log(`Cache MISS for query result: ${key}`);
      return null;
    } catch (error) {
      console.error('Error getting cached query result:', error);
      return null;
    }
  }

  /**
   * Cache query result
   */
  static cacheQueryResult(
    userId: string,
    databaseId: string,
    question: string,
    response: any,
    schemaVersion: string,
    sqlQuery?: string
  ): void {
    try {
      const key = this.getQueryResultKey(userId, databaseId, question, schemaVersion);
      const now = Date.now();
      const expiresAt = now + this.config.queryResultTTL;

      // Check cache size limit
      this.enforceCacheSizeLimit('queryResults', userId);

      const cachedItem: CachedItem = {
        data: { response, sqlQuery },
        createdAt: now,
        expiresAt,
        hitCount: 1,
        lastAccessed: now
      };

      this.queryResultCache.set(key, cachedItem);
      console.log(`Cached query result: ${key}`);
    } catch (error) {
      console.error('Error caching query result:', error);
    }
  }

  /**
   * Check if SQL query is cached
   */
  static getCachedSQLQuery(
    userId: string,
    databaseId: string,
    question: string,
    schema: any
  ): string | null {
    try {
      const key = this.getSqlQueryKey(userId, databaseId, question, schema);
      const cached = this.sqlQueryCache.get(key);

      if (cached && Date.now() < cached.expiresAt) {
        // Update hit count and last accessed
        cached.hitCount++;
        cached.lastAccessed = Date.now();
        this.sqlQueryCache.set(key, cached);

        console.log(`Cache HIT for SQL query: ${key}`);
        return cached.data;
      }

      if (cached && Date.now() >= cached.expiresAt) {
        // Remove expired item
        this.sqlQueryCache.delete(key);
      }

      console.log(`Cache MISS for SQL query: ${key}`);
      return null;
    } catch (error) {
      console.error('Error getting cached SQL query:', error);
      return null;
    }
  }

  /**
   * Cache SQL query
   */
  static cacheSQLQuery(
    userId: string,
    databaseId: string,
    question: string,
    sqlQuery: string,
    schema: any,
    databaseType: string
  ): void {
    try {
      const key = this.getSqlQueryKey(userId, databaseId, question, schema);
      const now = Date.now();
      const expiresAt = now + this.config.sqlQueryTTL;

      // Check cache size limit
      this.enforceCacheSizeLimit('sqlQueries', userId);

      const cachedItem: CachedItem = {
        data: sqlQuery,
        createdAt: now,
        expiresAt,
        hitCount: 1,
        lastAccessed: now
      };

      this.sqlQueryCache.set(key, cachedItem);
      console.log(`Cached SQL query: ${key}`);
    } catch (error) {
      console.error('Error caching SQL query:', error);
    }
  }

  /**
   * Check if embedding is cached
   */
  static getCachedEmbedding(content: string): number[] | null {
    try {
      const key = this.getEmbeddingKey(content);
      const cached = this.embeddingCache.get(key);

      if (cached && Date.now() < cached.expiresAt) {
        // Update hit count and last accessed
        cached.hitCount++;
        cached.lastAccessed = Date.now();
        this.embeddingCache.set(key, cached);

        console.log(`Cache HIT for embedding: ${key}`);
        return cached.data;
      }

      if (cached && Date.now() >= cached.expiresAt) {
        // Remove expired item
        this.embeddingCache.delete(key);
      }

      console.log(`Cache MISS for embedding: ${key}`);
      return null;
    } catch (error) {
      console.error('Error getting cached embedding:', error);
      return null;
    }
  }

  /**
   * Cache embedding
   */
  static cacheEmbedding(content: string, embedding: number[]): void {
    try {
      const key = this.getEmbeddingKey(content);
      const now = Date.now();
      const expiresAt = now + this.config.embeddingTTL;

      const cachedItem: CachedItem = {
        data: embedding,
        createdAt: now,
        expiresAt,
        hitCount: 1,
        lastAccessed: now
      };

      this.embeddingCache.set(key, cachedItem);
      console.log(`Cached embedding: ${key}`);
    } catch (error) {
      console.error('Error caching embedding:', error);
    }
  }

  /**
   * Invalidate cache for a specific database
   */
  static invalidateDatabaseCache(userId: string, databaseId: string): void {
    try {
      let deletedCount = 0;

      // Delete query result cache entries
      for (const [key, _] of this.queryResultCache) {
        if (key.includes(`qr:${userId}:${databaseId}:`)) {
          this.queryResultCache.delete(key);
          deletedCount++;
        }
      }

      // Delete SQL query cache entries
      for (const [key, _] of this.sqlQueryCache) {
        if (key.includes(`sql:${userId}:${databaseId}:`)) {
          this.sqlQueryCache.delete(key);
          deletedCount++;
        }
      }

      console.log(`Invalidated ${deletedCount} cache entries for user ${userId}, database ${databaseId}`);
    } catch (error) {
      console.error('Error invalidating database cache:', error);
    }
  }

  /**
   * Clear all cache for a user
   */
  static clearUserCache(userId: string): void {
    try {
      let deletedCount = 0;

      // Delete query result cache entries
      for (const [key, _] of this.queryResultCache) {
        if (key.includes(`qr:${userId}:`)) {
          this.queryResultCache.delete(key);
          deletedCount++;
        }
      }

      // Delete SQL query cache entries
      for (const [key, _] of this.sqlQueryCache) {
        if (key.includes(`sql:${userId}:`)) {
          this.sqlQueryCache.delete(key);
          deletedCount++;
        }
      }

      console.log(`Cleared ${deletedCount} cache entries for user ${userId}`);
    } catch (error) {
      console.error('Error clearing user cache:', error);
    }
  }

  /**
   * Clear all cache (global)
   */
  static clearAllCache(): void {
    try {
      const queryResultCount = this.queryResultCache.size;
      const sqlQueryCount = this.sqlQueryCache.size;
      const embeddingCount = this.embeddingCache.size;

      this.queryResultCache.clear();
      this.sqlQueryCache.clear();
      this.embeddingCache.clear();

      console.log(`Cleared all cache: ${queryResultCount} query results, ${sqlQueryCount} SQL queries, ${embeddingCount} embeddings`);
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(userId?: string): CacheStats {
    try {
      let queryResults = { total: 0, hits: 0 };
      let sqlQueries = { total: 0, hits: 0 };
      let embeddings = { total: 0, hits: 0 };

      // Calculate stats for query results
      for (const [key, item] of this.queryResultCache) {
        if (!userId || key.includes(`qr:${userId}:`)) {
          queryResults.total++;
          queryResults.hits += item.hitCount;
        }
      }

      // Calculate stats for SQL queries
      for (const [key, item] of this.sqlQueryCache) {
        if (!userId || key.includes(`sql:${userId}:`)) {
          sqlQueries.total++;
          sqlQueries.hits += item.hitCount;
        }
      }

      // Calculate stats for embeddings
      for (const [key, item] of this.embeddingCache) {
        embeddings.total++;
        embeddings.hits += item.hitCount;
      }

      return { queryResults, sqlQueries, embeddings };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        queryResults: { total: 0, hits: 0 },
        sqlQueries: { total: 0, hits: 0 },
        embeddings: { total: 0, hits: 0 }
      };
    }
  }

  /**
   * Enforce cache size limit by removing least recently used items
   */
  private static enforceCacheSizeLimit(cacheType: 'queryResults' | 'sqlQueries', userId: string): void {
    try {
      const cache = cacheType === 'queryResults' ? this.queryResultCache : this.sqlQueryCache;
      const prefix = cacheType === 'queryResults' ? `qr:${userId}:` : `sql:${userId}:`;

      // Get all keys for this user
      const userKeys = Array.from(cache.keys()).filter(key => key.startsWith(prefix));

      if (userKeys.length >= this.config.maxCacheSize) {
        // Sort by last accessed time (oldest first)
        const sortedKeys = userKeys.sort((a, b) => {
          const itemA = cache.get(a);
          const itemB = cache.get(b);
          return (itemA?.lastAccessed || 0) - (itemB?.lastAccessed || 0);
        });

        // Remove oldest items
        const toRemove = userKeys.length - this.config.maxCacheSize + 1;
        for (let i = 0; i < toRemove; i++) {
          cache.delete(sortedKeys[i]);
        }

        console.log(`Removed ${toRemove} old cache entries for user ${userId} (${cacheType})`);
      }
    } catch (error) {
      console.error('Error enforcing cache size limit:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  static cleanupExpiredCache(): void {
    try {
      const now = Date.now();
      let expiredCount = 0;

      // Clean query result cache
      for (const [key, item] of this.queryResultCache) {
        if (now >= item.expiresAt) {
          this.queryResultCache.delete(key);
          expiredCount++;
        }
      }

      // Clean SQL query cache
      for (const [key, item] of this.sqlQueryCache) {
        if (now >= item.expiresAt) {
          this.sqlQueryCache.delete(key);
          expiredCount++;
        }
      }

      // Clean embedding cache
      for (const [key, item] of this.embeddingCache) {
        if (now >= item.expiresAt) {
          this.embeddingCache.delete(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`Cleaned up ${expiredCount} expired cache entries`);
      }
    } catch (error) {
      console.error('Error cleaning up expired cache:', error);
    }
  }

  /**
   * Get cache size information
   */
  static getCacheSize(): { queryResults: number; sqlQueries: number; embeddings: number } {
    return {
      queryResults: this.queryResultCache.size,
      sqlQueries: this.sqlQueryCache.size,
      embeddings: this.embeddingCache.size
    };
  }
} 
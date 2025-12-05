/**
 * Cache Service
 * Provides caching functionality with Redis backend and graceful fallback
 * Implements Cache-Aside pattern for optimal performance
 */

const { getRedisClient, isRedisAvailable, cacheTTL } = require('../config/redis');

class CacheService {
  /**
   * Generate cache key with namespace
   * @param {string} namespace - Cache namespace (e.g., 'dashboard', 'user', 'school')
   * @param {string} key - Specific cache key
   * @returns {string} Formatted cache key
   */
  static generateKey(namespace, key) {
    return `educonnect:${namespace}:${key}`;
  }

  /**
   * Set cache value with TTL
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  static async set(namespace, key, value, ttl = null) {
    if (!isRedisAvailable()) {
      return false; // Graceful degradation
    }

    try {
      const redisClient = getRedisClient();
      const cacheKey = this.generateKey(namespace, key);
      const serializedValue = JSON.stringify(value);
      
      // Use namespace-specific TTL if not provided
      const timeToLive = ttl || cacheTTL[namespace] || cacheTTL.dashboard;
      
      await redisClient.setex(cacheKey, timeToLive, serializedValue);
      return true;
    } catch (error) {
      console.error(`Cache set error for ${namespace}:${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache value
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  static async get(namespace, key) {
    if (!isRedisAvailable()) {
      return null; // Graceful degradation
    }

    try {
      const redisClient = getRedisClient();
      const cacheKey = this.generateKey(namespace, key);
      
      const cachedValue = await redisClient.get(cacheKey);
      
      if (cachedValue) {
        return JSON.parse(cachedValue);
      }
      
      return null;
    } catch (error) {
      console.error(`Cache get error for ${namespace}:${key}:`, error.message);
      return null;
    }
  }

  /**
   * Delete cache value
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  static async del(namespace, key) {
    if (!isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      const cacheKey = this.generateKey(namespace, key);
      
      await redisClient.del(cacheKey);
      return true;
    } catch (error) {
      console.error(`Cache delete error for ${namespace}:${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple cache keys by pattern
   * @param {string} pattern - Redis key pattern (e.g., 'educonnect:dashboard:*')
   * @returns {Promise<number>} Number of keys deleted
   */
  static async delPattern(pattern) {
    if (!isRedisAvailable()) {
      return 0;
    }

    try {
      const redisClient = getRedisClient();
      const keys = await redisClient.keys(pattern);
      
      if (keys.length > 0) {
        await redisClient.del(...keys);
        return keys.length;
      }
      
      return 0;
    } catch (error) {
      console.error(`Cache delete pattern error for ${pattern}:`, error.message);
      return 0;
    }
  }

  /**
   * Check if cache key exists
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Key existence status
   */
  static async exists(namespace, key) {
    if (!isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      const cacheKey = this.generateKey(namespace, key);
      
      const exists = await redisClient.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      console.error(`Cache exists error for ${namespace}:${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get cache TTL (time to live)
   * @param {string} namespace - Cache namespace
   * @param {string} key - Cache key
   * @returns {Promise<number>} TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  static async ttl(namespace, key) {
    if (!isRedisAvailable()) {
      return -2;
    }

    try {
      const redisClient = getRedisClient();
      const cacheKey = this.generateKey(namespace, key);
      
      return await redisClient.ttl(cacheKey);
    } catch (error) {
      console.error(`Cache TTL error for ${namespace}:${key}:`, error.message);
      return -2;
    }
  }

  /**
   * Invalidate cache for a specific school
   * @param {string} schoolId - School identifier
   * @returns {Promise<number>} Number of keys deleted
   */
  static async invalidateSchoolCache(schoolId) {
    const patterns = [
      `educonnect:dashboard:${schoolId}*`,
      `educonnect:school:${schoolId}*`,
      `educonnect:user:*:${schoolId}*`,
      `educonnect:student:${schoolId}*`,
      `educonnect:parent:${schoolId}*`,
      `educonnect:teacher:${schoolId}*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.delPattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} cache keys for school ${schoolId}`);
    return totalDeleted;
  }

  /**
   * Invalidate cache for a specific user
   * @param {string} userId - User identifier
   * @param {string} schoolId - School identifier
   * @returns {Promise<number>} Number of keys deleted
   */
  static async invalidateUserCache(userId, schoolId) {
    const patterns = [
      `educonnect:user:${userId}*`,
      `educonnect:dashboard:${schoolId}*`, // Dashboard might include user data
      `educonnect:session:${userId}*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.delPattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} cache keys for user ${userId}`);
    return totalDeleted;
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  static async getStats() {
    if (!isRedisAvailable()) {
      return { available: false };
    }

    try {
      const redisClient = getRedisClient();
      const info = await redisClient.info('memory');
      const keyspace = await redisClient.info('keyspace');
      
      return {
        available: true,
        memory: info,
        keyspace: keyspace,
        connected: redisClient.status === 'ready'
      };
    } catch (error) {
      console.error('Cache stats error:', error.message);
      return { available: false, error: error.message };
    }
  }

  /**
   * Flush all cache (use with caution!)
   * @returns {Promise<boolean>} Success status
   */
  static async flushAll() {
    if (!isRedisAvailable()) {
      return false;
    }

    try {
      const redisClient = getRedisClient();
      await redisClient.flushdb();
      console.log('Cache flushed successfully');
      return true;
    } catch (error) {
      console.error('Cache flush error:', error.message);
      return false;
    }
  }
}

module.exports = CacheService;
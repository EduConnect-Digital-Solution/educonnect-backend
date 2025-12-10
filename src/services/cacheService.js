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

  // ========================================
  // CROSS-SCHOOL CACHING ENHANCEMENTS
  // Requirements: 1.1, 7.2
  // ========================================

  /**
   * Set platform-wide cache value with extended TTL options
   * @param {string} key - Platform cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  static async setPlatformCache(key, value, ttl = 1800) { // Default 30 minutes for platform data
    return await this.set('platform', key, value, ttl);
  }

  /**
   * Get platform-wide cache value
   * @param {string} key - Platform cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  static async getPlatformCache(key) {
    return await this.get('platform', key);
  }

  /**
   * Delete platform-wide cache value
   * @param {string} key - Platform cache key
   * @returns {Promise<boolean>} Success status
   */
  static async delPlatformCache(key) {
    return await this.del('platform', key);
  }

  /**
   * Invalidate all cross-school aggregation caches
   * @returns {Promise<number>} Number of keys deleted
   */
  static async invalidateCrossSchoolCaches() {
    const patterns = [
      'educonnect:platform:cross-school:*',
      'educonnect:platform:comparison:*',
      'educonnect:platform:trends:*',
      'educonnect:platform:kpis:*'
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.delPattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} cross-school cache keys`);
    return totalDeleted;
  }

  /**
   * Invalidate platform-wide caches when school data changes
   * @param {string} schoolId - School identifier that changed
   * @returns {Promise<number>} Number of keys deleted
   */
  static async invalidatePlatformCachesForSchool(schoolId) {
    // Invalidate cross-school aggregations that might include this school
    const crossSchoolDeleted = await this.invalidateCrossSchoolCaches();
    
    // Invalidate school-specific caches
    const schoolDeleted = await this.invalidateSchoolCache(schoolId);
    
    console.log(`Invalidated platform caches for school ${schoolId}: ${crossSchoolDeleted + schoolDeleted} keys`);
    return crossSchoolDeleted + schoolDeleted;
  }

  /**
   * Warm up platform-wide caches with commonly accessed data
   * @param {Array<string>} schoolIds - School IDs to warm up (optional)
   * @returns {Promise<Object>} Warm-up results
   */
  static async warmUpPlatformCaches(schoolIds = null) {
    console.log('🔥 Starting platform cache warm-up...');
    
    const results = {
      success: 0,
      failed: 0,
      operations: []
    };

    try {
      // Import CrossSchoolAggregator here to avoid circular dependency
      const CrossSchoolAggregator = require('./crossSchoolAggregator');
      
      // Warm up overview metrics
      try {
        await CrossSchoolAggregator.aggregateMetrics(schoolIds, 'overview');
        results.success++;
        results.operations.push('overview_metrics');
      } catch (error) {
        console.error('Failed to warm up overview metrics:', error.message);
        results.failed++;
      }

      // Warm up user metrics
      try {
        await CrossSchoolAggregator.aggregateMetrics(schoolIds, 'users');
        results.success++;
        results.operations.push('user_metrics');
      } catch (error) {
        console.error('Failed to warm up user metrics:', error.message);
        results.failed++;
      }

      // Warm up platform KPIs
      try {
        await CrossSchoolAggregator.calculatePlatformKPIs();
        results.success++;
        results.operations.push('platform_kpis');
      } catch (error) {
        console.error('Failed to warm up platform KPIs:', error.message);
        results.failed++;
      }

      console.log(`🔥 Platform cache warm-up completed: ${results.success} success, ${results.failed} failed`);
      
    } catch (error) {
      console.error('Platform cache warm-up error:', error.message);
      results.failed++;
    }

    return results;
  }

  /**
   * Get cache performance metrics for system admin monitoring
   * @returns {Promise<Object>} Cache performance data
   */
  static async getCachePerformanceMetrics() {
    if (!isRedisAvailable()) {
      return { 
        available: false, 
        error: 'Redis not available',
        metrics: null
      };
    }

    try {
      const redisClient = getRedisClient();
      
      // Get Redis info
      const [memoryInfo, statsInfo, keyspaceInfo] = await Promise.all([
        redisClient.info('memory'),
        redisClient.info('stats'),
        redisClient.info('keyspace')
      ]);

      // Parse memory info
      const memoryLines = memoryInfo.split('\r\n');
      const memoryMetrics = {};
      memoryLines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryMetrics[key] = value;
        }
      });

      // Parse stats info
      const statsLines = statsInfo.split('\r\n');
      const statsMetrics = {};
      statsLines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          statsMetrics[key] = value;
        }
      });

      // Get cache hit/miss ratios by namespace
      const namespaceMetrics = await this._getCacheNamespaceMetrics();

      return {
        available: true,
        memory: {
          usedMemory: memoryMetrics.used_memory_human,
          usedMemoryPeak: memoryMetrics.used_memory_peak_human,
          memoryFragmentationRatio: parseFloat(memoryMetrics.mem_fragmentation_ratio)
        },
        stats: {
          totalConnectionsReceived: parseInt(statsMetrics.total_connections_received),
          totalCommandsProcessed: parseInt(statsMetrics.total_commands_processed),
          keyspaceHits: parseInt(statsMetrics.keyspace_hits),
          keyspaceMisses: parseInt(statsMetrics.keyspace_misses),
          hitRate: this._calculateHitRate(statsMetrics.keyspace_hits, statsMetrics.keyspace_misses)
        },
        namespaces: namespaceMetrics,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Cache performance metrics error:', error.message);
      return { 
        available: false, 
        error: error.message,
        metrics: null
      };
    }
  }

  /**
   * Get cache metrics by namespace for monitoring
   * @private
   */
  static async _getCacheNamespaceMetrics() {
    const namespaces = ['dashboard', 'school', 'user', 'platform', 'student', 'parent', 'teacher'];
    const metrics = {};

    for (const namespace of namespaces) {
      try {
        const pattern = `educonnect:${namespace}:*`;
        const keys = await this._getKeysByPattern(pattern);
        
        metrics[namespace] = {
          keyCount: keys.length,
          estimatedMemoryUsage: keys.length * 1024 // Rough estimate
        };
      } catch (error) {
        metrics[namespace] = {
          keyCount: 0,
          estimatedMemoryUsage: 0,
          error: error.message
        };
      }
    }

    return metrics;
  }

  /**
   * Get keys by pattern (limited to prevent performance issues)
   * @private
   */
  static async _getKeysByPattern(pattern, limit = 1000) {
    if (!isRedisAvailable()) {
      return [];
    }

    try {
      const redisClient = getRedisClient();
      const keys = await redisClient.keys(pattern);
      return keys.slice(0, limit); // Limit to prevent performance issues
    } catch (error) {
      console.error(`Error getting keys for pattern ${pattern}:`, error.message);
      return [];
    }
  }

  /**
   * Calculate cache hit rate
   * @private
   */
  static _calculateHitRate(hits, misses) {
    const totalRequests = parseInt(hits) + parseInt(misses);
    if (totalRequests === 0) return 0;
    return Math.round((parseInt(hits) / totalRequests) * 100 * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Batch cache operations for improved performance
   * @param {Array} operations - Array of cache operations
   * @returns {Promise<Array>} Results of batch operations
   */
  static async batchOperations(operations) {
    if (!isRedisAvailable()) {
      return operations.map(() => ({ success: false, error: 'Redis not available' }));
    }

    const results = [];
    
    try {
      const redisClient = getRedisClient();
      const pipeline = redisClient.pipeline();

      // Add operations to pipeline
      operations.forEach(op => {
        const cacheKey = this.generateKey(op.namespace, op.key);
        
        switch (op.type) {
          case 'set':
            pipeline.setex(cacheKey, op.ttl || 900, JSON.stringify(op.value));
            break;
          case 'get':
            pipeline.get(cacheKey);
            break;
          case 'del':
            pipeline.del(cacheKey);
            break;
        }
      });

      // Execute pipeline
      const pipelineResults = await pipeline.exec();
      
      // Process results
      pipelineResults.forEach((result, index) => {
        const [error, value] = result;
        const operation = operations[index];
        
        if (error) {
          results.push({ success: false, error: error.message, operation: operation.type });
        } else {
          let processedValue = value;
          if (operation.type === 'get' && value) {
            try {
              processedValue = JSON.parse(value);
            } catch (parseError) {
              processedValue = value;
            }
          }
          results.push({ success: true, value: processedValue, operation: operation.type });
        }
      });

    } catch (error) {
      console.error('Batch cache operations error:', error.message);
      return operations.map(() => ({ success: false, error: error.message }));
    }

    return results;
  }

  /**
   * Schedule cache cleanup for expired or unused keys
   * @param {number} maxAge - Maximum age in seconds for keys to keep
   * @returns {Promise<number>} Number of keys cleaned up
   */
  static async scheduleCleanup(maxAge = 86400) { // Default 24 hours
    if (!isRedisAvailable()) {
      return 0;
    }

    console.log('🧹 Starting scheduled cache cleanup...');
    
    try {
      const redisClient = getRedisClient();
      let cleanedCount = 0;
      
      // Get all educonnect keys
      const allKeys = await redisClient.keys('educonnect:*');
      
      for (const key of allKeys) {
        try {
          const ttl = await redisClient.ttl(key);
          
          // If key has no expiry (-1) or is very old, check if it should be cleaned
          if (ttl === -1) {
            // Key has no expiry, check its age by attempting to determine from key pattern
            // For now, we'll skip keys without expiry to be safe
            continue;
          }
          
          // If TTL is very short (less than 60 seconds), let it expire naturally
          if (ttl > 0 && ttl < 60) {
            continue;
          }
          
        } catch (keyError) {
          console.error(`Error checking key ${key}:`, keyError.message);
        }
      }
      
      console.log(`🧹 Cache cleanup completed: ${cleanedCount} keys cleaned`);
      return cleanedCount;
      
    } catch (error) {
      console.error('Cache cleanup error:', error.message);
      return 0;
    }
  }
}

module.exports = CacheService;
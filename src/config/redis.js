/**
 * Redis Configuration
 * Handles Redis connection and client setup for caching
 */

const Redis = require('ioredis');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Connection timeout
  connectTimeout: 10000,
  // Command timeout
  commandTimeout: 5000,
  // Retry configuration
  retryDelayOnClusterDown: 300,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

// Create Redis client
let redisClient = null;
let isRedisEnabled = process.env.REDIS_ENABLED === 'true';

/**
 * Initialize Redis connection
 */
const initializeRedis = async () => {
  if (!isRedisEnabled) {
    console.log('Redis is disabled. Caching will be bypassed.');
    return null;
  }

  try {
    redisClient = new Redis(redisConfig);

    // Handle connection events
    redisClient.on('connect', () => {
      console.log('Redis client connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('Redis client ready to receive commands');
    });

    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error.message);
      // Don't throw error - allow graceful degradation
    });

    redisClient.on('close', () => {
      console.log('Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });

    // Test the connection
    await redisClient.ping();
    console.log('Redis connection established successfully');

    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis:', error.message);
    console.log('Continuing without Redis caching...');
    redisClient = null;
    return null;
  }
};

/**
 * Get Redis client instance
 */
const getRedisClient = () => {
  return redisClient;
};

/**
 * Check if Redis is available
 */
const isRedisAvailable = () => {
  return redisClient && redisClient.status === 'ready';
};

/**
 * Gracefully close Redis connection
 */
const closeRedis = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      console.log('Redis connection closed gracefully');
    } catch (error) {
      console.error('Error closing Redis connection:', error.message);
    }
  }
};

/**
 * Cache TTL configurations (in seconds)
 */
const cacheTTL = {
  dashboard: parseInt(process.env.CACHE_TTL_DASHBOARD) || 900, // 15 minutes
  userSession: parseInt(process.env.CACHE_TTL_USER_SESSION) || 86400, // 24 hours
  schoolProfile: parseInt(process.env.CACHE_TTL_SCHOOL_PROFILE) || 3600, // 1 hour
  otp: parseInt(process.env.CACHE_TTL_OTP) || 600, // 10 minutes
  studentData: 1800, // 30 minutes
  parentData: 1800, // 30 minutes
  teacherData: 1800, // 30 minutes
  invitations: 3600, // 1 hour
};

module.exports = {
  initializeRedis,
  getRedisClient,
  isRedisAvailable,
  closeRedis,
  cacheTTL,
  redisConfig
};
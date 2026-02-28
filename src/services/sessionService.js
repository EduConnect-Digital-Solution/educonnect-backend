/**
 * Session Service
 * Redis-based session tracking for authentication
 * Provides: session creation, validation, revocation, and listing
 * 
 * Design:
 * - Each login creates a unique session stored in Redis
 * - Sessions are keyed by sessionId (UUID) and indexed by userId
 * - Supports multiple concurrent sessions per user (multi-device)
 * - Graceful degradation: if Redis is down, auth still works via JWT
 */

const crypto = require('crypto');
const { getRedisClient, isRedisAvailable } = require('../config/redis');

// Session TTL: 7 days (matches refresh token expiry)
const SESSION_TTL = 7 * 24 * 60 * 60;

/**
 * Generate a unique session ID
 * @returns {string} UUID-like session identifier
 */
const generateSessionId = () => {
    return crypto.randomUUID();
};

/**
 * Create a new session on login
 * @param {Object} params - Session parameters
 * @param {string} params.userId - User or school admin ID
 * @param {string} params.role - User role (admin, teacher, parent, system_admin)
 * @param {string} params.schoolId - School ID (null for system admin)
 * @param {string} params.email - User email
 * @param {string} params.ip - Client IP address
 * @param {string} params.userAgent - Client user agent
 * @param {Object} params.tokens - JWT tokens (accessToken, refreshToken)
 * @returns {Promise<string|null>} Session ID or null if Redis unavailable
 */
const createSession = async ({ userId, role, schoolId, email, ip, userAgent, tokens }) => {
    if (!isRedisAvailable()) {
        return null; // Graceful degradation
    }

    try {
        const redis = getRedisClient();
        const sessionId = generateSessionId();
        const now = new Date().toISOString();

        const sessionData = {
            sessionId,
            userId: String(userId),
            role,
            schoolId: schoolId || null,
            email,
            ip: ip || 'unknown',
            userAgent: userAgent || 'unknown',
            createdAt: now,
            lastActivity: now,
            // Store JWT tokens server-side (never sent to client)
            tokens: tokens || null
        };

        // Store session data keyed by sessionId
        const sessionKey = `session:${sessionId}`;
        await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(sessionData));

        // Add sessionId to user's session set (for listing/revoking all sessions)
        const userSessionsKey = `user_sessions:${userId}`;
        await redis.sadd(userSessionsKey, sessionId);
        await redis.expire(userSessionsKey, SESSION_TTL);

        return sessionId;
    } catch (error) {
        console.error('SessionService: Failed to create session:', error.message);
        return null; // Graceful degradation
    }
};

/**
 * Validate that a session exists and is active
 * @param {string} sessionId - Session ID to validate
 * @returns {Promise<Object|null>} Session data if valid, null otherwise
 */
const validateSession = async (sessionId) => {
    if (!sessionId || !isRedisAvailable()) {
        return null; // No session to validate or Redis down — allow JWT to work
    }

    try {
        const redis = getRedisClient();
        const sessionKey = `session:${sessionId}`;
        const data = await redis.get(sessionKey);

        if (!data) {
            return null; // Session expired or revoked
        }

        return JSON.parse(data);
    } catch (error) {
        console.error('SessionService: Failed to validate session:', error.message);
        return null; // Graceful degradation
    }
};

/**
 * Update session's last activity timestamp
 * @param {string} sessionId - Session ID to touch
 */
const touchSession = async (sessionId) => {
    if (!sessionId || !isRedisAvailable()) return;

    try {
        const redis = getRedisClient();
        const sessionKey = `session:${sessionId}`;
        const data = await redis.get(sessionKey);

        if (data) {
            const sessionData = JSON.parse(data);
            sessionData.lastActivity = new Date().toISOString();
            await redis.setex(sessionKey, SESSION_TTL, JSON.stringify(sessionData));
        }
    } catch (error) {
        console.error('SessionService: Failed to touch session:', error.message);
    }
};

/**
 * Revoke a specific session (force-logout one device)
 * @param {string} sessionId - Session ID to revoke
 * @param {string} userId - User ID (to clean up session set)
 * @returns {Promise<boolean>} True if revoked successfully
 */
const revokeSession = async (sessionId, userId) => {
    if (!isRedisAvailable()) return false;

    try {
        const redis = getRedisClient();

        // Delete the session
        await redis.del(`session:${sessionId}`);

        // Remove from user's session set
        if (userId) {
            await redis.srem(`user_sessions:${userId}`, sessionId);
        }

        return true;
    } catch (error) {
        console.error('SessionService: Failed to revoke session:', error.message);
        return false;
    }
};

/**
 * Revoke all sessions for a user (force-logout all devices)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of sessions revoked
 */
const revokeAllSessions = async (userId) => {
    if (!isRedisAvailable()) return 0;

    try {
        const redis = getRedisClient();
        const userSessionsKey = `user_sessions:${userId}`;

        // Get all session IDs for this user
        const sessionIds = await redis.smembers(userSessionsKey);

        if (sessionIds.length === 0) return 0;

        // Delete all session keys
        const sessionKeys = sessionIds.map(id => `session:${id}`);
        await redis.del(...sessionKeys);

        // Delete the user session set
        await redis.del(userSessionsKey);

        return sessionIds.length;
    } catch (error) {
        console.error('SessionService: Failed to revoke all sessions:', error.message);
        return 0;
    }
};

/**
 * List all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of session objects
 */
const listSessions = async (userId) => {
    if (!isRedisAvailable()) return [];

    try {
        const redis = getRedisClient();
        const userSessionsKey = `user_sessions:${userId}`;

        // Get all session IDs for this user
        const sessionIds = await redis.smembers(userSessionsKey);

        if (sessionIds.length === 0) return [];

        // Fetch all session data
        const sessions = [];
        const expiredIds = [];

        for (const id of sessionIds) {
            const data = await redis.get(`session:${id}`);
            if (data) {
                sessions.push(JSON.parse(data));
            } else {
                expiredIds.push(id); // Session expired but still in set
            }
        }

        // Clean up expired session IDs from the set
        if (expiredIds.length > 0) {
            await redis.srem(userSessionsKey, ...expiredIds);
        }

        return sessions;
    } catch (error) {
        console.error('SessionService: Failed to list sessions:', error.message);
        return [];
    }
};

module.exports = {
    createSession,
    validateSession,
    touchSession,
    revokeSession,
    revokeAllSessions,
    listSessions,
    generateSessionId
};

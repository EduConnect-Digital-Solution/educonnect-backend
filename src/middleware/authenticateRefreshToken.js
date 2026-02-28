/**
 * Authenticate Session Middleware
 * Reads the session ID from the HttpOnly cookie, looks up the session in Redis,
 * and populates req.user with the stored session data.
 *
 * The JWT is stored server-side in Redis — NOT in the cookie.
 * The cookie contains only an opaque session ID (UUID).
 *
 * Used for endpoints like GET /me where the frontend relies on the
 * cookie (since the short-lived access token is held only in memory).
 */

const { getSessionIdFromCookie } = require('../utils/cookieHelper');
const SessionService = require('../services/sessionService');

const authenticateRefreshToken = async (req, res, next) => {
    try {
        const sessionId = getSessionIdFromCookie(req);

        if (!sessionId) {
            return res.status(401).json({
                success: false,
                message: 'No session found. Please log in again.'
            });
        }

        // Look up the session in Redis
        const session = await SessionService.validateSession(sessionId);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Session expired or invalid. Please log in again.'
            });
        }

        // Touch the session (update lastActivity)
        await SessionService.touchSession(sessionId);

        // Populate req.user from session data (same shape as authenticateToken)
        req.user = {
            userId: session.userId,
            id: session.userId,
            email: session.email,
            role: session.role,
            schoolId: session.schoolId
        };

        // Attach session info for downstream use
        req.sessionId = sessionId;
        req.session = session;

        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

module.exports = { authenticateRefreshToken };

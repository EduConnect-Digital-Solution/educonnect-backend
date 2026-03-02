const { validationResult } = require('express-validator');

/**
 * Validation Middleware
 * Extracts the repeated validation error handling pattern into a reusable middleware.
 * Use after express-validator checks in route definitions.
 *
 * Usage:
 *   router.post('/endpoint', [...validationRules], validateRequest, controller.handler);
 */
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

module.exports = validateRequest;

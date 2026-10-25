const { body, query } = require('express-validator');

/**
 * Validation for the per-school NexaPay merchant configuration.
 *
 * The API key and webhook secret are write-only: they are encrypted before
 * they touch the database and are never returned by any endpoint.
 */

const validateUpsertNexaPayConfig = [
  body('businessId').trim().isLength({ min: 1 }).withMessage('NexaPay business ID is required'),
  body('environment').isIn(['test', 'prod']).withMessage('Environment must be test or prod'),
  body('apiKey').trim().isLength({ min: 1 }).withMessage('NexaPay API key is required'),
  body('webhookSecret').trim().isLength({ min: 1 }).withMessage('NexaPay webhook secret is required'),
  // Only a system admin may configure another school. School admins are
  // restricted to their own school by preventCrossSchoolAccess.
  body('schoolId').optional().isUUID().withMessage('Invalid school ID')
];

const validateGetNexaPayConfig = [
  query('schoolId').optional().isUUID().withMessage('Invalid school ID')
];

module.exports = {
  validateUpsertNexaPayConfig,
  validateGetNexaPayConfig
};

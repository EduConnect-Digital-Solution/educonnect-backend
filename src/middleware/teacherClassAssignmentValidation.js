/**
 * Teacher Class Assignment Validation Middleware
 */

const { body, param } = require('express-validator');

/**
 * Validate assign classes to teacher request
 */
const validateAssignClasses = [
  body('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),

  body('classes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Classes must be a non-empty array')
    .custom((classes) => {
      if (!classes.every(cls => typeof cls === 'string' && cls.trim().length > 0)) {
        throw new Error('All classes must be non-empty strings');
      }
      return true;
    }),

  body('arms')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Arms must be a non-empty array')
    .custom((arms) => {
      if (!arms.every(a => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a))) {
        throw new Error('All arm IDs must be valid UUIDs');
      }
      return true;
    }),

  body()
    .custom((body) => {
      if ((!body.classes || body.classes.length === 0) && (!body.arms || body.arms.length === 0)) {
        throw new Error('Either classes or arms must be provided');
      }
      return true;
    }),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('School ID must be in format ABC1234')
];

/**
 * Validate assign subjects to teacher request
 */
const validateAssignSubjects = [
  body('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),
    
  body('subjects')
    .isArray({ min: 1 })
    .withMessage('Subjects must be a non-empty array')
    .custom((subjects) => {
      if (!subjects.every(subj => typeof subj === 'string')) {
        throw new Error('All subjects must be valid strings');
      }
      return true;
    })
    .custom((subjects) => {
      if (!subjects.every(subj => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subj))) {
        throw new Error('All subjects must be valid UUIDs');
      }
      return true;
    }),
    
  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('School ID must be in format ABC1234')
];

/**
 * Validate remove classes from teacher request
 */
const validateRemoveClasses = [
  body('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID'),

  body('classes')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Classes must be a non-empty array')
    .custom((classes) => {
      if (!classes.every(cls => typeof cls === 'string' && cls.trim().length > 0)) {
        throw new Error('All classes must be non-empty strings');
      }
      return true;
    }),

  body('arms')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Arms must be a non-empty array')
    .custom((arms) => {
      if (!arms.every(a => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a))) {
        throw new Error('All arm IDs must be valid UUIDs');
      }
      return true;
    }),

  body()
    .custom((body) => {
      if ((!body.classes || body.classes.length === 0) && (!body.arms || body.arms.length === 0)) {
        throw new Error('Either classes or arms must be provided');
      }
      return true;
    }),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('School ID must be in format ABC1234')
];

/**
 * Validate teacher ID parameter
 */
const validateTeacherId = [
  param('teacherId')
    .notEmpty()
    .withMessage('Teacher ID is required')
    .isUUID()
    .withMessage('Teacher ID must be a valid UUID')
];

module.exports = {
  validateAssignClasses,
  validateAssignSubjects,
  validateRemoveClasses,
  validateTeacherId
};
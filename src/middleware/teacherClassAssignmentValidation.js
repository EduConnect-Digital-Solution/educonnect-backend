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
    .isMongoId()
    .withMessage('Teacher ID must be a valid MongoDB ObjectId'),
    
  body('classes')
    .isArray({ min: 1 })
    .withMessage('Classes must be a non-empty array')
    .custom((classes) => {
      if (!classes.every(cls => typeof cls === 'string' && cls.trim().length > 0)) {
        throw new Error('All classes must be non-empty strings');
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
    .isMongoId()
    .withMessage('Teacher ID must be a valid MongoDB ObjectId'),
    
  body('subjects')
    .isArray({ min: 1 })
    .withMessage('Subjects must be a non-empty array')
    .custom((subjects) => {
      if (!subjects.every(subj => typeof subj === 'string' && subj.trim().length > 0)) {
        throw new Error('All subjects must be non-empty strings');
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
    .isMongoId()
    .withMessage('Teacher ID must be a valid MongoDB ObjectId'),
    
  body('classes')
    .isArray({ min: 1 })
    .withMessage('Classes must be a non-empty array')
    .custom((classes) => {
      if (!classes.every(cls => typeof cls === 'string' && cls.trim().length > 0)) {
        throw new Error('All classes must be non-empty strings');
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
    .isMongoId()
    .withMessage('Teacher ID must be a valid MongoDB ObjectId')
];

module.exports = {
  validateAssignClasses,
  validateAssignSubjects,
  validateRemoveClasses,
  validateTeacherId
};
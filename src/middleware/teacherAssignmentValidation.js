/**
 * Teacher Assignment Validation Middleware
 * Validation rules for teacher-student linking operations
 */

const { body, param, query } = require('express-validator');

/**
 * Validation for teacher assignment
 */
const validateTeacherAssignment = [
  body('teacherId')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),

  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),

  body('studentIds.*')
    .isMongoId()
    .withMessage('Each student ID must be a valid MongoDB ObjectId'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for bulk teacher assignment
 */
const validateBulkTeacherAssignment = [
  body('assignments')
    .isArray({ min: 1 })
    .withMessage('Assignments must be a non-empty array'),

  body('assignments.*.teacherId')
    .isMongoId()
    .withMessage('Each assignment must have a valid teacher ID'),

  body('assignments.*.studentIds')
    .isArray({ min: 1 })
    .withMessage('Each assignment must have a non-empty array of student IDs'),

  body('assignments.*.studentIds.*')
    .isMongoId()
    .withMessage('Each student ID must be a valid MongoDB ObjectId'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for teacher unassignment
 */
const validateTeacherUnassignment = [
  body('teacherId')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),

  body('studentIds')
    .isArray({ min: 1 })
    .withMessage('Student IDs must be a non-empty array'),

  body('studentIds.*')
    .isMongoId()
    .withMessage('Each student ID must be a valid MongoDB ObjectId'),

  body('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for single teacher-student assignment params
 */
const validateTeacherStudentParams = [
  param('teacherId')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),

  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format'),

  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

/**
 * Validation for getting teacher's students
 */
const validateGetTeacherStudents = [
  param('teacherId')
    .isMongoId()
    .withMessage('Invalid teacher ID format'),

  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

/**
 * Validation for getting student's teachers
 */
const validateGetStudentTeachers = [
  param('studentId')
    .isMongoId()
    .withMessage('Invalid student ID format'),

  query('schoolId')
    .optional()
    .matches(/^[A-Z]{3}[0-9]{4}$/)
    .withMessage('Invalid school ID format')
];

module.exports = {
  validateTeacherAssignment,
  validateBulkTeacherAssignment,
  validateTeacherUnassignment,
  validateTeacherStudentParams,
  validateGetTeacherStudents,
  validateGetStudentTeachers
};
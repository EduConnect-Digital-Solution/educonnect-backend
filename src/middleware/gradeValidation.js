/**
 * Grade Validation Middleware
 * Validates grade-related requests
 */

const { body, param, query } = require('express-validator');

/**
 * Validate grade assignment request
 */
const validateGradeAssignment = [
  body('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Student ID must be a valid MongoDB ObjectId'),
    
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject must be between 2 and 100 characters')
    .trim(),
    
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('Class must be between 1 and 20 characters')
    .trim(),
    
  body('section')
    .optional()
    .isLength({ max: 10 })
    .withMessage('Section cannot exceed 10 characters')
    .trim(),
    
  body('term')
    .optional()
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Term must be First Term, Second Term, or Third Term'),
    
  body('academicYear')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY (e.g., 2024-2025)'),
    
  body('assessments')
    .optional()
    .isArray()
    .withMessage('Assessments must be an array'),
    
  body('assessments.*.type')
    .if(body('assessments').exists())
    .notEmpty()
    .withMessage('Assessment type is required')
    .isIn(['Test', 'Assignment', 'Quiz', 'Project', 'Exam', 'Practical', 'Homework'])
    .withMessage('Assessment type must be one of: Test, Assignment, Quiz, Project, Exam, Practical, Homework'),
    
  body('assessments.*.title')
    .if(body('assessments').exists())
    .notEmpty()
    .withMessage('Assessment title is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Assessment title must be between 1 and 200 characters')
    .trim(),
    
  body('assessments.*.score')
    .if(body('assessments').exists())
    .isNumeric()
    .withMessage('Assessment score must be a number')
    .custom((value, { req, path }) => {
      const index = path.split('[')[1].split(']')[0];
      const maxScore = req.body.assessments[index].maxScore;
      if (parseFloat(value) < 0) {
        throw new Error('Assessment score cannot be negative');
      }
      if (maxScore && parseFloat(value) > parseFloat(maxScore)) {
        throw new Error('Assessment score cannot exceed maximum score');
      }
      return true;
    }),
    
  body('assessments.*.maxScore')
    .if(body('assessments').exists())
    .isNumeric()
    .withMessage('Assessment maximum score must be a number')
    .custom((value) => {
      if (parseFloat(value) < 1) {
        throw new Error('Assessment maximum score must be at least 1');
      }
      return true;
    }),
    
  body('assessments.*.weight')
    .optional()
    .isNumeric()
    .withMessage('Assessment weight must be a number')
    .custom((value) => {
      const weight = parseFloat(value);
      if (weight < 0 || weight > 100) {
        throw new Error('Assessment weight must be between 0 and 100');
      }
      return true;
    }),
    
  body('assessments.*.date')
    .optional()
    .isISO8601()
    .withMessage('Assessment date must be a valid date'),
    
  body('assessments.*.remarks')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Assessment remarks cannot exceed 500 characters')
    .trim(),
    
  body('remarks')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Remarks cannot exceed 1000 characters')
    .trim()
];

/**
 * Validate publish grades request
 */
const validatePublishGrades = [
  body('class')
    .notEmpty()
    .withMessage('Class is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('Class must be between 1 and 20 characters')
    .trim(),
    
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject must be between 2 and 100 characters')
    .trim(),
    
  body('term')
    .optional()
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Term must be First Term, Second Term, or Third Term'),
    
  body('academicYear')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY (e.g., 2024-2025)')
];

/**
 * Validate class name parameter
 */
const validateClassName = [
  param('className')
    .notEmpty()
    .withMessage('Class name is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('Class name must be between 1 and 20 characters')
    .trim()
];

/**
 * Validate subject parameter
 */
const validateSubject = [
  param('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject must be between 2 and 100 characters')
    .trim()
];

/**
 * Validate student ID parameter
 */
const validateStudentId = [
  param('studentId')
    .notEmpty()
    .withMessage('Student ID is required')
    .isMongoId()
    .withMessage('Student ID must be a valid MongoDB ObjectId')
];

/**
 * Validate grade ID parameter
 */
const validateGradeId = [
  param('gradeId')
    .notEmpty()
    .withMessage('Grade ID is required')
    .isMongoId()
    .withMessage('Grade ID must be a valid MongoDB ObjectId')
];

/**
 * Validate query parameters for student listing
 */
const validateStudentQuery = [
  query('term')
    .optional()
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Term must be First Term, Second Term, or Third Term'),
    
  query('academicYear')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY (e.g., 2024-2025)'),
    
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
 * Validate statistics query parameters
 */
const validateStatisticsQuery = [
  query('term')
    .optional()
    .isIn(['First Term', 'Second Term', 'Third Term'])
    .withMessage('Term must be First Term, Second Term, or Third Term'),
    
  query('academicYear')
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY (e.g., 2024-2025)')
];

/**
 * Sanitize grade data
 */
const sanitizeGradeData = (req, res, next) => {
  if (req.body) {
    // Trim string fields
    const stringFields = ['subject', 'class', 'section', 'term', 'academicYear', 'remarks'];
    stringFields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim();
      }
    });
    
    // Sanitize assessments
    if (req.body.assessments && Array.isArray(req.body.assessments)) {
      req.body.assessments = req.body.assessments.map(assessment => ({
        ...assessment,
        type: assessment.type?.trim(),
        title: assessment.title?.trim(),
        remarks: assessment.remarks?.trim(),
        score: parseFloat(assessment.score),
        maxScore: parseFloat(assessment.maxScore),
        weight: assessment.weight ? parseFloat(assessment.weight) : 1,
        date: assessment.date ? new Date(assessment.date) : new Date()
      }));
    }
    
    // Set default term if not provided
    if (!req.body.term) {
      req.body.term = 'First Term';
    }
    
    // Set default academic year if not provided
    if (!req.body.academicYear) {
      const currentYear = new Date().getFullYear();
      req.body.academicYear = `${currentYear}-${currentYear + 1}`;
    }
  }
  
  next();
};

/**
 * Validate teacher access to class and subject
 */
const validateTeacherAccess = async (req, res, next) => {
  try {
    const { userId: teacherId } = req.user;
    const { className, subject } = req.params;
    
    // Get teacher information
    const User = require('../models/User');
    const teacher = await User.findById(teacherId);
    
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Teacher role required.'
      });
    }
    
    // Check if teacher teaches the class (if className provided)
    if (className && (!teacher.classes || !teacher.classes.includes(className))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not teach this class.'
      });
    }
    
    // Check if teacher teaches the subject (if subject provided)
    if (subject && (!teacher.subjects || !teacher.subjects.includes(subject))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not teach this subject.'
      });
    }
    
    next();
  } catch (error) {
    console.error('Teacher access validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during access validation'
    });
  }
};

module.exports = {
  validateGradeAssignment,
  validatePublishGrades,
  validateClassName,
  validateSubject,
  validateStudentId,
  validateGradeId,
  validateStudentQuery,
  validateStatisticsQuery,
  sanitizeGradeData,
  validateTeacherAccess
};
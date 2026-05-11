/**
 * Academic Calendar Routes
 * Handles academic year, term, and calendar event management
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const academicCalendarController = require('../controllers/academicCalendarController');
const {
  validateAcademicYearCreation,
  validateAcademicTermCreation,
  validateAcademicYearId,
  validateAcademicTermId,
  validateAcademicYearQuery
} = require('../middleware/academicCalendarValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// =============== ACADEMIC YEAR ROUTES ===============

/**
 * @route   POST /api/admin/academic/years
 * @desc    Create academic years
 * @access  Admin
 */
router.post('/years',
  requireRole(['admin']),
  validateAcademicYearCreation,
  academicCalendarController.createAcademicYears
);

/**
 * @route   GET /api/academic/years
 * @desc    Get academic years
 * @access  Authenticated
 */
router.get('/years',
  academicCalendarController.getAcademicYears
);

/**
 * @route   PUT /api/admin/academic/years/:yearId/current
 * @desc    Set current academic year
 * @access  Admin
 */
router.put('/years/:yearId/current',
  requireRole(['admin']),
  validateAcademicYearId,
  academicCalendarController.setCurrentAcademicYear
);

// =============== ACADEMIC TERM ROUTES ===============

/**
 * @route   POST /api/admin/academic/terms
 * @desc    Create academic terms
 * @access  Admin
 */
router.post('/terms',
  requireRole(['admin']),
  validateAcademicTermCreation,
  academicCalendarController.createAcademicTerms
);

/**
 * @route   GET /api/academic/terms
 * @desc    Get academic terms
 * @access  Authenticated
 */
router.get('/terms',
  validateAcademicYearQuery,
  academicCalendarController.getAcademicTerms
);

/**
 * @route   PUT /api/admin/academic/terms/:termId/current
 * @desc    Set current academic term
 * @access  Admin
 */
router.put('/terms/:termId/current',
  requireRole(['admin']),
  validateAcademicTermId,
  academicCalendarController.setCurrentAcademicTerm
);

// =============== CURRENT PERIOD ROUTES ===============

/**
 * @route   GET /api/academic/current
 * @desc    Get current academic period
 * @access  Authenticated
 */
router.get('/current',
  academicCalendarController.getCurrentAcademicPeriod
);

module.exports = router;

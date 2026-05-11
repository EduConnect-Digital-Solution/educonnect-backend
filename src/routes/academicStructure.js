/**
 * Academic Structure Routes
 * Handles subjects, arms, and their relationships
 */

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const academicStructureController = require('../controllers/academicStructureController');
const {
  validateSubjectCreation,
  validateSubjectUpdate,
  validateSubjectDeletion,
  validateArmCreation,
  validateArmUpdate,
  validateArmDeletion,
  validateArmSubjectAddition,
  validateClassSubjectAddition,
  validateArmSubjectReplacement,
  validateArmSubjectCopy,
  validateUUID
} = require('../middleware/academicValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Apply authentication to all routes
router.use(authenticateToken);

// Apply admin role requirement to all management routes
router.use(requireRole(['admin']));

// =============== SUBJECT ROUTES ===============

/**
 * @route   POST /api/academic/subjects
 * @desc    Create subjects
 * @access  Admin
 */
router.post('/subjects',
  validateSubjectCreation,
  academicStructureController.createSubjects
);

/**
 * @route   GET /api/academic/subjects
 * @desc    List subjects
 * @access  Authenticated
 */
router.get('/subjects',
  // No role restriction - all authenticated users can view subjects
  academicStructureController.listSubjects
);

/**
 * @route   GET /api/academic/classes/:classId/subjects
 * @desc    Get subjects by class
 * @access  Authenticated
 */
router.get('/classes/:classId/subjects',
  validateUUID('classId'),
  academicStructureController.getSubjectsByClass
);

/**
 * @route   PUT /api/academic/subjects/:subjectId
 * @desc    Update subject
 * @access  Admin
 */
router.put('/subjects/:subjectId',
  validateSubjectUpdate,
  academicStructureController.updateSubject
);

/**
 * @route   DELETE /api/academic/subjects
 * @desc    Delete subjects
 * @access  Admin
 */
router.delete('/subjects',
  validateSubjectDeletion,
  academicStructureController.deleteSubjects
);

// =============== ARM ROUTES ===============

/**
 * @route   POST /api/academic/arms
 * @desc    Create arms
 * @access  Admin
 */
router.post('/arms',
  validateArmCreation,
  academicStructureController.createArms
);

/**
 * @route   GET /api/academic/classes/:classId/arms
 * @desc    Get arms by class
 * @access  Authenticated
 */
router.get('/classes/:classId/arms',
  validateUUID('classId'),
  academicStructureController.getArmsByClass
);

/**
 * @route   PUT /api/academic/arms/:armId
 * @desc    Update arm
 * @access  Admin
 */
router.put('/arms/:armId',
  validateArmUpdate,
  academicStructureController.updateArm
);

/**
 * @route   DELETE /api/academic/arms
 * @desc    Delete arms
 * @access  Admin
 */
router.delete('/arms',
  validateArmDeletion,
  academicStructureController.deleteArms
);

// =============== ARM-SUBJECT RELATIONSHIP ROUTES ===============

/**
 * @route   GET /api/academic/arms/:armId/subjects
 * @desc    Get arm subjects
 * @access  Authenticated
 */
router.get('/arms/:armId/subjects',
  validateUUID('armId'),
  academicStructureController.getArmSubjects
);

/**
 * @route   POST /api/academic/arms/:armId/subjects
 * @desc    Add subjects to arm
 * @access  Admin
 */
router.post('/arms/:armId/subjects',
  validateArmSubjectAddition,
  academicStructureController.addSubjectsToArm
);

/**
 * @route   POST /api/academic/classes/:classId/subjects
 * @desc    Add subjects to class
 * @access  Admin
 */
router.post('/classes/:classId/subjects',
  authenticateToken,
  requireRole(['admin']),
  validateClassSubjectAddition,
  academicStructureController.addSubjectsToClass
);

/**
 * @route   DELETE /api/academic/classes/:classId/subjects
 * @desc    Remove subjects from class
 * @access  Admin
 */
router.delete('/classes/:classId/subjects',
  authenticateToken,
  requireRole(['admin']),
  validateClassSubjectAddition,
  academicStructureController.removeSubjectsFromClass
);

/**
 * @route   DELETE /api/academic/arms/:armId/subjects
 * @desc    Remove subjects from arm
 * @access  Admin
 */
router.delete('/arms/:armId/subjects',
  validateArmSubjectAddition,
  academicStructureController.removeSubjectsFromArm
);

/**
 * @route   PUT /api/academic/arms/:armId/subjects/replace
 * @desc    Replace subjects for an arm
 * @access  Admin
 */
router.put('/arms/:armId/subjects/replace',
  validateArmSubjectReplacement,
  academicStructureController.replaceArmSubjects
);

/**
 * @route   POST /api/academic/arms/:sourceArmId/subjects/copy/:targetArmId
 * @desc    Copy subjects from one arm to another
 * @access  Admin
 */
router.post('/arms/:sourceArmId/subjects/copy/:targetArmId',
  validateArmSubjectCopy,
  academicStructureController.copyArmSubjects
);

module.exports = router;

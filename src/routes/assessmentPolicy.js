const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  list, getById, create, update, remove, addAssignment, removeAssignment
} = require('../controllers/assessmentPolicyController');
const {
  validatePolicy, validatePolicyUpdate, validateAssignment,
  validatePolicyId, validateAssignmentDelete
} = require('../middleware/assessmentPolicyValidation');

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/assessment-policies', list);
router.get('/assessment-policies/:id', validatePolicyId, getById);
router.post('/assessment-policies', validatePolicy, create);
router.put('/assessment-policies/:id', validatePolicyId, validatePolicyUpdate, update);
router.delete('/assessment-policies/:id', validatePolicyId, remove);
router.post('/assessment-policies/:id/assignments', validatePolicyId, validateAssignment, addAssignment);
router.delete('/assessment-policies/:id/assignments/:assignmentId', validateAssignmentDelete, removeAssignment);

module.exports = router;

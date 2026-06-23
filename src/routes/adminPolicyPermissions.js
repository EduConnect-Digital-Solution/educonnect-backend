const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { list, grant, revoke } = require('../controllers/adminPolicyPermissionController');

const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
};

router.use(authenticateToken);
router.use(requireRole(['admin']));

const validateGrant = [
  body('teacherId').isUUID().withMessage('teacherId must be a valid UUID'),
  body('classId').isUUID().withMessage('classId must be a valid UUID'),
  handleValidationErrors
];

router.get('/policy-permissions', list);
router.post('/policy-permissions', validateGrant, grant);
router.delete('/policy-permissions/:permissionId', revoke);

module.exports = router;
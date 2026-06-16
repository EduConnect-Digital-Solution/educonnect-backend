const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getMatrix, approve, return: return_ } = require('../controllers/submissionController');

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/submissions/matrix', getMatrix);
router.post('/submissions/:submissionId/approve', approve);
router.post('/submissions/:submissionId/return', return_);

module.exports = router;

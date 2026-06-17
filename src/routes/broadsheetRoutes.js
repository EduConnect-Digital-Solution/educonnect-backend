const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getBroadsheet } = require('../controllers/broadsheetController');

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/broadsheets', getBroadsheet);

module.exports = router;

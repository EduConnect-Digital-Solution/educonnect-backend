const express = require('express');
const router = express.Router();

const controller = require('../controllers/studentDashboardController');

router.get('/locales', controller.getLocales);

module.exports = router;

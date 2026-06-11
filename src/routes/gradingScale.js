const express = require('express');
const router = express.Router();

const gradingScaleController = require('../controllers/gradingScaleController');
const {
  validateCreateScale,
  validateUpdateScale,
  validateScaleId,
  validateAddBand,
  validateUpdateBand
} = require('../middleware/gradingScaleValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/', gradingScaleController.getScales);
router.post('/', validateCreateScale, gradingScaleController.createScale);
router.get('/:id', validateScaleId, gradingScaleController.getScale);
router.put('/:id', validateUpdateScale, gradingScaleController.updateScale);
router.delete('/:id', validateScaleId, gradingScaleController.deleteScale);
router.post('/:id/set-default', validateScaleId, gradingScaleController.setDefaultScale);
router.post('/:id/bands', validateAddBand, gradingScaleController.addBand);
router.put('/:id/bands/:bandId', validateUpdateBand, gradingScaleController.updateBand);
router.delete('/:id/bands/:bandId', validateScaleId, gradingScaleController.deleteBand);

module.exports = { gradingScaleRoutes: router };

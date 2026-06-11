const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  createScale, getScales, getScaleById, updateScale, deleteScale, setDefaultScale,
  addBand, updateBand, deleteBand
} = require('../controllers/gradingScaleController');
const {
  createScaleValidation, updateScaleValidation,
  addBandValidation, updateBandValidation
} = require('../middleware/gradingScaleValidation');

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.post('/grading-scales', createScaleValidation, createScale);
router.get('/grading-scales', getScales);
router.get('/grading-scales/:scaleId', getScaleById);
router.put('/grading-scales/:scaleId', updateScaleValidation, updateScale);
router.delete('/grading-scales/:scaleId', deleteScale);
router.put('/grading-scales/:scaleId/default', setDefaultScale);

router.post('/grading-scales/:scaleId/bands', addBandValidation, addBand);
router.put('/grading-scales/:scaleId/bands/:bandId', updateBandValidation, updateBand);
router.delete('/grading-scales/:scaleId/bands/:bandId', deleteBand);

module.exports = router;

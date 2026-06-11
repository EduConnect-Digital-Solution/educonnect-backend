const { validationResult } = require('express-validator');
const GradingScaleService = require('../services/gradingScaleService');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');

const createScale = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const scale = await GradingScaleService.createScale(req.user.schoolId, req.body);
  res.status(201).json({ success: true, message: 'Grading scale created', data: scale });
});

const getScales = catchAsync(async (req, res) => {
  const scales = await GradingScaleService.getScales(req.user.schoolId);
  res.json({ success: true, data: scales });
});

const getScaleById = catchAsync(async (req, res) => {
  const scale = await GradingScaleService.getScaleById(req.user.schoolId, req.params.scaleId);
  res.json({ success: true, data: scale });
});

const updateScale = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const scale = await GradingScaleService.updateScale(req.user.schoolId, req.params.scaleId, req.body);
  res.json({ success: true, message: 'Grading scale updated', data: scale });
});

const deleteScale = catchAsync(async (req, res) => {
  await GradingScaleService.deleteScale(req.user.schoolId, req.params.scaleId);
  res.json({ success: true, message: 'Grading scale deleted' });
});

const setDefaultScale = catchAsync(async (req, res) => {
  const scale = await GradingScaleService.setDefaultScale(req.user.schoolId, req.params.scaleId);
  res.json({ success: true, message: 'Default grading scale updated', data: scale });
});

const addBand = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const band = await GradingScaleService.addBand(req.user.schoolId, req.params.scaleId, req.body);
  res.status(201).json({ success: true, message: 'Grade band added', data: band });
});

const updateBand = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const band = await GradingScaleService.updateBand(req.user.schoolId, req.params.bandId, req.body);
  res.json({ success: true, message: 'Grade band updated', data: band });
});

const deleteBand = catchAsync(async (req, res) => {
  await GradingScaleService.deleteBand(req.user.schoolId, req.params.bandId);
  res.json({ success: true, message: 'Grade band deleted' });
});

module.exports = {
  createScale, getScales, getScaleById, updateScale, deleteScale, setDefaultScale,
  addBand, updateBand, deleteBand
};

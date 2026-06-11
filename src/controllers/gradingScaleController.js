const GradingScaleService = require('../services/gradingScaleService');
const catchAsync = require('../utils/catchAsync');

const createScale = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const scale = await GradingScaleService.createScale(schoolId, req.body);
  res.status(201).json({ success: true, message: 'Grading scale created', data: scale });
});

const getScales = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const scales = await GradingScaleService.getScales(schoolId);
  res.json({ success: true, data: scales });
});

const getScale = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const scale = await GradingScaleService.getScale(req.params.id, schoolId);
  res.json({ success: true, data: scale });
});

const updateScale = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const scale = await GradingScaleService.updateScale(req.params.id, schoolId, req.body);
  res.json({ success: true, message: 'Grading scale updated', data: scale });
});

const deleteScale = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  await GradingScaleService.deleteScale(req.params.id, schoolId);
  res.json({ success: true, message: 'Grading scale deleted' });
});

const setDefaultScale = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const scale = await GradingScaleService.setDefaultScale(req.params.id, schoolId);
  res.json({ success: true, message: 'Default grading scale updated', data: scale });
});

const addBand = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const band = await GradingScaleService.addBand(req.params.id, schoolId, req.body);
  res.status(201).json({ success: true, message: 'Grade band added', data: band });
});

const updateBand = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  const band = await GradingScaleService.updateBand(req.params.bandId, schoolId, req.body);
  res.json({ success: true, message: 'Grade band updated', data: band });
});

const deleteBand = catchAsync(async (req, res) => {
  const { schoolId } = req.user;
  await GradingScaleService.deleteBand(req.params.bandId, schoolId);
  res.json({ success: true, message: 'Grade band deleted' });
});

module.exports = {
  createScale, getScales, getScale, updateScale, deleteScale, setDefaultScale,
  addBand, updateBand, deleteBand
};

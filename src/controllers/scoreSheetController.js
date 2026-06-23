const scoreSheetService = require('../services/scoreSheetService');
const logger = require('../utils/logger');

const get = async (req, res) => {
  try {
    const { userId: teacherId, schoolId } = req.user;
    const { className, subjectName, termId } = req.query;

    if (!className || !subjectName || !termId) {
      return res.status(400).json({
        success: false,
        message: 'className, subjectName, and termId are required'
      });
    }

    const sheet = await scoreSheetService.getSheet(teacherId, schoolId, className, subjectName, termId);
    res.json({ success: true, data: { sheet } });
  } catch (error) {
    logger.error('Error fetching score sheet:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch score sheet' });
  }
};

const create = async (req, res) => {
  try {
    const { userId: teacherId, schoolId } = req.user;
    const { className, subjectName, termId } = req.body;

    if (!className || !subjectName || !termId) {
      return res.status(400).json({
        success: false,
        message: 'className, subjectName, and termId are required'
      });
    }

    const sheet = await scoreSheetService.createSheet(teacherId, schoolId, className, subjectName, termId);
    res.status(201).json({ success: true, data: { sheet } });
  } catch (error) {
    logger.error('Error creating score sheet:', error);
    if (error.message === 'Class not found' || error.message === 'Subject not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create score sheet' });
  }
};

const save = async (req, res) => {
  try {
    const { userId: teacherId, schoolId } = req.user;
    const { sheetId } = req.params;
    const { entries } = req.body;

    if (!Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: 'entries must be an array' });
    }

    for (const entry of entries) {
      if (entry.remark !== undefined && entry.remark !== null && typeof entry.remark === 'string' && entry.remark.length > 300) {
        return res.status(400).json({
          success: false,
          message: `Remark for student ${entry.studentId} exceeds 300 characters`
        });
      }
    }

    const result = await scoreSheetService.saveEntries(sheetId, teacherId, schoolId, entries);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Score sheet not found' });
    }
    if (result.locked) {
      return res.status(403).json({ success: false, message: 'Score sheet is locked' });
    }

    res.json({ success: true, data: { sheet: result } });
  } catch (error) {
    logger.error('Error saving score sheet entries:', error);
    res.status(500).json({ success: false, message: 'Failed to save entries' });
  }
};

const submit = async (req, res) => {
  try {
    const { userId: teacherId, schoolId } = req.user;
    const { sheetId } = req.params;

    const result = await scoreSheetService.submitSheet(sheetId, teacherId, schoolId);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Score sheet not found' });
    }
    if (result.locked) {
      return res.status(403).json({ success: false, message: 'Score sheet is already approved' });
    }
    if (result.alreadySubmitted) {
      return res.status(409).json({ success: false, message: 'Score sheet is already submitted' });
    }
    if (result.noPolicy) {
      return res.status(400).json({
        success: false,
        message: 'No assessment policy assigned for this class and subject. Please contact an admin.'
      });
    }
    if (result.validationErrors) {
      return res.status(400).json({
        success: false,
        message: 'Scores exceed policy limits',
        errors: result.validationErrors
      });
    }

    res.json({ success: true, data: { sheet: result } });
  } catch (error) {
    logger.error('Error submitting score sheet:', error);
    res.status(500).json({ success: false, message: 'Failed to submit score sheet' });
  }
};

module.exports = { get, create, save, submit };

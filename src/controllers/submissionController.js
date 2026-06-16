const submissionService = require('../services/submissionService');
const logger = require('../utils/logger');

const getMatrix = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { termId } = req.query;

    if (!termId) {
      return res.status(400).json({ success: false, message: 'termId is required' });
    }

    const data = await submissionService.getMatrix(schoolId, termId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching submission matrix:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submission matrix' });
  }
};

const approve = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { submissionId } = req.params;

    const result = await submissionService.approveSheet(submissionId, schoolId);
    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    if (result.wrongStatus) {
      return res.status(400).json({ success: false, message: 'Only submitted sheets can be approved' });
    }

    res.json({ success: true, data: { sheet: result.sheet } });
  } catch (error) {
    logger.error('Error approving submission:', error);
    res.status(500).json({ success: false, message: 'Failed to approve submission' });
  }
};

const return_ = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { submissionId } = req.params;
    const { note } = req.body;

    const result = await submissionService.returnSheet(submissionId, schoolId, note);
    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    if (result.wrongStatus) {
      return res.status(400).json({ success: false, message: 'Only submitted sheets can be returned' });
    }

    res.json({ success: true, data: { sheet: result.sheet } });
  } catch (error) {
    logger.error('Error returning submission:', error);
    res.status(500).json({ success: false, message: 'Failed to return submission' });
  }
};

module.exports = { getMatrix, approve, return: return_ };

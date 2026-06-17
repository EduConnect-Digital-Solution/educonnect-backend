const policyService = require('../services/assessmentPolicyService');
const logger = require('../utils/logger');

const getEffectivePolicy = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { className, subjectName } = req.query;

    if (!className || !subjectName) {
      return res.status(400).json({
        success: false,
        message: 'className and subjectName are required'
      });
    }

    const policy = await policyService.getEffectivePolicy(schoolId, className, subjectName);

    res.json({
      success: true,
      data: { policy }
    });
  } catch (error) {
    logger.error('Error resolving effective policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve effective policy'
    });
  }
};

module.exports = { getEffectivePolicy };

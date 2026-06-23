const policyService = require('../services/assessmentPolicyService');
const logger = require('../utils/logger');

const getEffectivePolicy = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { className, subjectName, armId } = req.query;

    if (!className || !subjectName) {
      return res.status(400).json({
        success: false,
        message: 'className and subjectName are required'
      });
    }

    const result = await policyService.getEffectivePolicy(schoolId, className, subjectName, armId || undefined, userId);

    res.json({
      success: true,
      data: {
        policy: result.policy,
        source: result.source,
        hasPermission: result.hasPermission
      }
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

const broadsheetService = require('../services/broadsheetService');
const logger = require('../utils/logger');

const getBroadsheet = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armId, termId } = req.query;

    if (!armId || !termId) {
      return res.status(400).json({ success: false, message: 'armId and termId are required' });
    }

    const data = await broadsheetService.getBroadsheet(schoolId, armId, termId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Arm not found' });
    }

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Error fetching broadsheet:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch broadsheet' });
  }
};

module.exports = { getBroadsheet };

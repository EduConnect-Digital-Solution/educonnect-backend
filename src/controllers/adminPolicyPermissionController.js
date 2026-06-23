const permissionService = require('../services/teacherPolicyPermissionService');
const logger = require('../utils/logger');

const list = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { permissions } = await permissionService.listPermissions(schoolId);
    res.json({ success: true, data: { permissions } });
  } catch (error) {
    logger.error('Error listing policy permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to list permissions' });
  }
};

const grant = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { teacherId, classId } = req.body;
    const result = await permissionService.grantPermission(schoolId, teacherId, classId, req.user.id);

    if (result.conflict) {
      return res.status(409).json({ success: false, message: 'Permission already exists for this teacher and class.' });
    }
    if (result.teacherNotFound) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    if (result.classNotFound) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    res.status(201).json({ success: true, data: { permission: result.permission } });
  } catch (error) {
    logger.error('Error granting policy permission:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Permission already exists for this teacher and class.' });
    }
    res.status(500).json({ success: false, message: 'Failed to grant permission' });
  }
};

const revoke = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { permissionId } = req.params;
    const result = await permissionService.revokePermission(permissionId, schoolId);

    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Permission not found' });
    }

    res.json({ success: true, data: { revoked: true } });
  } catch (error) {
    logger.error('Error revoking policy permission:', error);
    res.status(500).json({ success: false, message: 'Failed to revoke permission' });
  }
};

module.exports = { list, grant, revoke };
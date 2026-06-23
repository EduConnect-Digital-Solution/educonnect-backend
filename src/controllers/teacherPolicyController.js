const policyService = require('../services/assessmentPolicyService');
const logger = require('../utils/logger');

const checkPermission = async (userId, classId) => {
  const { prisma } = require('../config/database');
  return prisma.teacherPolicyPermission.findFirst({
    where: { teacherId: userId, classId }
  });
};

// GET /api/teacher/my-policy-permission
const myPermission = async (req, res) => {
  try {
    const { id: userId, schoolId } = req.user;
    const { prisma } = require('../config/database');

    const perm = await prisma.teacherPolicyPermission.findFirst({
      where: { teacherId: userId, class: { schoolId } },
      include: { class: { select: { id: true, name: true } } },
      orderBy: { grantedAt: 'desc' }
    });

    if (!perm) {
      return res.json({ success: true, data: { granted: false } });
    }

    res.json({
      success: true,
      data: {
        granted: true,
        permissionId: perm.id,
        classId: perm.class.id,
        className: perm.class.name,
        grantedAt: perm.grantedAt
      }
    });
  } catch (error) {
    logger.error('Error checking teacher policy permission:', error);
    res.status(500).json({ success: false, message: 'Failed to check permission' });
  }
};

// GET /api/teacher/my-policies
const myList = async (req, res) => {
  try {
    const { id: userId, schoolId } = req.user;
    const { prisma } = require('../config/database');

    const perm = await prisma.teacherPolicyPermission.findFirst({
      where: { teacherId: userId, class: { schoolId } }
    });
    if (!perm) {
      return res.status(403).json({ success: false, message: 'You do not have policy creation permission' });
    }

    const policies = await policyService.listTeacherPolicies(schoolId, perm.classId);
    res.json({ success: true, data: { policies } });
  } catch (error) {
    logger.error('Error listing teacher policies:', error);
    res.status(500).json({ success: false, message: 'Failed to list policies' });
  }
};

// POST /api/teacher/my-policies
const myCreate = async (req, res) => {
  try {
    const { id: userId, schoolId } = req.user;
    const { prisma } = require('../config/database');

    const perm = await prisma.teacherPolicyPermission.findFirst({
      where: { teacherId: userId, class: { schoolId } }
    });
    if (!perm) {
      return res.status(403).json({ success: false, message: 'You do not have policy creation permission' });
    }

    const policy = await policyService.createTeacherPolicy(schoolId, userId, req.body, perm.classId);
    res.status(201).json({ success: true, data: { policy } });
  } catch (error) {
    logger.error('Error creating teacher policy:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A policy with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create policy' });
  }
};

// PUT /api/teacher/my-policies/:policyId
const myUpdate = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { policyId } = req.params;

    const result = await policyService.updateTeacherPolicy(policyId, userId, req.body);
    if (result.notFound) {
      return res.status(403).json({ success: false, message: 'Policy not found or does not belong to you' });
    }

    res.json({ success: true, data: { policy: result.policy } });
  } catch (error) {
    logger.error('Error updating teacher policy:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A policy with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update policy' });
  }
};

// DELETE /api/teacher/my-policies/:policyId
const myDelete = async (req, res) => {
  try {
    const { id: userId, schoolId } = req.user;
    const { policyId } = req.params;

    const result = await policyService.deleteTeacherPolicy(policyId, userId, schoolId);
    if (result.notFound) {
      return res.status(403).json({ success: false, message: 'Policy not found or does not belong to you' });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error('Error deleting teacher policy:', error);
    res.status(500).json({ success: false, message: 'Failed to delete policy' });
  }
};

// GET /api/admin/teacher-policies
const adminListTeacherPolicies = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.query;

    const policies = await policyService.listTeacherPolicies(schoolId, classId || undefined);
    res.json({ success: true, data: { policies } });
  } catch (error) {
    logger.error('Error listing teacher policies for admin:', error);
    res.status(500).json({ success: false, message: 'Failed to list teacher policies' });
  }
};

// POST /api/teacher/my-policies/:policyId/assignments
const myAddAssignment = async (req, res) => {
  try {
    const { id: userId, schoolId } = req.user;
    const { policyId } = req.params;
    const { prisma } = require('../config/database');

    const perm = await prisma.teacherPolicyPermission.findFirst({
      where: { teacherId: userId, class: { schoolId } }
    });
    if (!perm) {
      return res.status(403).json({ success: false, message: 'You do not have policy creation permission' });
    }

    const result = await policyService.addTeacherAssignment(policyId, userId, req.body, perm.classId);
    if (result.notFound) {
      return res.status(403).json({ success: false, message: 'Policy not found or does not belong to you' });
    }
    if (result.invalidScope) {
      return res.status(400).json({ success: false, message: 'School and subject scopes are not allowed for teacher policies' });
    }
    if (result.invalidScopeId) {
      return res.status(400).json({ success: false, message: 'Scope ID does not belong to your class' });
    }

    res.status(201).json({ success: true, data: { assignment: result.assignment } });
  } catch (error) {
    logger.error('Error adding teacher policy assignment:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'This scope is already assigned to the policy' });
    }
    res.status(500).json({ success: false, message: 'Failed to add assignment' });
  }
};

// DELETE /api/teacher/my-policies/:policyId/assignments/:assignmentId
const myRemoveAssignment = async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { policyId, assignmentId } = req.params;

    const result = await policyService.removeTeacherAssignment(policyId, assignmentId, userId);
    if (result.notFound) {
      return res.status(403).json({ success: false, message: 'Policy or assignment not found' });
    }

    res.json({ success: true, data: { removed: true } });
  } catch (error) {
    logger.error('Error removing teacher policy assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to remove assignment' });
  }
};

module.exports = {
  myPermission,
  myList,
  myCreate,
  myUpdate,
  myDelete,
  adminListTeacherPolicies,
  myAddAssignment,
  myRemoveAssignment
};
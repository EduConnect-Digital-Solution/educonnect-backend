const policyService = require('../services/assessmentPolicyService');
const logger = require('../utils/logger');

const list = async (req, res) => {
  try {
    const { schoolId } = req.user;
    // Return all policies (admin + teacher) with their metadata fields
    const policies = await policyService.listPolicies(schoolId);
    res.json({ success: true, data: { policies } });
  } catch (error) {
    logger.error('Error listing assessment policies:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch policies' });
  }
};

const getById = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const policy = await policyService.getPolicyById(req.params.id, schoolId);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }
    res.json({ success: true, data: { policy } });
  } catch (error) {
    logger.error('Error fetching assessment policy:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch policy' });
  }
};

const create = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const policy = await policyService.createPolicy(schoolId, req.body);
    res.status(201).json({ success: true, data: { policy } });
  } catch (error) {
    logger.error('Error creating assessment policy:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A policy with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to create policy' });
  }
};

const update = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const policy = await policyService.updatePolicy(req.params.id, schoolId, req.body);
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }
    res.json({ success: true, data: { policy } });
  } catch (error) {
    logger.error('Error updating assessment policy:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'A policy with this name already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to update policy' });
  }
};

const remove = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const result = await policyService.deletePolicy(req.params.id, schoolId);
    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }
    if (result.hasAssignments) {
      return res.status(409).json({ success: false, message: 'Cannot delete policy with active assignments. Remove all assignments first.' });
    }
    res.json({ success: true, message: 'Policy deleted.' });
  } catch (error) {
    logger.error('Error deleting assessment policy:', error);
    res.status(500).json({ success: false, message: 'Failed to delete policy' });
  }
};

const addAssignment = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const assignment = await policyService.addAssignment(req.params.id, schoolId, req.body);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }
    res.status(201).json({ success: true, data: { assignment } });
  } catch (error) {
    logger.error('Error adding policy assignment:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'This scope is already assigned to the policy' });
    }
    res.status(500).json({ success: false, message: 'Failed to add assignment' });
  }
};

const removeAssignment = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const result = await policyService.removeAssignment(req.params.id, req.params.assignmentId, schoolId);
    if (result.notFound) {
      return res.status(404).json({ success: false, message: 'Policy or assignment not found' });
    }
    res.json({ success: true, message: 'Assignment removed.' });
  } catch (error) {
    logger.error('Error removing policy assignment:', error);
    res.status(500).json({ success: false, message: 'Failed to remove assignment' });
  }
};

module.exports = { list, getById, create, update, remove, addAssignment, removeAssignment };

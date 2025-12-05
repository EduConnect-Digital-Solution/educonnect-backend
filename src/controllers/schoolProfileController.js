/**
 * School Profile Management Controller
 * Handles HTTP requests and delegates business logic to schoolService
 * Requirements: 7.4
 */

const schoolService = require('../services/schoolService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Get School Profile
 * Retrieves complete school profile information for admin
 * Requirements: 7.4
 */
const getSchoolProfile = catchAsync(async (req, res) => {
  try {
    const { schoolId } = req.query;
    
    // Get school info - for testing, allow schoolId in query, in production this would come from auth middleware
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found'
        });
      }
      targetSchoolId = recentSchool.schoolId;
    }

    const result = await schoolService.getSchoolProfile(targetSchoolId);

    res.status(200).json({
      success: true,
      message: 'School profile retrieved successfully',
      data: {
        school: result.school,
        adminUser: result.admin,
        statistics: result.statistics
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Admin user not found for this school') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Update School Profile
 * Updates school profile information with validation
 * Requirements: 7.4
 */
const updateSchoolProfile = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { schoolId } = req.body;
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found'
        });
      }
      targetSchoolId = recentSchool.schoolId;
    }

    const result = await schoolService.updateSchoolProfile(targetSchoolId, req.body);

    res.status(200).json({
      success: true,
      message: 'School profile updated successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'A school with this name already exists') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Update Admin Profile
 * Updates admin user profile information
 * Requirements: 7.4
 */
const updateAdminProfile = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { schoolId } = req.body;
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
      const School = require('../models/School');
      const recentSchool = await School.findOne({ 
        isActive: true, 
        isVerified: true 
      }).sort({ createdAt: -1 });
      
      if (!recentSchool) {
        return res.status(404).json({
          success: false,
          message: 'No active school found'
        });
      }
      targetSchoolId = recentSchool.schoolId;
    }

    const result = await schoolService.updateAdminProfile(targetSchoolId, req.body);

    res.status(200).json({
      success: true,
      message: 'Admin profile updated successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Admin user not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Current password is required to change password' ||
        error.message === 'Current password is incorrect') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Change School Status
 * Activate or deactivate school (for system admin use)
 * Requirements: 7.4
 */
const changeSchoolStatus = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  try {
    const { schoolId, isActive, reason } = req.body;
    const action = isActive ? 'activate' : 'deactivate';
    
    // For now, use a placeholder admin user ID - in production this would come from auth middleware
    const adminUserId = '507f1f77bcf86cd799439011'; // Placeholder
    
    const result = await schoolService.changeSchoolStatus(schoolId, action, adminUserId, reason);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'School is already active' ||
        error.message === 'School is already inactive') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Invalid action. Must be "activate" or "deactivate"') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

module.exports = {
  getSchoolProfile,
  updateSchoolProfile,
  updateAdminProfile,
  changeSchoolStatus
};
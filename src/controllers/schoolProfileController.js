/**
 * School Profile Management Controller
 * Handles HTTP requests and delegates business logic to schoolService
 * Requirements: 7.4
 */

const schoolService = require('../services/schoolService');
const { prisma } = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Get School Profile
 * Retrieves complete school profile information for admin
 * Requirements: 7.4
 */
const getSchoolProfile = catchAsync(async (req, res) => {
  try {
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    const result = await schoolService.getSchoolProfile(targetSchoolId);

    // Get current academic year and term
    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: {
        schoolId: targetSchoolId,
        isCurrent: true
      },
      select: {
        id: true,
        year: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        isCurrent: true
      }
    });

    const currentTerm = await prisma.academicTerm.findFirst({
      where: {
        academicYearId: currentAcademicYear?.id,
        isCurrent: true
      },
      select: {
        id: true,
        name: true,
        academicYearId: true,
        startDate: true,
        endDate: true,
        isCurrent: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'School profile retrieved successfully',
      data: {
        school: result.school,
        currentAcademicYear: currentAcademicYear ? {
          id: currentAcademicYear.id,
          name: currentAcademicYear.name,
          startDate: currentAcademicYear.startDate.toISOString().split('T')[0],
          endDate: currentAcademicYear.endDate.toISOString().split('T')[0],
          expectedEndDate: currentAcademicYear.endDate.toISOString(),
          isActive: currentAcademicYear.isActive
        } : null,
        currentTerm: currentTerm ? {
          id: currentTerm.id,
          name: currentTerm.name,
          academicYearId: currentTerm.academicYearId,
          startDate: currentTerm.startDate.toISOString().split('T')[0],
          endDate: currentTerm.endDate.toISOString().split('T')[0],
          expectedEndDate: currentTerm.endDate.toISOString(),
          isCurrent: currentTerm.isCurrent
        } : null,
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
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
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
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
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
    const { isActive, reason } = req.body;
    const action = isActive ? 'activate' : 'deactivate';
    
    // Use authenticated user's schoolId from JWT token
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }
    
    // Find an actual admin user for this school instead of using hardcoded ID
    const adminUser = await prisma.user.findFirst({ 
      where: { 
        schoolId, 
        role: 'admin',
        isActive: true 
      } 
    });
    
    if (!adminUser) {
      return res.status(404).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }
    
    const result = await schoolService.changeSchoolStatus(schoolId, action, adminUser.id, reason);

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
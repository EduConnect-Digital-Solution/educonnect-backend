/**
 * Student Management Controller
 * Handles HTTP requests and delegates business logic to studentService
 * Requirements: 5.1, 5.2, 5.5
 */

const studentService = require('../services/studentService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Create Student Record
 * Creates a new student record with unique studentId
 * Requirements: 5.1
 */
const createStudent = catchAsync(async (req, res) => {
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

    const result = await studentService.createStudent(req.body, targetSchoolId);

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found or inactive') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'A student with this email already exists in your school' ||
        error.message === 'Roll number already exists in this class and section') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('parent IDs are invalid') || 
        error.message.includes('teacher IDs are invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Get Students List
 * Retrieves students with filtering and pagination
 * Requirements: 5.1, 5.2
 */
const getStudents = catchAsync(async (req, res) => {
  try {
    const { class: studentClass, section, status, page = 1, limit = 20, search } = req.query;
    
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Map status to isActive for service
    let isActive;
    if (status === 'active') {
      isActive = true;
    } else if (status === 'inactive') {
      isActive = false;
    }

    const filters = { 
      schoolId: targetSchoolId, 
      class: studentClass !== 'all' ? studentClass : undefined,
      section: section !== 'all' ? section : undefined,
      isActive,
      search 
    };
    const pagination = { page, limit };
    
    const result = await studentService.getStudents(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        ...result,
        filters: {
          class: studentClass || 'all',
          section: section || 'all',
          status: status || 'all',
          search: search || ''
        }
      }
    });
  } catch (error) {
    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Update Student Information
 * Updates student details with validation
 * Requirements: 5.2
 */
const updateStudent = catchAsync(async (req, res) => {
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
    const { studentId } = req.params;
    
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    const result = await studentService.updateStudent(studentId, req.body, targetSchoolId);

    res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Student not found or inactive') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'A student with this email already exists in your school' ||
        error.message === 'Roll number already exists in this class and section') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    if (error.message.includes('parent IDs are invalid') || 
        error.message.includes('teacher IDs are invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

/**
 * Toggle Student Status
 * Activate/deactivate students
 * Requirements: 5.5
 */
const toggleStudentStatus = catchAsync(async (req, res) => {
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
    const { studentId, action, reason } = req.body;
    
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Get admin user ID from JWT token
    const adminUserId = req.user.userId;

    let result;
    switch (action) {
      case 'activate':
        result = await studentService.activateStudent(studentId, targetSchoolId);
        break;
      case 'deactivate':
        result = await studentService.deactivateStudent(studentId, targetSchoolId, adminUserId, reason);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Must be "activate" or "deactivate"'
        });
    }

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Student not found or already inactive' ||
        error.message === 'Student not found or already active') {
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
 * Remove Student
 * Permanently remove a student record with data preservation
 * Requirements: 5.5
 */
const removeStudent = catchAsync(async (req, res) => {
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
    const { studentId, reason } = req.body;
    
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Get admin user ID from JWT token
    const adminUserId = req.user.userId;

    const result = await studentService.deleteStudent(studentId, targetSchoolId, adminUserId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        removedStudent: result.student,
        removedAt: new Date(),
        removedBy: {
          id: adminUserId,
          name: `${req.user.firstName || 'Admin'} ${req.user.lastName || 'User'}`,
          email: req.user.email
        },
        reason: reason || 'No reason provided'
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Student not found') {
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
 * Get Student Details
 * Get detailed information about a specific student
 * Requirements: 5.1, 5.2
 */
const getStudentDetails = catchAsync(async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Use authenticated user's schoolId from JWT token
    const targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    const result = await studentService.getStudentById(studentId, targetSchoolId);

    res.status(200).json({
      success: true,
      message: 'Student details retrieved successfully',
      data: result
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'Student not found') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    // Re-throw for global error handler
    throw error;
  }
});

module.exports = {
  createStudent,
  getStudents,
  updateStudent,
  toggleStudentStatus,
  removeStudent,
  getStudentDetails
};
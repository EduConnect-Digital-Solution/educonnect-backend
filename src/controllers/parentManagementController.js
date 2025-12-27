/**
 * Parent Management Controller
 * Handles HTTP requests and delegates business logic to parentService
 * Requirements: 4.4, 4.5
 */

const parentService = require('../services/parentService');
const invitationService = require('../services/invitationService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Invite Parent
 * Creates a parent invitation and sends invitation email
 * Requirements: 4.2, 4.3
 */
const inviteParent = catchAsync(async (req, res) => {
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

    // Get admin user for invitation tracking
    const User = require('../models/User');
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    const result = await invitationService.createParentInvitation(req.body, targetSchoolId, adminUser._id);

    res.status(201).json({
      success: true,
      message: 'Parent invitation sent successfully. User account created with temporary password.',
      data: {
        loginCredentials: {
          schoolId: targetSchoolId,
          email: result.user.email,
          temporaryPassword: result.temporaryPassword,
          children: result.students
        },
        invitation: result.invitation,
        emailSent: result.emailSent
      }
    });
  } catch (error) {
    // Handle specific business logic errors
    if (error.message === 'School not found or inactive') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'No admin user found for this school') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'At least one student ID is required for parent invitation' ||
        error.message === 'One or more student IDs are invalid or do not belong to this school') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    if (error.message === 'Active invitation already exists for this email') {
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
 * Get Parents List
 * Retrieves parents with filtering, pagination, and student relationships
 * Requirements: 4.4, 4.5
 */
const getParents = catchAsync(async (req, res) => {
  try {
    const { schoolId, status, page = 1, limit = 20, search, hasChildren } = req.query;
    
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

    // Map status to isActive for service
    let isActive;
    if (status === 'active') {
      isActive = true;
    } else if (status === 'inactive') {
      isActive = false;
    }

    const filters = { 
      schoolId: targetSchoolId, 
      search,
      isActive,
      hasChildren
    };
    const pagination = { page, limit };
    
    const result = await parentService.getParents(filters, pagination);

    res.status(200).json({
      success: true,
      message: 'Parents retrieved successfully',
      data: {
        ...result,
        filters: {
          status: status || 'all',
          hasChildren: hasChildren || 'all',
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
 * Get Parent Details
 * Get detailed information about a specific parent including children
 * Requirements: 4.4, 4.5
 */
const getParentDetails = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { schoolId } = req.query;
    
    // Import required models
    const User = require('../models/User');
    const School = require('../models/School');
    const mongoose = require('mongoose');
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parent ID format'
      });
    }
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
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

    // Find the parent with all relationships
    const parent = await User.findOne({
      _id: parentId,
      schoolId: targetSchoolId,
      role: 'parent'
    })
    .select('-password')
    .populate('children', 'firstName lastName studentId class section rollNumber grade dateOfBirth gender address phone isActive isEnrolled createdAt')
    .populate('invitedBy', 'firstName lastName email');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Parent details retrieved successfully',
      data: {
        parent: {
          id: parent._id,
          firstName: parent.firstName,
          lastName: parent.lastName,
          fullName: `${parent.firstName} ${parent.lastName}`,
          email: parent.email,
          phone: parent.phone,
          address: parent.address,
          occupation: parent.occupation,
          emergencyContact: parent.emergencyContact,
          emergencyPhone: parent.emergencyPhone,
          isActive: parent.isActive,
          isVerified: parent.isVerified,
          isTemporaryPassword: parent.isTemporaryPassword,
          lastLoginAt: parent.lastLoginAt,
          createdAt: parent.createdAt,
          updatedAt: parent.updatedAt,
          statusDisplay: parent.isActive ? 
            (parent.isTemporaryPassword ? 'Pending Registration' : 'Active') : 
            'Inactive',
          invitedBy: parent.invitedBy ? {
            name: `${parent.invitedBy.firstName} ${parent.invitedBy.lastName}`,
            email: parent.invitedBy.email
          } : null,
          children: parent.children.map(child => ({
            id: child._id,
            studentId: child.studentId,
            firstName: child.firstName,
            lastName: child.lastName,
            fullName: `${child.firstName} ${child.lastName}`,
            class: child.class,
            section: child.section,
            classDisplay: child.class && child.section ? `${child.class}-${child.section}` : child.class || 'Not Assigned',
            rollNumber: child.rollNumber,
            grade: child.grade,
            dateOfBirth: child.dateOfBirth,
            gender: child.gender,
            address: child.address,
            phone: child.phone,
            isActive: child.isActive,
            isEnrolled: child.isEnrolled,
            statusDisplay: child.isActive ? (child.isEnrolled ? 'Active' : 'Not Enrolled') : 'Inactive',
            createdAt: child.createdAt
          })),
          childrenCount: parent.children.length
        }
      }
    });

  } catch (error) {
    console.error('Get parent details error:', error);
    console.error('Error stack:', error.stack);
    console.error('Parent ID:', req.params.parentId);
    console.error('School ID:', req.query.schoolId);
    
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving parent details',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

/**
 * Link Parent to Students
 * Create parent-student relationships
 * Requirements: 4.4, 4.5
 */
const linkParentToStudents = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { parentId } = req.params;
    const { studentIds, schoolId } = req.body;
    
    // Import required models
    const User = require('../models/User');
    const Student = require('../models/Student');
    const School = require('../models/School');
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
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

    // Find the parent
    const parent = await User.findOne({
      _id: parentId,
      schoolId: targetSchoolId,
      role: 'parent'
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Validate all student IDs exist and belong to the same school
    const students = await Student.find({
      _id: { $in: studentIds },
      schoolId: targetSchoolId
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more student IDs are invalid or do not belong to this school'
      });
    }

    // Get admin user for tracking
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });

    // Add students to parent's children array (avoid duplicates)
    const newStudentIds = studentIds.filter(studentId => 
      !parent.children.some(childId => childId.toString() === studentId)
    );

    if (newStudentIds.length > 0) {
      parent.children.push(...newStudentIds);
      parent.updatedBy = adminUser?._id;
      await parent.save();

      // Add parent to students' parentIds array (avoid duplicates)
      await Student.updateMany(
        { 
          _id: { $in: newStudentIds },
          parentIds: { $ne: parentId }
        },
        { 
          $addToSet: { parentIds: parentId },
          $set: { updatedBy: adminUser?._id }
        }
      );
    }

    // Get updated parent with populated children
    const updatedParent = await User.findById(parentId)
      .select('-password')
      .populate('children', 'firstName lastName studentId class section isActive isEnrolled');

    res.status(200).json({
      success: true,
      message: `Parent linked to ${newStudentIds.length} new student(s) successfully`,
      data: {
        parent: {
          id: updatedParent._id,
          firstName: updatedParent.firstName,
          lastName: updatedParent.lastName,
          email: updatedParent.email,
          childrenCount: updatedParent.children.length,
          children: updatedParent.children.map(child => ({
            id: child._id,
            studentId: child.studentId,
            name: `${child.firstName} ${child.lastName}`,
            class: child.class,
            section: child.section,
            classDisplay: child.class && child.section ? `${child.class}-${child.section}` : child.class || 'Not Assigned',
            isActive: child.isActive,
            isEnrolled: child.isEnrolled
          }))
        },
        linkedStudents: newStudentIds.length,
        totalChildren: updatedParent.children.length
      }
    });

  } catch (error) {
    console.error('Link parent to students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while linking parent to students'
    });
  }
};

/**
 * Unlink Parent from Students
 * Remove parent-student relationships
 * Requirements: 4.4, 4.5
 */
const unlinkParentFromStudents = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { parentId } = req.params;
    const { studentIds, schoolId } = req.body;
    
    // Import required models
    const User = require('../models/User');
    const Student = require('../models/Student');
    const School = require('../models/School');
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
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

    // Find the parent
    const parent = await User.findOne({
      _id: parentId,
      schoolId: targetSchoolId,
      role: 'parent'
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get admin user for tracking
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });

    // Remove students from parent's children array
    parent.children = parent.children.filter(childId => 
      !studentIds.includes(childId.toString())
    );
    parent.updatedBy = adminUser?._id;
    await parent.save();

    // Remove parent from students' parentIds array
    await Student.updateMany(
      { _id: { $in: studentIds } },
      { 
        $pull: { parentIds: parentId },
        $set: { updatedBy: adminUser?._id }
      }
    );

    // Get updated parent with populated children
    const updatedParent = await User.findById(parentId)
      .select('-password')
      .populate('children', 'firstName lastName studentId class section isActive isEnrolled');

    res.status(200).json({
      success: true,
      message: `Parent unlinked from ${studentIds.length} student(s) successfully`,
      data: {
        parent: {
          id: updatedParent._id,
          firstName: updatedParent.firstName,
          lastName: updatedParent.lastName,
          email: updatedParent.email,
          childrenCount: updatedParent.children.length,
          children: updatedParent.children.map(child => ({
            id: child._id,
            studentId: child.studentId,
            name: `${child.firstName} ${child.lastName}`,
            class: child.class,
            section: child.section,
            classDisplay: child.class && child.section ? `${child.class}-${child.section}` : child.class || 'Not Assigned',
            isActive: child.isActive,
            isEnrolled: child.isEnrolled
          }))
        },
        unlinkedStudents: studentIds.length,
        remainingChildren: updatedParent.children.length
      }
    });

  } catch (error) {
    console.error('Unlink parent from students error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while unlinking parent from students'
    });
  }
};

/**
 * Remove Parent
 * Permanently remove a parent account with relationship cleanup
 * Requirements: 4.5
 */
const removeParent = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { parentId } = req.params;
    const { reason, schoolId } = req.body;
    
    // Import required models
    const User = require('../models/User');
    const Student = require('../models/Student');
    const School = require('../models/School');
    
    // Get school info
    let targetSchoolId = schoolId;
    if (!targetSchoolId) {
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

    // Find the parent
    const parent = await User.findOne({
      _id: parentId,
      schoolId: targetSchoolId,
      role: 'parent'
    }).populate('children', 'firstName lastName studentId');

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get admin user for tracking
    const adminUser = await User.findOne({ 
      schoolId: targetSchoolId, 
      role: 'admin' 
    });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    // Store parent info for response before deletion
    const parentInfo = {
      id: parent._id,
      firstName: parent.firstName,
      lastName: parent.lastName,
      fullName: `${parent.firstName} ${parent.lastName}`,
      email: parent.email,
      phone: parent.phone,
      isActive: parent.isActive,
      children: parent.children.map(child => ({
        id: child._id,
        studentId: child.studentId,
        name: `${child.firstName} ${child.lastName}`
      })),
      childrenCount: parent.children.length
    };

    // Remove parent from all students' parentIds arrays
    if (parent.children && parent.children.length > 0) {
      await Student.updateMany(
        { _id: { $in: parent.children } },
        { $pull: { parentIds: parent._id } }
      );
    }

    // Cancel any pending invitations for this parent
    const Invitation = require('../models/Invitation');
    await Invitation.updateMany(
      { 
        email: parent.email,
        schoolId: targetSchoolId,
        status: 'pending'
      },
      { 
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: adminUser._id,
        cancellationReason: `Parent removed: ${reason || 'Parent account deleted'}`
      }
    );

    // Remove the parent
    await User.findByIdAndDelete(parentId);

    res.status(200).json({
      success: true,
      message: 'Parent removed successfully',
      data: {
        removedParent: parentInfo,
        removedAt: new Date(),
        removedBy: {
          id: adminUser._id,
          name: `${adminUser.firstName} ${adminUser.lastName}`,
          email: adminUser.email
        },
        reason: reason || 'No reason provided',
        relationshipsCleanedUp: {
          studentsUnlinked: parentInfo.childrenCount,
          invitationsCancelled: true
        }
      }
    });

  } catch (error) {
    console.error('Remove parent error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while removing parent'
    });
  }
};

module.exports = {
  inviteParent,
  getParents,
  getParentDetails,
  linkParentToStudents,
  unlinkParentFromStudents,
  removeParent
};
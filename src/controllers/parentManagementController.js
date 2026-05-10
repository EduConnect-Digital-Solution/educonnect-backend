/**
 * Parent Management Controller
 * Handles HTTP requests and delegates business logic to parentService
 * Requirements: 4.4, 4.5
 */

const parentService = require('../services/parentService');
const invitationService = require('../services/invitationService');
const { prisma } = require('../config/database');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

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
    
    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Get admin user for invitation tracking
    const adminUser = await prisma.user.findFirst({ 
      where: { 
        schoolId: targetSchoolId, 
        role: 'admin' 
      } 
    });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    const result = await invitationService.createParentInvitation(req.body, targetSchoolId, adminUser.id);

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
    
    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;
    
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
    
    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Find the parent with all relationships using Prisma
    const parent = await prisma.user.findFirst({
      where: {
        id: parentId,
        schoolId: targetSchoolId,
        role: 'parent'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        occupation: true,
        emergencyContact: true,
        emergencyPhone: true,
        isActive: true,
        isVerified: true,
        isTemporaryPassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        invitedById: true,
        invitedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        parentOf: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                classId: true,
                section: true,
                rollNumber: true,
                grade: true,
                dateOfBirth: true,
                gender: true,
                address: true,
                phone: true,
                isActive: true,
                isEnrolled: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

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
          id: parent.id,
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
          children: parent.parentOf.map(pc => {
            const child = pc.student;
            return {
              id: child.id,
              studentId: child.studentId,
              firstName: child.firstName,
              lastName: child.lastName,
              fullName: `${child.firstName} ${child.lastName}`,
              classId: child.classId,
              armId: child.armId,
              section: child.section,
              classDisplay: child.classId ? `Class ID: ${child.classId}` : 'Not Assigned',
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
            };
          }),
          childrenCount: parent.parentOf.length
        }
      }
    });

  } catch (error) {
    logger.error('Get parent details error:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Parent ID:', req.params.parentId);
    
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
    const { studentIds } = req.body;
    
    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Find the parent
    const parent = await prisma.user.findFirst({
      where: {
        id: parentId,
        schoolId: targetSchoolId,
        role: 'parent'
      },
      include: {
        parentOf: {
          include: {
            student: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Validate all student IDs exist and belong to the same school
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId: targetSchoolId
      }
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more student IDs are invalid or do not belong to this school'
      });
    }

    // Get admin user for tracking
    const adminUser = await prisma.user.findFirst({ 
      where: { 
        schoolId: targetSchoolId, 
        role: 'admin' 
      } 
    });

    // Add students to parent's children array (avoid duplicates)
    const existingStudentIds = parent.parentOf.map(pc => pc.student.id);
    const newStudentIds = studentIds.filter(studentId => 
      !existingStudentIds.includes(studentId)
    );

    if (newStudentIds.length > 0) {
      // Create parent-child relationships
      await prisma.parentChild.createMany({
        data: newStudentIds.map(studentId => ({
          parentId: parentId,
          studentId: studentId,
          relationship: 'parent',
          isActive: true,
          createdById: adminUser?.id
        })),
        skipDuplicates: true
      });
    }

    // Get updated parent with populated children
    const updatedParent = await prisma.user.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        parentOf: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                classId: true,
                section: true,
                isActive: true,
                isEnrolled: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Parent linked to ${newStudentIds.length} new student(s) successfully`,
      data: {
        parent: {
          id: updatedParent.id,
          firstName: updatedParent.firstName,
          lastName: updatedParent.lastName,
          email: updatedParent.email,
          childrenCount: updatedParent.parentOf.length,
          children: updatedParent.parentOf.map(pc => ({
            id: pc.student.id,
            studentId: pc.student.studentId,
            name: `${pc.student.firstName} ${pc.student.lastName}`,
            classId: pc.student.classId,
            armId: pc.student.armId,
            section: pc.student.section,
            classDisplay: pc.student.classId ? `Class ID: ${pc.student.classId}` : 'Not Assigned',
            isActive: pc.student.isActive,
            isEnrolled: pc.student.isEnrolled
          }))
        },
        linkedStudents: newStudentIds.length,
        totalChildren: updatedParent.parentOf.length
      }
    });

  } catch (error) {
    logger.error('Link parent to students error:', error);
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
    const { studentIds } = req.body;
    
    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Find the parent
    const parent = await prisma.user.findFirst({
      where: {
        id: parentId,
        schoolId: targetSchoolId,
        role: 'parent'
      }
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get admin user for tracking
    const adminUser = await prisma.user.findFirst({ 
      where: { 
        schoolId: targetSchoolId, 
        role: 'admin' 
      } 
    });

    // Remove parent-child relationships
    await prisma.parentChild.deleteMany({
      where: {
        parentId: parentId,
        studentId: { in: studentIds }
      }
    });

    // Get updated parent with populated children
    const updatedParent = await prisma.user.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        parentOf: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                classId: true,
                armId: true,
                section: true,
                isActive: true,
                isEnrolled: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: `Parent unlinked from ${studentIds.length} student(s) successfully`,
      data: {
        parent: {
          id: updatedParent.id,
          firstName: updatedParent.firstName,
          lastName: updatedParent.lastName,
          email: updatedParent.email,
          childrenCount: updatedParent.parentOf.length,
          children: updatedParent.parentOf.map(pc => ({
            id: pc.student.id,
            studentId: pc.student.studentId,
            name: `${pc.student.firstName} ${pc.student.lastName}`,
            classId: pc.student.classId,
            armId: pc.student.armId,
            section: pc.student.section,
            classDisplay: pc.student.classId ? `Class ID: ${pc.student.classId}` : 'Not Assigned',
            isActive: pc.student.isActive,
            isEnrolled: pc.student.isEnrolled
          }))
        },
        unlinkedStudents: studentIds.length,
        remainingChildren: updatedParent.parentOf.length
      }
    });

  } catch (error) {
    logger.error('Unlink parent from students error:', error);
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
    const { reason } = req.body;
    
    // Use authenticated user's schoolId from JWT token
    let targetSchoolId = req.user.schoolId;
    
    if (!targetSchoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID not found in authentication token'
      });
    }

    // Find the parent with children
    const parent = await prisma.user.findFirst({
      where: {
        id: parentId,
        schoolId: targetSchoolId,
        role: 'parent'
      },
      include: {
        parentOf: {
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Get admin user for tracking
    const adminUser = await prisma.user.findFirst({ 
      where: { 
        schoolId: targetSchoolId, 
        role: 'admin' 
      } 
    });

    if (!adminUser) {
      return res.status(400).json({
        success: false,
        message: 'No admin user found for this school'
      });
    }

    // Store parent info for response before deletion
    const parentInfo = {
      id: parent.id,
      firstName: parent.firstName,
      lastName: parent.lastName,
      fullName: `${parent.firstName} ${parent.lastName}`,
      email: parent.email,
      phone: parent.phone,
      isActive: parent.isActive,
      children: parent.parentOf.map(pc => ({
        id: pc.student.id,
        studentId: pc.student.studentId,
        name: `${pc.student.firstName} ${pc.student.lastName}`
      })),
      childrenCount: parent.parentOf.length
    };

    // Remove parent from all students' parentIds arrays (delete parentChild records)
    if (parent.parentOf && parent.parentOf.length > 0) {
      await prisma.parentChild.deleteMany({
        where: {
          parentId: parentId
        }
      });
    }

    // Cancel any pending invitations for this parent
    await prisma.invitation.updateMany({
      where: { 
        email: parent.email,
        schoolId: targetSchoolId,
        status: 'pending'
      },
      data: { 
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledById: adminUser.id,
        cancellationReason: `Parent removed: ${reason || 'Parent account deleted'}`
      }
    });

    // Remove the parent
    await prisma.user.delete({
      where: { id: parentId }
    });

    res.status(200).json({
      success: true,
      message: 'Parent removed successfully',
      data: {
        removedParent: parentInfo,
        removedAt: new Date(),
        removedBy: {
          id: adminUser.id,
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
    logger.error('Remove parent error:', error);
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
/**
 * Parent Service
 * Centralized business logic for parent management operations
 * Enhanced with Redis caching for optimal performance
 */

const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Get Parents Service
 * Retrieves parents with filtering and pagination
 */
const getParents = async (filters, pagination) => {
  const { schoolId, search, isActive } = filters;
  const { page = 1, limit = 10 } = pagination;

  // Create cache key based on query parameters
  const cacheKey = `parents:${schoolId}:${isActive || 'all'}:${page}:${limit}:${search || 'none'}`;

  // Try cache first
  const cachedData = await CacheService.get('parent', cacheKey);
  if (cachedData) {
    logger.info(`👨‍👩‍👧‍👦 Parent list cache HIT for ${cacheKey}`);
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: cachedData.generatedAt
    };
  }

  logger.info(`👨‍👩‍👧‍👦 Parent list cache MISS for ${cacheKey} - querying database`);

  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  // Build where clause
  const where = {
    schoolId: school.id,
    role: 'parent'
  };
  if (isActive !== undefined) where.isActive = isActive;

  // Add search functionality
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get parents with included data
  const [parents, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        parentStudents: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentId: true,
                classId: true,
                armId: true,
                arm: { select: { name: true } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit)
    }),
    prisma.user.count({ where })
  ]);

  // Format response
  const formattedParents = parents.map(parent => ({
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
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
    children: parent.parentStudents
      .filter(ps => ps.student)
      .map(ps => ({
        id: ps.student.id,
        name: `${ps.student.firstName} ${ps.student.lastName}`,
        studentId: ps.student.studentId,
        classId: ps.student.classId,
        armId: ps.student.armId
      }))
  }));

  const parentData = {
    parents: formattedParents,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    },
    summary: {
      total,
      active: await prisma.user.count({ where: { ...where, isActive: true } }),
      inactive: await prisma.user.count({ where: { ...where, isActive: false } })
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache parent data for 5 minutes (shorter TTL due to frequent updates)
  await CacheService.set('parent', cacheKey, parentData, 300);
  logger.info(`👨‍👩‍👧‍👦 Parent list cached for ${cacheKey}`);

  return parentData;
};

/**
 * Get Parent by ID Service
 * Retrieves a single parent by ID with detailed information
 */
const getParentById = async (parentId, schoolId) => {
  // Try to get cached parent data first
  const cacheKey = `parent:${parentId}`;
  const cachedParent = await CacheService.get('parent', cacheKey);

  if (cachedParent) {
    logger.info(`👨‍👩‍👧‍👦 Parent cache HIT for ${parentId}`);
    return {
      ...cachedParent,
      cached: true,
      cacheTimestamp: cachedParent.generatedAt
    };
  }

  logger.info(`👨‍👩‍👧‍👦 Parent cache MISS for ${parentId} - fetching from database`);

  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: (await prisma.school.findFirst({ where: { id: schoolId } }) || await prisma.school.findFirst({ where: { schoolId: schoolId } }))?.id,
      role: 'parent'
    },
    include: {
      parentStudents: {
        include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentId: true,
                classId: true,
                armId: true,
                grade: true,
                dateOfBirth: true,
                gender: true,
                arm: { select: { name: true } }
              }
          }
        }
      }
    }
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  const parentData = {
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
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      children: parent.parentStudents
        .filter(ps => ps.student)
        .map(ps => ({
          id: ps.student.id,
          name: `${ps.student.firstName} ${ps.student.lastName}`,
          studentId: ps.student.studentId,
          classId: ps.student.classId,
        armId: ps.student.armId,
          grade: ps.student.grade,
          dateOfBirth: ps.student.dateOfBirth,
          gender: ps.student.gender
        }))
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache parent data for 15 minutes
  await CacheService.set('parent', cacheKey, parentData, 900);
  logger.info(`👨‍👩‍👧‍👦 Parent data cached for ${parentId}`);

  return parentData;
};

/**
 * Update Parent Service
 * Updates parent information
 */
const updateParent = async (parentId, updateData, schoolId) => {
  const {
    firstName,
    lastName,
    phone,
    address,
    occupation,
    emergencyContact,
    emergencyPhone
  } = updateData;

  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  // Find the parent
  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: school.id,
      role: 'parent'
    }
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  // Build update data
  const updateFields = {};
  if (firstName !== undefined) updateFields.firstName = firstName;
  if (lastName !== undefined) updateFields.lastName = lastName;
  if (phone !== undefined) updateFields.phone = phone;
  if (address !== undefined) updateFields.address = address;
  if (occupation !== undefined) updateFields.occupation = occupation;
  if (emergencyContact !== undefined) updateFields.emergencyContact = emergencyContact;
  if (emergencyPhone !== undefined) updateFields.emergencyPhone = emergencyPhone;
  updateFields.updatedAt = new Date();

  // Update parent record
  const updatedParent = await prisma.user.update({
    where: { id: parentId },
    data: updateFields,
    include: {
      parentStudents: {
        include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                studentId: true,
                classId: true,
                armId: true,
                arm: { select: { name: true } }
              }
          }
        }
      }
    }
  });

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: updatedParent.id,
      firstName: updatedParent.firstName,
      lastName: updatedParent.lastName,
      fullName: `${updatedParent.firstName} ${updatedParent.lastName}`,
      email: updatedParent.email,
      phone: updatedParent.phone,
      address: updatedParent.address,
      occupation: updatedParent.occupation,
      emergencyContact: updatedParent.emergencyContact,
      emergencyPhone: updatedParent.emergencyPhone,
      isActive: updatedParent.isActive,
      isVerified: updatedParent.isVerified,
      updatedAt: updatedParent.updatedAt,
      children: updatedParent.parentStudents
        .filter(ps => ps.student)
        .map(ps => ({
          id: ps.student.id,
          name: `${ps.student.firstName} ${ps.student.lastName}`,
          studentId: ps.student.studentId,
          classId: ps.student.classId,
        armId: ps.student.armId
        }))
    }
  };
};

/**
 * Link Parent to Student Service
 * Creates a relationship between parent and student
 */
const linkParentToStudent = async (parentId, studentId, schoolId) => {
  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  // Verify parent exists
  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: school.id,
      role: 'parent',
      isActive: true
    }
  });

  if (!parent) {
    throw new Error('Parent not found or inactive');
  }

  // Verify student exists
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: school.id,
      isActive: true
    },
    include: {
      arm: { select: { name: true } }
    }
  });

  if (!student) {
    throw new Error('Student not found or inactive');
  }

  // Check if relationship already exists
  const existingRelation = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: {
        parentId,
        studentId
      }
    }
  });

  if (existingRelation) {
    throw new Error('Parent is already linked to this student');
  }

  // Create relationship
  await prisma.parentStudent.create({
    data: {
      parentId,
      studentId
    }
  });

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent.id,
      name: `${parent.firstName} ${parent.lastName}`,
      email: parent.email
    },
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      classId: student.classId
    },
    message: 'Parent linked to student successfully'
  };
};

/**
 * Unlink Parent from Student Service
 * Removes the relationship between parent and student
 */
const unlinkParentFromStudent = async (parentId, studentId, schoolId) => {
  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  // Verify parent exists
  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: school.id,
      role: 'parent'
    }
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  // Verify student exists
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: school.id
    },
    include: {
      arm: { select: { name: true } }
    }
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // Remove relationship
  await prisma.parentStudent.delete({
    where: {
      parentId_studentId: {
        parentId,
        studentId
      }
    }
  });

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent.id,
      name: `${parent.firstName} ${parent.lastName}`,
      email: parent.email
    },
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      classId: student.classId
    },
    message: 'Parent unlinked from student successfully'
  };
};

/**
 * Deactivate Parent Service
 * Deactivates a parent account (soft delete)
 */
const deactivateParent = async (parentId, schoolId, adminUserId, reason) => {
  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: school.id,
      role: 'parent',
      isActive: true
    }
  });

  if (!parent) {
    throw new Error('Parent not found or already inactive');
  }

  // Update parent record
  const updatedParent = await prisma.user.update({
    where: { id: parentId },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  });

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: updatedParent.id,
      firstName: updatedParent.firstName,
      lastName: updatedParent.lastName,
      email: updatedParent.email,
      isActive: updatedParent.isActive
    },
    message: 'Parent deactivated successfully'
  };
};

/**
 * Activate Parent Service
 * Reactivates a deactivated parent account
 */
const activateParent = async (parentId, schoolId) => {
  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: school.id,
      role: 'parent',
      isActive: false
    }
  });

  if (!parent) {
    throw new Error('Parent not found or already active');
  }

  // Update parent record
  const updatedParent = await prisma.user.update({
    where: { id: parentId },
    data: {
      isActive: true,
      updatedAt: new Date()
    }
  });

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: updatedParent.id,
      firstName: updatedParent.firstName,
      lastName: updatedParent.lastName,
      email: updatedParent.email,
      isActive: updatedParent.isActive,
      updatedAt: updatedParent.updatedAt
    },
    message: 'Parent activated successfully'
  };
};

/**
 * Delete Parent Service
 * Permanently deletes a parent account (hard delete)
 */
const deleteParent = async (parentId, schoolId, adminUserId) => {
  // Get school
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId }
  });

  // If not found by UUID, try human-readable schoolId
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId }
    });
  }
  if (!school) {
    throw new Error('School not found');
  }

  const parent = await prisma.user.findFirst({
    where: {
      id: parentId,
      schoolId: school.id,
      role: 'parent'
    }
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  // Remove parent from all linked students (delete from junction table)
  await prisma.parentStudent.deleteMany({
    where: { parentId }
  });

  // Delete the parent record
  await prisma.user.delete({
    where: { id: parentId }
  });

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent.id,
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email
    },
    message: 'Parent deleted permanently'
  };
};

/**
 * Invalidate parent-related caches
 * @param {string} schoolId - School identifier
 * @param {string} parentId - Parent identifier (optional)
 */
const invalidateParentCaches = async (schoolId, parentId = null) => {
  logger.info(`🗑️ Invalidating parent caches for school ${schoolId}${parentId ? ` and parent ${parentId}` : ''}`);

  // Invalidate specific parent cache if parentId provided
  if (parentId) {
    await CacheService.del('parent', `parent:${parentId}`);
  }

  // Invalidate parent list caches (all variations)
  const parentListPattern = `educonnect:parent:parents:${schoolId}*`;
  const deletedCount = await CacheService.delPattern(parentListPattern);

  // Invalidate dashboard caches that depend on parent data
  const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
  const dashboardDeleted = await CacheService.delPattern(dashboardPattern);

  logger.info(`🗑️ Invalidated ${deletedCount} parent list entries and ${dashboardDeleted} dashboard entries for school ${schoolId}`);
};

/**
 * Warm up parent caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpParentCaches = async (schoolId) => {
  logger.info(`🔥 Warming up parent caches for school ${schoolId}`);

  try {
    // Pre-load common parent views
    await getParents({ schoolId, isActive: true }, { page: 1, limit: 20 });
    await getParents({ schoolId }, { page: 1, limit: 20 });

    logger.info(`🔥 Parent caches warmed up successfully for school ${schoolId}`);
  } catch (error) {
    logger.error(`❌ Failed to warm up parent caches for school ${schoolId}:`, error.message);
  }
};

module.exports = {
  getParents,
  getParentById,
  updateParent,
  linkParentToStudent,
  unlinkParentFromStudent,
  deactivateParent,
  activateParent,
  deleteParent,
  invalidateParentCaches,
  warmUpParentCaches
};

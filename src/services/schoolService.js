/**
 * School Service
 * Centralized business logic for school profile management operations
 * Enhanced with Redis caching for optimal performance
 * Rewritten to use Prisma instead of Mongoose
 */

const { prisma } = require('../config/database');
const bcrypt = require('bcrypt');
const CacheService = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Get School Profile Service
 * Retrieves complete school profile information
 */
const getSchoolProfile = async (schoolId) => {
  const cacheKey = `profile:${schoolId}`;
  const cachedProfile = await CacheService.get('school', cacheKey);

  if (cachedProfile) {
    logger.info(`🏫 School profile cache HIT for ${schoolId}`);
    return {
      ...cachedProfile,
      cached: true,
      cacheTimestamp: cachedProfile.generatedAt
    };
  }

  logger.info(`🏫 School profile cache MISS for ${schoolId} - fetching from database`);

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

  // Use school.id (UUID) for user/student lookups
  const adminUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'admin' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      profileImage: true,
      createdAt: true,
      lastLoginAt: true
    }
  });

  if (!adminUser) {
    logger.warn(`No admin user found for school ${school.schoolId} - profile will have null admin section`);
  }

  // Use school.id (UUID) for user/student lookups
  const totalStudents = await prisma.student.count({ where: { schoolId: school.id, isActive: true } });
  const totalTeachers = await prisma.user.count({ where: { schoolId: school.id, role: 'teacher', isActive: true } });
  const totalParents = await prisma.user.count({ where: { schoolId: school.id, role: 'parent', isActive: true } });
  const inactiveStudents = await prisma.student.count({ where: { schoolId: school.id, isActive: false } });

  const profileData = {
    school: {
      id: school.id,
      schoolId: school.id,
      schoolName: school.schoolName,
      email: school.email,
      phone: school.phone,
      address: school.address,
      website: school.website,
      description: school.description,
      schoolType: school.schoolType,
      principalName: school.principalName,
      isActive: school.isActive,
      isVerified: school.isVerified,
      systemConfig: school.systemConfig || {},
      systemMetadata: school.systemMetadata || {},
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    },
    admin: adminUser ? {
      id: adminUser.id,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      email: adminUser.email,
      phone: adminUser.phone,
      role: adminUser.role,
      isActive: adminUser.isActive,
      profileImage: adminUser.profileImage,
      createdAt: adminUser.createdAt,
      lastLoginAt: adminUser.lastLoginAt
    } : null,
    statistics: {
      totalStudents,
      totalTeachers,
      totalParents,
      inactiveStudents,
      totalUsers: totalTeachers + totalParents + 1
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  await CacheService.set('school', cacheKey, profileData, 1800);
  logger.info(`🏫 School profile cached for ${schoolId}`);

  return profileData;
};

/**
 * Update School Profile Service
 * Updates school profile information
 */
const updateSchoolProfile = async (schoolId, updateData) => {
  const {
    schoolName,
    phone,
    address,
    website,
    description,
    schoolType,
    systemConfig,
    systemMetadata
  } = updateData;

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

  if (schoolName && schoolName !== school.schoolName) {
    const existingSchool = await prisma.school.findFirst({
      where: {
        schoolName: schoolName.trim(),
        NOT: { id: school.id }
      }
    });

    if (existingSchool) {
      throw new Error('A school with this name already exists');
    }
  }

  const updateFields = {};
  if (schoolName !== undefined) updateFields.schoolName = schoolName.trim();
  if (phone !== undefined) updateFields.phone = phone.trim();
  if (address !== undefined) updateFields.address = address.trim();
  if (website !== undefined) updateFields.website = website.trim();
  if (description !== undefined) updateFields.description = description.trim();
  if (schoolType !== undefined) updateFields.schoolType = schoolType;
  if (systemConfig !== undefined) updateFields.systemConfig = { ...(school.systemConfig || {}), ...systemConfig };
  if (systemMetadata !== undefined) updateFields.systemMetadata = { ...(school.systemMetadata || {}), ...systemMetadata };
  updateFields.updatedAt = new Date();

  const updatedSchool = await prisma.school.update({
    where: { id: school.id },
    data: updateFields
  });

  await invalidateSchoolCaches(schoolId);

  return {
    school: {
      id: updatedSchool.id,
      schoolId: updatedSchool.schoolId,
      schoolName: updatedSchool.schoolName,
      email: updatedSchool.email,
      phone: updatedSchool.phone,
      address: updatedSchool.address,
      website: updatedSchool.website,
      description: updatedSchool.description,
      schoolType: updatedSchool.schoolType,
      principalName: updatedSchool.principalName,
      systemConfig: updatedSchool.systemConfig || {},
      systemMetadata: updatedSchool.systemMetadata || {},
      isActive: updatedSchool.isActive,
      isVerified: updatedSchool.isVerified,
      updatedAt: updatedSchool.updatedAt
    }
  };
};

/**
 * Update Admin Profile Service
 * Updates admin user profile information
 */
const updateAdminProfile = async (schoolId, updateData) => {
  const {
    firstName,
    lastName,
    phone,
    currentPassword,
    newPassword
  } = updateData;

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

  // Use school.id (UUID) for user lookup (user.schoolId is UUID)
  const adminUser = await prisma.user.findFirst({
    where: { schoolId: school.id, role: 'admin' }
  });

  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to change password');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, adminUser.password);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }
  }

  const updateFields = {};
  if (firstName !== undefined) updateFields.firstName = firstName.trim();
  if (lastName !== undefined) updateFields.lastName = lastName.trim();
  if (phone !== undefined) updateFields.phone = phone.trim();
  if (updateData.profileImage !== undefined) updateFields.profileImage = updateData.profileImage;
  if (newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    updateFields.password = hashedPassword;
  }
  updateFields.updatedAt = new Date();

  await prisma.user.update({
    where: { id: adminUser.id },
    data: updateFields
  });

  const updatedAdmin = await prisma.user.findUnique({
    where: { id: adminUser.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      profileImage: true,
      updatedAt: true
    }
  });

  await invalidateSchoolCaches(schoolId);

  return {
    admin: {
      id: updatedAdmin.id,
      firstName: updatedAdmin.firstName,
      lastName: updatedAdmin.lastName,
      email: updatedAdmin.email,
      phone: updatedAdmin.phone,
      role: updatedAdmin.role,
      isActive: updatedAdmin.isActive,
      profileImage: updatedAdmin.profileImage,
      updatedAt: updatedAdmin.updatedAt
    }
  };
};

/**
 * Change School Status Service
 * Activates or deactivates a school
 */
const changeSchoolStatus = async (schoolId, action, adminUserId, reason) => {
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

  const adminUser = await prisma.user.findUnique({ where: { id: adminUserId } });
  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  let updateFields = {};
  let message = '';

  switch (action) {
    case 'activate':
      if (school.isActive) {
        throw new Error('School is already active');
      }
      updateFields.isActive = true;
      message = 'School activated successfully';
      break;
    case 'deactivate':
      if (!school.isActive) {
        throw new Error('School is already inactive');
      }
      updateFields.isActive = false;
      message = 'School deactivated successfully';
      break;
    default:
      throw new Error('Invalid action. Must be "activate" or "deactivate"');
  }

  updateFields.updatedAt = new Date();

  const updatedSchool = await prisma.school.update({
    where: { id: school.id },
    data: updateFields
  });

  await invalidateSchoolCaches(schoolId);

  return {
    school: {
      id: updatedSchool.id,
      schoolId: updatedSchool.schoolId,
      schoolName: updatedSchool.schoolName,
      isActive: updatedSchool.isActive,
      updatedAt: updatedSchool.updatedAt
    },
    message
  };
};

/**
 * Get School Statistics Service
 * Retrieves detailed school statistics
 */
const getSchoolStatistics = async (schoolId) => {
  const cacheKey = `statistics:${schoolId}`;
  const cachedStats = await CacheService.get('school', cacheKey);

  if (cachedStats) {
    logger.info(`📊 School statistics cache HIT for ${schoolId}`);
    return {
      ...cachedStats,
      cached: true,
      cacheTimestamp: cachedStats.generatedAt
    };
  }

  logger.info(`📊 School statistics cache MISS for ${schoolId} - generating fresh data`);

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

  const [
    totalStudents,
    activeStudents,
    inactiveStudents,
    totalTeachers,
    activeTeachers,
    totalParents,
    activeParents,
    studentsPerGrade,
    studentsPerClass
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.student.count({ where: { schoolId, isActive: false } }),
    prisma.user.count({ where: { schoolId, role: 'teacher' } }),
    prisma.user.count({ where: { schoolId, role: 'teacher', isActive: true } }),
    prisma.user.count({ where: { schoolId, role: 'parent' } }),
    prisma.user.count({ where: { schoolId, role: 'parent', isActive: true } }),
    prisma.student.groupBy({
      by: ['grade'],
      where: { schoolId, isActive: true },
      _count: { grade: true }
    }).then(results => 
      results
        .map(item => ({ grade: item.grade, count: item._count.grade }))
        .sort((a, b) => (a.grade || '').localeCompare(b.grade || ''))
    ),
    prisma.student.groupBy({
      by: ['grade', 'class'],
      where: { schoolId, isActive: true },
      _count: { id: true }
    }).then(results => 
      results
        .map(item => ({ grade: item.grade, class: item.class, count: item._count.id }))
        .sort((a, b) => 
          (a.grade || '').localeCompare(b.grade || '') || 
          (a.class || '').localeCompare(b.class || '')
        )
    )
  ]);

  const statisticsData = {
    students: {
      total: totalStudents,
      active: activeStudents,
      inactive: inactiveStudents,
      byGrade: studentsPerGrade,
      byClass: studentsPerClass
    },
    teachers: {
      total: totalTeachers,
      active: activeTeachers,
      inactive: totalTeachers - activeTeachers
    },
    parents: {
      total: totalParents,
      active: activeParents,
      inactive: totalParents - activeParents
    },
    overview: {
      totalUsers: totalTeachers + totalParents + 1,
      activeUsers: activeTeachers + activeParents + 1,
      totalStudents: activeStudents
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  await CacheService.set('school', cacheKey, statisticsData, 600);
  logger.info(`📊 School statistics cached for ${schoolId}`);

  return statisticsData;
};

/**
 * Invalidate all school-related caches
 * @param {string} schoolId - School identifier
 */
const invalidateSchoolCaches = async (schoolId) => {
  logger.info(`🗑️ Invalidating school caches for ${schoolId}`);

  await CacheService.del('school', `profile:${schoolId}`);
  await CacheService.del('school', `statistics:${schoolId}`);

  const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
  const deletedCount = await CacheService.delPattern(dashboardPattern);

  logger.info(`🗑️ Invalidated school caches and ${deletedCount} related dashboard entries for ${schoolId}`);
};

/**
 * Warm up school caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpSchoolCaches = async (schoolId) => {
  logger.info(`🔥 Warming up school caches for ${schoolId}`);

  try {
    await getSchoolProfile(schoolId);
    await getSchoolStatistics(schoolId);
    logger.info(`🔥 School caches warmed up successfully for ${schoolId}`);
  } catch (error) {
    logger.error(`❌ Failed to warm up school caches for ${schoolId}:`, error.message);
  }
};

module.exports = {
  getSchoolProfile,
  updateSchoolProfile,
  updateAdminProfile,
  changeSchoolStatus,
  getSchoolStatistics,
  invalidateSchoolCaches,
  warmUpSchoolCaches
};

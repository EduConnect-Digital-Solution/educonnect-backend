/**
 * School Service
 * Centralized business logic for school profile management operations
 * Enhanced with Redis caching for optimal performance
 */

const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const CacheService = require('./cacheService');

/**
 * Get School Profile Service
 * Retrieves complete school profile information
 */
const getSchoolProfile = async (schoolId) => {
  // Try to get cached school profile first
  const cacheKey = `profile:${schoolId}`;
  const cachedProfile = await CacheService.get('school', cacheKey);
  
  if (cachedProfile) {
    console.log(`🏫 School profile cache HIT for ${schoolId}`);
    return {
      ...cachedProfile,
      cached: true,
      cacheTimestamp: cachedProfile.generatedAt
    };
  }

  console.log(`🏫 School profile cache MISS for ${schoolId} - fetching from database`);

  // Find the school
  const school = await School.findOne({ schoolId });
  if (!school) {
    throw new Error('School not found');
  }

  // Get admin user information
  const adminUser = await User.findOne({ 
    schoolId, 
    role: 'admin' 
  }).select('-password');

  if (!adminUser) {
    throw new Error('Admin user not found for this school');
  }

  // Get school statistics
  const totalStudents = await Student.countDocuments({ schoolId, isActive: true });
  const totalTeachers = await User.countDocuments({ schoolId, role: 'teacher', isActive: true });
  const totalParents = await User.countDocuments({ schoolId, role: 'parent', isActive: true });
  const inactiveStudents = await Student.countDocuments({ schoolId, isActive: false });

  const profileData = {
    school: {
      id: school._id,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email,
      phone: school.phone,
      address: school.address,
      website: school.website,
      description: school.description,
      establishedYear: school.establishedYear,
      schoolType: school.schoolType,
      board: school.board,
      grades: school.grades,
      isActive: school.isActive,
      isVerified: school.isVerified,
      verifiedAt: school.verifiedAt,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt,
      // School settings
      settings: school.settings || {},
      // Academic information
      academicYear: school.academicYear,
      terms: school.terms || [],
      holidays: school.holidays || []
    },
    admin: {
      id: adminUser._id,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      email: adminUser.email,
      phone: adminUser.phone,
      role: adminUser.role,
      isActive: adminUser.isActive,
      createdAt: adminUser.createdAt,
      lastLoginAt: adminUser.lastLoginAt
    },
    statistics: {
      totalStudents,
      totalTeachers,
      totalParents,
      inactiveStudents,
      totalUsers: totalTeachers + totalParents + 1 // +1 for admin
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache the school profile for 30 minutes
  await CacheService.set('school', cacheKey, profileData, 1800);
  console.log(`🏫 School profile cached for ${schoolId}`);

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
    establishedYear,
    schoolType,
    board,
    grades,
    academicYear,
    terms,
    holidays,
    settings
  } = updateData;

  // Find the school
  const school = await School.findOne({ schoolId });
  if (!school) {
    throw new Error('School not found');
  }

  // Check if school name is being changed and if it already exists
  if (schoolName && schoolName !== school.schoolName) {
    const existingSchool = await School.findOne({
      schoolName: schoolName.trim(),
      schoolId: { $ne: schoolId }
    });

    if (existingSchool) {
      throw new Error('A school with this name already exists');
    }
  }

  // Prepare update fields
  const updateFields = {};
  if (schoolName !== undefined) updateFields.schoolName = schoolName.trim();
  if (phone !== undefined) updateFields.phone = phone.trim();
  if (address !== undefined) updateFields.address = address.trim();
  if (website !== undefined) updateFields.website = website.trim();
  if (description !== undefined) updateFields.description = description.trim();
  if (establishedYear !== undefined) updateFields.establishedYear = establishedYear;
  if (schoolType !== undefined) updateFields.schoolType = schoolType;
  if (board !== undefined) updateFields.board = board;
  if (grades !== undefined) updateFields.grades = grades;
  if (academicYear !== undefined) updateFields.academicYear = academicYear;
  if (terms !== undefined) updateFields.terms = terms;
  if (holidays !== undefined) updateFields.holidays = holidays;
  if (settings !== undefined) updateFields.settings = { ...school.settings, ...settings };
  updateFields.updatedAt = new Date();

  // Update the school
  const updatedSchool = await School.findOneAndUpdate(
    { schoolId },
    updateFields,
    { new: true, runValidators: true }
  );

  // Invalidate school-related caches
  await invalidateSchoolCaches(schoolId);

  return {
    school: {
      id: updatedSchool._id,
      schoolId: updatedSchool.schoolId,
      schoolName: updatedSchool.schoolName,
      email: updatedSchool.email,
      phone: updatedSchool.phone,
      address: updatedSchool.address,
      website: updatedSchool.website,
      description: updatedSchool.description,
      establishedYear: updatedSchool.establishedYear,
      schoolType: updatedSchool.schoolType,
      board: updatedSchool.board,
      grades: updatedSchool.grades,
      academicYear: updatedSchool.academicYear,
      terms: updatedSchool.terms,
      holidays: updatedSchool.holidays,
      settings: updatedSchool.settings,
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

  // Find the admin user
  const adminUser = await User.findOne({ 
    schoolId, 
    role: 'admin' 
  });

  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  // If password change is requested, verify current password
  if (newPassword) {
    if (!currentPassword) {
      throw new Error('Current password is required to change password');
    }

    const isCurrentPasswordValid = await adminUser.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }
  }

  // Prepare update fields
  const updateFields = {};
  if (firstName !== undefined) updateFields.firstName = firstName.trim();
  if (lastName !== undefined) updateFields.lastName = lastName.trim();
  if (phone !== undefined) updateFields.phone = phone.trim();
  if (newPassword) updateFields.password = newPassword; // Will be hashed by pre-save middleware
  updateFields.updatedAt = new Date();

  // Update the admin user
  const updatedAdmin = await User.findByIdAndUpdate(
    adminUser._id,
    updateFields,
    { new: true, runValidators: true }
  ).select('-password');

  // Invalidate school-related caches (admin info is part of school profile)
  await invalidateSchoolCaches(schoolId);

  return {
    admin: {
      id: updatedAdmin._id,
      firstName: updatedAdmin.firstName,
      lastName: updatedAdmin.lastName,
      email: updatedAdmin.email,
      phone: updatedAdmin.phone,
      role: updatedAdmin.role,
      isActive: updatedAdmin.isActive,
      updatedAt: updatedAdmin.updatedAt
    }
  };
};

/**
 * Change School Status Service
 * Activates or deactivates a school
 */
const changeSchoolStatus = async (schoolId, action, adminUserId, reason) => {
  // Find the school
  const school = await School.findOne({ schoolId });
  if (!school) {
    throw new Error('School not found');
  }

  // Find the admin user for tracking
  const adminUser = await User.findById(adminUserId);
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
      updateFields.activatedAt = new Date();
      updateFields.activatedBy = adminUserId;
      updateFields.deactivatedAt = undefined;
      updateFields.deactivatedBy = undefined;
      updateFields.deactivationReason = undefined;
      message = 'School activated successfully';
      break;

    case 'deactivate':
      if (!school.isActive) {
        throw new Error('School is already inactive');
      }
      updateFields.isActive = false;
      updateFields.deactivatedAt = new Date();
      updateFields.deactivatedBy = adminUserId;
      updateFields.deactivationReason = reason || 'Deactivated by administrator';
      message = 'School deactivated successfully';
      break;

    default:
      throw new Error('Invalid action. Must be "activate" or "deactivate"');
  }

  updateFields.updatedAt = new Date();

  // Update the school
  const updatedSchool = await School.findOneAndUpdate(
    { schoolId },
    updateFields,
    { new: true }
  );

  // Invalidate school-related caches
  await invalidateSchoolCaches(schoolId);

  return {
    school: {
      id: updatedSchool._id,
      schoolId: updatedSchool.schoolId,
      schoolName: updatedSchool.schoolName,
      isActive: updatedSchool.isActive,
      activatedAt: updatedSchool.activatedAt,
      deactivatedAt: updatedSchool.deactivatedAt,
      deactivationReason: updatedSchool.deactivationReason,
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
  // Try to get cached statistics first
  const cacheKey = `statistics:${schoolId}`;
  const cachedStats = await CacheService.get('school', cacheKey);
  
  if (cachedStats) {
    console.log(`📊 School statistics cache HIT for ${schoolId}`);
    return {
      ...cachedStats,
      cached: true,
      cacheTimestamp: cachedStats.generatedAt
    };
  }

  console.log(`📊 School statistics cache MISS for ${schoolId} - generating fresh data`);

  // Verify school exists
  const school = await School.findOne({ schoolId });
  if (!school) {
    throw new Error('School not found');
  }

  // Get detailed statistics
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
    Student.countDocuments({ schoolId }),
    Student.countDocuments({ schoolId, isActive: true }),
    Student.countDocuments({ schoolId, isActive: false }),
    User.countDocuments({ schoolId, role: 'teacher' }),
    User.countDocuments({ schoolId, role: 'teacher', isActive: true }),
    User.countDocuments({ schoolId, role: 'parent' }),
    User.countDocuments({ schoolId, role: 'parent', isActive: true }),
    Student.aggregate([
      { $match: { schoolId, isActive: true } },
      { $group: { _id: '$grade', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Student.aggregate([
      { $match: { schoolId, isActive: true } },
      { $group: { _id: { grade: '$grade', class: '$class' }, count: { $sum: 1 } } },
      { $sort: { '_id.grade': 1, '_id.class': 1 } }
    ])
  ]);

  const statisticsData = {
    students: {
      total: totalStudents,
      active: activeStudents,
      inactive: inactiveStudents,
      byGrade: studentsPerGrade.map(item => ({
        grade: item._id,
        count: item.count
      })),
      byClass: studentsPerClass.map(item => ({
        grade: item._id.grade,
        class: item._id.class,
        count: item.count
      }))
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
      totalUsers: totalTeachers + totalParents + 1, // +1 for admin
      activeUsers: activeTeachers + activeParents + 1,
      totalStudents: activeStudents
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache statistics for 10 minutes (shorter TTL due to frequent changes)
  await CacheService.set('school', cacheKey, statisticsData, 600);
  console.log(`📊 School statistics cached for ${schoolId}`);

  return statisticsData;
};

/**
 * Invalidate all school-related caches
 * @param {string} schoolId - School identifier
 */
const invalidateSchoolCaches = async (schoolId) => {
  console.log(`🗑️ Invalidating school caches for ${schoolId}`);
  
  // Invalidate school profile cache
  await CacheService.del('school', `profile:${schoolId}`);
  
  // Invalidate school statistics cache
  await CacheService.del('school', `statistics:${schoolId}`);
  
  // Invalidate dashboard caches that depend on school data
  const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
  const deletedCount = await CacheService.delPattern(dashboardPattern);
  
  console.log(`🗑️ Invalidated school caches and ${deletedCount} related dashboard entries for ${schoolId}`);
};

/**
 * Warm up school caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpSchoolCaches = async (schoolId) => {
  console.log(`🔥 Warming up school caches for ${schoolId}`);
  
  try {
    // Pre-load school profile
    await getSchoolProfile(schoolId);
    
    // Pre-load school statistics
    await getSchoolStatistics(schoolId);
    
    console.log(`🔥 School caches warmed up successfully for ${schoolId}`);
  } catch (error) {
    console.error(`❌ Failed to warm up school caches for ${schoolId}:`, error.message);
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
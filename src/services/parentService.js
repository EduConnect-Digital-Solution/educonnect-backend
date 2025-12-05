/**
 * Parent Service
 * Centralized business logic for parent management operations
 * Enhanced with Redis caching for optimal performance
 */

const User = require('../models/User');
const Student = require('../models/Student');
const School = require('../models/School');
const CacheService = require('./cacheService');

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
    console.log(`👨‍👩‍👧‍👦 Parent list cache HIT for ${cacheKey}`);
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: cachedData.generatedAt
    };
  }

  console.log(`👨‍👩‍👧‍👦 Parent list cache MISS for ${cacheKey} - querying database`);

  // Build query
  const query = { schoolId, role: 'parent' };
  if (isActive !== undefined) query.isActive = isActive;

  // Add search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get parents with populated data
  const parents = await User.find(query)
    .populate('studentIds', 'firstName lastName studentId class section')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await User.countDocuments(query);

  // Format response
  const formattedParents = parents.map(parent => ({
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
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
    children: parent.studentIds ? parent.studentIds.map(student => ({
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      class: student.class,
      section: student.section
    })) : []
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
      active: await User.countDocuments({ ...query, isActive: true }),
      inactive: await User.countDocuments({ ...query, isActive: false })
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache parent data for 5 minutes (shorter TTL due to frequent updates)
  await CacheService.set('parent', cacheKey, parentData, 300);
  console.log(`👨‍👩‍👧‍👦 Parent list cached for ${cacheKey}`);

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
    console.log(`👨‍👩‍👧‍👦 Parent cache HIT for ${parentId}`);
    return {
      ...cachedParent,
      cached: true,
      cacheTimestamp: cachedParent.generatedAt
    };
  }

  console.log(`👨‍👩‍👧‍👦 Parent cache MISS for ${parentId} - fetching from database`);

  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent'
  }).populate('studentIds', 'firstName lastName studentId class section grade dateOfBirth gender');

  if (!parent) {
    throw new Error('Parent not found');
  }

  const parentData = {
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
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      children: parent.studentIds ? parent.studentIds.map(student => ({
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId,
        class: student.class,
        section: student.section,
        grade: student.grade,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender
      })) : []
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache parent data for 15 minutes
  await CacheService.set('parent', cacheKey, parentData, 900);
  console.log(`👨‍👩‍👧‍👦 Parent data cached for ${parentId}`);

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

  // Find the parent
  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent'
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  // Update parent record
  const updateFields = {};
  if (firstName !== undefined) updateFields.firstName = firstName;
  if (lastName !== undefined) updateFields.lastName = lastName;
  if (phone !== undefined) updateFields.phone = phone;
  if (address !== undefined) updateFields.address = address;
  if (occupation !== undefined) updateFields.occupation = occupation;
  if (emergencyContact !== undefined) updateFields.emergencyContact = emergencyContact;
  if (emergencyPhone !== undefined) updateFields.emergencyPhone = emergencyPhone;
  updateFields.updatedAt = new Date();

  const updatedParent = await User.findByIdAndUpdate(
    parentId,
    updateFields,
    { new: true, runValidators: true }
  ).populate('studentIds', 'firstName lastName studentId class section');

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: updatedParent._id,
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
      children: updatedParent.studentIds ? updatedParent.studentIds.map(student => ({
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId,
        class: student.class,
        section: student.section
      })) : []
    }
  };
};

/**
 * Link Parent to Student Service
 * Creates a relationship between parent and student
 */
const linkParentToStudent = async (parentId, studentId, schoolId) => {
  // Verify parent exists
  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent',
    isActive: true
  });

  if (!parent) {
    throw new Error('Parent not found or inactive');
  }

  // Verify student exists
  const student = await Student.findOne({
    _id: studentId,
    schoolId,
    isActive: true
  });

  if (!student) {
    throw new Error('Student not found or inactive');
  }

  // Check if relationship already exists
  if (parent.studentIds && parent.studentIds.includes(studentId)) {
    throw new Error('Parent is already linked to this student');
  }

  // Add student to parent's studentIds
  await User.findByIdAndUpdate(
    parentId,
    { $addToSet: { studentIds: studentId } }
  );

  // Add parent to student's parentIds
  await Student.findByIdAndUpdate(
    studentId,
    { $addToSet: { parentIds: parentId } }
  );

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent._id,
      name: `${parent.firstName} ${parent.lastName}`,
      email: parent.email
    },
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      class: student.class,
      section: student.section
    },
    message: 'Parent linked to student successfully'
  };
};

/**
 * Unlink Parent from Student Service
 * Removes the relationship between parent and student
 */
const unlinkParentFromStudent = async (parentId, studentId, schoolId) => {
  // Verify parent exists
  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent'
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  // Verify student exists
  const student = await Student.findOne({
    _id: studentId,
    schoolId
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // Check if relationship exists
  if (!parent.studentIds || !parent.studentIds.includes(studentId)) {
    throw new Error('Parent is not linked to this student');
  }

  // Remove student from parent's studentIds
  await User.findByIdAndUpdate(
    parentId,
    { $pull: { studentIds: studentId } }
  );

  // Remove parent from student's parentIds
  await Student.findByIdAndUpdate(
    studentId,
    { $pull: { parentIds: parentId } }
  );

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent._id,
      name: `${parent.firstName} ${parent.lastName}`,
      email: parent.email
    },
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      class: student.class,
      section: student.section
    },
    message: 'Parent unlinked from student successfully'
  };
};

/**
 * Deactivate Parent Service
 * Deactivates a parent account (soft delete)
 */
const deactivateParent = async (parentId, schoolId, adminUserId, reason) => {
  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent',
    isActive: true
  });

  if (!parent) {
    throw new Error('Parent not found or already inactive');
  }

  // Update parent record
  parent.isActive = false;
  parent.deactivatedAt = new Date();
  parent.deactivatedBy = adminUserId;
  parent.deactivationReason = reason || 'Deactivated by administrator';
  await parent.save();

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent._id,
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email,
      isActive: parent.isActive,
      deactivatedAt: parent.deactivatedAt,
      deactivationReason: parent.deactivationReason
    },
    message: 'Parent deactivated successfully'
  };
};

/**
 * Activate Parent Service
 * Reactivates a deactivated parent account
 */
const activateParent = async (parentId, schoolId) => {
  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent',
    isActive: false
  });

  if (!parent) {
    throw new Error('Parent not found or already active');
  }

  // Update parent record
  parent.isActive = true;
  parent.reactivatedAt = new Date();
  parent.deactivatedAt = undefined;
  parent.deactivatedBy = undefined;
  parent.deactivationReason = undefined;
  await parent.save();

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent._id,
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email,
      isActive: parent.isActive,
      reactivatedAt: parent.reactivatedAt
    },
    message: 'Parent activated successfully'
  };
};

/**
 * Delete Parent Service
 * Permanently deletes a parent account (hard delete)
 */
const deleteParent = async (parentId, schoolId, adminUserId) => {
  const parent = await User.findOne({
    _id: parentId,
    schoolId,
    role: 'parent'
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  // Remove parent from all linked students
  if (parent.studentIds && parent.studentIds.length > 0) {
    await Student.updateMany(
      { _id: { $in: parent.studentIds } },
      { $pull: { parentIds: parentId } }
    );
  }

  // Delete the parent record
  await User.findByIdAndDelete(parentId);

  // Invalidate parent-related caches
  await invalidateParentCaches(schoolId, parentId);

  return {
    parent: {
      id: parent._id,
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
  console.log(`🗑️ Invalidating parent caches for school ${schoolId}${parentId ? ` and parent ${parentId}` : ''}`);
  
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
  
  console.log(`🗑️ Invalidated ${deletedCount} parent list entries and ${dashboardDeleted} dashboard entries for school ${schoolId}`);
};

/**
 * Warm up parent caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpParentCaches = async (schoolId) => {
  console.log(`🔥 Warming up parent caches for school ${schoolId}`);
  
  try {
    // Pre-load common parent views
    await getParents({ schoolId, isActive: true }, { page: 1, limit: 20 });
    await getParents({ schoolId }, { page: 1, limit: 20 });
    
    console.log(`🔥 Parent caches warmed up successfully for school ${schoolId}`);
  } catch (error) {
    console.error(`❌ Failed to warm up parent caches for school ${schoolId}:`, error.message);
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
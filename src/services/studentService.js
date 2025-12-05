/**
 * Student Service
 * Centralized business logic for student management operations
 * Enhanced with Redis caching for optimal performance
 */

const Student = require('../models/Student');
const User = require('../models/User');
const School = require('../models/School');
const CacheService = require('./cacheService');

/**
 * Create Student Service
 * Creates a new student record with unique studentId
 */
const createStudent = async (studentData, schoolId) => {
  const {
    firstName,
    lastName,
    email,
    class: studentClass,
    section,
    rollNumber,
    grade,
    dateOfBirth,
    gender,
    address,
    phone,
    parentIds,
    teacherIds
  } = studentData;

  // Check if school exists and is active
  const school = await School.findOne({ schoolId, isActive: true, isVerified: true });
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Check if student with same email already exists in this school
  if (email) {
    const existingStudent = await Student.findOne({
      email: email.toLowerCase(),
      schoolId,
      isActive: true
    });

    if (existingStudent) {
      throw new Error('A student with this email already exists in your school');
    }
  }

  // Check if roll number is unique within the class and section
  if (rollNumber) {
    const existingRollNumber = await Student.findOne({
      schoolId,
      class: studentClass,
      section,
      rollNumber,
      isActive: true
    });

    if (existingRollNumber) {
      throw new Error('Roll number already exists in this class and section');
    }
  }

  // Validate parent IDs if provided
  if (parentIds && parentIds.length > 0) {
    const parents = await User.find({
      _id: { $in: parentIds },
      schoolId,
      role: 'parent',
      isActive: true
    });

    if (parents.length !== parentIds.length) {
      throw new Error('One or more parent IDs are invalid or do not belong to this school');
    }
  }

  // Validate teacher IDs if provided
  if (teacherIds && teacherIds.length > 0) {
    const teachers = await User.find({
      _id: { $in: teacherIds },
      schoolId,
      role: 'teacher',
      isActive: true
    });

    if (teachers.length !== teacherIds.length) {
      throw new Error('One or more teacher IDs are invalid or do not belong to this school');
    }
  }

  // Create student record
  const student = new Student({
    schoolId,
    firstName,
    lastName,
    email: email ? email.toLowerCase() : undefined,
    class: studentClass,
    section,
    rollNumber,
    grade,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    gender,
    address,
    phone,
    parentIds: parentIds || [],
    teacherIds: teacherIds || [],
    isActive: true,
    createdAt: new Date()
  });

  await student.save();

  // Update parent records to include this student
  if (parentIds && parentIds.length > 0) {
    await User.updateMany(
      { _id: { $in: parentIds } },
      { $addToSet: { studentIds: student._id } }
    );
  }

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId);

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      class: student.class,
      section: student.section,
      rollNumber: student.rollNumber,
      grade: student.grade,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      address: student.address,
      phone: student.phone,
      parentIds: student.parentIds,
      teacherIds: student.teacherIds,
      isActive: student.isActive,
      createdAt: student.createdAt
    }
  };
};

/**
 * Update Student Service
 * Updates an existing student record
 */
const updateStudent = async (studentId, updateData, schoolId) => {
  const {
    firstName,
    lastName,
    email,
    class: studentClass,
    section,
    rollNumber,
    grade,
    dateOfBirth,
    gender,
    address,
    phone,
    parentIds,
    teacherIds
  } = updateData;

  // Find the student
  const student = await Student.findOne({
    _id: studentId,
    schoolId,
    isActive: true
  });

  if (!student) {
    throw new Error('Student not found or inactive');
  }

  // Check if email is being changed and if new email already exists
  if (email && email.toLowerCase() !== student.email) {
    const existingStudent = await Student.findOne({
      email: email.toLowerCase(),
      schoolId,
      isActive: true,
      _id: { $ne: studentId }
    });

    if (existingStudent) {
      throw new Error('A student with this email already exists in your school');
    }
  }

  // Check if roll number is being changed and if new roll number already exists
  if (rollNumber && (rollNumber !== student.rollNumber || studentClass !== student.class || section !== student.section)) {
    const existingRollNumber = await Student.findOne({
      schoolId,
      class: studentClass || student.class,
      section: section || student.section,
      rollNumber,
      isActive: true,
      _id: { $ne: studentId }
    });

    if (existingRollNumber) {
      throw new Error('Roll number already exists in this class and section');
    }
  }

  // Validate parent IDs if provided
  if (parentIds && parentIds.length > 0) {
    const parents = await User.find({
      _id: { $in: parentIds },
      schoolId,
      role: 'parent',
      isActive: true
    });

    if (parents.length !== parentIds.length) {
      throw new Error('One or more parent IDs are invalid or do not belong to this school');
    }
  }

  // Validate teacher IDs if provided
  if (teacherIds && teacherIds.length > 0) {
    const teachers = await User.find({
      _id: { $in: teacherIds },
      schoolId,
      role: 'teacher',
      isActive: true
    });

    if (teachers.length !== teacherIds.length) {
      throw new Error('One or more teacher IDs are invalid or do not belong to this school');
    }
  }

  // Update student record
  const updateFields = {};
  if (firstName !== undefined) updateFields.firstName = firstName;
  if (lastName !== undefined) updateFields.lastName = lastName;
  if (email !== undefined) updateFields.email = email ? email.toLowerCase() : undefined;
  if (studentClass !== undefined) updateFields.class = studentClass;
  if (section !== undefined) updateFields.section = section;
  if (rollNumber !== undefined) updateFields.rollNumber = rollNumber;
  if (grade !== undefined) updateFields.grade = grade;
  if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
  if (gender !== undefined) updateFields.gender = gender;
  if (address !== undefined) updateFields.address = address;
  if (phone !== undefined) updateFields.phone = phone;
  if (parentIds !== undefined) updateFields.parentIds = parentIds;
  if (teacherIds !== undefined) updateFields.teacherIds = teacherIds;
  updateFields.updatedAt = new Date();

  const updatedStudent = await Student.findByIdAndUpdate(
    studentId,
    updateFields,
    { new: true, runValidators: true }
  );

  // Update parent records if parentIds changed
  if (parentIds !== undefined) {
    // Remove this student from old parents
    await User.updateMany(
      { studentIds: studentId },
      { $pull: { studentIds: studentId } }
    );

    // Add this student to new parents
    if (parentIds.length > 0) {
      await User.updateMany(
        { _id: { $in: parentIds } },
        { $addToSet: { studentIds: studentId } }
      );
    }
  }

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: updatedStudent._id,
      studentId: updatedStudent.studentId,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      email: updatedStudent.email,
      class: updatedStudent.class,
      section: updatedStudent.section,
      rollNumber: updatedStudent.rollNumber,
      grade: updatedStudent.grade,
      dateOfBirth: updatedStudent.dateOfBirth,
      gender: updatedStudent.gender,
      address: updatedStudent.address,
      phone: updatedStudent.phone,
      parentIds: updatedStudent.parentIds,
      teacherIds: updatedStudent.teacherIds,
      isActive: updatedStudent.isActive,
      createdAt: updatedStudent.createdAt,
      updatedAt: updatedStudent.updatedAt
    }
  };
};

/**
 * Get Students Service
 * Retrieves students with filtering and pagination
 */
const getStudents = async (filters, pagination) => {
  const { schoolId, class: studentClass, section, grade, isActive, search } = filters;
  const { page = 1, limit = 10 } = pagination;

  // Create cache key based on query parameters
  const cacheKey = `students:${schoolId}:${studentClass || 'all'}:${section || 'all'}:${grade || 'all'}:${isActive || 'all'}:${page}:${limit}:${search || 'none'}`;
  
  // Try cache first
  const cachedData = await CacheService.get('student', cacheKey);
  if (cachedData) {
    console.log(`👨‍🎓 Student list cache HIT for ${cacheKey}`);
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: cachedData.generatedAt
    };
  }

  console.log(`👨‍🎓 Student list cache MISS for ${cacheKey} - querying database`);

  // Build query
  const query = { schoolId };
  if (studentClass) query.class = studentClass;
  if (section) query.section = section;
  if (grade) query.grade = grade;
  if (isActive !== undefined) query.isActive = isActive;

  // Add search functionality
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { studentId: { $regex: search, $options: 'i' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get students with populated data
  const students = await Student.find(query)
    .populate('parentIds', 'firstName lastName email phone')
    .populate('teacherIds', 'firstName lastName email subjects')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count for pagination
  const total = await Student.countDocuments(query);

  // Format response
  const formattedStudents = students.map(student => ({
    id: student._id,
    studentId: student.studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    fullName: `${student.firstName} ${student.lastName}`,
    email: student.email,
    class: student.class,
    section: student.section,
    rollNumber: student.rollNumber,
    grade: student.grade,
    dateOfBirth: student.dateOfBirth,
    gender: student.gender,
    address: student.address,
    phone: student.phone,
    isActive: student.isActive,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    parents: student.parentIds ? student.parentIds.map(parent => ({
      id: parent._id,
      name: `${parent.firstName} ${parent.lastName}`,
      email: parent.email,
      phone: parent.phone
    })) : [],
    teachers: student.teacherIds ? student.teacherIds.map(teacher => ({
      id: teacher._id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      subjects: teacher.subjects
    })) : []
  }));

  const studentsData = {
    students: formattedStudents,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    },
    summary: {
      total,
      active: await Student.countDocuments({ ...query, isActive: true }),
      inactive: await Student.countDocuments({ ...query, isActive: false })
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache student data for 5 minutes (shorter TTL due to frequent updates)
  await CacheService.set('student', cacheKey, studentsData, 300);
  console.log(`👨‍🎓 Student list cached for ${cacheKey}`);

  return studentsData;
};

/**
 * Get Student by ID Service
 * Retrieves a single student by ID
 */
const getStudentById = async (studentId, schoolId) => {
  // Try to get cached student data first
  const cacheKey = `student:${studentId}`;
  const cachedStudent = await CacheService.get('student', cacheKey);
  
  if (cachedStudent) {
    console.log(`👨‍🎓 Student cache HIT for ${studentId}`);
    return {
      ...cachedStudent,
      cached: true,
      cacheTimestamp: cachedStudent.generatedAt
    };
  }

  console.log(`👨‍🎓 Student cache MISS for ${studentId} - fetching from database`);

  const student = await Student.findOne({
    _id: studentId,
    schoolId
  })
    .populate('parentIds', 'firstName lastName email phone address occupation')
    .populate('teacherIds', 'firstName lastName email subjects');

  if (!student) {
    throw new Error('Student not found');
  }

  const studentData = {
    student: {
      id: student._id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      class: student.class,
      section: student.section,
      rollNumber: student.rollNumber,
      grade: student.grade,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      address: student.address,
      phone: student.phone,
      isActive: student.isActive,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      parents: student.parentIds ? student.parentIds.map(parent => ({
        id: parent._id,
        name: `${parent.firstName} ${parent.lastName}`,
        email: parent.email,
        phone: parent.phone,
        address: parent.address,
        occupation: parent.occupation
      })) : [],
      teachers: student.teacherIds ? student.teacherIds.map(teacher => ({
        id: teacher._id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        subjects: teacher.subjects
      })) : []
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache student data for 15 minutes
  await CacheService.set('student', cacheKey, studentData, 900);
  console.log(`👨‍🎓 Student data cached for ${studentId}`);

  return studentData;
};

/**
 * Deactivate Student Service
 * Deactivates a student record (soft delete)
 */
const deactivateStudent = async (studentId, schoolId, adminUserId, reason) => {
  const student = await Student.findOne({
    _id: studentId,
    schoolId,
    isActive: true
  });

  if (!student) {
    throw new Error('Student not found or already inactive');
  }

  // Update student record
  student.isActive = false;
  student.deactivatedAt = new Date();
  student.deactivatedBy = adminUserId;
  student.deactivationReason = reason || 'Deactivated by administrator';
  await student.save();

  // Remove student from parent records
  await User.updateMany(
    { studentIds: studentId },
    { $pull: { studentIds: studentId } }
  );

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      isActive: student.isActive,
      deactivatedAt: student.deactivatedAt,
      deactivationReason: student.deactivationReason
    },
    message: 'Student deactivated successfully'
  };
};

/**
 * Activate Student Service
 * Reactivates a deactivated student record
 */
const activateStudent = async (studentId, schoolId) => {
  const student = await Student.findOne({
    _id: studentId,
    schoolId,
    isActive: false
  });

  if (!student) {
    throw new Error('Student not found or already active');
  }

  // Update student record
  student.isActive = true;
  student.reactivatedAt = new Date();
  student.deactivatedAt = undefined;
  student.deactivatedBy = undefined;
  student.deactivationReason = undefined;
  await student.save();

  // Re-add student to parent records
  if (student.parentIds && student.parentIds.length > 0) {
    await User.updateMany(
      { _id: { $in: student.parentIds } },
      { $addToSet: { studentIds: studentId } }
    );
  }

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      isActive: student.isActive,
      reactivatedAt: student.reactivatedAt
    },
    message: 'Student activated successfully'
  };
};

/**
 * Delete Student Service
 * Permanently deletes a student record (hard delete)
 */
const deleteStudent = async (studentId, schoolId, adminUserId) => {
  const student = await Student.findOne({
    _id: studentId,
    schoolId
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // Remove student from parent records
  await User.updateMany(
    { studentIds: studentId },
    { $pull: { studentIds: studentId } }
  );

  // Delete the student record
  await Student.findByIdAndDelete(studentId);

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName
    },
    message: 'Student deleted permanently'
  };
};

/**
 * Invalidate student-related caches
 * @param {string} schoolId - School identifier
 * @param {string} studentId - Student identifier (optional)
 */
const invalidateStudentCaches = async (schoolId, studentId = null) => {
  console.log(`🗑️ Invalidating student caches for school ${schoolId}${studentId ? ` and student ${studentId}` : ''}`);
  
  // Invalidate specific student cache if studentId provided
  if (studentId) {
    await CacheService.del('student', `student:${studentId}`);
  }
  
  // Invalidate student list caches (all variations)
  const studentListPattern = `educonnect:student:students:${schoolId}*`;
  const deletedCount = await CacheService.delPattern(studentListPattern);
  
  // Invalidate dashboard caches that depend on student data
  const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
  const dashboardDeleted = await CacheService.delPattern(dashboardPattern);
  
  // Invalidate teacher caches that might include this student
  const teacherPattern = `educonnect:teacher:*`;
  const teacherDeleted = await CacheService.delPattern(teacherPattern);
  
  // Invalidate parent caches that might include this student
  const parentPattern = `educonnect:parent:*`;
  const parentDeleted = await CacheService.delPattern(parentPattern);
  
  console.log(`🗑️ Invalidated ${deletedCount} student list entries, ${dashboardDeleted} dashboard entries, ${teacherDeleted} teacher entries, and ${parentDeleted} parent entries for school ${schoolId}`);
};

/**
 * Warm up student caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpStudentCaches = async (schoolId) => {
  console.log(`🔥 Warming up student caches for school ${schoolId}`);
  
  try {
    // Pre-load common student views
    await getStudents({ schoolId, isActive: true }, { page: 1, limit: 20 });
    await getStudents({ schoolId }, { page: 1, limit: 20 });
    
    console.log(`🔥 Student caches warmed up successfully for school ${schoolId}`);
  } catch (error) {
    console.error(`❌ Failed to warm up student caches for school ${schoolId}:`, error.message);
  }
};

module.exports = {
  createStudent,
  updateStudent,
  getStudents,
  getStudentById,
  deactivateStudent,
  activateStudent,
  deleteStudent,
  invalidateStudentCaches,
  warmUpStudentCaches
};
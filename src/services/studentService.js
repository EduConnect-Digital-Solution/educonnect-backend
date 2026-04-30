/**
 * Student Service
 * Centralized business logic for student management operations
 * Enhanced with Redis caching for optimal performance
 * Rewritten to use Prisma instead of Mongoose
 */

const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const logger = require('../utils/logger');

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
    parentIds = [],
    teacherIds = []
  } = studentData;

  // Check if school exists and is active
  const school = await prisma.school.findFirst({
    where: { schoolId, isActive: true, isVerified: true }
  });
  if (!school) {
    throw new Error('School not found or inactive');
  }
  const schoolIdUuid = school.id;

  // Check if student with same email already exists in this school
  if (email) {
    const existingStudent = await prisma.student.findFirst({
      where: { email: email.toLowerCase(), schoolId: schoolIdUuid, isActive: true }
    });

    if (existingStudent) {
      throw new Error('A student with this email already exists in your school');
    }
  }

  // Check if roll number is unique within the class and section
  if (rollNumber) {
    const existingRollNumber = await prisma.student.findFirst({
      where: { schoolId: schoolIdUuid, class: studentClass, section, rollNumber, isActive: true }
    });

    if (existingRollNumber) {
      throw new Error('Roll number already exists in this class and section');
    }
  }

  // Validate parent IDs if provided
  if (parentIds.length > 0) {
    const parents = await prisma.user.findMany({
      where: { id: { in: parentIds }, schoolId: schoolIdUuid, role: 'parent', isActive: true }
    });

    if (parents.length !== parentIds.length) {
      throw new Error('One or more parent IDs are invalid or do not belong to this school');
    }
  }

  // Validate teacher IDs if provided
  if (teacherIds.length > 0) {
    const teachers = await prisma.user.findMany({
      where: { id: { in: teacherIds }, schoolId: schoolIdUuid, role: 'teacher', isActive: true }
    });

    if (teachers.length !== teacherIds.length) {
      throw new Error('One or more teacher IDs are invalid or do not belong to this school');
    }
  }

  // Create student record
  const student = await prisma.student.create({
    data: {
      schoolId: schoolIdUuid,
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
      isActive: true,
      createdAt: new Date()
    }
  });

  // Create ParentStudent junction records
  if (parentIds.length > 0) {
    await prisma.parentStudent.createMany({
      data: parentIds.map(parentId => ({ parentId, studentId: student.id }))
    });
  }

  // Create TeacherStudent junction records
  if (teacherIds.length > 0) {
    await prisma.teacherStudent.createMany({
      data: teacherIds.map(teacherId => ({ teacherId, studentId: student.id }))
    });
  }

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId);

  // Fetch relation IDs for return
  const parentIdsRes = await prisma.parentStudent.findMany({
    where: { studentId: student.id },
    select: { parentId: true }
  }).then(res => res.map(r => r.parentId));
  const teacherIdsRes = await prisma.teacherStudent.findMany({
    where: { studentId: student.id },
    select: { teacherId: true }
  }).then(res => res.map(r => r.teacherId));

  return {
    student: {
      id: student.id,
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
      parentIds: parentIdsRes,
      teacherIds: teacherIdsRes,
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

  // Get school UUID
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
  if (!school) throw new Error('School not found');
  const schoolIdUuid = school.id;

  // Find the student
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: schoolIdUuid, isActive: true }
  });

  if (!student) {
    throw new Error('Student not found or inactive');
  }

  // Check if email is being changed and if new email already exists
  if (email && email.toLowerCase() !== student.email) {
    const existingStudent = await prisma.student.findFirst({
      where: { email: email.toLowerCase(), schoolId: schoolIdUuid, isActive: true, id: { not: studentId } }
    });

    if (existingStudent) {
      throw new Error('A student with this email already exists in your school');
    }
  }

  // Check if roll number is being changed and if new roll number already exists
  if (rollNumber && (rollNumber !== student.rollNumber || studentClass !== student.class || section !== student.section)) {
    const existingRollNumber = await prisma.student.findFirst({
      where: {
        schoolId: schoolIdUuid,
        class: studentClass || student.class,
        section: section || student.section,
        rollNumber,
        isActive: true,
        id: { not: studentId }
      }
    });

    if (existingRollNumber) {
      throw new Error('Roll number already exists in this class and section');
    }
  }

  // Validate parent IDs if provided
  if (parentIds && parentIds.length > 0) {
    const parents = await prisma.user.findMany({
      where: { id: { in: parentIds }, schoolId: schoolIdUuid, role: 'parent', isActive: true }
    });

    if (parents.length !== parentIds.length) {
      throw new Error('One or more parent IDs are invalid or do not belong to this school');
    }
  }

  // Validate teacher IDs if provided
  if (teacherIds && teacherIds.length > 0) {
    const teachers = await prisma.user.findMany({
      where: { id: { in: teacherIds }, schoolId: schoolIdUuid, role: 'teacher', isActive: true }
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
  updateFields.updatedAt = new Date();

  const updatedStudent = await prisma.student.update({
    where: { id: studentId },
    data: updateFields
  });

  // Update parent relations if parentIds changed
  if (parentIds !== undefined) {
    await prisma.parentStudent.deleteMany({ where: { studentId: studentId } });
    if (parentIds.length > 0) {
      await prisma.parentStudent.createMany({
        data: parentIds.map(parentId => ({ parentId, studentId: studentId }))
      });
    }
  }

  // Update teacher relations if teacherIds changed
  if (teacherIds !== undefined) {
    await prisma.teacherStudent.deleteMany({ where: { studentId: studentId } });
    if (teacherIds.length > 0) {
      await prisma.teacherStudent.createMany({
        data: teacherIds.map(teacherId => ({ teacherId, studentId: studentId }))
      });
    }
  }

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  // Fetch updated relation IDs
  const parentIdsRes = await prisma.parentStudent.findMany({
    where: { studentId: studentId },
    select: { parentId: true }
  }).then(res => res.map(r => r.parentId));
  const teacherIdsRes = await prisma.teacherStudent.findMany({
    where: { studentId: studentId },
    select: { teacherId: true }
  }).then(res => res.map(r => r.teacherId));

  return {
    student: {
      id: updatedStudent.id,
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
      parentIds: parentIdsRes,
      teacherIds: teacherIdsRes,
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
    logger.info(`👨‍🎓 Student list cache HIT for ${cacheKey}`);
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: cachedData.generatedAt
    };
  }

  logger.info(`👨‍🎓 Student list cache MISS for ${cacheKey} - querying database`);

  // Get school UUID
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
  if (!school) throw new Error('School not found');
  const schoolIdUuid = school.id;

  // Build query
  const where = { schoolId: schoolIdUuid };
  if (studentClass) where.class = studentClass;
  if (section) where.section = section;
  if (grade) where.grade = grade;
  if (isActive !== undefined) where.isActive = isActive;

  // Add search functionality
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { studentId: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Get students with populated data
  const students = await prisma.student.findMany({
    where,
    include: {
      parentOf: { include: { parent: true } },
      studentOf: { include: { teacher: true } }
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take
  });

  // Get total count for pagination
  const total = await prisma.student.count({ where });

  // Format response
  const formattedStudents = students.map(student => ({
    id: student.id,
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
    parents: student.parentOf.map(p => ({
      id: p.parent.id,
      name: `${p.parent.firstName} ${p.parent.lastName}`,
      email: p.parent.email,
      phone: p.parent.phone
    })),
    teachers: student.studentOf.map(t => ({
      id: t.teacher.id,
      name: `${t.teacher.firstName} ${t.teacher.lastName}`,
      email: t.teacher.email,
      subjects: t.teacher.subjects
    }))
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
      active: await prisma.student.count({ where: { ...where, isActive: true } }),
      inactive: await prisma.student.count({ where: { ...where, isActive: false } })
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache student data for 5 minutes (shorter TTL due to frequent updates)
  await CacheService.set('student', cacheKey, studentsData, 300);
  logger.info(`👨‍🎓 Student list cached for ${cacheKey}`);

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
    logger.info(`👨‍🎓 Student cache HIT for ${studentId}`);
    return {
      ...cachedStudent,
      cached: true,
      cacheTimestamp: cachedStudent.generatedAt
    };
  }

  logger.info(`👨‍🎓 Student cache MISS for ${studentId} - fetching from database`);

  // Get school UUID
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
  if (!school) throw new Error('School not found');
  const schoolIdUuid = school.id;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: schoolIdUuid },
    include: {
      parentOf: { include: { parent: true } },
      studentOf: { include: { teacher: true } }
    }
  });

  if (!student) {
    throw new Error('Student not found');
  }

  const studentData = {
    student: {
      id: student.id,
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
      parents: student.parentOf.map(p => ({
        id: p.parent.id,
        name: `${p.parent.firstName} ${p.parent.lastName}`,
        email: p.parent.email,
        phone: p.parent.phone
      })),
      teachers: student.studentOf.map(t => ({
        id: t.teacher.id,
        name: `${t.teacher.firstName} ${t.teacher.lastName}`,
        email: t.teacher.email,
        subjects: t.teacher.subjects
      }))
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache student data for 15 minutes
  await CacheService.set('student', cacheKey, studentData, 900);
  logger.info(`👨‍🎓 Student data cached for ${studentId}`);

  return studentData;
};

/**
 * Deactivate Student Service
 * Deactivates a student record (soft delete)
 */
const deactivateStudent = async (studentId, schoolId, adminUserId, reason) => {
  // Get school UUID
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
  if (!school) throw new Error('School not found');
  const schoolIdUuid = school.id;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: schoolIdUuid, isActive: true }
  });

  if (!student) {
    throw new Error('Student not found or already inactive');
  }

  // Update student record
  const updatedStudent = await prisma.student.update({
    where: { id: studentId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: adminUserId,
      deactivationReason: reason || 'Deactivated by administrator',
      updatedAt: new Date()
    }
  });

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: updatedStudent.id,
      studentId: updatedStudent.studentId,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      isActive: updatedStudent.isActive,
      deactivatedAt: updatedStudent.deactivatedAt,
      deactivationReason: updatedStudent.deactivationReason
    },
    message: 'Student deactivated successfully'
  };
};

/**
 * Activate Student Service
 * Reactivates a deactivated student record
 */
const activateStudent = async (studentId, schoolId) => {
  // Get school UUID
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
  if (!school) throw new Error('School not found');
  const schoolIdUuid = school.id;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: schoolIdUuid, isActive: false }
  });

  if (!student) {
    throw new Error('Student not found or already active');
  }

  // Update student record
  const updatedStudent = await prisma.student.update({
    where: { id: studentId },
    data: {
      isActive: true,
      deactivatedAt: null,
      deactivatedBy: null,
      deactivationReason: null,
      updatedAt: new Date()
    }
  });

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: updatedStudent.id,
      studentId: updatedStudent.studentId,
      firstName: updatedStudent.firstName,
      lastName: updatedStudent.lastName,
      isActive: updatedStudent.isActive
    },
    message: 'Student activated successfully'
  };
};

/**
 * Delete Student Service
 * Permanently deletes a student record (hard delete)
 */
const deleteStudent = async (studentId, schoolId, adminUserId) => {
  // Get school UUID
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
  if (!school) throw new Error('School not found');
  const schoolIdUuid = school.id;

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: schoolIdUuid }
  });

  if (!student) {
    throw new Error('Student not found');
  }

  // Delete junction table records
  await prisma.parentStudent.deleteMany({ where: { studentId: studentId } });
  await prisma.teacherStudent.deleteMany({ where: { studentId: studentId } });

  // Delete the student record
  await prisma.student.delete({ where: { id: studentId } });

  // Invalidate student-related caches
  await invalidateStudentCaches(schoolId, studentId);

  return {
    student: {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName
    },
    message: 'Student deleted permanently'
  };
};

/**
 * Invalidate student-related caches
 * @param {string} schoolId - School identifier (human-readable)
 * @param {string} studentId - Student identifier (optional, Prisma UUID)
 */
const invalidateStudentCaches = async (schoolId, studentId = null) => {
  logger.info(`🗑️ Invalidating student caches for school ${schoolId}${studentId ? ` and student ${studentId}` : ''}`);
   
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
   
  // Invalidate teacher dashboard and grade caches for this school
  const teacherDashboardPattern = `educonnect:teacher:dashboard:*`;
  const teacherStudentsPattern = `educonnect:teacher:students:*`;
  const gradeClassesPattern = `educonnect:grades:classes:*`;
  const teacherDashboardDeleted = await CacheService.delPattern(teacherDashboardPattern);
  const teacherStudentsDeleted = await CacheService.delPattern(teacherStudentsPattern);
  const gradeClassesDeleted = await CacheService.delPattern(gradeClassesPattern);
   
  // Invalidate parent caches that might include this student
  const parentPattern = `educonnect:parent:*`;
  const parentDeleted = await CacheService.delPattern(parentPattern);
   
  logger.info(`🗑️ Invalidated ${deletedCount} student list entries, ${dashboardDeleted} dashboard entries, ${teacherDashboardDeleted + teacherStudentsDeleted + gradeClassesDeleted} teacher/grade entries, and ${parentDeleted} parent entries for school ${schoolId}`);
};

/**
 * Warm up student caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier (human-readable)
 */
const warmUpStudentCaches = async (schoolId) => {
  logger.info(`🔥 Warming up student caches for school ${schoolId}`);
   
  try {
    // Pre-load common student views
    await getStudents({ schoolId, isActive: true }, { page: 1, limit: 20 });
    await getStudents({ schoolId }, { page: 1, limit: 20 });
     
    logger.info(`🔥 Student caches warmed up successfully for school ${schoolId}`);
  } catch (error) {
    logger.error(`❌ Failed to warm up student caches for school ${schoolId}:`, error.message);
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

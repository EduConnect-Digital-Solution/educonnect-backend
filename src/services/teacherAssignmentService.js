/**
 * Teacher Assignment Service
 * Business logic for teacher-student linking operations
 */

const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const GradeService = require('./gradeService');
const TeacherService = require('./teacherService');
const logger = require('../utils/logger');

/**
 * Assign Teacher to Students
 * Links a teacher to one or more students
 */
const assignTeacherToStudents = async (teacherId, studentIds, schoolId, adminUserId) => {
  // Validate school exists and get UUID
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Validate teacher exists and belongs to school
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: school.id,
      role: 'teacher',
      isActive: true
    }
  });

  if (!teacher) {
    throw new Error('Teacher not found or inactive in this school');
  }

  // Validate all students exist and belong to school
  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId: school.id,
      isActive: true
    }
  });

  if (students.length !== studentIds.length) {
    throw new Error('One or more students not found or inactive in this school');
  }

  // Track assignment results
  const results = {
    teacherId,
    teacherName: `${teacher.firstName} ${teacher.lastName}`,
    assignments: [],
    alreadyAssigned: [],
    errors: []
  };

  // Process each student
  for (const student of students) {
    try {
      // Check if teacher is already assigned via TeacherStudent table
      const existingAssignment = await prisma.teacherStudent.findUnique({
        where: {
          teacherId_studentId: {
            teacherId,
            studentId: student.id
          }
        }
      });

      if (existingAssignment) {
        results.alreadyAssigned.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          message: 'Teacher already assigned to this student'
        });
        continue;
      }

      // Create teacher-student assignment in junction table
      await prisma.teacherStudent.create({
        data: {
          teacherId,
          studentId: student.id,
          isActive: true
        }
      });

      results.assignments.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        message: 'Teacher assigned successfully'
      });

    } catch (error) {
      results.errors.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        error: error.message
      });
    }
  }

  // Invalidate teacher dashboard caches so student counts update immediately
  try {
    await GradeService.invalidateGradeCaches(schoolId, teacherId);
    await TeacherService.invalidateTeacherCaches(schoolId, teacherId);
    
    // Also invalidate admin dashboard cache to reflect new student assignments
    const DashboardService = require('./dashboardService');
    await DashboardService.invalidateDashboardCache(schoolId);
    
    logger.info(`🗑️ Invalidated teacher and admin dashboard caches after student assignment for teacher ${teacherId}`);
  } catch (cacheError) {
    logger.error(`❌ Failed to invalidate caches after assignment:`, cacheError.message);
  }

  return results;
};

/**
 * Bulk Teacher Assignment
 * Assigns multiple teachers to multiple students
 */
const assignTeachersBulk = async (assignments, schoolId, adminUserId) => {
  // Validate school exists
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

  const results = {
    totalAssignments: assignments.length,
    successful: [],
    failed: []
  };

  // Process each assignment
  for (const assignment of assignments) {
    try {
      const { teacherId, studentIds } = assignment;
      
      const result = await assignTeacherToStudents(
        teacherId,
        studentIds,
        schoolId,
        adminUserId
      );

      results.successful.push({
        teacherId,
        result
      });

    } catch (error) {
      results.failed.push({
        teacherId: assignment.teacherId,
        studentIds: assignment.studentIds,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Unassign Teacher from Students
 * Removes a teacher from one or more students
 */
const unassignTeacherFromStudents = async (teacherId, studentIds, schoolId, adminUserId) => {
  // Validate school exists and get UUID
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Validate teacher exists and belongs to school
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: school.id,
      role: 'teacher',
      isActive: true
    }
  });

  if (!teacher) {
    throw new Error('Teacher not found or inactive in this school');
  }

  // Validate all students exist and belong to school
  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId: school.id,
      isActive: true
    }
  });

  if (students.length !== studentIds.length) {
    throw new Error('One or more students not found or inactive in this school');
  }

  // Track unassignment results
  const results = {
    teacherId,
    teacherName: `${teacher.firstName} ${teacher.lastName}`,
    unassignments: [],
    notAssigned: [],
    errors: []
  };

  // Process each student
  for (const student of students) {
    try {
      // Check if teacher is assigned via TeacherStudent table
      const existingAssignment = await prisma.teacherStudent.findUnique({
        where: {
          teacherId_studentId: {
            teacherId,
            studentId: student.id
          }
        }
      });

      if (existingAssignment) {
        // Remove assignment from junction table
        await prisma.teacherStudent.delete({
          where: {
            teacherId_studentId: {
              teacherId,
              studentId: student.id
            }
          }
        });

        results.unassignments.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          message: 'Teacher unassigned successfully'
        });
      } else {
        results.notAssigned.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          message: 'Teacher was not assigned to this student'
        });
      }

    } catch (error) {
      results.errors.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        error: error.message
      });
    }
  }

  // Invalidate teacher dashboard caches so student counts update immediately
  try {
    await GradeService.invalidateGradeCaches(schoolId, teacherId);
    await TeacherService.invalidateTeacherCaches(schoolId, teacherId);
    
    // Also invalidate admin dashboard cache to reflect student unassignments
    const DashboardService = require('./dashboardService');
    await DashboardService.invalidateDashboardCache(schoolId);
    
    logger.info(`🗑️ Invalidated teacher and admin dashboard caches after student unassignment for teacher ${teacherId}`);
  } catch (cacheError) {
    logger.error(`❌ Failed to invalidate caches after unassignment:`, cacheError.message);
  }

  return results;
};

/**
 * Get Teacher's Students
 * Retrieves all students assigned to a specific teacher
 */
const getTeacherStudents = async (teacherId, schoolId, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;

  // Validate school exists and get UUID
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Validate teacher exists and belongs to school
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: school.id,
      role: 'teacher',
      isActive: true
    }
  });

  if (!teacher) {
    throw new Error('Teacher not found or inactive in this school');
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Find students assigned to this teacher via TeacherStudent table
  const teacherStudents = await prisma.teacherStudent.findMany({
    where: {
      teacherId,
      student: {
        schoolId: school.id,
        isActive: true
      }
    },
    include: {
      student: {
        include: {
          arm: { select: { name: true } },
          parentOf: {
            include: {
              parent: true
            }
          }
        }
      }
    },
    orderBy: [
      { student: { firstName: 'asc' } },
      { student: { lastName: 'asc' } }
    ],
    skip,
    take: parseInt(limit)
  });

  // Get total count
  const total = await prisma.teacherStudent.count({
    where: {
      teacherId,
      student: {
        schoolId: school.id,
        isActive: true
      }
    }
  });

  // Format response
  const formattedStudents = teacherStudents.map(ts => {
    const student = ts.student;
    return {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      classId: student.classId,
      armId: student.armId,
      rollNumber: student.rollNumber,
      grade: student.grade,
      parents: student.parentOf ? student.parentOf.map(ps => ({
        id: ps.parent.id,
        name: `${ps.parent.firstName} ${ps.parent.lastName}`,
        email: ps.parent.email,
        phone: ps.parent.phone
      })) : []
    };
  });

  return {
    teacher: {
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      subjects: teacher.subjects || []
    },
    students: formattedStudents,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

/**
 * Get Student's Teachers
 * Retrieves all teachers assigned to a specific student
 */
const getStudentTeachers = async (studentId, schoolId) => {
  // Validate school exists and get UUID
  // Find school by either UUID (id) or human-readable schoolId
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Find student
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
    throw new Error('Student not found or inactive in this school');
  }

  // Get teachers assigned to this student via TeacherStudent table
  const teacherStudents = await prisma.teacherStudent.findMany({
    where: {
      studentId,
      teacher: {
        schoolId: school.id,
        isActive: true
      }
    },
    include: {
      teacher: true
    }
  });

  // Format response
  const teachers = teacherStudents.map(ts => ({
    id: ts.teacher.id,
    name: `${ts.teacher.firstName} ${ts.teacher.lastName}`,
    email: ts.teacher.email,
    subjects: ts.teacher.subjects || []
  }));

  return {
    student: {
      id: student.id,
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      classId: student.classId,
      armId: student.armId
    },
    teachers,
    totalTeachers: teachers.length
  };
};

module.exports = {
  assignTeacherToStudents,
  assignTeachersBulk,
  unassignTeacherFromStudents,
  getTeacherStudents,
  getStudentTeachers
};

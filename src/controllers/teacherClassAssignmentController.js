/**
 * Teacher Class Assignment Controller
 * Handles assigning classes and subjects to teachers
 */

const { prisma } = require('../config/database');
const TeacherService = require('../services/teacherService');
const CacheService = require('../services/cacheService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Assign Classes to Teacher
 * Admin can assign multiple classes to a teacher
 */
const assignClassesToTeacher = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { teacherId, classes } = req.body;

  // Use authenticated user's schoolId from JWT token
  const targetSchoolId = req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID not found in authentication token'
    });
  }

  // Find the teacher
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: targetSchoolId,
      role: 'teacher'
    }
  });

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found'
    });
  }

  // Add new classes (avoid duplicates)
  const existingClasses = teacher.classes || [];
  const newClasses = classes.filter(cls => !existingClasses.includes(cls));
  let autoAssignedCount = 0;

  if (newClasses.length > 0) {
    const updatedClasses = [...existingClasses, ...newClasses];
    await prisma.user.update({
      where: { id: teacherId },
      data: { classes: updatedClasses }
    });
    teacher.classes = updatedClasses;

    // Auto-assign teacher to all students in newly assigned classes
    const classRecords = await prisma.class.findMany({
      where: { schoolId: targetSchoolId, name: { in: newClasses } },
      select: { id: true, name: true }
    });

    if (classRecords.length > 0) {
      const classIds = classRecords.map(c => c.id);
      const students = await prisma.student.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: { id: true, classId: true }
      });

      if (students.length > 0) {
        const classMap = {};
        classRecords.forEach(c => { classMap[c.id] = c.name; });

        const { count } = await prisma.teacherStudent.createMany({
          data: students.map(s => ({
            teacherId,
            studentId: s.id,
            class: classMap[s.classId] || null,
            isActive: true
          })),
          skipDuplicates: true
        });
        autoAssignedCount = count;
      }
    }
  }

  // Always invalidate caches to ensure fresh data on teacher dashboard
  await TeacherService.invalidateTeacherCaches(targetSchoolId, teacherId);
  await CacheService.del('grades', `classes:${teacherId}`);

  res.status(200).json({
    success: true,
    message: `Teacher assigned to ${newClasses.length} new class(es) successfully`,
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        classes: teacher.classes,
        subjects: teacher.subjects
      },
      assignedClasses: newClasses,
      totalClasses: teacher.classes.length,
      autoAssignedStudents: autoAssignedCount
    }
  });
});

/**
 * Assign Subjects to Teacher
 * Admin can assign multiple subjects to a teacher
 */
const assignSubjectsToTeacher = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { teacherId, subjects } = req.body;

  // Use authenticated user's schoolId from JWT token
  const targetSchoolId = req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID not found in authentication token'
    });
  }

  // Find the teacher
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: targetSchoolId,
      role: 'teacher'
    }
  });

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found'
    });
  }

  // Add new subjects (avoid duplicates)
  const existingSubjects = teacher.subjects || [];
  const newSubjects = subjects.filter(subj => !existingSubjects.includes(subj));

  if (newSubjects.length > 0) {
    const updatedSubjects = [...existingSubjects, ...newSubjects];
    await prisma.user.update({
      where: { id: teacherId },
      data: { subjects: updatedSubjects }
    });
    teacher.subjects = updatedSubjects;
  }

  res.status(200).json({
    success: true,
    message: `Teacher assigned to ${newSubjects.length} new subject(s) successfully`,
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        classes: teacher.classes,
        subjects: teacher.subjects
      },
      assignedSubjects: newSubjects,
      totalSubjects: teacher.subjects.length
    }
  });
});

/**
 * Remove Classes from Teacher
 */
const removeClassesFromTeacher = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { teacherId, classes } = req.body;

  // Use authenticated user's schoolId from JWT token
  const targetSchoolId = req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID not found in authentication token'
    });
  }

  // Find the teacher
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: targetSchoolId,
      role: 'teacher'
    }
  });

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found'
    });
  }

  // Remove classes
  const originalClasses = teacher.classes || [];
  const updatedClasses = originalClasses.filter(cls => !classes.includes(cls));

  await prisma.user.update({
    where: { id: teacherId },
    data: { classes: updatedClasses }
  });
  teacher.classes = updatedClasses;

  // Clean up TeacherStudent records for students in the removed classes
  const removedClassNames = originalClasses.filter(cls => classes.includes(cls));
  if (removedClassNames.length > 0) {
    const classRecords = await prisma.class.findMany({
      where: { schoolId: targetSchoolId, name: { in: removedClassNames } },
      select: { id: true }
    });

    if (classRecords.length > 0) {
      const studentIds = (
        await prisma.student.findMany({
          where: { classId: { in: classRecords.map(c => c.id) }, isActive: true },
          select: { id: true }
        })
      ).map(s => s.id);

      if (studentIds.length > 0) {
        await prisma.teacherStudent.deleteMany({
          where: {
            teacherId,
            studentId: { in: studentIds }
          }
        });
      }
    }
  }

  // Invalidate teacher caches after class removal
  await TeacherService.invalidateTeacherCaches(targetSchoolId, teacherId);
  // Also invalidate grades namespace cache (teacher classes are cached there)
  await CacheService.del('grades', `classes:${teacherId}`);

  const removedClasses = originalClasses.filter(cls => classes.includes(cls));

  res.status(200).json({
    success: true,
    message: `Teacher removed from ${removedClasses.length} class(es) successfully`,
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        classes: teacher.classes,
        subjects: teacher.subjects
      },
      removedClasses: removedClasses,
      remainingClasses: teacher.classes.length
    }
  });
});

/**
 * Get Teacher's Current Assignments
 */
const getTeacherAssignments = catchAsync(async (req, res) => {
  const { teacherId } = req.params;

  // Use authenticated user's schoolId from JWT token
  const targetSchoolId = req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID not found in authentication token'
    });
  }

  // Find the teacher
  const teacher = await prisma.user.findFirst({
    where: {
      id: teacherId,
      schoolId: targetSchoolId,
      role: 'teacher'
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      employeeId: true,
      phone: true,
      isActive: true,
      classes: true,
      subjects: true
    }
  });

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Teacher assignments retrieved successfully',
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        phone: teacher.phone,
        isActive: teacher.isActive
      },
      assignments: {
        classes: teacher.classes || [],
        subjects: teacher.subjects || [],
        classCount: (teacher.classes || []).length,
        subjectCount: (teacher.subjects || []).length
      }
    }
  });
});

module.exports = {
  assignClassesToTeacher,
  assignSubjectsToTeacher,
  removeClassesFromTeacher,
  getTeacherAssignments
};
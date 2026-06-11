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

  if (newClasses.length > 0) {
    const updatedClasses = [...existingClasses, ...newClasses];
    await prisma.user.update({
      where: { id: teacherId },
      data: { classes: updatedClasses }
    });
    teacher.classes = updatedClasses;

    // Auto-create TeacherStudent records for active students in newly assigned classes
    const classRecords = await prisma.class.findMany({
      where: { schoolId: targetSchoolId, name: { in: newClasses }, isActive: true }
    });
    const classIds = classRecords.map(c => c.id);
    const activeStudents = await prisma.student.findMany({
      where: { schoolId: targetSchoolId, classId: { in: classIds }, isActive: true, isEnrolled: true },
      select: { id: true }
    });
    if (activeStudents.length > 0) {
      await prisma.teacherStudent.createMany({
        data: activeStudents.map(s => ({
          teacherId,
          studentId: s.id
        })),
        skipDuplicates: true
      });
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
      totalClasses: teacher.classes.length
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

  // Resolve subject IDs to names
  const subjectRecords = await prisma.subject.findMany({
    where: { id: { in: subjects }, schoolId: targetSchoolId, isActive: true },
    select: { id: true, name: true }
  });

  if (subjectRecords.length !== subjects.length) {
    const foundIds = subjectRecords.map(s => s.id);
    const invalidIds = subjects.filter(id => !foundIds.includes(id));
    return res.status(400).json({
      success: false,
      message: `Invalid subject IDs: ${invalidIds.join(', ')}`
    });
  }

  const subjectNames = subjectRecords.map(s => s.name);

  // Add new subjects (avoid duplicates)
  const existingSubjects = teacher.subjects || [];
  const newSubjectNames = subjectNames.filter(name => !existingSubjects.includes(name));

  if (newSubjectNames.length > 0) {
    const updatedSubjects = [...existingSubjects, ...newSubjectNames];
    await prisma.user.update({
      where: { id: teacherId },
      data: { subjects: updatedSubjects }
    });
    teacher.subjects = updatedSubjects;
  }

  res.status(200).json({
    success: true,
    message: newSubjectNames.length > 0 ? `Teacher assigned to ${newSubjectNames.length} new subject(s) successfully` : 'No new subjects to assign',
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        classes: teacher.classes,
        subjects: teacher.subjects
      },
      assignedSubjectNames: newSubjectNames,
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

  // Delete TeacherStudent records for students in removed classes
  const classRecords = await prisma.class.findMany({
    where: { schoolId: targetSchoolId, name: { in: classes }, isActive: true }
  });
  const classIds = classRecords.map(c => c.id);
  const studentsInRemovedClasses = await prisma.student.findMany({
    where: { schoolId: targetSchoolId, classId: { in: classIds }, isActive: true },
    select: { id: true }
  });
  if (studentsInRemovedClasses.length > 0) {
    await prisma.teacherStudent.deleteMany({
      where: {
        teacherId,
        studentId: { in: studentsInRemovedClasses.map(s => s.id) }
      }
    });
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
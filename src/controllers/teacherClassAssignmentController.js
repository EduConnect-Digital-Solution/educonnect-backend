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

  const { teacherId, classes, arms } = req.body;
  const targetSchoolId = req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID not found in authentication token'
    });
  }

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

  let assignedClassNames = [];
  let assignedArms = [];

  if (arms && arms.length > 0) {
    // --- Arm-specific assignment ---
    const armRecords = await prisma.arm.findMany({
      where: { id: { in: arms }, schoolId: targetSchoolId },
      include: { class: { select: { name: true } } }
    });

    if (armRecords.length !== arms.length) {
      const foundIds = armRecords.map(a => a.id);
      const invalidIds = arms.filter(id => !foundIds.includes(id));
      return res.status(400).json({
        success: false,
        message: `Invalid arm IDs: ${invalidIds.join(', ')}`
      });
    }

    for (const arm of armRecords) {
      await prisma.arm.update({
        where: { id: arm.id },
        data: { classTeacherId: teacherId }
      });
    }

    assignedArms = armRecords.map(a => ({ id: a.id, name: a.name, className: a.class.name }));

    // Auto-create TeacherStudent records for students in those arms
    const studentArms = [...new Set(armRecords.map(a => a.id))];
    const activeStudents = await prisma.student.findMany({
      where: { schoolId: targetSchoolId, armId: { in: studentArms }, isActive: true, isEnrolled: true },
      select: { id: true }
    });
    if (activeStudents.length > 0) {
      await prisma.teacherStudent.createMany({
        data: activeStudents.map(s => ({ teacherId, studentId: s.id })),
        skipDuplicates: true
      });
    }

    // Also add class names to User.classes so grading flows still work
    const classNames = [...new Set(armRecords.map(a => a.class.name))];
    const existingClasses = teacher.classes || [];
    const newForUser = classNames.filter(cls => !existingClasses.includes(cls));
    if (newForUser.length > 0) {
      const updatedClasses = [...existingClasses, ...newForUser];
      await prisma.user.update({
        where: { id: teacherId },
        data: { classes: updatedClasses }
      });
      teacher.classes = updatedClasses;
    }
    assignedClassNames = classNames;
  }

  if (classes && classes.length > 0 && (!arms || arms.length === 0)) {
    // --- Whole-class assignment (only when arms not provided) ---
    const existingClasses = teacher.classes || [];
    const newClasses = classes.filter(cls => !existingClasses.includes(cls));

    if (newClasses.length > 0) {
      const updatedClasses = [...existingClasses, ...newClasses];
      await prisma.user.update({
        where: { id: teacherId },
        data: { classes: updatedClasses }
      });
      teacher.classes = updatedClasses;

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
          data: activeStudents.map(s => ({ teacherId, studentId: s.id })),
          skipDuplicates: true
        });
      }
    }
    assignedClassNames = newClasses;
  }

  await TeacherService.invalidateTeacherCaches(targetSchoolId, teacherId);
  await CacheService.del('grades', `classes:${teacherId}`);

  res.status(200).json({
    success: true,
    message: assignedArms.length > 0
      ? `Teacher assigned to ${assignedArms.length} arm(s) in ${assignedClassNames.length} class(es)`
      : `Teacher assigned to ${assignedClassNames.length} new class(es) successfully`,
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        classes: teacher.classes,
        subjects: teacher.subjects
      },
      assignedClasses: assignedClassNames,
      assignedArms,
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

  const { teacherId, classes, arms } = req.body;
  const targetSchoolId = req.user.schoolId;

  if (!targetSchoolId) {
    return res.status(400).json({
      success: false,
      message: 'School ID not found in authentication token'
    });
  }

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

  let removedClassNames = [];
  let removedArmIds = [];

  if (arms && arms.length > 0) {
    // Remove arm-specific assignments
    const armRecords = await prisma.arm.findMany({
      where: { id: { in: arms }, schoolId: targetSchoolId, classTeacherId: teacherId }
    });

    if (armRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'None of the specified arms are assigned to this teacher'
      });
    }

    await prisma.arm.updateMany({
      where: { id: { in: arms }, classTeacherId: teacherId },
      data: { classTeacherId: null }
    });

    removedArmIds = armRecords.map(a => a.id);

    // Delete TeacherStudent records for students in those arms
    const studentsInRemovedArms = await prisma.student.findMany({
      where: { schoolId: targetSchoolId, armId: { in: removedArmIds }, isActive: true },
      select: { id: true }
    });
    if (studentsInRemovedArms.length > 0) {
      await prisma.teacherStudent.deleteMany({
        where: {
          teacherId,
          studentId: { in: studentsInRemovedArms.map(s => s.id) }
        }
      });
    }
  }

  if (classes && classes.length > 0) {
    // Remove whole-class assignments
    const originalClasses = teacher.classes || [];
    const updatedClasses = originalClasses.filter(cls => !classes.includes(cls));

    await prisma.user.update({
      where: { id: teacherId },
      data: { classes: updatedClasses }
    });
    teacher.classes = updatedClasses;
    removedClassNames = originalClasses.filter(cls => classes.includes(cls));

    // Also clear arm assignments for those classes
    const classRecords = await prisma.class.findMany({
      where: { schoolId: targetSchoolId, name: { in: classes }, isActive: true }
    });
    const classIds = classRecords.map(c => c.id);
    const updatedArms = await prisma.arm.updateMany({
      where: { classId: { in: classIds }, classTeacherId: teacherId },
      data: { classTeacherId: null }
    });
    if (updatedArms.count > 0) {
      removedArmIds = [...new Set([...removedArmIds])];
    }

    // Delete TeacherStudent records for students in removed classes
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
  }

  await TeacherService.invalidateTeacherCaches(targetSchoolId, teacherId);
  await CacheService.del('grades', `classes:${teacherId}`);

  res.status(200).json({
    success: true,
    message: removedArmIds.length > 0
      ? `Teacher removed from ${removedClassNames.length} class(es) and ${removedArmIds.length} arm(s)`
      : `Teacher removed from ${removedClassNames.length} class(es) successfully`,
    data: {
      teacher: {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        classes: teacher.classes,
        subjects: teacher.subjects
      },
      removedClasses: removedClassNames,
      removedArms: removedArmIds,
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
      subjects: true,
      armClasses: {
        select: { id: true, name: true, class: { select: { name: true } } }
      }
    }
  });

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found'
    });
  }

  // Build structured class list: whole-class entries + arm-specific entries
  const wholeClassNames = teacher.classes || [];
  const armClassNames = new Set(teacher.armClasses.map(a => a.class.name));

  // Classes that are only arm-specific (not already in whole-class)
  const onlyArmClasses = [...armClassNames].filter(n => !wholeClassNames.includes(n));

  const structuredClasses = [
    ...wholeClassNames.map(name => ({ className: name })),
    ...onlyArmClasses.map(name => ({
      className: name,
      arms: teacher.armClasses.filter(a => a.class.name === name).map(a => ({ id: a.id, name: a.name }))
    }))
  ];

  // Also add arms info for classes that have both whole-class and arm assignments
  for (const entry of structuredClasses) {
    const armEntries = teacher.armClasses.filter(a => a.class.name === entry.className);
    if (armEntries.length > 0) {
      entry.arms = armEntries.map(a => ({ id: a.id, name: a.name }));
    }
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
        classes: structuredClasses,
        subjects: teacher.subjects || [],
        classCount: structuredClasses.length,
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
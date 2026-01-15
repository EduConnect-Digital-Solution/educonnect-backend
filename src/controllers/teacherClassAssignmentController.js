/**
 * Teacher Class Assignment Controller
 * Handles assigning classes and subjects to teachers
 */

const User = require('../models/User');
const TeacherService = require('../services/teacherService');
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
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId: targetSchoolId,
    role: 'teacher'
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
    teacher.classes = [...existingClasses, ...newClasses];
    await teacher.save();

    // Invalidate teacher caches after class assignment
    await TeacherService.invalidateTeacherCaches(targetSchoolId, teacherId);
  }

  res.status(200).json({
    success: true,
    message: `Teacher assigned to ${newClasses.length} new class(es) successfully`,
    data: {
      teacher: {
        id: teacher._id,
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
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId: targetSchoolId,
    role: 'teacher'
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
    teacher.subjects = [...existingSubjects, ...newSubjects];
    await teacher.save();
  }

  res.status(200).json({
    success: true,
    message: `Teacher assigned to ${newSubjects.length} new subject(s) successfully`,
    data: {
      teacher: {
        id: teacher._id,
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
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId: targetSchoolId,
    role: 'teacher'
  });

  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: 'Teacher not found'
    });
  }

  // Remove classes
  const originalClasses = teacher.classes || [];
  teacher.classes = originalClasses.filter(cls => !classes.includes(cls));
  await teacher.save();

  // Invalidate teacher caches after class removal
  await TeacherService.invalidateTeacherCaches(targetSchoolId, teacherId);

  const removedClasses = originalClasses.filter(cls => classes.includes(cls));

  res.status(200).json({
    success: true,
    message: `Teacher removed from ${removedClasses.length} class(es) successfully`,
    data: {
      teacher: {
        id: teacher._id,
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
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId: targetSchoolId,
    role: 'teacher'
  }).select('-password');

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
        id: teacher._id,
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
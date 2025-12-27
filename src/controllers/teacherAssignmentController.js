/**
 * Teacher Assignment Controller
 * Handles teacher-student linking operations
 */

const teacherAssignmentService = require('../services/teacherAssignmentService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Assign Teacher to Students
 * Assigns a single teacher to one or more students
 */
const assignTeacher = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { teacherId, studentIds, schoolId } = req.body;
  const targetSchoolId = schoolId || req.user.schoolId;

  const result = await teacherAssignmentService.assignTeacherToStudents(
    teacherId,
    studentIds,
    targetSchoolId,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Teacher assigned successfully',
    data: result
  });
});

/**
 * Bulk Teacher Assignment
 * Assigns multiple teachers to multiple students in one operation
 */
const assignTeachersBulk = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { assignments, schoolId } = req.body;
  const targetSchoolId = schoolId || req.user.schoolId;

  const result = await teacherAssignmentService.assignTeachersBulk(
    assignments,
    targetSchoolId,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Bulk teacher assignment completed',
    data: result
  });
});

/**
 * Unassign Teacher from Students
 * Removes a teacher from one or more students
 */
const unassignTeacher = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { teacherId, studentIds, schoolId } = req.body;
  const targetSchoolId = schoolId || req.user.schoolId;

  const result = await teacherAssignmentService.unassignTeacherFromStudents(
    teacherId,
    studentIds,
    targetSchoolId,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Teacher unassigned successfully',
    data: result
  });
});

/**
 * Assign Teacher to Single Student
 * Assigns a specific teacher to a specific student
 */
const assignTeacherToStudent = catchAsync(async (req, res) => {
  const { studentId, teacherId } = req.params;
  const { schoolId } = req.query;
  const targetSchoolId = schoolId || req.user.schoolId;

  const result = await teacherAssignmentService.assignTeacherToStudents(
    teacherId,
    [studentId],
    targetSchoolId,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Teacher assigned to student successfully',
    data: result
  });
});

/**
 * Unassign Teacher from Single Student
 * Removes a specific teacher from a specific student
 */
const unassignTeacherFromStudent = catchAsync(async (req, res) => {
  const { studentId, teacherId } = req.params;
  const { schoolId } = req.query;
  const targetSchoolId = schoolId || req.user.schoolId;

  const result = await teacherAssignmentService.unassignTeacherFromStudents(
    teacherId,
    [studentId],
    targetSchoolId,
    req.user.id
  );

  res.status(200).json({
    success: true,
    message: 'Teacher unassigned from student successfully',
    data: result
  });
});

/**
 * Get Teacher's Students
 * Retrieves all students assigned to a specific teacher
 */
const getTeacherStudents = catchAsync(async (req, res) => {
  const { teacherId } = req.params;
  const { schoolId, page = 1, limit = 20 } = req.query;
  const targetSchoolId = schoolId || req.user.schoolId;

  // Check if user is the teacher themselves or an admin
  if (req.user.role === 'teacher' && req.user.id !== teacherId) {
    return res.status(403).json({
      success: false,
      message: 'Teachers can only view their own students'
    });
  }

  const result = await teacherAssignmentService.getTeacherStudents(
    teacherId,
    targetSchoolId,
    { page, limit }
  );

  res.status(200).json({
    success: true,
    message: 'Teacher students retrieved successfully',
    data: result
  });
});

/**
 * Get Student's Teachers
 * Retrieves all teachers assigned to a specific student
 */
const getStudentTeachers = catchAsync(async (req, res) => {
  const { studentId } = req.params;
  const { schoolId } = req.query;
  const targetSchoolId = schoolId || req.user.schoolId;

  const result = await teacherAssignmentService.getStudentTeachers(
    studentId,
    targetSchoolId
  );

  res.status(200).json({
    success: true,
    message: 'Student teachers retrieved successfully',
    data: result
  });
});

module.exports = {
  assignTeacher,
  assignTeachersBulk,
  unassignTeacher,
  assignTeacherToStudent,
  unassignTeacherFromStudent,
  getTeacherStudents,
  getStudentTeachers
};
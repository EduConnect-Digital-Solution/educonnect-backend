/**
 * Grade Controller
 * Handles grade management HTTP requests for teachers
 * Implements the workflow: Classes → Subjects → Students → Grades
 */

const GradeService = require('../services/gradeService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

/**
 * Get Teacher's Classes
 * Returns all classes the teacher teaches
 */
const getTeacherClasses = catchAsync(async (req, res) => {
  const { userId: teacherId, schoolId } = req.user;

  const data = await GradeService.getTeacherClasses(teacherId, schoolId);

  res.status(200).json({
    success: true,
    message: 'Teacher classes retrieved successfully',
    data
  });
});

/**
 * Get Subjects by Class
 * Returns subjects teacher teaches in a specific class
 */
const getSubjectsByClass = catchAsync(async (req, res) => {
  const { userId: teacherId, schoolId } = req.user;
  const { className } = req.params;

  if (!className) {
    return res.status(400).json({
      success: false,
      message: 'Class name is required'
    });
  }

  const data = await GradeService.getSubjectsByClass(teacherId, className, schoolId);

  res.status(200).json({
    success: true,
    message: 'Subjects retrieved successfully',
    data
  });
});

/**
 * Get Students by Class and Subject
 * Returns students in a class for a specific subject with grade information
 */
const getStudentsByClassAndSubject = catchAsync(async (req, res) => {
  const { userId: teacherId, schoolId } = req.user;
  const { className, subject } = req.params;
  const { term, academicYear, page, limit } = req.query;

  if (!className || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Class name and subject are required'
    });
  }

  const data = await GradeService.getStudentsByClassAndSubject(
    teacherId, 
    className, 
    subject, 
    schoolId,
    { term, academicYear, page, limit }
  );

  res.status(200).json({
    success: true,
    message: 'Students retrieved successfully',
    data
  });
});

/**
 * Assign Grade to Student
 * Creates or updates a grade record for a student
 */
const assignGrade = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId: teacherId } = req.user;

  try {
    const grade = await GradeService.assignGrade(teacherId, req.body);

    res.status(201).json({
      success: true,
      message: 'Grade assigned successfully',
      data: {
        grade: {
          id: grade._id,
          studentId: grade.studentId,
          subject: grade.subject,
          class: grade.class,
          term: grade.term,
          academicYear: grade.academicYear,
          totalScore: grade.totalScore,
          totalMaxScore: grade.totalMaxScore,
          percentage: grade.percentage,
          letterGrade: grade.letterGrade,
          gradePoints: grade.gradePoints,
          assessments: grade.assessments,
          remarks: grade.remarks,
          isPublished: grade.isPublished,
          createdAt: grade.createdAt,
          updatedAt: grade.updatedAt
        }
      }
    });
  } catch (error) {
    if (error.message.includes('Access denied') || 
        error.message.includes('not found') ||
        error.message.includes('not in')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * Get Student Grades
 * Returns all grades for a specific student
 */
const getStudentGrades = catchAsync(async (req, res) => {
  const { userId: teacherId } = req.user;
  const { studentId } = req.params;
  const { term, academicYear, subject, publishedOnly } = req.query;

  if (!studentId) {
    return res.status(400).json({
      success: false,
      message: 'Student ID is required'
    });
  }

  try {
    const data = await GradeService.getStudentGrades(teacherId, studentId, {
      term,
      academicYear,
      subject,
      publishedOnly: publishedOnly === 'true'
    });

    res.status(200).json({
      success: true,
      message: 'Student grades retrieved successfully',
      data
    });
  } catch (error) {
    if (error.message.includes('Access denied') || 
        error.message.includes('not found') ||
        error.message.includes('not in')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * Get Grade Details
 * Returns detailed information about a specific grade
 */
const getGradeDetails = catchAsync(async (req, res) => {
  const { userId: teacherId } = req.user;
  const { gradeId } = req.params;

  if (!gradeId) {
    return res.status(400).json({
      success: false,
      message: 'Grade ID is required'
    });
  }

  try {
    const grade = await GradeService.getGradeDetails(teacherId, gradeId);

    res.status(200).json({
      success: true,
      message: 'Grade details retrieved successfully',
      data: { grade }
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Access denied')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * Update Grade
 * Updates an existing grade record
 */
const updateGrade = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId: teacherId } = req.user;
  const { gradeId } = req.params;

  if (!gradeId) {
    return res.status(400).json({
      success: false,
      message: 'Grade ID is required'
    });
  }

  try {
    // For updates, we can reuse the assignGrade method with the grade ID
    const updatedGrade = await GradeService.assignGrade(teacherId, {
      ...req.body,
      _id: gradeId
    });

    res.status(200).json({
      success: true,
      message: 'Grade updated successfully',
      data: { grade: updatedGrade }
    });
  } catch (error) {
    if (error.message.includes('Access denied') || 
        error.message.includes('not found')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * Delete Grade
 * Removes a grade record
 */
const deleteGrade = catchAsync(async (req, res) => {
  const { userId: teacherId } = req.user;
  const { gradeId } = req.params;

  if (!gradeId) {
    return res.status(400).json({
      success: false,
      message: 'Grade ID is required'
    });
  }

  try {
    const result = await GradeService.deleteGrade(teacherId, gradeId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    if (error.message.includes('not found') || 
        error.message.includes('Access denied') ||
        error.message.includes('Cannot delete')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * Publish Grades
 * Publishes grades for a class and subject
 */
const publishGrades = catchAsync(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId: teacherId } = req.user;

  try {
    const result = await GradeService.publishGrades(teacherId, req.body);

    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        publishedCount: result.publishedCount
      }
    });
  } catch (error) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }
    throw error;
  }
});

/**
 * Get Class Statistics
 * Returns grade statistics for a class and subject
 */
const getClassStatistics = catchAsync(async (req, res) => {
  const { userId: teacherId } = req.user;
  const { className, subject } = req.params;
  const { term = 'First Term', academicYear } = req.query;

  if (!className || !subject) {
    return res.status(400).json({
      success: false,
      message: 'Class name and subject are required'
    });
  }

  // Use current academic year if not provided
  const currentAcademicYear = academicYear || (() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
  })();

  const stats = await GradeService.getClassStatistics(
    teacherId, 
    className, 
    subject, 
    term, 
    currentAcademicYear
  );

  res.status(200).json({
    success: true,
    message: 'Class statistics retrieved successfully',
    data: {
      className,
      subject,
      term,
      academicYear: currentAcademicYear,
      statistics: stats
    }
  });
});

module.exports = {
  getTeacherClasses,
  getSubjectsByClass,
  getStudentsByClassAndSubject,
  assignGrade,
  getStudentGrades,
  getGradeDetails,
  updateGrade,
  deleteGrade,
  publishGrades,
  getClassStatistics
};
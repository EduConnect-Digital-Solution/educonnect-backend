const studentService = require('../services/studentDashboardService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

const getMe = catchAsync(async (req, res) => {
  const data = await studentService.getStudentIdentity(req.user, req.student);

  res.status(200).json({
    success: true,
    message: 'Student identity retrieved successfully',
    data
  });
});

const getNotifications = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { unread, page = 1, limit = 20 } = req.query;
  const { userId, schoolId } = req.user;

  const data = await studentService.getNotificationsList(userId, schoolId, {
    unread,
    page: Number(page),
    limit: Number(limit)
  });

  res.status(200).json({
    success: true,
    message: 'Notifications retrieved successfully',
    data
  });
});

const markNotificationRead = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { userId, schoolId } = req.user;

  try {
    const data = await studentService.markNotificationRead(userId, schoolId, id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data
    });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or belongs to another student'
      });
    }
    throw error;
  }
});

const markAllNotificationsRead = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;

  const data = await studentService.markAllNotificationsRead(userId, schoolId);

  res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data
  });
});

const getDashboard = catchAsync(async (req, res) => {
  const { student, user } = req;

  const data = await studentService.getDashboardOverview(student, user.schoolId);

  res.status(200).json({
    success: true,
    message: 'Dashboard data retrieved successfully',
    data
  });
});

const getTimetable = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { week, termId } = req.query;
  const { student, user } = req;

  const data = await studentService.getTimetable(student, user.schoolId, week, termId);

  res.status(200).json({
    success: true,
    message: 'Timetable retrieved successfully',
    data
  });
});

const getTerms = catchAsync(async (req, res) => {
  const { schoolId } = req.user;

  const data = await studentService.getTermsList(schoolId);

  res.status(200).json({
    success: true,
    message: 'Terms retrieved successfully',
    data
  });
});

const getAcademics = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { termId, page = 1, limit = 20 } = req.query;
  const { student, user } = req;

  const data = await studentService.getAcademicsList(student, user.schoolId, termId, {
    page: Number(page),
    limit: Number(limit)
  });

  res.status(200).json({
    success: true,
    message: 'Academics data retrieved successfully',
    data
  });
});

const getAssignments = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { status, subjectId, termId, page = 1, limit = 20 } = req.query;
  const { student, user } = req;

  const data = await studentService.getAssignmentsList(student, user.schoolId, {
    status,
    subjectId,
    termId,
    page: Number(page),
    limit: Number(limit)
  });

  res.status(200).json({
    success: true,
    message: 'Assignments retrieved successfully',
    data
  });
});

const getAssignment = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { assignmentId } = req.params;
  const { student, user } = req;

  try {
    const data = await studentService.getAssignmentDetail(student, user.schoolId, assignmentId);

    res.status(200).json({
      success: true,
      message: 'Assignment retrieved successfully',
      data
    });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found or does not belong to your class'
      });
    }
    throw error;
  }
});

const submitAssignment = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { assignmentId } = req.params;
  const { textResponse, attachments } = req.body;
  const { student, user } = req;

  let attachmentArray = null;
  if (attachments) {
    if (typeof attachments === 'string') {
      try {
        attachmentArray = JSON.parse(attachments);
      } catch {
        attachmentArray = [{ fileUrl: attachments, fileName: 'file', mimeType: 'application/octet-stream' }];
      }
    } else if (Array.isArray(attachments)) {
      attachmentArray = attachments;
    }
  }

  if (req.files && req.files.length > 0) {
    logger.warn('File uploads received via Multer, but endpoint expects URLs. Use attachments field instead.');
  }

  try {
    const data = await studentService.submitAssignment(student.id, user.schoolId, assignmentId, {
      textResponse,
      attachments: attachmentArray
    });

    res.status(201).json({
      success: true,
      message: 'Assignment submitted successfully',
      data
    });
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(422).json({
        success: false,
        message: 'Assignment does not belong to your class',
        code: 'NOT_FOUND'
      });
    }
    if (error.message === 'ALREADY_SUBMITTED') {
      return res.status(409).json({
        success: false,
        message: 'Assignment already has a submission',
        code: 'ALREADY_SUBMITTED'
      });
    }
    if (error.message === 'DEADLINE_PASSED') {
      return res.status(409).json({
        success: false,
        message: 'Submission attempted past due date',
        code: 'DEADLINE_PASSED'
      });
    }
    throw error;
  }
});

const getTeachers = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { search, subjectId, page = 1, limit = 20 } = req.query;
  const { schoolId } = req.user;

  const data = await studentService.getTeachersList(schoolId, {
    search,
    subjectId,
    page: Number(page),
    limit: Number(limit)
  });

  res.status(200).json({
    success: true,
    message: 'Teachers retrieved successfully',
    data
  });
});

const getProfile = catchAsync(async (req, res) => {
  const { student, user } = req;

  const data = await studentService.getStudentProfile(student, user.userId);

  res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully',
    data
  });
});

const updateProfile = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { phone, address, avatarUrl } = req.body;
  const { student, user } = req;

  const data = await studentService.updateStudentProfile(student, user.userId, {
    phone,
    address,
    avatarUrl
  });

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data
  });
});

const getActivity = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { type, page = 1, limit = 20 } = req.query;
  const { student } = req;

  const data = await studentService.getActivityFeed(student.id, {
    type,
    page: Number(page),
    limit: Number(limit)
  });

  res.status(200).json({
    success: true,
    message: 'Activity feed retrieved successfully',
    data
  });
});

const getSettings = catchAsync(async (req, res) => {
  const { userId } = req.user;

  const data = await studentService.getSettings(userId);

  res.status(200).json({
    success: true,
    message: 'Settings retrieved successfully',
    data
  });
});

const updateSettings = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { notifications, preferences } = req.body;
  const { userId } = req.user;

  const data = await studentService.updateSettings(userId, {
    notifications,
    preferences
  });

  res.status(200).json({
    success: true,
    message: 'Settings updated successfully',
    data
  });
});

const changePassword = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }

  const { currentPassword, newPassword } = req.body;
  const { userId } = req.user;

  try {
    const data = await studentService.changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      data
    });
  } catch (error) {
    if (error.message === 'INVALID_CURRENT_PASSWORD') {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'UNAUTHORIZED'
      });
    }
    throw error;
  }
});

const getLocales = catchAsync(async (req, res) => {
  const data = studentService.getLocales();

  res.status(200).json({
    success: true,
    message: 'Locales retrieved successfully',
    data
  });
});

module.exports = {
  getMe,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getDashboard,
  getTimetable,
  getTerms,
  getAcademics,
  getAssignments,
  getAssignment,
  submitAssignment,
  getTeachers,
  getProfile,
  updateProfile,
  getActivity,
  getSettings,
  updateSettings,
  changePassword,
  getLocales
};

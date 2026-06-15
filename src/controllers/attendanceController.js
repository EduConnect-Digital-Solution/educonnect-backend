const AttendanceService = require('../services/attendanceService');
const catchAsync = require('../utils/catchAsync');
const { validationResult } = require('express-validator');

const getTeacherSchedule = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const { date, armId } = req.query;

  const data = await AttendanceService.getTeacherSchedule(userId, schoolId, { date, armId });

  res.status(200).json({
    success: true,
    data
  });
});

const getSessionStudents = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const { scheduleId } = req.params;
  const { className, subjectName, armId } = req.query;

  const data = await AttendanceService.getSessionStudents(userId, schoolId, scheduleId, {
    className, subjectName, armId
  });

  res.status(200).json({
    success: true,
    data
  });
});

const saveDraft = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId, schoolId } = req.user;
  const data = await AttendanceService.saveDraft(userId, schoolId, req.body);

  res.status(200).json({
    success: true,
    data
  });
});

const submitAttendance = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId, schoolId } = req.user;
  const data = await AttendanceService.submitAttendance(userId, schoolId, req.body);

  res.status(200).json({
    success: true,
    data
  });
});

const updateAttendance = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { userId, schoolId } = req.user;
  const { attendanceId } = req.params;
  const data = await AttendanceService.updateAttendance(userId, schoolId, attendanceId, req.body);

  res.status(200).json({
    success: true,
    data
  });
});

const getHistory = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const data = await AttendanceService.getHistory(userId, schoolId, req.query);

  res.status(200).json({
    success: true,
    data
  });
});

const getByDate = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const { date } = req.params;
  const { armId } = req.query;

  const data = await AttendanceService.getByDate(userId, schoolId, date, { armId });

  res.status(200).json({
    success: true,
    data
  });
});

const getSummary = catchAsync(async (req, res) => {
  const { userId, schoolId } = req.user;
  const { scheduleId } = req.params;

  const data = await AttendanceService.getSummary(userId, schoolId, scheduleId);

  res.status(200).json({
    success: true,
    data
  });
});

module.exports = {
  getTeacherSchedule,
  getSessionStudents,
  saveDraft,
  submitAttendance,
  updateAttendance,
  getHistory,
  getByDate,
  getSummary
};

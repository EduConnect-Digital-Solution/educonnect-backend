const express = require('express');
const router = express.Router();

const attendanceController = require('../controllers/attendanceController');
const {
  validateScheduleDate,
  validateDateParam,
  validateScheduleId,
  validateSessionStudents,
  validateDraftBody,
  validateSubmitBody,
  validateUpdateBody,
  validateHistoryQuery
} = require('../middleware/attendanceValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);
router.use(requireRole(['teacher']));

router.get('/attendance/schedule',
  validateScheduleDate,
  attendanceController.getTeacherSchedule
);

router.get('/attendance/sessions/:scheduleId/students',
  validateSessionStudents,
  attendanceController.getSessionStudents
);

router.post('/attendance/draft',
  validateDraftBody,
  attendanceController.saveDraft
);

router.post('/attendance/submit',
  validateSubmitBody,
  attendanceController.submitAttendance
);

router.put('/attendance/:attendanceId',
  validateUpdateBody,
  attendanceController.updateAttendance
);

router.get('/attendance/history',
  validateHistoryQuery,
  attendanceController.getHistory
);

router.get('/attendance/date/:date',
  validateDateParam,
  attendanceController.getByDate
);

router.get('/attendance/summary/:scheduleId',
  validateScheduleId,
  attendanceController.getSummary
);

module.exports = router;

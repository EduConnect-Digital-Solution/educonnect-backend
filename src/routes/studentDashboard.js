const express = require('express');
const router = express.Router();

const controller = require('../controllers/studentDashboardController');
const { authenticateStudent } = require('../middleware/studentAuth');
const {
  validateNotificationQuery,
  validateNotificationId,
  validateTimetableQuery,
  validateAcademicsQuery,
  validateAssignmentsQuery,
  validateAssignmentId,
  validateAssignmentSubmit,
  validateTeachersQuery,
  validateActivityQuery,
  validateProfileUpdate,
  validateSettingsUpdate,
  validatePasswordChange,
  validatePaginationDefaults
} = require('../middleware/studentValidation');

router.use(authenticateStudent);
router.use(validatePaginationDefaults);

router.get('/me', controller.getMe);

router.get('/notifications',
  validateNotificationQuery,
  controller.getNotifications
);

router.patch('/notifications/read-all',
  controller.markAllNotificationsRead
);

router.patch('/notifications/:id/read',
  validateNotificationId,
  controller.markNotificationRead
);

router.get('/dashboard',
  controller.getDashboard
);

router.get('/timetable',
  validateTimetableQuery,
  controller.getTimetable
);

router.get('/terms',
  controller.getTerms
);

router.get('/academics',
  validateAcademicsQuery,
  controller.getAcademics
);

router.get('/assignments',
  validateAssignmentsQuery,
  controller.getAssignments
);

router.get('/assignments/:assignmentId',
  validateAssignmentId,
  controller.getAssignment
);

router.post('/assignments/:assignmentId/submit',
  validateAssignmentId,
  validateAssignmentSubmit,
  controller.submitAssignment
);

router.get('/teachers',
  validateTeachersQuery,
  controller.getTeachers
);

router.get('/profile',
  controller.getProfile
);

router.patch('/profile',
  validateProfileUpdate,
  controller.updateProfile
);

router.get('/activity',
  validateActivityQuery,
  controller.getActivity
);

router.get('/settings',
  controller.getSettings
);

router.patch('/settings',
  validateSettingsUpdate,
  controller.updateSettings
);

router.post('/auth/change-password',
  validatePasswordChange,
  controller.changePassword
);

module.exports = router;

const express = require('express');
const adminRouter = express.Router();
const teacherRouter = express.Router();

const timetableController = require('../controllers/timetableController');
const {
  validateCompositeKey,
  validateDraftSave,
  validateConflictCheck,
  validatePublish
} = require('../middleware/timetableValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

adminRouter.use(authenticateToken);
adminRouter.use(requireRole(['admin']));

adminRouter.get('/draft',
  validateCompositeKey,
  timetableController.getDraft
);

adminRouter.post('/draft',
  validateDraftSave,
  timetableController.saveDraft
);

adminRouter.delete('/draft',
  validateCompositeKey,
  timetableController.deleteDraft
);

adminRouter.post('/check-conflicts',
  validateConflictCheck,
  timetableController.checkConflicts
);

adminRouter.post('/publish',
  validatePublish,
  timetableController.publishTimetable
);

adminRouter.get('/published',
  validateCompositeKey,
  timetableController.getPublished
);

teacherRouter.use(authenticateToken);
teacherRouter.use(requireRole(['teacher']));

teacherRouter.get('/today',
  timetableController.getTeacherTodaySchedule
);

module.exports = { adminTimetableRoutes: adminRouter, teacherTimetableRoutes: teacherRouter };

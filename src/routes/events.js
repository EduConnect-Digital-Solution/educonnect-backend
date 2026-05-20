const express = require('express');
const router = express.Router();

const eventsController = require('../controllers/eventsController');
const {
  validateGetEvents,
  validateCreateEvent,
  validateUpdateEvent,
  validateEventId,
  validateUpdateNotifications,
  validateSendNotification,
  validateGetLogs
} = require('../middleware/eventsValidation');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/events', validateGetEvents, eventsController.getEvents);
router.post('/events', validateCreateEvent, eventsController.createEvent);
router.put('/events/:eventId', validateUpdateEvent, eventsController.updateEvent);
router.delete('/events/:eventId', validateEventId, eventsController.deleteEvent);
router.put('/events/:eventId/notifications', validateUpdateNotifications, eventsController.updateEventNotifications);
router.get('/events/:eventId/notifications', validateEventId, eventsController.getEventNotifications);
router.post('/events/:eventId/notify', validateSendNotification, eventsController.sendNotificationOverride);

router.get('/notifications/logs', validateGetLogs, eventsController.getNotificationLogs);

module.exports = router;

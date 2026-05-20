const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const eventsService = require('../services/eventsService');

const getEvents = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { termId } = req.query;

    if (!termId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'termId query parameter is required' }
      });
    }

    const events = await prisma.event.findMany({
      where: { schoolId, termId },
      orderBy: { date: 'asc' }
    });

    res.json({
      success: true,
      data: { events }
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch events' }
    });
  }
};

const createEvent = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { termId, name, date, endDate, type, notifications } = req.body;

    if (!termId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'termId is required' }
      });
    }

    const eventErrors = eventsService.validateEventInput({ name, date, endDate, type });
    if (eventErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: eventErrors.map(e => e.message).join(', ') }
      });
    }

    const notifErrors = eventsService.validateNotificationsInput(notifications);
    if (notifErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: notifErrors.map(e => e.message).join(', ') }
      });
    }

    const event = await prisma.event.create({
      data: {
        schoolId,
        termId,
        name,
        date: new Date(date),
        endDate: endDate ? new Date(endDate) : null,
        type
      }
    });

    let notificationConfigId = null;

    if (notifications && (notifications.enabled === true || notifications.enabled === 'true')) {
      const config = await eventsService.upsertNotificationConfig(event.id, schoolId, notifications);
      notificationConfigId = config.id;
    }

    if (notificationConfigId) {
      await prisma.event.update({
        where: { id: event.id },
        data: { notificationConfigId }
      });
    }

    const created = await prisma.event.findUnique({
      where: { id: event.id }
    });

    res.status(201).json({
      success: true,
      data: { event: created }
    });
  } catch (error) {
    logger.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create event' }
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { eventId } = req.params;
    const { termId, name, date, endDate, type, notifications } = req.body;

    const existing = await prisma.event.findFirst({
      where: { id: eventId, schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (date !== undefined) {
      if (!eventsService.isValidISO(date)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'date must be a valid ISO8601 datetime' }
        });
      }
      updateData.date = new Date(date);
    }
    if (endDate !== undefined) {
      if (endDate !== null && !eventsService.isValidISO(endDate)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'endDate must be a valid ISO8601 datetime or null' }
        });
      }
      updateData.endDate = endDate ? new Date(endDate) : null;
    }
    if (type !== undefined) {
      if (!eventsService.VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `type must be one of: ${eventsService.VALID_TYPES.join(', ')}` }
        });
      }
      updateData.type = type;
    }

    let notificationConfigId = existing.notificationConfigId;

    if (notifications !== undefined) {
      if (notifications.enabled === false || notifications.enabled === 'false') {
        if (existing.notificationConfigId) {
          await prisma.notificationConfig.deleteMany({
            where: { eventId: existing.id }
          });
        }
        notificationConfigId = null;
      } else if (notifications.enabled === true || notifications.enabled === 'true') {
        const config = await eventsService.upsertNotificationConfig(existing.id, schoolId, notifications);
        notificationConfigId = config.id;
      }
    }

    updateData.notificationConfigId = notificationConfigId;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData
    });

    res.json({
      success: true,
      data: { event }
    });
  } catch (error) {
    logger.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update event' }
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { eventId } = req.params;

    const existing = await prisma.event.findFirst({
      where: { id: eventId, schoolId }
    });

    if (!existing) {
      return res.json({ success: true });
    }

    await prisma.event.delete({
      where: { id: eventId }
    });

    logger.info(`Deleted event ${eventId}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to delete event' }
    });
  }
};

const updateEventNotifications = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { eventId } = req.params;
    const { targets, channels, schedule } = req.body;

    const existing = await prisma.event.findFirst({
      where: { id: eventId, schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const notifErrors = eventsService.validateNotificationsInput({
      enabled: true,
      targets,
      channels,
      schedule
    });
    if (notifErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: notifErrors.map(e => e.message).join(', ') }
      });
    }

    const config = await eventsService.upsertNotificationConfig(eventId, schoolId, {
      targets: targets || { roles: [], classIds: [], userIds: [] },
      channels: channels || [],
      schedule: schedule || { type: 'immediate', sendAt: null }
    });

    const status = config.schedule.type === 'scheduled' ? 'scheduled' : 'processing';

    const updated = await prisma.notificationConfig.update({
      where: { id: config.id },
      data: { status }
    });

    res.json({
      success: true,
      data: { id: updated.id, status: updated.status }
    });
  } catch (error) {
    logger.error('Error updating notification config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update notification settings' }
    });
  }
};

const getEventNotifications = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { eventId } = req.params;

    const existing = await prisma.event.findFirst({
      where: { id: eventId, schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const config = await prisma.notificationConfig.findUnique({
      where: { eventId }
    });

    if (!config) {
      return res.json({
        success: true,
        data: {
          id: null,
          eventId,
          targets: { roles: [], classIds: [], userIds: [] },
          channels: [],
          schedule: { type: 'immediate', sendAt: null },
          status: 'draft'
        }
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching notification config:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notification settings' }
    });
  }
};

const sendNotificationOverride = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { eventId } = req.params;
    const { targets, channels, message } = req.body;

    const existing = await prisma.event.findFirst({
      where: { id: eventId, schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const recipients = await eventsService.resolveRecipients(schoolId, targets || {});

    const config = await eventsService.upsertNotificationConfig(eventId, schoolId, {
      targets: targets || { roles: [], classIds: [], userIds: [] },
      channels: channels || [],
      schedule: { type: 'immediate', sendAt: null }
    });

    await prisma.notificationConfig.update({
      where: { id: config.id },
      data: { status: 'processing' }
    });

    const logCount = await eventsService.createNotificationLogs(
      eventId,
      recipients,
      channels || [],
      'pending'
    );

    logger.info(`Queued notification for event ${eventId}: ${logCount} log entries, ${recipients.length} recipients`);

    res.json({
      success: true,
      message: 'Notification job queued successfully.'
    });
  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to send notification' }
    });
  }
};

const getNotificationLogs = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { eventId, status } = req.query;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'eventId query parameter is required' }
      });
    }

    const existing = await prisma.event.findFirst({
      where: { id: eventId, schoolId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' }
      });
    }

    const where = { eventId };
    if (status && eventsService.VALID_LOG_STATUSES.includes(status)) {
      where.status = status;
    }

    const total = await prisma.notificationLog.count({ where: { eventId } });
    const failed = await prisma.notificationLog.count({ where: { eventId, status: 'failed' } });

    const logs = await prisma.notificationLog.findMany({
      where,
      orderBy: { sentAt: { sort: 'desc', nulls: 'last' } }
    });

    res.json({
      success: true,
      data: { total, failed, logs }
    });
  } catch (error) {
    logger.error('Error fetching notification logs:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notification logs' }
    });
  }
};

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventNotifications,
  getEventNotifications,
  sendNotificationOverride,
  getNotificationLogs
};

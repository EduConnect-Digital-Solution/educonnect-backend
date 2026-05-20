const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

const RECIPIENT_BATCH_SIZE = 100;

const VALID_TYPES = ['holiday', 'exam', 'event'];
const VALID_CHANNELS = ['push', 'sms', 'email', 'in_app'];
const VALID_SCHEDULE_TYPES = ['immediate', 'scheduled'];
const VALID_STATUSES = ['draft', 'scheduled', 'processing', 'sent', 'failed'];
const VALID_LOG_STATUSES = ['sent', 'failed', 'pending'];
const VALID_USER_ROLES = ['admin', 'teacher', 'parent'];

const isValidISO = (str) => !isNaN(Date.parse(str));

const validateEventInput = ({ name, date, endDate, type }) => {
  const errors = [];
  if (!name || typeof name !== 'string') errors.push({ field: 'name', message: 'name is required' });
  if (!date || !isValidISO(date)) errors.push({ field: 'date', message: 'date must be a valid ISO8601 datetime' });
  if (endDate !== undefined && endDate !== null && !isValidISO(endDate)) {
    errors.push({ field: 'endDate', message: 'endDate must be a valid ISO8601 datetime or null' });
  }
  if (!type || !VALID_TYPES.includes(type)) {
    errors.push({ field: 'type', message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  return errors;
};

const validateNotificationsInput = (notifications) => {
  const errors = [];
  if (!notifications) return errors;

  if (notifications.enabled === true || notifications.enabled === 'true') {
    if (notifications.targets) {
      if (notifications.targets.roles && !Array.isArray(notifications.targets.roles)) {
        errors.push({ field: 'notifications.targets.roles', message: 'must be an array' });
      }
      if (notifications.targets.classIds && !Array.isArray(notifications.targets.classIds)) {
        errors.push({ field: 'notifications.targets.classIds', message: 'must be an array' });
      }
      if (notifications.targets.userIds && !Array.isArray(notifications.targets.userIds)) {
        errors.push({ field: 'notifications.targets.userIds', message: 'must be an array' });
      }
    }
    if (notifications.channels) {
      if (!Array.isArray(notifications.channels)) {
        errors.push({ field: 'notifications.channels', message: 'must be an array' });
      } else {
        for (const ch of notifications.channels) {
          if (!VALID_CHANNELS.includes(ch)) {
            errors.push({ field: 'notifications.channels', message: `invalid channel: ${ch}` });
          }
        }
      }
    }
    if (notifications.schedule) {
      if (!VALID_SCHEDULE_TYPES.includes(notifications.schedule.type)) {
        errors.push({ field: 'notifications.schedule.type', message: `must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}` });
      }
      if (notifications.schedule.type === 'scheduled') {
        if (!notifications.schedule.sendAt || !isValidISO(notifications.schedule.sendAt)) {
          errors.push({ field: 'notifications.schedule.sendAt', message: 'required ISO8601 when type is scheduled' });
        } else if (new Date(notifications.schedule.sendAt) <= new Date()) {
          errors.push({ field: 'notifications.schedule.sendAt', message: 'must be in the future' });
        }
      }
    }
  }
  return errors;
};

const resolveRecipients = async (schoolId, targets) => {
  const recipientSet = new Map();

  const { roles = [], classIds = [], userIds = [] } = targets || {};

  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });
    for (const u of users) {
      recipientSet.set(u.id, { recipientId: u.id, recipientName: `${u.firstName} ${u.lastName}` });
    }
  }

  if (classIds.length > 0) {
    const students = await prisma.student.findMany({
      where: { classId: { in: classIds }, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });
    for (const s of students) {
      if (!recipientSet.has(s.id)) {
        let name = `${s.firstName} ${s.lastName}`;
        if (roles.includes('parent')) {
          const parentLinks = await prisma.parentStudent.findMany({
            where: { studentId: s.id },
            include: { parent: { select: { id: true, firstName: true, lastName: true } } }
          });
          for (const link of parentLinks) {
            const pid = link.parent.id;
            if (!recipientSet.has(pid)) {
              recipientSet.set(pid, { recipientId: pid, recipientName: `${link.parent.firstName} ${link.parent.lastName}` });
            }
          }
        }
        if (roles.includes('student') || roles.length === 0) {
          recipientSet.set(s.id, { recipientId: s.id, recipientName: name });
        }
      }
    }

    if (roles.includes('teacher')) {
      const classRecords = await prisma.class.findMany({
        where: { id: { in: classIds }, schoolId },
        select: { id: true, arms: { select: { classTeacherId: true } } }
      });
      const teacherIds = new Set();
      for (const cls of classRecords) {
        for (const arm of cls.arms) {
          if (arm.classTeacherId) teacherIds.add(arm.classTeacherId);
        }
      }
      if (teacherIds.size > 0) {
        const teachers = await prisma.user.findMany({
          where: { id: { in: [...teacherIds] }, schoolId, isActive: true },
          select: { id: true, firstName: true, lastName: true }
        });
        for (const t of teachers) {
          if (!recipientSet.has(t.id)) {
            recipientSet.set(t.id, { recipientId: t.id, recipientName: `${t.firstName} ${t.lastName}` });
          }
        }
      }
    }
  }

  if (roles.length > 0 && classIds.length === 0 && userIds.length === 0) {
    const validRoles = roles.filter(r => VALID_USER_ROLES.includes(r));
    if (validRoles.length === 0) return [...recipientSet.values()];
    const users = await prisma.user.findMany({
      where: { role: { in: validRoles }, schoolId, isActive: true },
      select: { id: true, firstName: true, lastName: true }
    });
    for (const u of users) {
      if (!recipientSet.has(u.id)) {
        recipientSet.set(u.id, { recipientId: u.id, recipientName: `${u.firstName} ${u.lastName}` });
      }
    }
  }

  return [...recipientSet.values()];
};

const upsertNotificationConfig = async (eventId, schoolId, data) => {
  const targets = data.targets || { roles: [], classIds: [], userIds: [] };
  const channels = data.channels || [];
  const schedule = data.schedule || { type: 'immediate', sendAt: null };
  const status = schedule.type === 'scheduled' ? 'scheduled' : 'draft';

  const config = await prisma.notificationConfig.upsert({
    where: { eventId },
    update: { targets, channels, schedule, status },
    create: { eventId, targets, channels, schedule, status }
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { notificationConfigId: config.id }
  });

  return config;
};

const createNotificationLogs = async (eventId, recipients, channels, status = 'pending') => {
  const logs = [];
  for (const recipient of recipients) {
    for (const channel of channels) {
      logs.push({
        eventId,
        recipientId: recipient.recipientId,
        recipientName: recipient.recipientName,
        channel,
        status
      });
    }
  }

  const created = [];
  for (let i = 0; i < logs.length; i += RECIPIENT_BATCH_SIZE) {
    const batch = logs.slice(i, i + RECIPIENT_BATCH_SIZE);
    const result = await prisma.notificationLog.createMany({ data: batch });
    created.push(result.count);
  }

  return created.reduce((a, b) => a + b, 0);
};

module.exports = {
  VALID_TYPES,
  VALID_CHANNELS,
  VALID_SCHEDULE_TYPES,
  VALID_STATUSES,
  VALID_LOG_STATUSES,
  isValidISO,
  validateEventInput,
  validateNotificationsInput,
  resolveRecipients,
  upsertNotificationConfig,
  createNotificationLogs
};

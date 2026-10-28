const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const audit = require('./platformAuditService');
const invitationService = require('./invitationService');
const { findSchool } = require('./schoolLifecycleService');

/**
 * Invite teachers that were imported from a CSV, in bulk, on a school's
 * behalf. Each invitation claims the imported record, sets a temporary
 * password and emails the teacher. The temporary passwords are emailed and
 * never returned here.
 *
 * Invitations go out one at a time and are capped per call, because each one
 * sends an email and the email provider rate-limits bursts.
 */

const MAX_INVITES_PER_CALL = 100;

const importedTeacherWhere = (school) => ({
  schoolId: school.id,
  role: 'teacher',
  isVerified: false,
  invitedBy: null,
  isActive: true,
  deactivatedAt: null
});

const inviteImportedStaff = async (schoolCode, { userIds } = {}, actor, context = {}) => {
  const school = await findSchool(schoolCode);
  if (school.archivedAt || !school.isActive) {
    throw new AppError('This school is not active. Reactivate or restore it before inviting staff.', 409, 'SCHOOL_NOT_ACTIVE');
  }

  // The invitation is issued in the name of the school's own admin.
  const admin = school.adminUserId
    ? await prisma.user.findFirst({ where: { id: school.adminUserId, schoolId: school.id, role: 'admin', isActive: true } })
    : null;
  if (!admin) {
    throw new AppError('This school has no active admin to issue invitations', 409, 'NO_SCHOOL_ADMIN');
  }

  const where = { ...importedTeacherWhere(school), ...(userIds && userIds.length ? { id: { in: userIds } } : {}) };
  const targets = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: MAX_INVITES_PER_CALL,
    select: { id: true, firstName: true, lastName: true, email: true, subjects: true }
  });

  const results = [];
  for (const teacher of targets) {
    try {
      const invited = await invitationService.createTeacherInvitation(
        {
          email: teacher.email,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          subjects: teacher.subjects
        },
        school.id,
        admin.id
      );
      results.push({ userId: teacher.id, email: teacher.email, status: 'invited', emailSent: invited.emailSent });
    } catch (error) {
      logger.warn('Bulk invite failed for one teacher', { schoolCode, userId: teacher.id, message: error.message });
      results.push({ userId: teacher.id, email: teacher.email, status: 'failed', error: error.message });
    }
  }

  const invited = results.filter((result) => result.status === 'invited').length;
  const remaining = await prisma.user.count({ where: importedTeacherWhere(school) });

  await audit.record({
    action: 'staff.invite',
    entityType: 'school',
    entityId: school.schoolId,
    schoolId: school.id,
    actor,
    context,
    details: {
      schoolCode: school.schoolId,
      requested: userIds && userIds.length ? userIds.length : 'all',
      attempted: targets.length,
      invited,
      failed: results.length - invited
    }
  });

  return {
    attempted: targets.length,
    invited,
    failed: results.length - invited,
    remainingNotInvited: remaining,
    capPerCall: MAX_INVITES_PER_CALL,
    results
  };
};

module.exports = {
  MAX_INVITES_PER_CALL,
  inviteImportedStaff
};

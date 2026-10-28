const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const AccessGuard = require('./accessGuard');
const SessionService = require('./sessionService');
const CacheService = require('./cacheService');
const audit = require('./platformAuditService');
const { findSchool, REMOVED_EMAIL_DOMAIN } = require('./schoolLifecycleService');

/**
 * Removing a person does not delete them: grades, attendance and fee history
 * must keep pointing at someone. Instead the account is deactivated for good
 * and every piece of personal information is wiped, including the copies kept
 * on fee invoices and receipts.
 *
 * What is NOT scrubbed: free-text copies elsewhere (for example the payer
 * details a bank reports on a fee payment, or report-card snapshots). Those
 * are listed in docs/superadmin-god-mode.md.
 */

const REMOVED_STUDENT_NAME = { firstName: 'Removed', lastName: 'Student' };
const REMOVED_USER_NAME = { firstName: 'Removed', lastName: 'User' };

const removedEmailFor = (userId) => `removed-${userId}${REMOVED_EMAIL_DOMAIN}`;

const isRemovedUser = (user) => String(user.email || '').endsWith(REMOVED_EMAIL_DOMAIN);

const isRemovedStudent = (student) =>
  student.firstName === REMOVED_STUDENT_NAME.firstName &&
  student.lastName === REMOVED_STUDENT_NAME.lastName &&
  !student.email &&
  !student.isActive;

const schoolIdsFor = (school) => [school.id, school.schoolId];

/** A password nobody knows, hashed once and shared by every wiped account. */
const makeUnusablePasswordHash = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

const scrubUserRow = async (tx, user, school, { reason, actor, now, passwordHash }) => {
  await tx.user.update({
    where: { id: user.id },
    data: {
      ...REMOVED_USER_NAME,
      email: removedEmailFor(user.id),
      password: passwordHash,
      phone: null,
      address: null,
      profileImage: null,
      occupation: null,
      emergencyContact: null,
      emergencyPhone: null,
      invitationToken: null,
      invitationExpires: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      settings: Prisma.DbNull,
      isDeleted: true,
      isActive: false,
      deactivatedAt: now,
      deactivatedBy: actor,
      deactivationReason: reason
    }
  });

  // Pending invitations and one-time codes hold the person's email and name.
  await tx.invitation.deleteMany({ where: { schoolId: { in: schoolIdsFor(school) }, email: user.email } });
  await tx.oTP.deleteMany({ where: { schoolId: { in: schoolIdsFor(school) }, email: user.email } });
};

const scrubStudentRow = async (tx, student, school, { reason, actor, now }) => {
  await tx.student.update({
    where: { id: student.id },
    data: {
      ...REMOVED_STUDENT_NAME,
      email: null,
      phone: null,
      address: null,
      dateOfBirth: null,
      profileImage: null,
      notes: null,
      guardian: Prisma.DbNull,
      isDeleted: true,
      isActive: false,
      isEnrolled: false,
      deactivatedAt: now,
      deactivatedBy: actor,
      deactivationReason: reason
    }
  });

  // Fee documents keep a copy of the student's name.
  const invoices = await tx.feeInvoice.findMany({
    where: { schoolId: school.id, studentId: student.id },
    select: { id: true }
  });
  if (invoices.length === 0) return;

  await tx.feeInvoice.updateMany({
    where: { id: { in: invoices.map((invoice) => invoice.id) } },
    data: { studentName: `${REMOVED_STUDENT_NAME.firstName} ${REMOVED_STUDENT_NAME.lastName}` }
  });

  const payments = await tx.feePayment.findMany({
    where: { invoiceId: { in: invoices.map((invoice) => invoice.id) } },
    select: { id: true }
  });
  if (payments.length > 0) {
    await tx.feeReceipt.updateMany({
      where: { paymentId: { in: payments.map((payment) => payment.id) } },
      data: {
        studentInfo: {
          name: `${REMOVED_STUDENT_NAME.firstName} ${REMOVED_STUDENT_NAME.lastName}`,
          className: null
        }
      }
    });
  }
};

const endSessions = async (userIds) => {
  for (const userId of userIds) {
    AccessGuard.invalidateUser(userId);
    try {
      await SessionService.revokeAllSessions(String(userId));
    } catch (error) {
      logger.warn('Could not revoke sessions after removal', { userId, message: error.message });
    }
  }
};

const refreshCaches = async (school) => {
  try {
    await CacheService.invalidatePlatformCachesForSchool(school.schoolId);
  } catch (error) {
    logger.warn('Cache invalidation after removal failed', { schoolCode: school.schoolId, message: error.message });
  }
};

/**
 * Remove a user account (teacher, parent, admin, or a student's login).
 * A student profile linked to the account is wiped with it.
 */
const removeUser = async (schoolCode, userId, { reason }, actor, context = {}) => {
  const school = await findSchool(schoolCode);

  const user = await prisma.user.findFirst({ where: { id: userId, schoolId: school.id } });
  if (!user) throw new AppError('User not found in this school', 404, 'USER_NOT_FOUND');
  if (isRemovedUser(user)) throw new AppError('This user has already been removed', 409, 'ALREADY_REMOVED');
  if (school.adminUserId === user.id) {
    throw new AppError(
      'This is the primary admin of the school. Archive the school or hand over administration first.',
      409,
      'PRIMARY_ADMIN'
    );
  }

  const linkedStudent = await prisma.student.findFirst({ where: { userId: user.id, schoolId: school.id } });
  const passwordHash = await makeUnusablePasswordHash();
  const now = new Date();
  const scrubContext = { reason, actor, now, passwordHash };

  await prisma.$transaction(async (tx) => {
    await scrubUserRow(tx, user, school, scrubContext);
    if (linkedStudent) await scrubStudentRow(tx, linkedStudent, school, scrubContext);

    // The audit row records who and why, but not the personal details just wiped.
    await audit.recordInTransaction(tx, {
      action: 'user.remove',
      entityType: 'user',
      entityId: user.id,
      schoolId: school.id,
      actor,
      context,
      details: { schoolCode: school.schoolId, role: user.role, reason, studentProfileRemoved: Boolean(linkedStudent) }
    });
  });

  await endSessions([user.id]);
  await refreshCaches(school);

  return {
    removed: { type: 'user', id: user.id, role: user.role },
    studentProfileRemoved: linkedStudent ? linkedStudent.id : null
  };
};

/** Remove a student record, and the student's login if there is one. */
const removeStudent = async (schoolCode, studentId, { reason }, actor, context = {}) => {
  const school = await findSchool(schoolCode);

  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: school.id } });
  if (!student) throw new AppError('Student not found in this school', 404, 'STUDENT_NOT_FOUND');
  if (isRemovedStudent(student)) throw new AppError('This student has already been removed', 409, 'ALREADY_REMOVED');

  const linkedUser = student.userId
    ? await prisma.user.findFirst({ where: { id: student.userId, schoolId: school.id } })
    : null;
  const passwordHash = linkedUser ? await makeUnusablePasswordHash() : null;
  const now = new Date();
  const scrubContext = { reason, actor, now, passwordHash };

  await prisma.$transaction(async (tx) => {
    await scrubStudentRow(tx, student, school, scrubContext);
    if (linkedUser && !isRemovedUser(linkedUser)) await scrubUserRow(tx, linkedUser, school, scrubContext);

    await audit.recordInTransaction(tx, {
      action: 'student.remove',
      entityType: 'student',
      entityId: student.id,
      schoolId: school.id,
      actor,
      context,
      details: { schoolCode: school.schoolId, reason, loginRemoved: Boolean(linkedUser) }
    });
  });

  if (linkedUser) await endSessions([linkedUser.id]);
  await refreshCaches(school);

  return {
    removed: { type: 'student', id: student.id },
    loginRemoved: linkedUser ? linkedUser.id : null
  };
};

module.exports = {
  REMOVED_STUDENT_NAME,
  removedEmailFor,
  isRemovedUser,
  isRemovedStudent,
  removeUser,
  removeStudent
};

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const { generateUniqueSchoolCode } = require('../utils/schoolIdentifiers');
const AccessGuard = require('./accessGuard');
const SessionService = require('./sessionService');
const audit = require('./platformAuditService');
const {
  findSchool,
  withSystemNote,
  buildNote,
  invalidateCaches,
  REMOVED_EMAIL_DOMAIN
} = require('./schoolLifecycleService');

/**
 * Creating schools, switching them on and off, and switching individual
 * accounts on and off - the day-to-day half of the system admin's controls.
 *
 * Everything that changes data does so in one transaction together with its
 * audit row, so an action is never half done and never unrecorded.
 */

const TRIAL_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEACTIVATION_FLAG = 'deactivated';

const isDeactivationFlag = (flag) =>
  flag && (flag.flagType === DEACTIVATION_FLAG || String(flag.description || '').startsWith('School deactivated'));

// ---------------------------------------------------------------------------
// Create a school
// ---------------------------------------------------------------------------

const createSchool = async (schoolData, systemAdminId, context = {}) => {
  const {
    schoolName,
    email,
    password,
    phone,
    address,
    website,
    description,
    principalName,
    schoolType = 'public',
    subscriptionTier = 'basic',
    adminUserData = {}
  } = schoolData;

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.school.findFirst({ where: { email: normalizedEmail }, select: { id: true } });
  if (existing) throw new AppError('A school with this email already exists', 409, 'SCHOOL_EMAIL_EXISTS');

  // When no password is given, one is generated and shown once in the response.
  const generatedPassword = password ? null : crypto.randomBytes(9).toString('base64url');
  const passwordHash = await bcrypt.hash(password || generatedPassword, 12);
  const now = new Date();

  let created;
  try {
    created = await prisma.$transaction(async (tx) => {
      const schoolCode = await generateUniqueSchoolCode(tx, schoolName);

      const school = await tx.school.create({
        data: {
          schoolId: schoolCode,
          schoolName: schoolName.trim(),
          email: normalizedEmail,
          password: passwordHash,
          phone: phone ? phone.trim() : undefined,
          address: address ? address.trim() : undefined,
          website: website ? website.trim() : undefined,
          description: description ? description.trim() : undefined,
          schoolType,
          // Created by a system admin, so there is no email verification step.
          isVerified: true,
          isActive: true,
          systemConfig: {
            subscriptionTier,
            subscriptionStatus: 'trial',
            subscriptionStartDate: now,
            subscriptionEndDate: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
            features: [{ featureName: 'basic_features', isEnabled: true, enabledBy: systemAdminId, enabledAt: now }]
          },
          systemMetadata: withSystemNote(
            { createdBy: systemAdminId, ...(principalName ? { principalName: principalName.trim() } : {}) },
            buildNote('School created by system administrator', systemAdminId, 'general')
          )
        }
      });

      const adminUser = await tx.user.create({
        data: {
          schoolId: school.id,
          firstName: adminUserData.firstName || 'School',
          lastName: adminUserData.lastName || 'Admin',
          email: normalizedEmail,
          password: passwordHash,
          role: 'admin',
          isSchoolAdmin: true,
          isActive: true,
          isVerified: true,
          isTemporaryPassword: true // the admin should choose their own password
        }
      });

      await tx.school.update({ where: { id: school.id }, data: { adminUserId: adminUser.id } });

      await audit.recordInTransaction(tx, {
        action: 'school.create',
        entityType: 'school',
        entityId: school.schoolId,
        schoolId: school.id,
        actor: systemAdminId,
        context,
        details: { schoolCode: school.schoolId, schoolName: school.schoolName, subscriptionTier, passwordGenerated: Boolean(generatedPassword) }
      });

      return { school, adminUser };
    });
  } catch (error) {
    if (error && error.code === 'P2002') {
      throw new AppError('A school with this email already exists', 409, 'SCHOOL_EMAIL_EXISTS');
    }
    throw error;
  }

  await invalidateCaches(created.school.schoolId);

  return {
    school: {
      id: created.school.id,
      schoolId: created.school.schoolId,
      schoolName: created.school.schoolName,
      email: created.school.email,
      isActive: created.school.isActive,
      subscriptionTier,
      subscriptionStatus: 'trial',
      createdAt: created.school.createdAt
    },
    adminUser: {
      id: created.adminUser.id,
      firstName: created.adminUser.firstName,
      lastName: created.adminUser.lastName,
      email: created.adminUser.email,
      isTemporaryPassword: true
    },
    ...(generatedPassword
      ? { temporaryPassword: generatedPassword, temporaryPasswordNote: 'Shown once. Give it to the school admin securely; they should change it on first login.' }
      : {})
  };
};

// ---------------------------------------------------------------------------
// Switch a school off and on
// ---------------------------------------------------------------------------

const deactivateSchool = async (schoolCode, reason, systemAdminId, context = {}) => {
  const school = await findSchool(schoolCode);
  if (school.archivedAt) {
    throw new AppError('School is archived. Restore it instead of deactivating it.', 409, 'SCHOOL_ARCHIVED');
  }
  if (!school.isActive) throw new AppError('School is already inactive', 409, 'SCHOOL_ALREADY_INACTIVE');

  const now = new Date();
  const metadata = withSystemNote(
    school.systemMetadata,
    buildNote(`School deactivated: ${reason}`, systemAdminId, 'general'),
    { lastModifiedBy: systemAdminId }
  );
  metadata.flags = [
    ...(school.systemMetadata && school.systemMetadata.flags ? school.systemMetadata.flags : []),
    {
      flagType: DEACTIVATION_FLAG,
      description: `School deactivated: ${reason}`,
      createdBy: systemAdminId,
      isActive: true,
      createdAt: now.toISOString()
    }
  ];

  const affectedUsers = await prisma.user.count({ where: { schoolId: school.id, isActive: true } });

  await prisma.$transaction(async (tx) => {
    await tx.school.update({ where: { id: school.id }, data: { isActive: false, systemMetadata: metadata } });
    await audit.recordInTransaction(tx, {
      action: 'school.deactivate',
      entityType: 'school',
      entityId: school.schoolId,
      schoolId: school.id,
      actor: systemAdminId,
      context,
      details: { schoolCode: school.schoolId, schoolName: school.schoolName, reason, affectedUsers }
    });
  });

  await invalidateCaches(school.schoolId);

  return {
    school: { schoolId: school.schoolId, schoolName: school.schoolName, isActive: false, deactivatedAt: now, reason },
    affectedUsers
  };
};

const reactivateSchool = async (schoolCode, options = {}) => {
  const { reason, reactivatedBy, reactivatedAt, context = {} } = options;
  const actor = reactivatedBy || 'system';

  const school = await findSchool(schoolCode);
  if (school.archivedAt) {
    throw new AppError('School is archived. Use restore to bring it back.', 409, 'SCHOOL_ARCHIVED');
  }
  if (school.isActive) throw new AppError('School is already active', 409, 'SCHOOL_ALREADY_ACTIVE');

  const metadata = withSystemNote(
    school.systemMetadata,
    buildNote(`School reactivated: ${reason || 'No reason provided'}`, actor, 'general'),
    { lastModifiedBy: actor }
  );
  metadata.flags = ((school.systemMetadata && school.systemMetadata.flags) || []).filter((flag) => !isDeactivationFlag(flag));

  await prisma.$transaction(async (tx) => {
    await tx.school.update({ where: { id: school.id }, data: { isActive: true, systemMetadata: metadata } });
    await audit.recordInTransaction(tx, {
      action: 'school.reactivate',
      entityType: 'school',
      entityId: school.schoolId,
      schoolId: school.id,
      actor,
      context,
      details: { schoolCode: school.schoolId, schoolName: school.schoolName, reason }
    });
  });

  await invalidateCaches(school.schoolId);

  return {
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      isActive: true,
      reactivatedAt: reactivatedAt || new Date(),
      reason
    }
  };
};

// ---------------------------------------------------------------------------
// Switch an account off and on
// ---------------------------------------------------------------------------

// Who may become what. Parents can never become admins.
const ALLOWED_ROLE_TRANSITIONS = {
  admin: ['teacher'],
  teacher: ['admin'],
  parent: ['teacher']
};

const endSessions = async (userId) => {
  AccessGuard.invalidateUser(userId);
  try {
    await SessionService.revokeAllSessions(String(userId));
  } catch (error) {
    logger.warn('Could not revoke sessions', { userId, message: error.message });
  }
};

const planAccessChange = async (user, { action, newRole, schoolTransfer, reason }, actor) => {
  const changes = { before: {}, after: {} };
  const now = new Date();

  switch (action) {
    case 'activate':
      if (user.isActive && !user.deactivatedAt) throw new AppError('User is already active', 409, 'USER_ALREADY_ACTIVE');
      changes.before = { isActive: user.isActive };
      changes.after = { isActive: true };
      return {
        changes,
        description: 'Activate user',
        data: { isActive: true, deactivatedAt: null, deactivatedBy: null, deactivationReason: null }
      };

    case 'deactivate':
      if (!user.isActive && user.deactivatedAt) throw new AppError('User is already inactive', 409, 'USER_ALREADY_INACTIVE');
      changes.before = { isActive: user.isActive };
      changes.after = { isActive: false };
      return {
        changes,
        description: 'Deactivate user',
        data: { isActive: false, deactivatedAt: now, deactivatedBy: actor, deactivationReason: reason }
      };

    case 'change_role': {
      if (!newRole || newRole === user.role) throw new AppError('Invalid or same role specified', 400, 'INVALID_ROLE');
      const allowed = ALLOWED_ROLE_TRANSITIONS[user.role];
      if (!allowed || !allowed.includes(newRole)) {
        throw new AppError(
          `Role transition from ${user.role} to ${newRole} is not allowed. Allowed: ${allowed ? allowed.join(', ') : 'none'}`,
          400,
          'ROLE_TRANSITION_NOT_ALLOWED'
        );
      }
      const data = { role: newRole };
      if (newRole === 'teacher' && (!user.subjects || user.subjects.length === 0)) data.subjects = ['General'];
      if (newRole !== 'teacher') {
        data.subjects = [];
        data.classes = [];
      }
      changes.before = { role: user.role, subjects: user.subjects, classes: user.classes };
      changes.after = { role: newRole, subjects: data.subjects || user.subjects, classes: data.classes || user.classes };
      return { changes, description: `Change user role from ${user.role} to ${newRole}`, data };
    }

    case 'transfer_school': {
      // The request validator calls this targetSchoolId; older callers sent schoolId.
      const targetCode = schoolTransfer && (schoolTransfer.targetSchoolId || schoolTransfer.schoolId);
      if (!targetCode) throw new AppError('Target school ID required for transfer', 400, 'TARGET_SCHOOL_REQUIRED');
      const target = await prisma.school.findFirst({ where: { schoolId: targetCode } });
      if (!target) throw new AppError('Target school not found', 404, 'SCHOOL_NOT_FOUND');
      changes.before = { schoolId: user.schoolId };
      changes.after = { schoolId: target.id };
      return { changes, description: `Transfer user to school ${targetCode}`, data: { schoolId: target.id } };
    }

    default:
      throw new AppError('Invalid action specified', 400, 'INVALID_ACTION');
  }
};

const manageUserAccess = async (userId, permissions, systemAdminId, context = {}) => {
  const { action, reason } = permissions;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  if (String(user.email).endsWith(REMOVED_EMAIL_DOMAIN)) {
    throw new AppError('This account was removed and cannot be changed', 409, 'ACCOUNT_REMOVED');
  }

  const plan = await planAccessChange(user, permissions, systemAdminId);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.user.update({ where: { id: userId }, data: plan.data });
    await audit.recordInTransaction(tx, {
      action: `user.${action}`,
      entityType: 'user',
      entityId: userId,
      schoolId: user.schoolId,
      actor: systemAdminId,
      context,
      details: { operation: plan.description, reason, role: user.role, changes: plan.changes }
    });
    return result;
  });

  // Any change to an account ends its current logins: the new state (or role,
  // or school) applies from the next sign-in.
  await endSessions(userId);
  await invalidateCaches(updated.schoolId);

  return {
    user: {
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      role: updated.role,
      schoolId: updated.schoolId,
      isActive: updated.isActive,
      updatedAt: updated.updatedAt
    },
    action: plan.description,
    reason
  };
};

module.exports = {
  TRIAL_DAYS,
  isDeactivationFlag,
  createSchool,
  deactivateSchool,
  reactivateSchool,
  manageUserAccess
};

const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const AccessGuard = require('./accessGuard');
const CacheService = require('./cacheService');
const audit = require('./platformAuditService');

/**
 * School lifecycle for system admins: look at a school, archive it, delete it
 * and restore it.
 *
 * Nothing is ever physically deleted. Archive and delete both lock everyone
 * out and keep every row; "deleted" is the isDeleted flag, and a restore
 * clears it. Delete additionally hides the school from every list.
 */

const REMOVED_EMAIL_DOMAIN = '@removed.invalid';
const STAFF_ROLES = ['teacher', 'admin'];

const normalizeName = (value) => String(value || '').trim().toLowerCase();

const statusOf = (school) => {
  if (school.isDeleted) return 'deleted';
  if (school.archivedAt) return 'archived';
  return school.isActive ? 'active' : 'inactive';
};

const findSchool = async (schoolCode, client = prisma) => {
  const school = await client.school.findFirst({ where: { schoolId: schoolCode } });
  if (!school) throw new AppError('School not found', 404, 'SCHOOL_NOT_FOUND');
  return school;
};

const assertNameConfirmed = (school, confirmSchoolName) => {
  if (normalizeName(confirmSchoolName) !== normalizeName(school.schoolName)) {
    throw new AppError(
      'Type the exact school name to confirm this action',
      400,
      'CONFIRMATION_MISMATCH'
    );
  }
};

/** Append a note (and optional extra keys) to a school's system metadata. */
const withSystemNote = (metadata, note, extra = {}) => ({
  ...(metadata || {}),
  ...extra,
  systemNotes: [...((metadata && metadata.systemNotes) || []), note]
});

const buildNote = (text, actor, category = 'lifecycle') => ({
  note: text,
  createdBy: actor,
  category,
  createdAt: new Date().toISOString()
});

const invalidateCaches = async (schoolCode) => {
  AccessGuard.invalidateAll();
  try {
    await CacheService.invalidatePlatformCachesForSchool(schoolCode);
  } catch (error) {
    logger.warn('Cache invalidation after school change failed', { schoolCode, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Looking at a school
// ---------------------------------------------------------------------------

const schoolIdsFor = (school) => [school.id, school.schoolId];

const getSchoolDetail = async (schoolCode) => {
  const school = await findSchool(schoolCode);

  const [admin, teachers, parents, studentLogins, admins, students, activeStudents, classes, notInvited, pendingInvitations] =
    await Promise.all([
      school.adminUserId
        ? prisma.user.findUnique({
            where: { id: school.adminUserId },
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true, lastLoginAt: true }
          })
        : Promise.resolve(null),
      prisma.user.count({ where: { schoolId: school.id, role: 'teacher' } }),
      prisma.user.count({ where: { schoolId: school.id, role: 'parent' } }),
      prisma.user.count({ where: { schoolId: school.id, role: 'student' } }),
      prisma.user.count({ where: { schoolId: school.id, role: 'admin' } }),
      prisma.student.count({ where: { schoolId: school.id } }),
      prisma.student.count({ where: { schoolId: school.id, isActive: true } }),
      prisma.class.count({ where: { schoolId: school.id, isActive: true } }),
      prisma.user.count({ where: { schoolId: school.id, role: 'teacher', isVerified: false, invitedBy: null } }),
      prisma.invitation.count({
        where: { schoolId: { in: schoolIdsFor(school) }, status: 'pending', expiresAt: { gt: new Date() } }
      })
    ]);

  return {
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email,
      phone: school.phone,
      address: school.address,
      website: school.website,
      description: school.description,
      schoolType: school.schoolType,
      isVerified: school.isVerified,
      status: statusOf(school),
      subscription: {
        tier: school.systemConfig && school.systemConfig.subscriptionTier,
        status: school.systemConfig && school.systemConfig.subscriptionStatus,
        endsAt: school.systemConfig && school.systemConfig.subscriptionEndDate
      },
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    },
    admin,
    statistics: {
      admins,
      teachers,
      teachersNotYetInvited: notInvited,
      parents,
      studentLogins,
      students,
      activeStudents,
      activeClasses: classes,
      pendingInvitations
    },
    archive: school.archivedAt
      ? { archivedAt: school.archivedAt, archivedBy: school.archivedBy, reason: school.archiveReason }
      : null,
    deletion: school.isDeleted
      ? { deletedAt: school.deletedAt, deletedBy: school.deletedBy, reason: school.deleteReason }
      : null
  };
};

const pageArgs = ({ page, limit }) => {
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  return { take, currentPage, skip: (currentPage - 1) * take };
};

const searchFilter = (search, fields) =>
  search ? { OR: fields.map((field) => ({ [field]: { contains: search, mode: 'insensitive' } })) } : {};

const listStudents = async (schoolCode, { page, limit, search, status, classId } = {}) => {
  const school = await findSchool(schoolCode);
  const { take, currentPage, skip } = pageArgs({ page, limit });

  const where = {
    schoolId: school.id,
    isDeleted: false,
    ...searchFilter(search, ['firstName', 'lastName', 'studentId', 'email'])
  };
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (classId) where.classId = classId;

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        email: true,
        gender: true,
        rollNumber: true,
        isActive: true,
        isEnrolled: true,
        userId: true,
        createdAt: true,
        classRef: { select: { id: true, name: true } },
        arm: { select: { id: true, name: true } }
      }
    }),
    prisma.student.count({ where })
  ]);

  return {
    students: rows.map(({ userId, classRef, arm, ...student }) => ({
      ...student,
      className: classRef ? classRef.name : null,
      armName: arm ? arm.name : null,
      hasLogin: Boolean(userId)
    })),
    pagination: { page: currentPage, limit: take, total, pages: Math.ceil(total / take) }
  };
};

/**
 * Where a staff member stands:
 *   not_invited - imported record, no login yet
 *   invited     - has a login with a temporary password
 *   active      - signed up and in use
 *   inactive    - deactivated by an admin
 */
const staffStatusOf = (user) => {
  if (!user.isActive || user.deactivatedAt) return 'inactive';
  if (!user.isVerified && !user.invitedBy) return 'not_invited';
  if (user.isTemporaryPassword) return 'invited';
  return 'active';
};

const staffStatusFilter = (status) => {
  switch (status) {
    case 'not_invited': return { isVerified: false, invitedBy: null, isActive: true, deactivatedAt: null };
    case 'invited': return { isVerified: true, isTemporaryPassword: true, isActive: true, deactivatedAt: null };
    case 'active': return { isVerified: true, isTemporaryPassword: false, isActive: true, deactivatedAt: null };
    case 'inactive': return { OR: [{ isActive: false }, { deactivatedAt: { not: null } }] };
    default: return {};
  }
};

const listStaff = async (schoolCode, { page, limit, search, status, role } = {}) => {
  const school = await findSchool(schoolCode);
  const { take, currentPage, skip } = pageArgs({ page, limit });

  const where = {
    AND: [
      {
        schoolId: school.id,
        isDeleted: false,
        role: role && STAFF_ROLES.includes(role) ? role : { in: STAFF_ROLES },
        NOT: { email: { endsWith: REMOVED_EMAIL_DOMAIN } }
      },
      searchFilter(search, ['firstName', 'lastName', 'email']),
      staffStatusFilter(status)
    ]
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        subjects: true,
        isActive: true,
        isVerified: true,
        isTemporaryPassword: true,
        invitedBy: true,
        deactivatedAt: true,
        lastLoginAt: true,
        createdAt: true
      }
    }),
    prisma.user.count({ where })
  ]);

  return {
    staff: rows.map(({ invitedBy, isVerified, isTemporaryPassword, deactivatedAt, ...person }) => ({
      ...person,
      status: staffStatusOf({ ...person, invitedBy, isVerified, isTemporaryPassword, deactivatedAt })
    })),
    pagination: { page: currentPage, limit: take, total, pages: Math.ceil(total / take) }
  };
};

// ---------------------------------------------------------------------------
// Archive and restore
// ---------------------------------------------------------------------------

const archiveSchool = async (schoolCode, { reason, confirmSchoolName }, actor, context = {}) => {
  const school = await findSchool(schoolCode);
  if (school.archivedAt) throw new AppError('School is already archived', 409, 'SCHOOL_ALREADY_ARCHIVED');
  assertNameConfirmed(school, confirmSchoolName);

  const archivedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.school.update({
      where: { id: school.id },
      data: {
        isActive: false,
        archivedAt,
        archivedBy: actor,
        archiveReason: reason,
        systemMetadata: withSystemNote(
          school.systemMetadata,
          buildNote(`School archived: ${reason}`, actor),
          { lastModifiedBy: actor }
        )
      }
    });
    await audit.recordInTransaction(tx, {
      action: 'school.archive',
      entityType: 'school',
      entityId: school.schoolId,
      schoolId: school.id,
      actor,
      context,
      details: { schoolCode: school.schoolId, schoolName: school.schoolName, reason, wasActive: school.isActive }
    });
  });

  await invalidateCaches(school.schoolId);

  return { school: { schoolId: school.schoolId, schoolName: school.schoolName, status: 'archived', archivedAt } };
};

const restoreSchool = async (schoolCode, { reason }, actor, context = {}) => {
  const school = await findSchool(schoolCode);
  if (!school.archivedAt && !school.isDeleted) throw new AppError('School is neither archived nor deleted', 409, 'SCHOOL_NOT_ARCHIVED');

  await prisma.$transaction(async (tx) => {
    await tx.school.update({
      where: { id: school.id },
      data: {
        isActive: true,
        archivedAt: null,
        archivedBy: null,
        archiveReason: null,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        systemMetadata: withSystemNote(
          school.systemMetadata,
          buildNote(`School restored: ${reason}`, actor),
          { lastModifiedBy: actor }
        )
      }
    });
    await audit.recordInTransaction(tx, {
      action: 'school.restore',
      entityType: 'school',
      entityId: school.schoolId,
      schoolId: school.id,
      actor,
      context,
      details: { schoolCode: school.schoolId, schoolName: school.schoolName, reason, archivedAt: school.archivedAt }
    });
  });

  await invalidateCaches(school.schoolId);

  return { school: { schoolId: school.schoolId, schoolName: school.schoolName, status: 'active' } };
};

// ---------------------------------------------------------------------------
// Delete (soft)
// ---------------------------------------------------------------------------

const deleteSchool = async (schoolCode, { confirmSchoolName, reason }, actor, context = {}) => {
  const school = await findSchool(schoolCode);
  if (school.isDeleted) throw new AppError('School is already deleted', 409, 'SCHOOL_ALREADY_DELETED');
  assertNameConfirmed(school, confirmSchoolName);

  const deletedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.school.update({
      where: { id: school.id },
      data: {
        isDeleted: true,
        isActive: false,
        deletedAt,
        deletedBy: actor,
        deleteReason: reason,
        systemMetadata: withSystemNote(
          school.systemMetadata,
          buildNote(`School deleted: ${reason}`, actor),
          { lastModifiedBy: actor }
        )
      }
    });
    await audit.recordInTransaction(tx, {
      action: 'school.delete',
      entityType: 'school',
      entityId: school.schoolId,
      schoolId: school.id,
      actor,
      context,
      details: { schoolCode: school.schoolId, schoolName: school.schoolName, reason }
    });
  });

  await invalidateCaches(school.schoolId);
  return { school: { schoolId: school.schoolId, schoolName: school.schoolName, status: 'deleted', deletedAt } };
};

module.exports = {
  REMOVED_EMAIL_DOMAIN,
  STAFF_ROLES,
  normalizeName,
  statusOf,
  staffStatusOf,
  findSchool,
  withSystemNote,
  buildNote,
  invalidateCaches,
  getSchoolDetail,
  listStudents,
  listStaff,
  archiveSchool,
  restoreSchool,
  deleteSchool
};

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const listPermissions = async (schoolId) => {
  const permissions = await prisma.teacherPolicyPermission.findMany({
    where: { class: { schoolId } },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true } }
    },
    orderBy: { grantedAt: 'desc' }
  });

  const results = await Promise.all(permissions.map(async (p) => {
    const policyCount = await prisma.assessmentPolicy.count({
      where: { createdByTeacherId: p.teacherId, scopedClassId: p.classId }
    });
    return {
      id: p.id,
      teacherId: p.teacherId,
      teacherName: `${p.teacher.firstName} ${p.teacher.lastName}`,
      classId: p.class.id,
      className: p.class.name,
      grantedAt: p.grantedAt,
      policyCount
    };
  }));

  return { permissions: results };
};

const grantPermission = async (schoolId, teacherId, classId, grantedBy) => {
  const existing = await prisma.teacherPolicyPermission.findUnique({
    where: { teacherId_classId: { teacherId, classId } }
  });
  if (existing) return { conflict: true };

  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, schoolId, role: 'teacher' }
  });
  if (!teacher) return { teacherNotFound: true };

  const cls = await prisma.class.findFirst({
    where: { id: classId, schoolId }
  });
  if (!cls) return { classNotFound: true };

  const permission = await prisma.teacherPolicyPermission.create({
    data: { teacherId, classId, grantedBy },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      class: { select: { id: true, name: true } }
    }
  });

  logger.info(`Granted policy permission to teacher ${teacherId} for class ${classId}`);
  return {
    permission: {
      id: permission.id,
      teacherId: permission.teacherId,
      teacherName: `${permission.teacher.firstName} ${permission.teacher.lastName}`,
      classId: permission.class.id,
      className: permission.class.name,
      grantedAt: permission.grantedAt,
      policyCount: 0
    }
  };
};

const revokePermission = async (permissionId, schoolId) => {
  const permission = await prisma.teacherPolicyPermission.findFirst({
    where: { id: permissionId, class: { schoolId } }
  });
  if (!permission) return { notFound: true };

  await prisma.teacherPolicyPermission.delete({ where: { id: permissionId } });
  logger.info(`Revoked policy permission ${permissionId}`);
  return { revoked: true };
};

module.exports = { listPermissions, grantPermission, revokePermission };
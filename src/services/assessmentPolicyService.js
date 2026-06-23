const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const includeClause = {
  components: { orderBy: { sortOrder: 'asc' } },
  assignments: true
};

const includeWithMeta = {
  ...includeClause,
  createdByTeacher: { select: { id: true, firstName: true, lastName: true } },
  scopedClass: { select: { id: true, name: true } }
};

const formatPolicy = (policy) => ({
  id: policy.id,
  name: policy.name,
  description: policy.description,
  caComponents: policy.components.map(c => ({
    id: c.id,
    name: c.name,
    maxScore: c.maxScore,
    sortOrder: c.sortOrder
  })),
  caMax: policy.caMax,
  examMax: policy.examMax,
  total: policy.total,
  assignments: policy.assignments.map(a => ({
    id: a.id,
    scope: a.scope,
    scopeId: a.scopeId,
    scopeName: a.scopeName,
    secondaryScopeId: a.secondaryScopeId,
    secondaryScopeName: a.secondaryScopeName
  })),
  createdAt: policy.createdAt,
  updatedAt: policy.updatedAt,
  createdByRole: policy.createdByRole,
  createdByTeacherId: policy.createdByTeacherId,
  createdByTeacherName: policy.createdByTeacher
    ? `${policy.createdByTeacher.firstName} ${policy.createdByTeacher.lastName}`
    : null,
  scopedClassId: policy.scopedClassId,
  scopedClassName: policy.scopedClass ? policy.scopedClass.name : null
});

// ── Admin policy CRUD ──────────────────────────────────────────

const listPolicies = async (schoolId) => {
  const policies = await prisma.assessmentPolicy.findMany({
    where: { schoolId },
    include: includeWithMeta,
    orderBy: { createdAt: 'desc' }
  });
  return policies.map(formatPolicy);
};

const getPolicyById = async (policyId, schoolId) => {
  const policy = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, schoolId },
    include: includeWithMeta
  });
  if (!policy) return null;
  return formatPolicy(policy);
};

const createPolicy = async (schoolId, data) => {
  const { name, description, caComponents, examMax } = data;
  const caMax = caComponents.reduce((sum, c) => sum + c.maxScore, 0);

  const policy = await prisma.assessmentPolicy.create({
    data: {
      schoolId,
      name,
      description: description || null,
      caMax,
      examMax,
      total: caMax + examMax,
      createdByRole: 'admin',
      components: {
        create: caComponents.map((c, i) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder ?? i
        }))
      }
    },
    include: includeWithMeta
  });

  logger.info(`Created admin assessment policy ${policy.id} for school ${schoolId}`);
  return formatPolicy(policy);
};

const updatePolicy = async (policyId, schoolId, data) => {
  const existing = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, schoolId }
  });
  if (!existing) return null;

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  if (data.caComponents || data.examMax !== undefined) {
    const caComponents = data.caComponents || (await prisma.cAComponent.findMany({
      where: { policyId },
      orderBy: { sortOrder: 'asc' }
    }));
    const examMax = data.examMax !== undefined ? data.examMax : existing.examMax;
    const caMax = data.caComponents
      ? data.caComponents.reduce((sum, c) => sum + c.maxScore, 0)
      : caComponents.reduce((sum, c) => sum + c.maxScore, 0);

    updateData.caMax = caMax;
    updateData.examMax = examMax;
    updateData.total = caMax + examMax;
  }

  const policy = await prisma.assessmentPolicy.update({
    where: { id: policyId },
    data: {
      ...updateData,
      components: data.caComponents ? {
        deleteMany: {},
        create: data.caComponents.map((c, i) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder ?? i
        }))
      } : undefined
    },
    include: includeWithMeta
  });

  logger.info(`Updated assessment policy ${policyId} for school ${schoolId}`);
  return formatPolicy(policy);
};

const deletePolicy = async (policyId, schoolId) => {
  const existing = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, schoolId },
    include: { assignments: { take: 1 } }
  });
  if (!existing) return { notFound: true };
  if (existing.assignments.length > 0) return { hasAssignments: true };

  await prisma.assessmentPolicy.delete({ where: { id: policyId } });
  logger.info(`Deleted assessment policy ${policyId} from school ${schoolId}`);
  return { deleted: true };
};

const addAssignment = async (policyId, schoolId, data) => {
  const existing = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, schoolId }
  });
  if (!existing) return null;

  const assignment = await prisma.policyAssignment.create({
    data: {
      policyId,
      scope: data.scope,
      scopeId: data.scope === 'school' ? null : data.scopeId,
      scopeName: data.scope === 'school' ? null : data.scopeName,
      secondaryScopeId: data.scope === 'subject_class' ? data.secondaryScopeId : null,
      secondaryScopeName: data.scope === 'subject_class' ? data.secondaryScopeName : null
    }
  });

  logger.info(`Added ${data.scope} assignment to policy ${policyId}`);
  return {
    id: assignment.id,
    scope: assignment.scope,
    scopeId: assignment.scopeId,
    scopeName: assignment.scopeName,
    secondaryScopeId: assignment.secondaryScopeId,
    secondaryScopeName: assignment.secondaryScopeName
  };
};

const removeAssignment = async (policyId, assignmentId, schoolId) => {
  const policy = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, schoolId }
  });
  if (!policy) return { notFound: true };

  const assignment = await prisma.policyAssignment.findFirst({
    where: { id: assignmentId, policyId }
  });
  if (!assignment) return { notFound: true };

  await prisma.policyAssignment.delete({ where: { id: assignmentId } });
  logger.info(`Removed assignment ${assignmentId} from policy ${policyId}`);
  return { removed: true };
};

// ── Teacher policy CRUD ────────────────────────────────────────

const listTeacherPolicies = async (schoolId, classId) => {
  const where = { schoolId, createdByRole: 'teacher' };
  if (classId) where.scopedClassId = classId;

  const policies = await prisma.assessmentPolicy.findMany({
    where,
    include: includeWithMeta,
    orderBy: { createdAt: 'desc' }
  });
  return policies.map(formatPolicy);
};

const createTeacherPolicy = async (schoolId, teacherId, data, scopedClassId) => {
  const { name, description, caComponents, examMax } = data;
  const caMax = caComponents.reduce((sum, c) => sum + c.maxScore, 0);

  const policy = await prisma.assessmentPolicy.create({
    data: {
      schoolId,
      name,
      description: description || null,
      caMax,
      examMax,
      total: caMax + examMax,
      createdByRole: 'teacher',
      createdByTeacherId: teacherId,
      scopedClassId,
      components: {
        create: caComponents.map((c, i) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder ?? i
        }))
      }
    },
    include: includeWithMeta
  });

  logger.info(`Created teacher policy ${policy.id} by teacher ${teacherId}`);
  return formatPolicy(policy);
};

const getTeacherPolicy = async (policyId, teacherId) => {
  const policy = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, createdByTeacherId: teacherId },
    include: includeWithMeta
  });
  if (!policy) return null;
  return formatPolicy(policy);
};

const updateTeacherPolicy = async (policyId, teacherId, data) => {
  const existing = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, createdByTeacherId: teacherId }
  });
  if (!existing) return { notFound: true };

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  if (data.caComponents || data.examMax !== undefined) {
    const caComponents = data.caComponents || (await prisma.cAComponent.findMany({
      where: { policyId },
      orderBy: { sortOrder: 'asc' }
    }));
    const examMax = data.examMax !== undefined ? data.examMax : existing.examMax;
    const caMax = data.caComponents
      ? data.caComponents.reduce((sum, c) => sum + c.maxScore, 0)
      : caComponents.reduce((sum, c) => sum + c.maxScore, 0);

    updateData.caMax = caMax;
    updateData.examMax = examMax;
    updateData.total = caMax + examMax;
  }

  const policy = await prisma.assessmentPolicy.update({
    where: { id: policyId },
    data: {
      ...updateData,
      components: data.caComponents ? {
        deleteMany: {},
        create: data.caComponents.map((c, i) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder ?? i
        }))
      } : undefined
    },
    include: includeWithMeta
  });

  logger.info(`Teacher ${teacherId} updated policy ${policyId}`);
  return { policy: formatPolicy(policy) };
};

const deleteTeacherPolicy = async (policyId, teacherId, schoolId) => {
  const existing = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, createdByTeacherId: teacherId }
  });
  if (!existing) return { notFound: true };

  await prisma.assessmentPolicy.delete({ where: { id: policyId } });
  logger.info(`Teacher ${teacherId} deleted policy ${policyId}`);
  return { deleted: true };
};

// ── Teacher policy assignment management ───────────────────────

const addTeacherAssignment = async (policyId, teacherId, data, scopedClassId) => {
  const policy = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, createdByTeacherId: teacherId }
  });
  if (!policy) return { notFound: true };

  // Validate scope restrictions for teacher policies
  if (data.scope === 'school' || data.scope === 'subject') {
    return { invalidScope: true };
  }

  // Validate that scopeId belongs to teacher's class
  if (data.scope === 'arm') {
    const arm = await prisma.arm.findFirst({
      where: { id: data.scopeId, classId: scopedClassId }
    });
    if (!arm) return { invalidScopeId: true };
  }
  if (data.scope === 'subject_class') {
    const subject = await prisma.subject.findFirst({
      where: { id: data.scopeId, schoolId: policy.schoolId }
    });
    if (!subject) return { invalidScopeId: true };
  }

  const assignment = await prisma.policyAssignment.create({
    data: {
      policyId,
      scope: data.scope,
      scopeId: data.scope === 'class' ? null : data.scopeId,
      scopeName: data.scope === 'class' ? null : data.scopeName,
      secondaryScopeId: data.scope === 'subject_class' ? scopedClassId : null,
      secondaryScopeName: data.scope === 'subject_class' ? null : null
    }
  });

  return {
    assignment: {
      id: assignment.id,
      scope: assignment.scope,
      scopeId: assignment.scopeId,
      scopeName: assignment.scopeName,
      secondaryScopeId: assignment.secondaryScopeId,
      secondaryScopeName: assignment.secondaryScopeName
    }
  };
};

const removeTeacherAssignment = async (policyId, assignmentId, teacherId) => {
  const policy = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, createdByTeacherId: teacherId }
  });
  if (!policy) return { notFound: true };

  const assignment = await prisma.policyAssignment.findFirst({
    where: { id: assignmentId, policyId }
  });
  if (!assignment) return { notFound: true };

  await prisma.policyAssignment.delete({ where: { id: assignmentId } });
  return { removed: true };
};

// ── Effective policy resolution (dual-branch with isolation) ───

const getEffectivePolicy = async (schoolId, className, subjectName, armId, userId) => {
  const classRecord = await prisma.class.findFirst({
    where: { schoolId, name: className, isActive: true }
  });
  if (!classRecord) return null;

  const subjectRecord = await prisma.subject.findFirst({
    where: { schoolId, name: subjectName, isActive: true }
  });
  if (!subjectRecord) return null;

  // Check if the requesting teacher has a delegation permission
  let hasPermission = false;
  if (userId) {
    const perm = await prisma.teacherPolicyPermission.findFirst({
      where: { teacherId: userId, classId: classRecord.id }
    });
    hasPermission = !!perm;
  }

  const matchPriority = (assignment) => {
    if (assignment.scope === 'subject_class') return 0;
    if (assignment.scope === 'subject') return 1;
    if (assignment.scope === 'arm') return 2;
    if (assignment.scope === 'class') return 3;
    if (assignment.scope === 'school') return 4;
    return 5;
  };

  const resolveFromAssignments = async (whereExtra) => {
    const where = { ...whereExtra };
    const assignments = await prisma.policyAssignment.findMany({
      where,
      include: {
        policy: {
          include: {
            components: { orderBy: { sortOrder: 'asc' } }
          }
        }
      }
    });
    if (assignments.length === 0) return null;
    const best = assignments.sort((a, b) => matchPriority(a) - matchPriority(b))[0];
    if (!best || !best.policy) return null;
    return {
      id: best.policy.id,
      name: best.policy.name,
      caComponents: best.policy.components.map(c => ({
        id: c.id,
        name: c.name,
        maxScore: c.maxScore,
        sortOrder: c.sortOrder
      })),
      caMax: best.policy.caMax,
      examMax: best.policy.examMax
    };
  };

  if (hasPermission) {
    // Teacher-delegated branch — skip ALL admin policies
    const whereClause = {
      policy: { createdByRole: 'teacher', createdByTeacherId: userId },
      OR: [
        { scope: 'subject_class', scopeId: subjectRecord.id, secondaryScopeId: classRecord.id },
        ...(armId ? [{ scope: 'arm', scopeId: armId }] : []),
        { scope: 'class', policy: { scopedClassId: classRecord.id } }
      ]
    };
    const policy = await resolveFromAssignments(whereClause);
    return {
      policy,
      source: policy ? 'teacher' : null,
      hasPermission: true
    };
  }

  // Admin branch — ignore teacher policies entirely
  const whereClause = {
    policy: { createdByRole: 'admin' },
    OR: [
      { scope: 'subject_class', scopeId: subjectRecord.id, secondaryScopeId: classRecord.id },
      { scope: 'subject', scopeId: subjectRecord.id },
      ...(armId ? [{ scope: 'arm', scopeId: armId }] : []),
      { scope: 'class', scopeId: classRecord.id },
      { scope: 'school', policy: { schoolId } }
    ]
  };
  const policy = await resolveFromAssignments(whereClause);
  return {
    policy,
    source: policy ? 'admin' : null,
    hasPermission: false
  };
};

// ── Effective policy without auth (used by scoring service) ────

const resolvePolicyForScoring = async (schoolId, classId, subjectId) => {
  const assignments = await prisma.policyAssignment.findMany({
    where: {
      policy: { schoolId },
      OR: [
        { scope: 'subject_class', scopeId: subjectId, secondaryScopeId: classId },
        { scope: 'subject', scopeId: subjectId },
        { scope: 'class', scopeId: classId },
        { scope: 'school', policy: { schoolId } }
      ]
    },
    include: {
      policy: {
        include: { components: { orderBy: { sortOrder: 'asc' } } }
      }
    }
  });

  if (assignments.length === 0) return null;

  const matchPriority = (a) => {
    if (a.scope === 'subject_class') return 0;
    if (a.scope === 'subject') return 1;
    if (a.scope === 'class') return 2;
    if (a.scope === 'school') return 3;
    return 4;
  };

  const best = assignments.sort((a, b) => matchPriority(a) - matchPriority(b))[0];
  if (!best || !best.policy) return null;

  return {
    id: best.policy.id,
    name: best.policy.name,
    caComponents: best.policy.components.map(c => ({
      id: c.id,
      name: c.name,
      maxScore: c.maxScore,
      sortOrder: c.sortOrder
    })),
    caMax: best.policy.caMax,
    examMax: best.policy.examMax
  };
};

module.exports = {
  listPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  addAssignment,
  removeAssignment,
  getEffectivePolicy,
  resolvePolicyForScoring,
  // Teacher-specific
  listTeacherPolicies,
  createTeacherPolicy,
  getTeacherPolicy,
  updateTeacherPolicy,
  deleteTeacherPolicy,
  addTeacherAssignment,
  removeTeacherAssignment
};

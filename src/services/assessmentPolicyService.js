const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const includeClause = {
  components: { orderBy: { sortOrder: 'asc' } },
  assignments: true
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
  updatedAt: policy.updatedAt
});

const listPolicies = async (schoolId) => {
  const policies = await prisma.assessmentPolicy.findMany({
    where: { schoolId },
    include: includeClause,
    orderBy: { createdAt: 'desc' }
  });
  return policies.map(formatPolicy);
};

const getPolicyById = async (policyId, schoolId) => {
  const policy = await prisma.assessmentPolicy.findFirst({
    where: { id: policyId, schoolId },
    include: includeClause
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
      components: {
        create: caComponents.map((c, i) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder ?? i
        }))
      }
    },
    include: includeClause
  });

  logger.info(`Created assessment policy ${policy.id} for school ${schoolId}`);
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
    include: includeClause
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

const getEffectivePolicy = async (schoolId, className, subjectName, armId) => {
  const classRecord = await prisma.class.findFirst({
    where: { schoolId, name: className, isActive: true }
  });
  if (!classRecord) return null;

  const subjectRecord = await prisma.subject.findFirst({
    where: { schoolId, name: subjectName, isActive: true }
  });
  if (!subjectRecord) return null;

  const matchPriority = (assignment) => {
    if (assignment.scope === 'subject_class') return 0;
    if (assignment.scope === 'subject') return 1;
    if (assignment.scope === 'arm') return 2;
    if (assignment.scope === 'class') return 3;
    if (assignment.scope === 'school') return 4;
    return 5;
  };

  const assignments = await prisma.policyAssignment.findMany({
    where: {
      OR: [
        { scope: 'school', policy: { schoolId } },
        { scope: 'class', scopeId: classRecord.id, policy: { schoolId } },
        { scope: 'subject', scopeId: subjectRecord.id, policy: { schoolId } },
        { scope: 'subject_class', scopeId: subjectRecord.id, secondaryScopeId: classRecord.id, policy: { schoolId } },
        ...(armId ? [{ scope: 'arm', scopeId: armId, policy: { schoolId } }] : [])
      ]
    },
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

module.exports = {
  listPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  addAssignment,
  removeAssignment,
  getEffectivePolicy
};

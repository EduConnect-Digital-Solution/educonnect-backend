const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const sheetInclude = {
  entries: true
};

const formatSheet = (sheet) => {
  if (!sheet) return null;
  return {
    id: sheet.id,
    status: sheet.status,
    returnNote: sheet.returnNote,
    entries: sheet.entries.map(e => ({
      studentId: e.studentId,
      caScores: e.caScores,
      examScore: e.examScore
    })),
    submittedAt: sheet.submittedAt,
    updatedAt: sheet.updatedAt
  };
};

const getSheet = async (teacherId, schoolId, className, subjectName, termId) => {
  const classRecord = await prisma.class.findFirst({
    where: { schoolId, name: className, isActive: true }
  });
  if (!classRecord) return null;

  const subjectRecord = await prisma.subject.findFirst({
    where: { schoolId, name: subjectName, isActive: true }
  });
  if (!subjectRecord) return null;

  const sheet = await prisma.scoreSheet.findFirst({
    where: {
      teacherId,
      classId: classRecord.id,
      subjectId: subjectRecord.id,
      termId
    },
    include: sheetInclude
  });

  return formatSheet(sheet);
};

const createSheet = async (teacherId, schoolId, className, subjectName, termId) => {
  const classRecord = await prisma.class.findFirst({
    where: { schoolId, name: className, isActive: true }
  });
  if (!classRecord) throw new Error('Class not found');

  const subjectRecord = await prisma.subject.findFirst({
    where: { schoolId, name: subjectName, isActive: true }
  });
  if (!subjectRecord) throw new Error('Subject not found');

  const existing = await prisma.scoreSheet.findFirst({
    where: {
      teacherId,
      classId: classRecord.id,
      subjectId: subjectRecord.id,
      termId
    }
  });
  if (existing) {
    const sheet = await prisma.scoreSheet.findUnique({
      where: { id: existing.id },
      include: sheetInclude
    });
    return formatSheet(sheet);
  }

  const sheet = await prisma.scoreSheet.create({
    data: {
      schoolId,
      teacherId,
      classId: classRecord.id,
      subjectId: subjectRecord.id,
      termId,
      status: 'draft'
    },
    include: sheetInclude
  });

  logger.info(`Created score sheet ${sheet.id} for teacher ${teacherId}`);
  return formatSheet(sheet);
};

const saveEntries = async (sheetId, teacherId, schoolId, entries) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: sheetId, teacherId, schoolId }
  });
  if (!sheet) return null;
  if (sheet.status === 'submitted' || sheet.status === 'approved') return { locked: true };

  await prisma.scoreEntry.deleteMany({ where: { sheetId } });

  if (entries.length > 0) {
    await prisma.scoreEntry.createMany({
      data: entries.map(e => ({
        sheetId,
        studentId: e.studentId,
        caScores: e.caScores || {},
        examScore: e.examScore ?? null
      }))
    });
  }

  const updated = await prisma.scoreSheet.findUnique({
    where: { id: sheetId },
    include: sheetInclude
  });

  return formatSheet(updated);
};

const submitSheet = async (sheetId, teacherId, schoolId) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: sheetId, teacherId, schoolId },
    include: sheetInclude
  });
  if (!sheet) return null;
  if (sheet.status === 'approved') return { locked: true };
  if (sheet.status === 'submitted') return { alreadySubmitted: true };

  const policy = await resolvePolicyForSheet(schoolId, sheet.classId, sheet.subjectId);
  if (!policy) return { noPolicy: true };

  const validationErrors = [];
  for (const entry of sheet.entries) {
    const caScores = entry.caScores || {};
    for (const component of policy.caComponents) {
      const score = caScores[component.id];
      if (score !== undefined && score !== null) {
        if (score > component.maxScore) {
          validationErrors.push(
            `Student ${entry.studentId}: ${component.name} score (${score}) exceeds max (${component.maxScore})`
          );
        }
      }
    }
    if (entry.examScore !== null && entry.examScore !== undefined && entry.examScore > policy.examMax) {
      validationErrors.push(
        `Student ${entry.studentId}: exam score (${entry.examScore}) exceeds max (${policy.examMax})`
      );
    }
  }

  if (validationErrors.length > 0) {
    return { validationErrors };
  }

  const updated = await prisma.scoreSheet.update({
    where: { id: sheetId },
    data: {
      status: 'submitted',
      submittedAt: new Date()
    },
    include: sheetInclude
  });

  logger.info(`Score sheet ${sheetId} submitted by teacher ${teacherId}`);
  return formatSheet(updated);
};

const resolvePolicyForSheet = async (schoolId, classId, subjectId) => {
  const assignments = await prisma.policyAssignment.findMany({
    where: {
      OR: [
        { scope: 'school', policy: { schoolId } },
        { scope: 'class', scopeId: classId, policy: { schoolId } },
        { scope: 'subject', scopeId: subjectId, policy: { schoolId } },
        { scope: 'subject_class', scopeId: subjectId, secondaryScopeId: classId, policy: { schoolId } }
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

  const priority = (a) => {
    if (a.scope === 'subject_class') return 0;
    if (a.scope === 'subject') return 1;
    if (a.scope === 'class') return 2;
    if (a.scope === 'school') return 3;
    return 4;
  };

  const best = assignments.sort((a, b) => priority(a) - priority(b))[0];
  if (!best || !best.policy) return null;

  return {
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
  getSheet,
  createSheet,
  saveEntries,
  submitSheet
};

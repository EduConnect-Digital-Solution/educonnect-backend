const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const getMatrix = async (schoolId, termId) => {
  const arms = await prisma.arm.findMany({
    where: { schoolId, isActive: true },
    include: {
      class: { select: { id: true, name: true } },
      armSubjects: {
        include: {
          subject: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: [
      { class: { level: 'asc' } },
      { name: 'asc' }
    ]
  });

  const subjectMap = new Map();
  for (const arm of arms) {
    for (const armSubject of arm.armSubjects) {
      const subj = armSubject.subject;
      if (!subjectMap.has(subj.id)) {
        subjectMap.set(subj.id, { id: subj.id, name: subj.name });
      }
    }
  }
  const subjectList = Array.from(subjectMap.values());

  const sheets = await prisma.scoreSheet.findMany({
    where: {
      schoolId,
      termId,
      classId: { in: arms.map(a => a.classId) }
    },
    select: {
      id: true,
      classId: true,
      subjectId: true,
      status: true,
      teacherId: true,
      updatedAt: true,
      teacher: { select: { firstName: true, lastName: true } }
    }
  });

  const sheetMap = {};
  for (const sheet of sheets) {
    const key = `${sheet.classId}:${sheet.subjectId}`;
    sheetMap[key] = sheet;
  }

  const classIds = [...new Set(arms.map(a => a.classId))];
  const classNames = await prisma.class.findMany({
    where: { id: { in: classIds } },
    select: { id: true, name: true }
  });
  const classNameMap = {};
  for (const c of classNames) classNameMap[c.id] = c.name;

  const entryAggs = await prisma.assessmentEntry.groupBy({
    by: ['className', 'subjectName'],
    where: { schoolId, termId, className: { in: classNames.map(c => c.name) } },
    _count: { id: true },
    _max: { updatedAt: true }
  });
  const entryKey = (cn, sn) => `${cn}:${sn}`;
  const entryMap = {};
  for (const agg of entryAggs) {
    entryMap[entryKey(agg.className, agg.subjectName)] = {
      count: agg._count.id,
      lastUpdated: agg._max.updatedAt
    };
  }

  const mapStatus = (sheet) => {
    if (!sheet) return 'not_started';
    const legacyMap = { draft: 'in_progress', submitted: 'in_progress', returned: 'in_progress', approved: 'completed' };
    return legacyMap[sheet.status] || 'in_progress';
  };

  const matrix = arms.map(arm => {
    const subjects = (arm.armSubjects || []).map(armSubject => {
      const key = `${arm.classId}:${armSubject.subject.id}`;
      const sheet = sheetMap[key];
      const cn = classNameMap[arm.classId] || arm.class.name;
      const ek = entryKey(cn, armSubject.subject.name);
      const agg = entryMap[ek];

      const status = agg && agg.count > 0 ? 'in_progress' : mapStatus(sheet);

      return {
        subjectId: armSubject.subject.id,
        subjectName: armSubject.subject.name,
        teacherName: sheet ? `${sheet.teacher.firstName} ${sheet.teacher.lastName}` : null,
        status,
        entryCount: agg ? agg.count : 0,
        lastUpdated: agg?.lastUpdated || sheet?.updatedAt || null
      };
    });

    return {
      armId: arm.id,
      armName: arm.name,
      className: arm.class.name,
      subjects
    };
  });

  const counts = { total: 0, completed: 0, in_progress: 0, not_started: 0 };
  for (const arm of matrix) {
    for (const subj of arm.subjects) {
      counts.total++;
      counts[subj.status] = (counts[subj.status] || 0) + 1;
    }
  }

  return {
    termId,
    summary: counts,
    subjectList,
    matrix
  };
};

const approveSheet = async (sheetId, schoolId) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: sheetId, schoolId }
  });
  if (!sheet) return { notFound: true };
  if (sheet.status !== 'submitted') return { wrongStatus: true };

  const updated = await prisma.scoreSheet.update({
    where: { id: sheetId },
    data: {
      status: 'approved',
      approvedAt: new Date()
    },
    select: { id: true, status: true, approvedAt: true }
  });

  logger.info(`Score sheet ${sheetId} approved`);
  return { sheet: updated };
};

const returnSheet = async (sheetId, schoolId, note) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: sheetId, schoolId }
  });
  if (!sheet) return { notFound: true };
  if (sheet.status !== 'submitted') return { wrongStatus: true };

  const updated = await prisma.scoreSheet.update({
    where: { id: sheetId },
    data: {
      status: 'returned',
      returnNote: note || null,
      submittedAt: null
    },
    select: { id: true, status: true, returnNote: true }
  });

  logger.info(`Score sheet ${sheetId} returned with note`);
  return { sheet: updated };
};

const forceReturnSheet = async (sheetId, schoolId, note) => {
  const sheet = await prisma.scoreSheet.findFirst({
    where: { id: sheetId, schoolId }
  });
  if (!sheet) return { notFound: true };
  if (sheet.status === 'draft' || sheet.status === 'returned') {
    return { wrongStatus: true, message: 'Sheet is not in a terminal state (submitted/approved)' };
  }

  const updated = await prisma.scoreSheet.update({
    where: { id: sheetId },
    data: {
      status: 'returned',
      returnNote: note || null,
      submittedAt: null,
      approvedAt: null
    },
    select: { id: true, status: true, returnNote: true }
  });

  logger.info(`Score sheet ${sheetId} force-returned by admin`);
  return { sheet: updated };
};

module.exports = { getMatrix, approveSheet, returnSheet, forceReturnSheet };

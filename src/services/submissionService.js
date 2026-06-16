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

  const matrix = arms.map(arm => {
    const subjects = (arm.armSubjects || []).map(armSubject => {
      const key = `${arm.classId}:${armSubject.subject.id}`;
      const sheet = sheetMap[key];
      return {
        subjectId: armSubject.subject.id,
        subjectName: armSubject.subject.name,
        sheetId: sheet?.id || null,
        status: sheet?.status || 'not_started',
        teacherName: sheet ? `${sheet.teacher.firstName} ${sheet.teacher.lastName}` : null,
        updatedAt: sheet?.updatedAt || null
      };
    });

    return {
      armId: arm.id,
      armName: arm.name,
      className: arm.class.name,
      subjects
    };
  });

  const counts = { total: 0, approved: 0, submitted: 0, draft: 0, returned: 0, not_started: 0 };
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

module.exports = { getMatrix, approveSheet, returnSheet };

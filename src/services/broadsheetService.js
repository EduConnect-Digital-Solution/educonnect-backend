const { prisma } = require('../config/database');
const GradingScaleService = require('./gradingScaleService');
const logger = require('../utils/logger');

const getBroadsheet = async (schoolId, armId, termId) => {
  const arm = await prisma.arm.findFirst({
    where: { id: armId, schoolId, isActive: true },
    include: {
      class: { select: { id: true, name: true } },
      armSubjects: {
        include: {
          subject: { select: { id: true, name: true } }
        }
      },
      students: {
        where: { isActive: true, isEnrolled: true },
        select: { id: true, firstName: true, lastName: true, studentId: true }
      }
    }
  });

  if (!arm) return null;

  const className = arm.class.name;
  const subjectIds = arm.armSubjects.map(as => as.subject.id);
  const subjectList = arm.armSubjects.map(as => ({
    id: as.subject.id,
    name: as.subject.name
  }));

  const term = await prisma.academicTerm.findUnique({
    where: { id: termId },
    select: { name: true }
  });

  const totalSubjects = subjectIds.length;

  // ── Determine status per subject ────────────────────────
  const sheets = await prisma.scoreSheet.findMany({
    where: {
      schoolId,
      termId,
      classId: arm.classId,
      subjectId: { in: subjectIds }
    },
    select: { id: true, subjectId: true, status: true }
  });
  const sheetMap = {};
  for (const sheet of sheets) {
    sheetMap[sheet.subjectId] = sheet;
  }

  const entries = await prisma.assessmentEntry.findMany({
    where: { schoolId, termId, className },
    include: { scores: true }
  });

  const entrySubjectMap = {};
  for (const entry of entries) {
    const sn = entry.subjectName;
    if (!entrySubjectMap[sn]) entrySubjectMap[sn] = [];
    entrySubjectMap[sn].push(entry);
  }

  const mapStatus = (sheet) => {
    if (!sheet) return 'not_started';
    const legacyMap = { draft: 'in_progress', submitted: 'in_progress', returned: 'in_progress', approved: 'completed' };
    return legacyMap[sheet.status] || 'in_progress';
  };

  const subjectStatuses = subjectList.map(subject => {
    const sheet = sheetMap[subject.id];
    const subjEntries = entrySubjectMap[subject.name] || [];
    if (subjEntries.length > 0) {
      const allScored = subjEntries.every(e =>
        e.scores.length === arm.students.length
      );
      return { subjectName: subject.name, status: allScored ? 'completed' : 'in_progress' };
    }
    return { subjectName: subject.name, status: mapStatus(sheet) };
  });

  const completedCount = subjectStatuses.filter(s => s.status === 'completed').length;
  const allComplete = completedCount === totalSubjects;

  const pending = subjectStatuses.filter(s => s.status !== 'completed');

  if (!allComplete) {
    return {
      armId: arm.id,
      armName: arm.name,
      className,
      termId,
      termName: term ? term.name : null,
      readiness: {
        allComplete: false,
        total: totalSubjects,
        completed: completedCount,
        pending
      },
      subjects: subjectList,
      students: []
    };
  }

  // ── Compile scores from assessment entries ──────────────
  const entryScoresMap = {};
  for (const entry of entries) {
    const sn = entry.subjectName;
    if (!entryScoresMap[sn]) entryScoresMap[sn] = {};
    for (const sc of entry.scores) {
      if (!entryScoresMap[sn][sc.studentId]) entryScoresMap[sn][sc.studentId] = 0;
      entryScoresMap[sn][sc.studentId] += sc.score;
    }
  }

  // Fallback to legacy sheets for subjects without new entries
  const legacySheetData = await prisma.scoreSheet.findMany({
    where: {
      schoolId,
      termId,
      classId: arm.classId,
      subjectId: { in: subjectIds.filter(sid => {
        const subj = subjectList.find(s => s.id === sid);
        return subj && !entrySubjectMap[subj.name];
      })}
    },
    include: { entries: true }
  });
  const legacySheetMap = {};
  for (const sheet of legacySheetData) {
    legacySheetMap[sheet.subjectId] = sheet;
  }

  const students = arm.students.map(student => {
    const scores = {};
    let totalScore = 0;
    let totalGradePoints = 0;
    let subjectsWithScores = 0;

    for (const subject of subjectList) {
      const entryScores = entryScoresMap[subject.name];
      let ca = 0;
      let exam = 0;
      let total = 0;

      if (entryScores && entryScores[student.id] != null) {
        total = entryScores[student.id];
        ca = total;
      } else {
        // Fallback to legacy sheet
        const sheet = legacySheetMap[subject.id];
        if (sheet) {
          const entry = sheet.entries.find(e => e.studentId === student.id);
          if (entry) {
            ca = entry.caScores
              ? Object.values(entry.caScores).reduce((sum, v) => sum + (Number(v) || 0), 0)
              : 0;
            exam = entry.examScore || 0;
            total = ca + exam;
          } else {
            scores[subject.id] = null;
            continue;
          }
        } else {
          scores[subject.id] = null;
          continue;
        }
      }

      const percentage = total;
      const gradeResult = GradingScaleService.resolveGrade(schoolId, percentage);

      scores[subject.id] = { ca, exam, total, grade: gradeResult ? gradeResult.label : null };

      totalScore += total;
      if (gradeResult && gradeResult.gradePoints != null) {
        totalGradePoints += gradeResult.gradePoints;
      }
      subjectsWithScores++;
    }

    const average = subjectsWithScores > 0
      ? Math.round((totalScore / subjectsWithScores) * 10) / 10
      : 0;

    const gradePointAverage = subjectsWithScores > 0
      ? Math.round((totalGradePoints / subjectsWithScores) * 100) / 100
      : 0;

    return {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      admissionNo: student.studentId || null,
      scores,
      totalScore,
      average,
      gradePointAverage,
      position: 0
    };
  });

  students.sort((a, b) => b.totalScore - a.totalScore);

  let currentPos = 1;
  for (let i = 0; i < students.length; i++) {
    if (i > 0 && students[i].totalScore < students[i - 1].totalScore) {
      currentPos = i + 1;
    }
    students[i].position = currentPos;
  }

  logger.info(`Broadsheet compiled for arm ${armId}, term ${termId}`);

  return {
    armId: arm.id,
    armName: arm.name,
    className,
    termId,
    termName: term ? term.name : null,
    readiness: {
      allComplete: true,
      total: totalSubjects,
      completed: completedCount,
      pending: []
    },
    subjects: subjectList,
    students
  };
};

module.exports = { getBroadsheet };

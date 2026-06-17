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

  const sheets = await prisma.scoreSheet.findMany({
    where: {
      schoolId,
      termId,
      classId: arm.classId,
      subjectId: { in: subjectIds }
    },
    include: {
      entries: true
    }
  });

  const totalSubjects = subjectIds.length;

  const sheetMap = {};
  for (const sheet of sheets) {
    sheetMap[sheet.subjectId] = sheet;
  }

  const subjectStatuses = subjectList.map(subject => {
    const sheet = sheetMap[subject.id];
    return {
      subjectName: subject.name,
      status: sheet?.status || 'not_started'
    };
  });

  const approvedCount = subjectStatuses.filter(s => s.status === 'approved').length;
  const allApproved = approvedCount === totalSubjects;

  const pending = subjectStatuses.filter(s => s.status !== 'approved');

  if (!allApproved) {
    return {
      armId: arm.id,
      armName: arm.name,
      className,
      termId,
      termName: term ? term.name : null,
      readiness: {
        allApproved: false,
        total: totalSubjects,
        approved: approvedCount,
        pending
      },
      subjects: subjectList,
      students: []
    };
  }

  const students = arm.students.map(student => {
    const scores = {};
    let totalScore = 0;
    let totalGradePoints = 0;
    let subjectsWithScores = 0;

    for (const subject of subjectList) {
      const sheet = sheetMap[subject.id];
      if (!sheet) {
        scores[subject.id] = null;
        continue;
      }

      const entry = sheet.entries.find(e => e.studentId === student.id);
      if (!entry) {
        scores[subject.id] = null;
        continue;
      }

      const ca = entry.caScores
        ? Object.values(entry.caScores).reduce((sum, v) => sum + (Number(v) || 0), 0)
        : 0;
      const exam = entry.examScore || 0;
      const total = ca + exam;
      const percentage = total;

      const gradeResult = GradingScaleService.resolveGrade(schoolId, percentage);

      scores[subject.id] = {
        ca,
        exam,
        total,
        grade: gradeResult ? gradeResult.label : null
      };

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
      allApproved: true,
      total: totalSubjects,
      approved: approvedCount,
      pending: []
    },
    subjects: subjectList,
    students
  };
};

module.exports = { getBroadsheet };

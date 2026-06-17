const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const DEFAULT_BLOCKS = [
  { id: 'blk_header', type: 'header', label: 'School Header & Crest', enabled: true },
  { id: 'blk_student', type: 'student-info', label: 'Student Information', enabled: true },
  { id: 'blk_results', type: 'results-table', label: 'Results Table', enabled: true },
  { id: 'blk_attendance', type: 'attendance', label: 'Attendance Summary', enabled: false },
  { id: 'blk_traits', type: 'traits', label: 'Affective Traits', enabled: false },
  { id: 'blk_comments', type: 'comments', label: 'Class Teacher\'s Comments', enabled: true },
  { id: 'blk_signatures', type: 'signatures', label: 'Signatures', enabled: true }
];

const DEFAULT_TRAITS = ['Punctuality', 'Conduct', 'Neatness', 'Participation', 'Leadership'];

// ===== RESULT PUBLISHING =====

const getPublishStatus = async (schoolId, termId, classId) => {
  const [sheets, school, term] = await Promise.all([
    prisma.scoreSheet.findMany({
      where: { schoolId, termId, classId },
      select: { status: true }
    }),
    prisma.school.findUnique({
      where: { id: schoolId },
      select: { defaultGradingScaleId: true }
    }),
    prisma.academicTerm.findUnique({
      where: { id: termId },
      select: { startDate: true, endDate: true }
    })
  ]);

  const total = sheets.length;
  const approved = sheets.filter(s => s.status === 'approved').length;
  const allApproved = total > 0 && approved === total;
  const schemesAssigned = !!school?.defaultGradingScaleId;
  const termDatesSet = !!(term?.startDate && term?.endDate);

  const publication = await prisma.resultPublication.findUnique({
    where: {
      schoolId_termId_classId: { schoolId, termId, classId }
    }
  });

  const published = publication?.published || false;

  return {
    published,
    publishedAt: publication?.publishedAt || null,
    checklist: {
      allApproved: {
        passed: allApproved,
        label: 'All score sheets approved',
        detail: allApproved
          ? `All ${total} score sheet(s) have been approved`
          : `${approved} of ${total} score sheet(s) approved`
      },
      schemesAssigned: {
        passed: schemesAssigned,
        label: 'Grading scheme assigned to every subject',
        detail: schemesAssigned
          ? 'Default grading scale is configured'
          : 'No default grading scale has been set'
      },
      termDatesSet: {
        passed: termDatesSet,
        label: 'Academic term dates are set',
        detail: termDatesSet
          ? 'Term start and end dates are configured'
          : 'Term dates have not been set'
      }
    }
  };
};

const publishResults = async (schoolId, termId, classId, userId) => {
  const publication = await prisma.resultPublication.upsert({
    where: {
      schoolId_termId_classId: { schoolId, termId, classId }
    },
    update: {
      published: true,
      publishedAt: new Date(),
      publishedBy: userId
    },
    create: {
      schoolId,
      termId,
      classId,
      published: true,
      publishedAt: new Date(),
      publishedBy: userId
    }
  });

  logger.info(`Results published for term ${termId}, class ${classId} by user ${userId}`);
  return {
    published: publication.published,
    publishedAt: publication.publishedAt
  };
};

// ===== PDF JOBS =====

const createPdfJob = async (schoolId, type, metadata) => {
  const job = await prisma.pdfJob.create({
    data: {
      schoolId,
      type,
      status: 'processing',
      progress: 0,
      metadata: metadata || {}
    }
  });

  logger.info(`PDF job ${job.id} created for ${type}`);

  process.nextTick(async () => {
    try {
      await simulatePdfGeneration(job.id);
    } catch (err) {
      logger.error(`PDF job ${job.id} failed:`, err);
    }
  });

  return { jobId: job.id };
};

const getPdfJob = async (schoolId, jobId) => {
  const job = await prisma.pdfJob.findFirst({
    where: { id: jobId, schoolId }
  });

  if (!job) return null;

  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    downloadUrl: job.downloadUrl
  };
};

const simulatePdfGeneration = async (jobId) => {
  await prisma.pdfJob.update({
    where: { id: jobId },
    data: { progress: 50 }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  await prisma.pdfJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      progress: 100,
      downloadUrl: `/api/admin/results/pdf-jobs/${jobId}/download`
    }
  });

  logger.info(`PDF job ${jobId} completed`);
};

// ===== REPORT CARD TEMPLATE =====

const getTemplate = async (schoolId) => {
  let template = await prisma.reportCardTemplate.findUnique({
    where: { schoolId }
  });

  if (!template) {
    template = await prisma.reportCardTemplate.create({
      data: {
        schoolId,
        orientation: 'portrait',
        accent: 'blue',
        blocks: DEFAULT_BLOCKS
      }
    });
  }

  return {
    orientation: template.orientation,
    accent: template.accent,
    blocks: template.blocks
  };
};

const saveTemplate = async (schoolId, data) => {
  const template = await prisma.reportCardTemplate.upsert({
    where: { schoolId },
    update: {
      orientation: data.orientation || undefined,
      accent: data.accent || undefined,
      blocks: data.blocks || undefined
    },
    create: {
      schoolId,
      orientation: data.orientation || 'portrait',
      accent: data.accent || 'blue',
      blocks: data.blocks || DEFAULT_BLOCKS
    }
  });

  logger.info(`Report card template saved for school ${schoolId}`);
  return {
    orientation: template.orientation,
    accent: template.accent,
    blocks: template.blocks
  };
};

// ===== REPORT CARD COMMENTS =====

const getCommentsWorklist = async (schoolId, armId, termId) => {
  const arm = await prisma.arm.findFirst({
    where: { id: armId, schoolId, isActive: true },
    include: {
      students: {
        where: { isActive: true, isEnrolled: true },
        select: { id: true, firstName: true, lastName: true, studentId: true }
      }
    }
  });

  if (!arm) return null;

  const existingComments = await prisma.reportCardComment.findMany({
    where: { schoolId, armId, termId }
  });

  const commentMap = {};
  for (const c of existingComments) {
    commentMap[c.studentId] = c;
  }

  const students = arm.students.map(student => {
    const existing = commentMap[student.id];
    return {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      admissionNo: student.studentId || null,
      comment: existing?.comment || null,
      traits: existing?.traits || null,
      status: existing?.status || 'pending'
    };
  });

  return {
    traits: DEFAULT_TRAITS,
    students
  };
};

const saveComment = async (schoolId, studentId, data) => {
  const { armId, termId, comment, traits } = data;

  const status = comment ? 'completed' : 'pending';

  const saved = await prisma.reportCardComment.upsert({
    where: {
      studentId_armId_termId: { studentId, armId, termId }
    },
    update: {
      comment: comment || null,
      traits: traits || undefined,
      status
    },
    create: {
      schoolId,
      studentId,
      armId,
      termId,
      comment: comment || null,
      traits: traits || {},
      status
    }
  });

  logger.info(`Comment saved for student ${studentId} in arm ${armId}, term ${termId}`);
  return {
    studentId: saved.studentId,
    status: saved.status
  };
};

// ===== REPORT CARD GENERATE =====

const generateReportCards = async (schoolId, armId, termId) => {
  const job = await createPdfJob(schoolId, 'report_card', { armId, termId });
  logger.info(`Report card generation started for arm ${armId}, term ${termId}`);
  return job;
};

// ===== REPORT CARD SIGN-OFF =====

const signOff = async (schoolId, armId, termId, userId) => {
  const publication = await prisma.reportCardPublication.upsert({
    where: {
      schoolId_armId_termId: { schoolId, armId, termId }
    },
    update: {
      signedOff: true,
      signedAt: new Date(),
      signedBy: userId
    },
    create: {
      schoolId,
      armId,
      termId,
      signedOff: true,
      signedAt: new Date(),
      signedBy: userId
    }
  });

  logger.info(`Report cards signed off for arm ${armId}, term ${termId} by user ${userId}`);
  return {
    signedOff: publication.signedOff,
    signedAt: publication.signedAt
  };
};

// ===== REPORT CARD PUBLISH TO PARENTS =====

const publishToParents = async (schoolId, armId, termId, userId, studentIds) => {
  const studentCount = studentIds && studentIds.length > 0
    ? studentIds.length
    : await prisma.student.count({
        where: { schoolId, armId, isActive: true, isEnrolled: true }
      });

  const publication = await prisma.reportCardPublication.upsert({
    where: {
      schoolId_armId_termId: { schoolId, armId, termId }
    },
    update: {
      released: true,
      releasedAt: new Date(),
      releasedBy: userId,
      publishedCount: studentCount
    },
    create: {
      schoolId,
      armId,
      termId,
      released: true,
      releasedAt: new Date(),
      releasedBy: userId,
      publishedCount: studentCount
    }
  });

  logger.info(`Report cards published for arm ${armId}, term ${termId} to ${studentCount} students`);
  return {
    publishedCount: publication.publishedCount,
    publishedAt: publication.releasedAt
  };
};

module.exports = {
  getPublishStatus,
  publishResults,
  createPdfJob,
  getPdfJob,
  getTemplate,
  saveTemplate,
  getCommentsWorklist,
  saveComment,
  generateReportCards,
  signOff,
  publishToParents
};

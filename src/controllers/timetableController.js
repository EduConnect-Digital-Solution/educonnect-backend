const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const timetableService = require('../services/timetableService');

const getDraft = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId, termId, armId } = req.query;

    const where = { schoolId };
    if (classId) where.classId = classId;
    if (termId) where.termId = termId;
    if (armId) where.armId = armId;

    const draft = await prisma.timetableDraft.findFirst({ where });

    logger.info(`Retrieved timetable draft for class ${classId || 'any'}, term ${termId || 'any'}`);

    res.json({
      success: true,
      data: {
        draft: draft ? {
          id: draft.id,
          classId: draft.classId,
          termId: draft.termId,
          armId: draft.armId,
          periods: draft.periods,
          schedules: draft.schedules,
          updatedAt: draft.updatedAt.toISOString()
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching timetable draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timetable draft',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const saveDraft = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId, termId, academicYearId, armId, periods, schedules } = req.body;

    const existingDraft = await prisma.timetableDraft.findFirst({
      where: {
        schoolId,
        classId,
        termId,
        armId: armId || null
      }
    });

    const draftData = {
      schoolId,
      classId,
      termId,
      academicYearId: academicYearId || null,
      armId: armId || null,
      periods: periods || [],
      schedules: schedules || []
    };

    let draft;
    if (existingDraft) {
      draft = await prisma.timetableDraft.update({
        where: { id: existingDraft.id },
        data: draftData
      });
    } else {
      draft = await prisma.timetableDraft.create({
        data: draftData
      });
    }

    logger.info(`Saved timetable draft ${draft.id} for class ${classId}, term ${termId}`);

    res.json({
      success: true,
      data: {
        draftId: draft.id,
        savedAt: draft.updatedAt.toISOString()
      }
    });
  } catch (error) {
    logger.error('Error saving timetable draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save timetable draft',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteDraft = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId, termId, armId } = req.query;

    await prisma.timetableDraft.deleteMany({
      where: {
        schoolId,
        classId,
        termId,
        armId: armId || null
      }
    });

    logger.info(`Deleted timetable draft for class ${classId}, term ${termId}`);

    res.json({
      success: true
    });
  } catch (error) {
    logger.error('Error deleting timetable draft:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete timetable draft',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const checkConflicts = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId, termId, armId, schedules } = req.body;

    const validationErrors = await timetableService.validateEntities(schoolId, { classId, termId, armId });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    const result = await timetableService.checkConflicts(schedules, termId, armId);

    logger.info(`Conflict check for class ${classId}, term ${termId}: ${result.conflicts.length} conflict(s)`);

    res.json({
      success: true,
      data: {
        hasConflicts: result.hasConflicts,
        conflicts: result.conflicts
      }
    });
  } catch (error) {
    logger.error('Error checking timetable conflicts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check timetable conflicts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const publishTimetable = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { academicYearId, termId, classId, armId, periods, schedules } = req.body;

    const validationErrors = await timetableService.validateEntities(schoolId, {
      classId, termId, academicYearId, armId, periods, schedules
    });
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    const conflictResult = await timetableService.checkConflicts(schedules, termId, armId);
    const hasErrors = conflictResult.conflicts.some(c => c.severity === 'error');

    if (hasErrors) {
      return res.status(409).json({
        success: false,
        message: 'Cannot publish timetable with unresolved conflicts',
        data: {
          conflicts: conflictResult.conflicts
        }
      });
    }

    const enrichedSchedules = (schedules || []).map(s => ({
      ...s,
      id: timetableService.generateScheduleId()
    }));

    const existingPublished = await prisma.timetablePublished.findFirst({
      where: {
        schoolId,
        classId,
        termId,
        armId: armId || null
      }
    });

    let published;
    const publishData = {
      schoolId,
      classId,
      termId,
      academicYearId: academicYearId || null,
      armId: armId || null,
      periods: periods || [],
      schedules: enrichedSchedules,
      publishedAt: new Date()
    };

    if (existingPublished) {
      published = await prisma.timetablePublished.update({
        where: { id: existingPublished.id },
        data: publishData
      });
    } else {
      published = await prisma.timetablePublished.create({
        data: publishData
      });
    }

    await prisma.timetableDraft.deleteMany({
      where: {
        schoolId,
        classId,
        termId,
        armId: armId || null
      }
    });

    logger.info(`Published timetable ${published.id} for class ${classId}, term ${termId}`);

    res.json({
      success: true,
      data: {
        published: true,
        publishedAt: published.publishedAt.toISOString(),
        timetableId: published.id,
        conflictsResolved: !hasErrors,
        schedules: enrichedSchedules
      }
    });
  } catch (error) {
    logger.error('Error publishing timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getPublished = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId, termId, armId } = req.query;

    const published = await prisma.timetablePublished.findFirst({
      where: {
        schoolId,
        classId,
        termId,
        armId: armId || null
      }
    });

    logger.info(`Retrieved published timetable for class ${classId}, term ${termId}`);

    res.json({
      success: true,
      data: {
        timetable: published ? {
          id: published.id,
          classId: published.classId,
          termId: published.termId,
          armId: published.armId,
          publishedAt: published.publishedAt.toISOString(),
          periods: published.periods,
          schedules: published.schedules
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching published timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch published timetable',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getTeacherTodaySchedule = async (req, res) => {
  try {
    const teacherId = req.user.userId;
    const schoolId = req.user.schoolId;
    const { date } = req.query;

    const dateStr = date || new Date().toISOString().split('T')[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.'
      });
    }

    const result = await timetableService.buildDayScheduleForTeacher(teacherId, schoolId, dateStr);

    logger.info(`Retrieved schedule for teacher ${teacherId} on ${dateStr}: ${result.scheduledClasses.length} class(es)`);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching teacher schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher schedule',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getDraft,
  saveDraft,
  deleteDraft,
  checkConflicts,
  publishTimetable,
  getPublished,
  getTeacherTodaySchedule
};

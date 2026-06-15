const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const logger = require('../utils/logger');
const { AppError, NotFoundError, ConflictError, AuthorizationError } = require('../utils/AppError');

const parseDateLocal = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
};

const toDateRange = (dateStr) => {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
};

const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const computeSummary = (records) => {
  const total = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  return { total, present, absent, late };
};

class AttendanceService {

  // ──────────────────────────────────────────────
  // Endpoint 1: GET /api/teacher/attendance/schedule
  // ──────────────────────────────────────────────
  static async getTeacherSchedule(userId, schoolId, { date, armId }) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const { year, month, day } = parseDateLocal(targetDate);
    const localDate = new Date(year, month, day);
    const dayName = dayOfWeekNames[localDate.getDay()];

    const currentTerm = await prisma.academicTerm.findFirst({
      where: {
        schoolId,
        isActive: true,
        startDate: { lte: localDate },
        endDate: { gte: localDate }
      },
      include: {
        academicYear: { select: { id: true, year: true, name: true } }
      }
    });

    const academicContext = currentTerm ? {
      academicYearId: currentTerm.academicYear.id,
      academicYear: currentTerm.academicYear.name || currentTerm.academicYear.year,
      termId: currentTerm.id,
      term: currentTerm.name
    } : null;

    if (!currentTerm || dayName === 'Saturday' || dayName === 'Sunday') {
      return {
        date: targetDate,
        academicContext,
        scheduledClasses: []
      };
    }

    const publishedTimetables = await prisma.timetablePublished.findMany({
      where: { termId: currentTerm.id }
    });

    const { start, end } = toDateRange(targetDate);

    const existingSessions = await prisma.attendanceSession.findMany({
      where: {
        schoolId,
        createdBy: userId,
        date: { gte: start, lte: end }
      },
      include: {
        records: { select: { status: true } },
        class: { select: { name: true } },
        arm: { select: { name: true } }
      }
    });

    const sessionByKey = {};
    for (const s of existingSessions) {
      const key = `${s.classId}_${s.armId || 'null'}_${s.periodId || ''}_${s.subjectId || ''}`;
      sessionByKey[key] = s;
    }

    const scheduledClasses = [];

    for (const tt of publishedTimetables) {
      const schedules = tt.schedules || [];
      const daySchedules = schedules.filter(s => s.dayOfWeek === dayName && s.teacherId === userId);

      if (armId) {
        const filtered = daySchedules.filter(s => s.armId === armId);
        if (filtered.length > 0) {
          for (const s of filtered) this._pushSchedule(scheduledClasses, s, tt, sessionByKey, targetDate);
        }
      } else {
        for (const s of daySchedules) {
          this._pushSchedule(scheduledClasses, s, tt, sessionByKey, targetDate);
        }
      }
    }

    scheduledClasses.sort((a, b) => (a.periodNumber || 0) - (b.periodNumber || 0));

    return {
      date: targetDate,
      academicContext,
      scheduledClasses
    };
  }

  static _pushSchedule(scheduledClasses, s, tt, sessionByKey, targetDate) {
    const key = `${s.classId}_${s.armId || 'null'}_${s.periodId || ''}_${s.subjectId || ''}`;
    const session = sessionByKey[key];

    let attendanceStatus = 'not_started';
    let attendanceId = null;
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let studentCount = 0;

    if (session) {
      attendanceId = session.id;
      if (session.status === 'submitted') {
        attendanceStatus = 'completed';
      } else {
        attendanceStatus = 'in_progress';
      }
      const summary = computeSummary(session.records);
      presentCount = summary.present;
      absentCount = summary.absent;
      lateCount = summary.late;
      studentCount = summary.total;
    }

    scheduledClasses.push({
      scheduleId: s.id || `${s.classId}_${s.subjectId}_p${s.periodNumber}`,
      classId: s.classId,
      className: s.className,
      armId: s.armId || null,
      armName: s.armName || null,
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      periodId: s.periodId,
      periodNumber: s.periodNumber,
      timeSlot: {
        start: s.startTime,
        end: s.endTime
      },
      room: s.roomName || null,
      attendanceStatus,
      attendanceId,
      studentCount,
      presentCount,
      absentCount,
      lateCount
    });
  }

  // ──────────────────────────────────────────────
  // Endpoint 2: GET /api/teacher/attendance/sessions/:scheduleId/students
  // ──────────────────────────────────────────────
  static async getSessionStudents(userId, schoolId, scheduleId, { className, subjectName, armId }) {
    let classId = null;
    let resolvedClassName = className;

    // Try to find a matching attendance session first
    let session = await prisma.attendanceSession.findFirst({
      where: {
        schoolId,
        createdBy: userId,
        scheduleId
      },
      include: {
        records: {
          include: {
            marker: { select: { id: true, firstName: true, lastName: true } }
          }
        },
        class: { select: { id: true, name: true } },
        arm: { select: { id: true, name: true } }
      }
    });

    if (session) {
      classId = session.classId;
      armId = session.armId || armId;
      resolvedClassName = resolvedClassName || session.class?.name;
    }

    // If no session yet, try to resolve from timetable
    if (!classId) {
      const publishedTimetables = await prisma.timetablePublished.findMany({
        where: { schoolId }
      });

      for (const tt of publishedTimetables) {
        const schedules = tt.schedules || [];

        // Try direct ID match first
        let match = schedules.find(s => s.id === scheduleId && s.teacherId === userId);

        // Fallback: match by className + subjectName + teacherId
        if (!match && className && subjectName) {
          match = schedules.find(s =>
            s.className === className &&
            s.subjectName === subjectName &&
            s.teacherId === userId
          );
        }

        if (match) {
          classId = match.classId;
          armId = armId || match.armId;
          resolvedClassName = resolvedClassName || match.className;
          break;
        }
      }
    }

    if (!classId) {
      throw new NotFoundError('Schedule not found or teacher not assigned to it');
    }

    // Find the arm
    let armRecord = null;
    if (armId) {
      armRecord = await prisma.arm.findFirst({ where: { id: armId, schoolId } });
    }
    if (!armRecord && classId) {
      armRecord = await prisma.arm.findFirst({ where: { classId, schoolId, isActive: true } });
    }

    // Get students in the class/arm
    const studentWhere = { schoolId, isActive: true };
    if (armRecord) {
      studentWhere.armId = armRecord.id;
    } else if (classId) {
      studentWhere.classId = classId;
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        rollNumber: true
      },
      orderBy: { rollNumber: 'asc' }
    });

    // If no session exists yet, return students with null statuses
    if (!session) {
      return {
        scheduleId,
        attendanceId: null,
        attendanceStatus: 'not_started',
        submittedAt: null,
        students: students.map(s => ({
          studentId: s.id,
          rollNumber: s.rollNumber || '',
          fullName: `${s.firstName} ${s.lastName}`,
          status: null,
          reason: '',
          lateArrivalTime: ''
        }))
      };
    }

    // Build a map of existing records
    const recordMap = {};
    for (const r of session.records) {
      recordMap[r.studentId] = r;
    }

    const attendanceStatus = session.status === 'submitted' ? 'completed' : 'in_progress';

    return {
      scheduleId,
      attendanceId: session.id,
      attendanceStatus,
      submittedAt: session.updatedAt || session.createdAt,
      students: students.map(s => {
        const record = recordMap[s.id];
        return {
          studentId: s.id,
          rollNumber: s.rollNumber || '',
          fullName: `${s.firstName} ${s.lastName}`,
          status: record ? record.status : null,
          reason: record ? (record.remarks || '') : '',
          lateArrivalTime: record && record.status === 'late' ? (record.remarks || '') : ''
        };
      })
    };
  }

  static async _validateTeacherAssignment(userId, schoolId, classId, subjectId) {
    const teacher = await prisma.user.findUnique({
      where: { id: userId },
      select: { classes: true, subjects: true }
    });
    if (!teacher) {
      throw new AuthorizationError('Teacher not found');
    }

    if (classId) {
      const classRecord = await prisma.class.findFirst({
        where: { id: classId, schoolId },
        select: { name: true }
      });
      if (!classRecord) {
        throw new NotFoundError('Class not found');
      }
      if (!teacher.classes.includes(classRecord.name)) {
        throw new AuthorizationError(`Teacher not assigned to class "${classRecord.name}"`);
      }
    }

    if (subjectId) {
      const subjectRecord = await prisma.subject.findFirst({
        where: { id: subjectId, schoolId },
        select: { name: true }
      });
      if (!subjectRecord) {
        throw new NotFoundError('Subject not found');
      }
      if (!teacher.subjects.includes(subjectRecord.name)) {
        throw new AuthorizationError(`Teacher not assigned to subject "${subjectRecord.name}"`);
      }
    }
  }

  // ──────────────────────────────────────────────
  // Endpoint 3: POST /api/teacher/attendance/draft
  // ──────────────────────────────────────────────
  static async saveDraft(userId, schoolId, body) {
    const {
      academicYearId, termId, scheduleId, classId,
      armId, subjectId, periodId, date, attendanceId,
      attendances = []
    } = body;

    await this._validateTeacherAssignment(userId, schoolId, classId, subjectId);

    // Check for existing session by attendanceId
    if (attendanceId) {
      const existing = await prisma.attendanceSession.findUnique({
        where: { id: attendanceId }
      });
      if (!existing) {
        throw new NotFoundError('Attendance record not found');
      }
      if (existing.status === 'submitted') {
        throw new ConflictError('A submitted record already exists for this session. Use PUT to edit.');
      }
      // Existing draft — upsert records
      return this._upsertDraftRecords(existing.id, userId, attendances);
    }

    // Check conflict by scheduleId + date
    if (scheduleId) {
      const existing = await prisma.attendanceSession.findFirst({
        where: { scheduleId, date: new Date(`${date}T00:00:00.000Z`), schoolId, createdBy: userId }
      });
      if (existing && existing.status === 'submitted') {
        throw new ConflictError('A submitted record already exists for this session');
      }
      if (existing) {
        return this._upsertDraftRecords(existing.id, userId, attendances);
      }
    }

    const periodNumber = body.periodNumber || (periodId ? parseInt(periodId.replace(/\D/g, ''), 10) || null : null);

    const session = await prisma.attendanceSession.create({
      data: {
        schoolId,
        academicYearId: academicYearId || null,
        academicTermId: termId || null,
        classId: classId || null,
        armId: armId || null,
        subjectId: subjectId || null,
        periodId: periodId || null,
        periodNumber,
        scheduleId: scheduleId || null,
        status: 'draft',
        date: new Date(`${date}T00:00:00.000Z`),
        sessionType: 'regular',
        isActive: true,
        createdBy: userId
      }
    });

    if (attendances.length > 0) {
      await this._upsertRecords(session.id, userId, attendances);
    }

    return {
      attendanceId: session.id,
      status: 'draft',
      savedAt: session.createdAt.toISOString()
    };
  }

  static async _upsertDraftRecords(sessionId, userId, attendances) {
    await this._upsertRecords(sessionId, userId, attendances);

    const updated = await prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, createdAt: true, updatedAt: true }
    });

    return {
      attendanceId: updated.id,
      status: updated.status,
      savedAt: (updated.updatedAt || updated.createdAt).toISOString()
    };
  }

  static async _upsertRecords(sessionId, userId, attendances) {
    for (const a of attendances) {
      const data = {
        status: a.status || null,
        remarks: a.reason || a.lateArrivalTime || null,
        markedBy: userId,
        markedAt: new Date()
      };

      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId: a.studentId
          }
        },
        update: {
          status: data.status,
          remarks: data.remarks,
          markedBy: userId,
          markedAt: new Date()
        },
        create: {
          sessionId,
          studentId: a.studentId,
          status: data.status,
          remarks: data.remarks,
          markedBy: userId,
          markedAt: new Date()
        }
      });
    }
  }

  // ──────────────────────────────────────────────
  // Endpoint 4: POST /api/teacher/attendance/submit
  // ──────────────────────────────────────────────
  static async submitAttendance(userId, schoolId, body) {
    const {
      academicYearId, termId, scheduleId, classId,
      armId, subjectId, periodId, date, attendanceId,
      attendances = []
    } = body;

    await this._validateTeacherAssignment(userId, schoolId, classId, subjectId);

    // Validate at least one non-null status
    const validAttendances = attendances.filter(a => a.status !== null && a.status !== undefined);
    if (validAttendances.length === 0) {
      throw new AppError('At least one student must have a non-null status to submit', 400);
    }

    // Check for existing session by attendanceId
    if (attendanceId) {
      const existing = await prisma.attendanceSession.findUnique({
        where: { id: attendanceId }
      });
      if (!existing) {
        throw new NotFoundError('Attendance record not found');
      }
      if (existing.status === 'submitted') {
        throw new ConflictError('A submitted record already exists for this session. Use PUT to edit.');
      }
      // Existing draft — finalise it
      return this._finaliseSession(existing.id, userId, validAttendances);
    }

    // Check conflict by scheduleId + date
    if (scheduleId) {
      const existing = await prisma.attendanceSession.findFirst({
        where: { scheduleId, date: new Date(`${date}T00:00:00.000Z`), schoolId, createdBy: userId }
      });
      if (existing && existing.status === 'submitted') {
        throw new ConflictError('A submitted record already exists for this session');
      }
      if (existing) {
        return this._finaliseSession(existing.id, userId, validAttendances);
      }
    }

    const periodNumber = body.periodNumber || (periodId ? parseInt(periodId.replace(/\D/g, ''), 10) || null : null);

    const session = await prisma.attendanceSession.create({
      data: {
        schoolId,
        academicYearId: academicYearId || null,
        academicTermId: termId || null,
        classId: classId || null,
        armId: armId || null,
        subjectId: subjectId || null,
        periodId: periodId || null,
        periodNumber,
        scheduleId: scheduleId || null,
        status: 'submitted',
        date: new Date(`${date}T00:00:00.000Z`),
        sessionType: 'regular',
        isActive: false,
        createdBy: userId
      }
    });

    if (validAttendances.length > 0) {
      await this._upsertRecords(session.id, userId, validAttendances);
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId: session.id },
      select: { status: true }
    });

    return {
      attendanceId: session.id,
      status: 'submitted',
      submittedAt: session.createdAt.toISOString(),
      summary: computeSummary(records)
    };
  }

  static async _finaliseSession(sessionId, userId, attendances) {
    // Delete existing records for this session, then create new ones
    await prisma.attendanceRecord.deleteMany({ where: { sessionId } });

    if (attendances.length > 0) {
      await prisma.attendanceRecord.createMany({
        data: attendances.map(a => ({
          sessionId,
          studentId: a.studentId,
          status: a.status,
          remarks: a.reason || a.lateArrivalTime || null,
          markedBy: userId,
          markedAt: new Date()
        }))
      });
    }

    const session = await prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { status: 'submitted', isActive: false }
    });

    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      select: { status: true }
    });

    return {
      attendanceId: session.id,
      status: 'submitted',
      submittedAt: session.updatedAt.toISOString(),
      summary: computeSummary(records)
    };
  }

  // ──────────────────────────────────────────────
  // Endpoint 5: PUT /api/teacher/attendance/:attendanceId
  // ──────────────────────────────────────────────
  static async updateAttendance(userId, schoolId, attendanceId, body) {
    const { editReason, armId, attendances = [] } = body;

    const session = await prisma.attendanceSession.findFirst({
      where: { id: attendanceId, schoolId },
      include: { records: { select: { id: true, studentId: true, status: true } } }
    });

    if (!session) {
      throw new NotFoundError('Attendance record not found');
    }

    if (session.createdBy !== userId) {
      throw new AuthorizationError('You can only edit your own attendance records');
    }

    // Update individual records (upsert by studentId)
    for (const a of attendances) {
      await prisma.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: attendanceId,
            studentId: a.studentId
          }
        },
        update: {
          status: a.status,
          remarks: a.reason || a.lateArrivalTime || null,
          markedBy: userId,
          markedAt: new Date()
        },
        create: {
          sessionId: attendanceId,
          studentId: a.studentId,
          status: a.status,
          remarks: a.reason || a.lateArrivalTime || null,
          markedBy: userId,
          markedAt: new Date()
        }
      });
    }

    // Audit trail
    logger.info('ATTENDANCE_EDIT', {
      attendanceId,
      editedBy: userId,
      editReason: editReason || 'No reason provided',
      previousState: session.records.map(r => ({ studentId: r.studentId, status: r.status })),
      timestamp: new Date().toISOString()
    });

    const updatedSession = await prisma.attendanceSession.findUnique({
      where: { id: attendanceId }
    });

    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId: attendanceId },
      select: { status: true }
    });

    return {
      attendanceId: updatedSession.id,
      status: 'submitted',
      updatedAt: updatedSession.updatedAt.toISOString(),
      summary: computeSummary(records)
    };
  }

  // ──────────────────────────────────────────────
  // Endpoint 6: GET /api/teacher/attendance/history
  // ──────────────────────────────────────────────
  static async getHistory(userId, schoolId, query) {
    const {
      page = 1,
      limit = 20,
      classId,
      armId,
      subjectId,
      startDate,
      endDate,
      status = 'submitted'
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = { schoolId, createdBy: userId };

    if (status !== 'all') {
      where.status = status;
    }

    if (classId) where.classId = classId;
    if (armId) where.armId = armId;
    if (subjectId) where.subjectId = subjectId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.date.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [sessions, total] = await Promise.all([
      prisma.attendanceSession.findMany({
        where,
        include: {
          records: { select: { status: true } },
          class: { select: { name: true } },
          arm: { select: { name: true } }
        },
        orderBy: { date: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.attendanceSession.count({ where })
    ]);

    const subjectNames = await this._resolveSubjectNames(sessions);

    return {
      records: sessions.map(s => {
        const summary = computeSummary(s.records);
        return {
          attendanceId: s.id,
          scheduleId: s.scheduleId || '',
          classId: s.classId || '',
          className: s.class?.name || '',
          armId: s.armId || '',
          armName: s.arm?.name || '',
          subjectId: s.subjectId || '',
          subjectName: subjectNames.get(s.subjectId) || '',
          date: s.date.toISOString().split('T')[0],
          periodNumber: s.periodNumber,
          status: s.status === 'submitted' ? 'submitted' : 'draft',
          submittedAt: s.updatedAt ? s.updatedAt.toISOString() : s.createdAt.toISOString(),
          summary
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  }

  // ──────────────────────────────────────────────
  // Endpoint 7: GET /api/teacher/attendance/date/:date
  // ──────────────────────────────────────────────
  static async getByDate(userId, schoolId, dateStr, { armId }) {
    const { start, end } = toDateRange(dateStr);

    const currentTerm = await prisma.academicTerm.findFirst({
      where: {
        schoolId,
        isActive: true,
        startDate: { lte: new Date(`${dateStr}T23:59:59.999Z`) },
        endDate: { gte: new Date(`${dateStr}T00:00:00.000Z`) }
      },
      include: {
        academicYear: { select: { id: true, year: true, name: true } }
      }
    });

    const academicContext = currentTerm ? {
      academicYearId: currentTerm.academicYear.id,
      academicYear: currentTerm.academicYear.name || currentTerm.academicYear.year,
      termId: currentTerm.id,
      term: currentTerm.name
    } : null;

    const where = {
      schoolId,
      createdBy: userId,
      date: { gte: start, lte: end }
    };

    if (armId) where.armId = armId;

    const sessions = await prisma.attendanceSession.findMany({
      where,
      include: {
        records: { select: { status: true } },
        class: { select: { name: true } },
        arm: { select: { name: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Build time slot lookup from published timetables
    const scheduleTimeMap = {};
    if (currentTerm) {
      const timetables = await prisma.timetablePublished.findMany({
        where: { schoolId, termId: currentTerm.id }
      });
      for (const tt of timetables) {
        for (const s of (tt.schedules || [])) {
          if (s.startTime) {
            scheduleTimeMap[s.id] = { start: s.startTime, end: s.endTime || '' };
          }
        }
      }
    }

    const subjectNames = await this._resolveSubjectNames(sessions);

    return {
      date: dateStr,
      academicContext,
      scheduledClasses: sessions.map(s => {
        const summary = computeSummary(s.records);
        const attendanceStatus = s.status === 'submitted' ? 'completed' : 'in_progress';
        const scheduleTime = scheduleTimeMap[s.scheduleId] || {};

        return {
          scheduleId: s.scheduleId || s.id,
          classId: s.classId || '',
          className: s.class?.name || '',
          armId: s.armId || '',
          armName: s.arm?.name || '',
          subjectId: s.subjectId || '',
          subjectName: subjectNames.get(s.subjectId) || '',
          periodId: s.periodId || '',
          periodNumber: s.periodNumber,
          timeSlot: {
            start: scheduleTime.start || '',
            end: scheduleTime.end || ''
          },
          room: null,
          attendanceStatus,
          attendanceId: s.id,
          studentCount: summary.total,
          presentCount: summary.present,
          absentCount: summary.absent,
          lateCount: summary.late
        };
      })
    };
  }

  // ──────────────────────────────────────────────
  // Endpoint 8: GET /api/teacher/attendance/summary/:scheduleId
  // ──────────────────────────────────────────────
  static async getSummary(userId, schoolId, scheduleId) {
    const session = await prisma.attendanceSession.findFirst({
      where: {
        schoolId,
        createdBy: userId,
        scheduleId
      },
      include: {
        records: { select: { status: true } }
      }
    });

    if (!session) {
      throw new NotFoundError('No attendance record found for this schedule');
    }

    const summary = computeSummary(session.records);
    const attendanceStatus = session.status === 'submitted' ? 'completed' : 'in_progress';

    return {
      scheduleId,
      attendanceId: session.id,
      attendanceStatus,
      submittedAt: (session.updatedAt || session.createdAt).toISOString(),
      summary
    };
  }

  static async _resolveSubjectNames(sessions) {
    const subjectIds = [...new Set(sessions.map(s => s.subjectId).filter(Boolean))];
    if (subjectIds.length === 0) return new Map();

    const subjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true }
    });

    const map = new Map();
    for (const sub of subjects) {
      map.set(sub.id, sub.name);
    }
    return map;
  }
}

module.exports = AttendanceService;

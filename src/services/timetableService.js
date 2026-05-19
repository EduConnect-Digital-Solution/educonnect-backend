const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

const SUBJECT_OVERLOAD_THRESHOLD = 5;

const generateScheduleId = () => crypto.randomUUID();

const parseDateLocal = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
};

const findCurrentTerm = async (schoolId, date) => {
  const targetDate = date || new Date();

  const queryDate = typeof date === 'string'
    ? new Date(`${date}T00:00:00.000Z`)
    : targetDate;

  const term = await prisma.academicTerm.findFirst({
    where: {
      schoolId,
      isActive: true,
      startDate: { lte: queryDate },
      endDate: { gte: queryDate }
    },
    include: {
      academicYear: {
        select: { id: true, year: true, name: true }
      }
    }
  });

  return term;
};

const validateEntities = async (schoolId, { classId, termId, academicYearId, armId, periods, schedules }) => {
  const errors = [];

  const schoolClass = await prisma.class.findFirst({
    where: { id: classId, schoolId, isActive: true }
  });
  if (!schoolClass) errors.push({ field: 'classId', message: 'Class not found' });

  const term = await prisma.academicTerm.findFirst({
    where: { id: termId, schoolId, isActive: true }
  });
  if (!term) errors.push({ field: 'termId', message: 'Term not found' });

  if (academicYearId) {
    const year = await prisma.academicYear.findFirst({
      where: { id: academicYearId, schoolId, isActive: true }
    });
    if (!year) errors.push({ field: 'academicYearId', message: 'Academic year not found' });
  }

  if (armId) {
    const arm = await prisma.arm.findFirst({
      where: { id: armId, schoolId, isActive: true }
    });
    if (!arm) errors.push({ field: 'armId', message: 'Arm not found' });
  }

  if (periods && Array.isArray(periods)) {
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      if (!p.id || !p.periodNumber || !p.startTime || !p.endTime) {
        errors.push({ field: `periods[${i}]`, message: 'Period id, periodNumber, startTime, and endTime are required' });
      }
    }
  }

  if (schedules && Array.isArray(schedules)) {
    for (let i = 0; i < schedules.length; i++) {
      const s = schedules[i];
      if (!s.dayOfWeek || !s.periodId || !s.subjectId || !s.teacherId) {
        errors.push({ field: `schedules[${i}]`, message: 'dayOfWeek, periodId, subjectId, and teacherId are required' });
      }
      if (!['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(s.dayOfWeek)) {
        errors.push({ field: `schedules[${i}].dayOfWeek`, message: 'dayOfWeek must be Monday-Friday' });
      }
    }
  }

  return errors;
};

const checkConflicts = async (schedules, termId, excludeArmId = null) => {
  const conflicts = [];

  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return { hasConflicts: false, conflicts: [] };
  }

  const publishedTimetables = await prisma.timetablePublished.findMany({
    where: { termId }
  });

  const publishedSchedules = publishedTimetables.flatMap(t => t.schedules || []);

  const filteredPublished = excludeArmId
    ? publishedSchedules.filter(s => s.armId !== excludeArmId)
    : publishedSchedules;

  const dayPeriodMap = new Map();
  for (const s of schedules) {
    const key = `${s.dayOfWeek}_${s.periodId}`;
    if (!dayPeriodMap.has(key)) {
      dayPeriodMap.set(key, []);
    }
    dayPeriodMap.get(key).push(s);
  }

  for (const [key, entries] of dayPeriodMap) {
    if (entries.length > 1) {
      conflicts.push({
        type: 'PERIOD_DUPLICATION',
        severity: 'error',
        message: `Multiple entries on ${entries[0].dayOfWeek} period ${entries[0].periodNumber}`,
        slots: entries.map(e => ({ day: e.dayOfWeek, periodId: e.periodId }))
      });
    }
  }

  const subjectDayCount = {};
  for (const s of schedules) {
    const subjKey = `${s.subjectId}_${s.dayOfWeek}`;
    subjectDayCount[subjKey] = (subjectDayCount[subjKey] || 0) + 1;
  }

  for (const s of schedules) {
    const count = Object.keys(subjectDayCount)
      .filter(k => k.startsWith(`${s.subjectId}_`))
      .reduce((sum, k) => sum + subjectDayCount[k], 0);

    if (count > SUBJECT_OVERLOAD_THRESHOLD) {
      if (!conflicts.find(c => c.type === 'SUBJECT_OVERLOAD' && c.message.includes(s.subjectName || s.subjectId))) {
        conflicts.push({
          type: 'SUBJECT_OVERLOAD',
          severity: 'warning',
          message: `Subject "${s.subjectName || s.subjectId}" appears ${count} times per week (threshold: ${SUBJECT_OVERLOAD_THRESHOLD})`,
          slots: []
        });
      }
    }
  }

  const teacherBookings = new Map();
  for (const ps of filteredPublished) {
    const key = `${ps.teacherId}_${ps.dayOfWeek}_${ps.periodId}`;
    teacherBookings.set(key, ps);
  }

  for (const s of schedules) {
    const key = `${s.teacherId}_${s.dayOfWeek}_${s.periodId}`;
    if (teacherBookings.has(key)) {
      const existing = teacherBookings.get(key);
      conflicts.push({
        type: 'TEACHER_DOUBLE_BOOKING',
        severity: 'error',
        message: `Teacher "${s.teacherName || s.teacherId}" is already assigned to another class on ${s.dayOfWeek} period ${s.periodNumber}`,
        slots: [
          { day: s.dayOfWeek, periodId: s.periodId },
          { day: existing.dayOfWeek, periodId: existing.periodId }
        ]
      });
    }
  }

  const roomBookings = new Map();
  for (const ps of filteredPublished) {
    if (ps.roomId) {
      const key = `${ps.roomId}_${ps.dayOfWeek}_${ps.periodId}`;
      roomBookings.set(key, ps);
    }
  }

  for (const s of schedules) {
    if (s.roomId) {
      const key = `${s.roomId}_${s.dayOfWeek}_${s.periodId}`;
      if (roomBookings.has(key)) {
        const existing = roomBookings.get(key);
        conflicts.push({
          type: 'ROOM_CONFLICT',
          severity: 'error',
          message: `Room "${s.roomName || s.roomId}" is already assigned to another class on ${s.dayOfWeek} period ${s.periodNumber}`,
          slots: [
            { day: s.dayOfWeek, periodId: s.periodId },
            { day: existing.dayOfWeek, periodId: existing.periodId }
          ]
        });
      }
    }
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts
  };
};

const computeAttendanceStats = async (teacherId, dateStr) => {
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const sessions = await prisma.attendanceSession.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay
      },
      createdBy: teacherId
    },
    include: {
      records: {
        select: {
          status: true
        }
      }
    }
  });

  return sessions.map(session => {
    const total = session.records.length;
    const present = session.records.filter(r => r.status === 'present').length;
    const absent = session.records.filter(r => r.status === 'absent').length;
    const late = session.records.filter(r => r.status === 'late').length;

    const status = session.isActive
      ? (session.records.length > 0 ? 'completed' : 'in_progress')
      : 'not_started';

    return {
      sessionId: session.id,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      studentCount: total,
      attendanceStatus: status
    };
  });
};

const buildDayScheduleForTeacher = async (teacherId, schoolId, dateStr) => {
  const { year, month, day } = parseDateLocal(dateStr);
  const localDate = new Date(year, month, day);

  const term = await findCurrentTerm(schoolId, dateStr);
  if (!term) {
    return {
      date: dateStr,
      academicContext: null,
      scheduledClasses: []
    };
  }

  const publishedTimetables = await prisma.timetablePublished.findMany({
    where: {
      termId: term.id
    }
  });

  const scheduledClasses = [];

  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayOfWeekNames[localDate.getDay()];

  if (dayName === 'Saturday' || dayName === 'Sunday') {
    return {
      date: dateStr,
      academicContext: {
        academicYearId: term.academicYear.id,
        academicYear: term.academicYear.name || term.academicYear.year,
        termId: term.id,
        term: term.name
      },
      scheduledClasses: []
    };
  }

  for (const tt of publishedTimetables) {
    const schedules = tt.schedules || [];
    const daySchedules = schedules.filter(s => s.dayOfWeek === dayName && s.teacherId === teacherId);

    for (const s of daySchedules) {
      scheduledClasses.push({
        scheduleId: s.id || generateScheduleId(),
        classId: s.classId,
        className: s.className,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        periodId: s.periodId,
        periodNumber: s.periodNumber,
        timeSlot: {
          start: s.startTime,
          end: s.endTime
        },
        room: s.roomName || null,
        teacherId: s.teacherId,
        attendanceStatus: 'not_started',
        attendanceId: null,
        studentCount: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0
      });
    }
  }

  scheduledClasses.sort((a, b) => a.periodNumber - b.periodNumber);

  const attendanceStats = await computeAttendanceStats(teacherId, dateStr);
  const attendanceBySessionId = {};
  for (const stat of attendanceStats) {
    attendanceBySessionId[stat.sessionId] = stat;
  }

  for (const sc of scheduledClasses) {
    const sessionKey = `${sc.classId}_${sc.periodId}`;
    const matchingStat = Object.values(attendanceBySessionId).find(
      a => a.sessionId.includes(sc.scheduleId) || a.sessionId.includes(sc.periodId)
    );

    if (matchingStat) {
      sc.attendanceStatus = matchingStat.attendanceStatus;
      sc.studentCount = matchingStat.studentCount;
      sc.presentCount = matchingStat.presentCount;
      sc.absentCount = matchingStat.absentCount;
      sc.lateCount = matchingStat.lateCount;
    }
  }

  return {
    date: dateStr,
    academicContext: {
      academicYearId: term.academicYear.id,
      academicYear: term.academicYear.name || term.academicYear.year,
      termId: term.id,
      term: term.name
    },
    scheduledClasses
  };
};

module.exports = {
  generateScheduleId,
  findCurrentTerm,
  validateEntities,
  checkConflicts,
  computeAttendanceStats,
  buildDayScheduleForTeacher,
  SUBJECT_OVERLOAD_THRESHOLD
};

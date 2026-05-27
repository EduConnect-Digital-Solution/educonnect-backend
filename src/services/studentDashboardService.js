const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const config = require('../config');

const getStudentIdentity = async (user, student) => {
  const school = await prisma.school.findUnique({
    where: { id: student.schoolId },
    select: { schoolName: true }
  });

  return {
    studentId: student.id,
    fullName: student.fullName,
    avatarUrl: student.profileImage,
    class: student.className || student.currentClass || 'Not assigned',
    schoolName: school?.schoolName || 'Unknown',
    schoolLogoUrl: null
  };
};

const getNotificationsList = async (userId, schoolId, { unread, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const where = {
    schoolId,
    userId
  };

  if (unread === true) {
    where.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { schoolId, userId, isRead: false }
    })
  ]);

  return {
    unreadCount,
    notifications: notifications.map(n => ({
      notificationId: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      meta: n.meta
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const markNotificationRead = async (userId, schoolId, notificationId) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification || notification.userId !== userId || notification.schoolId !== schoolId) {
    throw new Error('NOT_FOUND');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return {
    notificationId: updated.id,
    isRead: updated.isRead
  };
};

const markAllNotificationsRead = async (userId, schoolId) => {
  const result = await prisma.notification.updateMany({
    where: {
      schoolId,
      userId,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: new Date()
    }
  });

  return {
    markedRead: result.count
  };
};

const getActiveTerm = async (schoolId) => {
  return prisma.academicTerm.findFirst({
    where: {
      schoolId,
      isCurrent: true
    },
    include: {
      academicYear: true
    }
  });
};

const getDashboardOverview = async (student, schoolId) => {
  const activeTerm = await getActiveTerm(schoolId);
  const now = new Date();

  const enrollmentsWhere = {
    schoolId,
    isActive: true,
    isEnrolled: true
  };

  if (student.classId) {
    enrollmentsWhere.classId = student.classId;
  }

  const [totalEnrollments, grades, upcomingEvents] = await Promise.all([
    prisma.student.count({
      where: enrollmentsWhere
    }),
    activeTerm ? prisma.grade.findMany({
      where: {
        studentId: student.id,
        schoolId,
        term: activeTerm.term
      }
    }) : [],
    prisma.schoolCalendar.findMany({
      where: {
        schoolId,
        startDate: { gte: now },
        isActive: true
      },
      take: 5,
      orderBy: { startDate: 'asc' }
    })
  ]);

  let performanceScore = 0;
  let attendanceRate = 88;
  const performanceCards = [];

  if (grades.length > 0) {
    const validGrades = grades.filter(g => g.percentage !== null);
    if (validGrades.length > 0) {
      performanceScore = Math.round(validGrades.reduce((sum, g) => sum + g.percentage, 0) / validGrades.length);
    }

    for (const grade of grades) {
      if (grade.percentage !== null) {
        performanceCards.push({
          subjectId: `${grade.subject}-${student.id}`,
          subjectName: grade.subject,
          gradePercent: Math.round(grade.percentage),
          trend: 'stable'
        });
      }
    }
  }

  return {
    overview: {
      totalEnrollments,
      totalEvents: upcomingEvents.length,
      performanceScore,
      attendanceRate,
      currentClass: student.className || student.currentClass || 'Not assigned'
    },
    performanceCards,
    upcomingEvents: upcomingEvents.map(e => ({
      eventId: e.id,
      title: e.title,
      date: e.startDate.toISOString(),
      type: e.eventType
    }))
  };
};

const getTimetable = async (student, schoolId, week, termId) => {
  const activeTerm = termId 
    ? await prisma.academicTerm.findUnique({ where: { id: termId } })
    : await getActiveTerm(schoolId);

  let year, weekNum;
  if (week) {
    const match = week.match(/^(\d{4})-W(\d{2})$/);
    if (match) {
      year = parseInt(match[1]);
      weekNum = parseInt(match[2]);
    }
  }

  const timetable = await prisma.timetablePublished.findFirst({
    where: {
      schoolId,
      ...(student.classId && { classId: student.classId }),
      ...(student.armId && { armId: student.armId }),
      ...(activeTerm && { termId: activeTerm.id })
    },
    orderBy: { publishedAt: 'desc' }
  });

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const schedule = [];

  const today = new Date();
  const currentDay = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

  for (let i = 0; i < 5; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = dayDate.toISOString().split('T')[0];

    const daySlots = timetable?.schedules?.[daysOfWeek[i]] || timetable?.periods || [];
    
    schedule.push({
      day: daysOfWeek[i],
      date: dateStr,
      slots: Array.isArray(daySlots) ? daySlots.map((slot, idx) => ({
        slotId: slot.id || `${daysOfWeek[i]}-${idx}`,
        startTime: slot.startTime || '08:00',
        endTime: slot.endTime || '09:00',
        subjectName: slot.subject || 'Free Period',
        teacherName: slot.teacher || 'TBD',
        classroom: slot.classroom || slot.room || 'TBD',
        locationCode: slot.locationCode || slot.wing || null,
        type: slot.type || 'class'
      })) : []
    });
  }

  return {
    termId: activeTerm?.id || null,
    termName: activeTerm?.name || 'Current Term',
    week: week || `current`,
    schedule
  };
};

const getTermsList = async (schoolId) => {
  const terms = await prisma.academicTerm.findMany({
    where: { schoolId },
    include: { academicYear: true },
    orderBy: [
      { isCurrent: 'desc' },
      { startDate: 'desc' }
    ]
  });

  return {
    terms: terms.map(t => ({
      termId: t.id,
      termName: t.name,
      isActive: t.isCurrent || t.isActive,
      startDate: t.startDate.toISOString().split('T')[0],
      endDate: t.endDate.toISOString().split('T')[0]
    }))
  };
};

const getAcademicsList = async (student, schoolId, termId, { page = 1, limit = 20 }) => {
  const activeTerm = termId
    ? await prisma.academicTerm.findUnique({ where: { id: termId } })
    : await getActiveTerm(schoolId);

  const skip = (page - 1) * limit;

  let subjects = [];
  let classSubjects = [];

  if (student.classId) {
    const classWithSubjects = await prisma.class.findUnique({
      where: { id: student.classId },
      include: {
        subjects: {
          include: { subject: true }
        }
      }
    });
    if (classWithSubjects) {
      classSubjects = classWithSubjects.subjects.map(cs => cs.subject);
    }
  }

  if (student.armId) {
    const armWithSubjects = await prisma.arm.findUnique({
      where: { id: student.armId },
      include: {
        armSubjects: {
          include: { subject: true }
        }
      }
    });
    if (armWithSubjects) {
      const armSubjects = armWithSubjects.armSubjects.map(as => as.subject);
      const allSubjects = [...classSubjects, ...armSubjects];
      const uniqueIds = new Set();
      classSubjects = allSubjects.filter(s => {
        if (uniqueIds.has(s.id)) return false;
        uniqueIds.add(s.id);
        return true;
      });
    }
  }

  const gradesWhere = {
    studentId: student.id,
    schoolId
  };
  if (activeTerm) {
    gradesWhere.term = activeTerm.term;
  }

  const grades = await prisma.grade.findMany({
    where: gradesWhere,
    include: {
      teacher: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    }
  });

  const gradeMap = new Map();
  for (const grade of grades) {
    gradeMap.set(grade.subject.toLowerCase(), grade);
  }

  const allSubjectNames = new Set([
    ...classSubjects.map(s => s.name),
    ...grades.map(g => g.subject)
  ]);

  const allSubjects = [...allSubjectNames].map(name => {
    const grade = gradeMap.get(name.toLowerCase());
    const classSubj = classSubjects.find(s => s.name.toLowerCase() === name.toLowerCase());

    let currentGradePercent = null;
    let rawScore = null;
    let maxScore = null;
    let gradeLabel = 'N/A';
    let performanceStatus = 'Not Available';

    if (grade) {
      currentGradePercent = grade.percentage;
      rawScore = grade.totalScore;
      maxScore = grade.totalMaxScore;
      gradeLabel = grade.letterGrade ? grade.letterGrade.replace('_', '+').replace('_', '-') : 'N/A';

      if (currentGradePercent !== null) {
        if (currentGradePercent >= 90) performanceStatus = 'Excellent';
        else if (currentGradePercent >= 70) performanceStatus = 'On Track';
        else if (currentGradePercent >= 50) performanceStatus = 'Needs Improvement';
        else performanceStatus = 'At Risk';
      }
    }

    return {
      subjectId: classSubj?.id || grade?.id || name,
      subjectName: name,
      rawScore,
      maxScore,
      currentGradePercent,
      gradeLabel,
      attendanceType: 'Full',
      attendancePercent: 92,
      performanceStatus,
      assignedTeacher: grade?.teacher ? {
        teacherId: grade.teacher.id,
        fullName: `${grade.teacher.firstName} ${grade.teacher.lastName}`,
        avatarUrl: grade.teacher.profileImage
      } : null
    };
  });

  const total = allSubjects.length;
  const paginated = allSubjects.slice(skip, skip + limit);

  return {
    termId: activeTerm?.id || null,
    termName: activeTerm?.name || 'Current Term',
    subjects: paginated,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const getAssignmentsList = async (student, schoolId, { status, subjectId, termId, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;
  const now = new Date();

  const where = {
    schoolId,
    isPublished: true
  };

  if (student.classId) {
    where.OR = [
      { classId: student.classId },
      { classId: null }
    ];
  }

  const [assignments, submissions] = await Promise.all([
    prisma.assignment.findMany({
      where,
      include: {
        submissions: {
          where: { studentId: student.id }
        }
      },
      orderBy: { dueAt: 'asc' }
    }),
    prisma.assignmentSubmission.findMany({
      where: { studentId: student.id }
    })
  ]);

  const submissionMap = new Map();
  for (const sub of submissions) {
    submissionMap.set(sub.assignmentId, sub);
  }

  let processed = assignments.map(assignment => {
    const submission = submissionMap.get(assignment.id);
    let derivedStatus = 'pending';

    if (submission) {
      derivedStatus = submission.status === 'graded' ? 'graded' : 'submitted';
    } else if (assignment.dueAt < now) {
      derivedStatus = 'overdue';
    }

    return {
      ...assignment,
      derivedStatus,
      submission
    };
  });

  if (status) {
    processed = processed.filter(a => a.derivedStatus === status);
  }

  const pendingAssignments = processed.filter(a => a.derivedStatus === 'pending');
  let countdown = null;
  if (pendingAssignments.length > 0) {
    const nextDue = pendingAssignments.reduce((earliest, a) => 
      a.dueAt < earliest.dueAt ? a : earliest
    );
    const secondsRemaining = Math.max(0, Math.floor((nextDue.dueAt - now) / 1000));
    countdown = {
      nextDueAssignmentId: nextDue.id,
      nextDueAt: nextDue.dueAt.toISOString(),
      secondsRemaining
    };
  }

  const total = processed.length;
  const paginated = processed.slice(skip, skip + limit);

  return {
    assignments: paginated.map(a => ({
      assignmentId: a.id,
      title: a.title,
      subjectName: a.subject,
      teacherName: 'Teacher',
      dueAt: a.dueAt.toISOString(),
      status: a.derivedStatus,
      submittedAt: a.submission?.submittedAt?.toISOString() || null,
      gradePercent: a.submission?.gradePercent || null,
      feedback: a.submission?.feedback || null,
      attachments: a.attachments || []
    })),
    countdown,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const getAssignmentDetail = async (student, schoolId, assignmentId) => {
  const [assignment, submission] = await Promise.all([
    prisma.assignment.findUnique({
      where: { id: assignmentId }
    }),
    prisma.assignmentSubmission.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId: student.id
        }
      }
    })
  ]);

  if (!assignment || assignment.schoolId !== schoolId) {
    throw new Error('NOT_FOUND');
  }

  if (assignment.classId && assignment.classId !== student.classId) {
    throw new Error('NOT_FOUND');
  }

  const now = new Date();
  let status = 'pending';
  if (submission) {
    status = submission.status === 'graded' ? 'graded' : 'submitted';
  } else if (assignment.dueAt < now) {
    status = 'overdue';
  }

  return {
    assignmentId: assignment.id,
    title: assignment.title,
    description: assignment.description,
    subjectName: assignment.subject,
    teacherName: 'Teacher',
    dueAt: assignment.dueAt.toISOString(),
    maxScore: assignment.maxScore,
    status,
    submittedAt: submission?.submittedAt?.toISOString() || null,
    gradePercent: submission?.gradePercent || null,
    feedback: submission?.feedback || null,
    attachments: assignment.attachments || [],
    submission: submission ? {
      submissionId: submission.id,
      textResponse: submission.textResponse,
      attachments: submission.attachments,
      submittedAt: submission.submittedAt.toISOString(),
      status: submission.status,
      gradePercent: submission.gradePercent,
      feedback: submission.feedback
    } : null
  };
};

const submitAssignment = async (studentId, schoolId, assignmentId, { textResponse, attachments }) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId }
  });

  if (!assignment || assignment.schoolId !== schoolId) {
    throw new Error('NOT_FOUND');
  }

  const now = new Date();

  const existing = await prisma.assignmentSubmission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId,
        studentId
      }
    }
  });

  if (existing) {
    throw new Error('ALREADY_SUBMITTED');
  }

  if (assignment.dueAt < now) {
    throw new Error('DEADLINE_PASSED');
  }

  const submission = await prisma.assignmentSubmission.create({
    data: {
      assignmentId,
      studentId,
      textResponse: textResponse || null,
      attachments: attachments || null,
      status: 'submitted'
    }
  });

  await logActivity(studentId, 'submission', `Submitted '${assignment.title}'`, {
    assignmentId
  });

  return {
    submissionId: submission.id,
    assignmentId: submission.assignmentId,
    submittedAt: submission.submittedAt.toISOString(),
    status: submission.status,
    files: submission.attachments || []
  };
};

const getTeachersList = async (schoolId, { search, subjectId, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const where = {
    schoolId,
    role: 'teacher',
    isActive: true
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [teachers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { lastName: 'asc' }
    }),
    prisma.user.count({ where })
  ]);

  return {
    teachers: teachers.map(t => ({
      teacherId: t.id,
      fullName: `${t.firstName} ${t.lastName}`,
      subjects: t.subjects || [],
      avatarUrl: t.profileImage,
      contact: {
        email: t.email,
        ...(t.phone && { phone: t.phone })
      }
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const getStudentProfile = async (student, userId) => {
  const recentActivities = await prisma.activityLog.findMany({
    where: { studentId: student.id },
    take: 5,
    orderBy: { timestamp: 'desc' }
  });

  const [user, classInfo, armInfo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    }),
    student.classId ? prisma.class.findUnique({
      where: { id: student.classId },
      select: { name: true }
    }) : null,
    student.armId ? prisma.arm.findUnique({
      where: { id: student.armId },
      select: { name: true }
    }) : null
  ]);

  const activeTerm = await getActiveTerm(student.schoolId);

  const guardian = student.guardian || {};

  return {
    studentId: student.id,
    admissionNumber: student.studentId,
    fullName: student.fullName,
    avatarUrl: student.profileImage,
    personal: {
      dateOfBirth: student.dateOfBirth?.toISOString().split('T')[0] || null,
      gender: student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : null,
      bloodGroup: null,
      stateOfOrigin: null,
      nationality: 'Nigerian',
      address: student.address || null
    },
    contact: {
      email: user?.email || student.email,
      phone: student.phone || null
    },
    guardian: {
      fullName: guardian.fullName || null,
      relationship: guardian.relationship || null,
      phone: guardian.phone || null,
      email: guardian.email || null,
      address: guardian.address || student.address
    },
    academic: {
      class: classInfo?.name || student.currentClass || 'Not assigned',
      termId: activeTerm?.id || null,
      termName: activeTerm?.name || 'Current Term',
      enrolledAt: student.admissionDate?.toISOString().split('T')[0] || null
    },
    recentActivity: recentActivities.map(a => ({
      activityId: a.id,
      type: a.type,
      description: a.description,
      timestamp: a.timestamp.toISOString()
    }))
  };
};

const updateStudentProfile = async (student, userId, { phone, address, avatarUrl }) => {
  const updateData = {};
  const updatedFields = [];

  if (phone !== undefined) {
    updateData.phone = phone;
    updatedFields.push('phone');
  }

  if (address !== undefined) {
    updateData.address = address;
    updatedFields.push('address');
  }

  let newAvatarUrl = student.profileImage;
  if (avatarUrl) {
    updateData.profileImage = avatarUrl;
    newAvatarUrl = avatarUrl;
    updatedFields.push('avatar');
  }

  if (updatedFields.length > 0) {
    await prisma.student.update({
      where: { id: student.id },
      data: updateData
    });

    await logActivity(student.id, 'profile_update', 'Updated profile information');
  }

  return {
    studentId: student.id,
    updatedFields,
    avatarUrl: newAvatarUrl
  };
};

const getActivityFeed = async (studentId, { type, page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const where = { studentId };
  if (type) {
    where.type = type;
  }

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' }
    }),
    prisma.activityLog.count({ where })
  ]);

  return {
    activities: activities.map(a => ({
      activityId: a.id,
      type: a.type,
      description: a.description,
      timestamp: a.timestamp.toISOString(),
      meta: a.meta
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

const getSettings = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  const settings = user.settings || {};
  const notifications = settings.notifications || {};
  const preferences = settings.preferences || {};

  return {
    notifications: {
      assignmentReminders: notifications.assignmentReminders !== false,
      gradePublished: notifications.gradePublished !== false,
      feeReminders: notifications.feeReminders !== false,
      schoolAnnouncements: notifications.schoolAnnouncements !== false,
      smsEnabled: notifications.smsEnabled === true,
      emailEnabled: notifications.emailEnabled !== false
    },
    preferences: {
      language: preferences.language || 'en',
      timezone: preferences.timezone || 'Africa/Lagos',
      darkMode: preferences.darkMode === true,
      compactView: preferences.compactView === true
    }
  };
};

const updateSettings = async (userId, { notifications, preferences }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  const currentSettings = user.settings || {};
  const updatedFields = [];

  if (notifications) {
    currentSettings.notifications = {
      ...currentSettings.notifications,
      ...notifications
    };
    Object.keys(notifications).forEach(key => {
      updatedFields.push(`notifications.${key}`);
    });
  }

  if (preferences) {
    currentSettings.preferences = {
      ...currentSettings.preferences,
      ...preferences
    };
    Object.keys(preferences).forEach(key => {
      updatedFields.push(`preferences.${key}`);
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      settings: currentSettings
    }
  });

  return {
    updatedFields
  };
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    throw new Error('INVALID_CURRENT_PASSWORD');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword
    }
  });

  return {
    message: 'Password updated successfully'
  };
};

const logActivity = async (studentId, type, description, meta = null) => {
  try {
    await prisma.activityLog.create({
      data: {
        studentId,
        type,
        description,
        meta
      }
    });
  } catch (error) {
    logger.error('Failed to log activity:', error);
  }
};

const getLocales = () => {
  return {
    locales: config.locales
  };
};

module.exports = {
  getStudentIdentity,
  getNotificationsList,
  markNotificationRead,
  markAllNotificationsRead,
  getDashboardOverview,
  getTimetable,
  getTermsList,
  getAcademicsList,
  getAssignmentsList,
  getAssignmentDetail,
  submitAssignment,
  getTeachersList,
  getStudentProfile,
  updateStudentProfile,
  getActivityFeed,
  getSettings,
  updateSettings,
  changePassword,
  logActivity,
  getLocales
};

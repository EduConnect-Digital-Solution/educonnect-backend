/**
 * Teacher Service
 * Handles teacher dashboard and profile business logic
 * Enhanced with Redis caching for optimal performance
 */

const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const logger = require('../utils/logger');

class TeacherService {
  /**
   * Get teacher dashboard data
   * @param {string} userId - Teacher user ID
   * @param {string} schoolId - School identifier
   * @returns {Object} Teacher dashboard data
   */
  static async getTeacherDashboard(userId, schoolId) {
    // Try to get cached dashboard data first
    const cacheKey = `dashboard:${userId}`;
    const cachedData = await CacheService.get('teacher', cacheKey);
    
    if (cachedData) {
      logger.info(`👨‍🏫 Teacher dashboard cache HIT for ${userId}`);
      return {
        ...cachedData,
        cached: true,
        cacheTimestamp: cachedData.generatedAt
      };
    }

    logger.info(`👨‍🏫 Teacher dashboard cache MISS for ${userId} - generating fresh data`);

    // Get school
    // Find school by either UUID (id) or human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });

    // If not found by UUID, try human-readable schoolId
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }
    if (!school) {
      throw new Error('School not found');
    }

    // Get teacher information
    const teacher = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Get students assigned to this teacher
    // 1. Students directly assigned to teacher (via teacherStudent junction table)
    const directlyAssignedStudents = await prisma.student.findMany({
      where: {
        schoolId: school.id,
        studentOf: {
          some: {
            teacherId: userId,
            isActive: true
          }
        },
        isActive: true
      },
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        section: true,
        grade: true,
        classId: true,
        armId: true
      }
    });

    // 2. Students in teacher's assigned classes (only if teacher has classes assigned)
    let studentsInClasses = [];
    if (teacher.classes && teacher.classes.length > 0) {
      // Get class records for teacher's assigned classes
      const assignedClassRecords = await prisma.class.findMany({
        where: {
          schoolId: school.id,
          name: { in: teacher.classes },
          isActive: true
        }
      });
      
      if (assignedClassRecords.length > 0) {
        studentsInClasses = await prisma.student.findMany({
          where: {
            schoolId: school.id,
            classId: { in: assignedClassRecords.map(c => c.id) },
            isActive: true,
            NOT: {
              id: { in: directlyAssignedStudents.map(s => s.id) }
            }
          },
          select: {
            id: true,
            studentId: true,
            firstName: true,
            lastName: true,
            section: true,
            grade: true,
            classId: true,
            armId: true
          }
        });
      }
    }

    // Combine both lists - directly assigned students + students in assigned classes
    const allStudents = [...directlyAssignedStudents, ...studentsInClasses];
    const myStudents = directlyAssignedStudents; // Keep track of directly assigned for stats

    // Calculate statistics
    const stats = {
      myStudents: myStudents.length, // Directly assigned students
      totalStudentsInClasses: allStudents.length, // All students teacher can see
      subjects: teacher.subjects ? teacher.subjects.length : 0,
      classes: teacher.classes ? teacher.classes.length : 0
    };

    // Group students by class for better organization
    const studentsByClass = {};
    allStudents.forEach(student => {
      const classKey = student.classId || 'Unassigned';
      if (!studentsByClass[classKey]) {
        studentsByClass[classKey] = [];
      }
      studentsByClass[classKey].push(student);
    });

    // Recent activity (placeholder for future implementation)
    const recentActivity = [
      {
        type: 'login',
        message: 'Logged into dashboard',
        timestamp: new Date()
      }
    ];

    // Quick actions for teachers
    const quickActions = [
      {
        title: 'View My Students',
        description: 'See all students you can access',
        action: 'view_students',
        count: allStudents.length
      },
      {
        title: 'Manage Classes',
        description: 'View and manage your classes',
        action: 'manage_classes',
        count: teacher.classes ? teacher.classes.length : 0
      },
      {
        title: 'Subject Overview',
        description: 'Review subjects you teach',
        action: 'view_subjects',
        count: teacher.subjects ? teacher.subjects.length : 0
      }
    ];

    const dashboardData = {
      teacher: {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        fullName: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        subjects: teacher.subjects || [],
        classes: teacher.classes || [],
        phone: teacher.phone,
        lastLoginAt: teacher.lastLoginAt
      },
      school: {
        id: school.id,
        schoolId: school.id,
        schoolName: school.schoolName,
        email: school.email
      },
      statistics: stats,
      myStudents: allStudents.map(student => ({
        id: student.id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        classId: student.classId,
      armId: student.armId,
        section: student.section,
        classDisplay: student.classId ? `Class ID: ${student.classId}` : 'Not Assigned',
        grade: student.grade,
        isDirectlyAssigned: myStudents.some(ms => ms.id === student.id)
      })),
      studentsByClass: studentsByClass,
      recentActivity: recentActivity,
      quickActions: quickActions,
      navigation: {
        dashboard: '/teacher/dashboard',
        students: '/teacher/students',
        classes: '/teacher/classes',
        subjects: '/teacher/subjects',
        profile: '/teacher/profile'
      },
      cached: false,
      generatedAt: new Date().toISOString()
    };

    // Cache teacher dashboard for 10 minutes
    await CacheService.set('teacher', cacheKey, dashboardData, 600);
    logger.info(`👨‍🏫 Teacher dashboard cached for ${userId}`);

    return dashboardData;
  }

  /**
   * Get teacher's students with filtering and pagination
   * @param {string} userId - Teacher user ID
   * @param {string} schoolId - School identifier
   * @param {Object} options - Query options
   * @returns {Object} Teacher's students data
   */
  static async getMyStudents(userId, schoolId, { studentClass, section, page = 1, limit = 20 }) {
    // Create cache key based on query parameters
    const cacheKey = `students:${userId}:${studentClass || 'all'}:${section || 'all'}:${page}:${limit}`;
    
    // Try cache first
    const cachedData = await CacheService.get('teacher', cacheKey);
    if (cachedData) {
      logger.info(`👨‍🏫 Teacher students cache HIT for ${cacheKey}`);
      return {
        ...cachedData,
        cached: true,
        cacheTimestamp: cachedData.generatedAt
      };
    }

    logger.info(`👨‍🏫 Teacher students cache MISS for ${cacheKey} - querying database`);

    // Get school
    // Find school by either UUID (id) or human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });

    // If not found by UUID, try human-readable schoolId
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }
    if (!school) {
      throw new Error('School not found');
    }

    // Get teacher information
    const teacher = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Build where clause for students - both directly assigned AND in teacher's classes
    const whereClause = {
      schoolId: school.id,
      isActive: true
    };

    // Get directly assigned students (via teacherStudent junction table)
    const directAssignmentWhere = {
      ...whereClause,
      studentOf: {
        some: {
          teacherId: userId,
          isActive: true
        }
      }
    };

    // Get students in teacher's classes (if teacher has classes)
    let classAssignmentWhere = null;
    if (teacher.classes && teacher.classes.length > 0) {
      // Get class records for teacher's assigned classes
      const assignedClassRecords = await prisma.class.findMany({
        where: {
          schoolId: school.id,
          name: { in: teacher.classes },
          isActive: true
        }
      });
      
      if (assignedClassRecords.length > 0) {
        classAssignmentWhere = {
          ...whereClause,
          classId: { in: assignedClassRecords.map(c => c.id) }
        };
      }
    }

    // Combine queries
    let studentIds = new Set();

    const [directStudents, classStudents] = await Promise.all([
      prisma.student.findMany({
        where: directAssignmentWhere,
        select: { id: true }
      }),
      classAssignmentWhere ? prisma.student.findMany({
        where: classAssignmentWhere,
        select: { id: true }
      }) : Promise.resolve([])
    ]);

    directStudents.forEach(s => studentIds.add(s.id));
    classStudents.forEach(s => studentIds.add(s.id));

    // Build final where clause with the combined IDs
    const combinedWhere = {
      ...whereClause,
      id: { in: [...studentIds] }
    };

    // Add filters
    if (studentClass && studentClass !== 'all') {
      // Convert class name to classId
      const classRecord = await prisma.class.findFirst({
        where: {
          schoolId: school.id,
          name: studentClass,
          isActive: true
        }
      });
      if (classRecord) {
        combinedWhere.classId = classRecord.id;
      }
    }
    if (section && section !== 'all') {
      combinedWhere.section = section;
    }

    // Get students with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: combinedWhere,
        orderBy: [
          { classId: 'asc' },
          { section: 'asc' },
          { firstName: 'asc' }
        ],
        skip,
        take: parseInt(limit),
        include: {
          parentOf: {
            include: {
              parent: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          }
        }
      }),
      prisma.student.count({ where: combinedWhere })
    ]);

    // Format response
    const formattedStudents = students.map(student => ({
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      classId: student.classId,
      armId: student.armId,
      section: student.section,
      classDisplay: student.classId ? `Class ID: ${student.classId}` : 'Not Assigned',
      grade: student.grade,
      dateOfBirth: student.dateOfBirth,
      age: student.age,
      gender: student.gender,
      isActive: student.isActive,
      isEnrolled: student.isEnrolled,
      parents: student.parentOf
        .filter(p => p.parent)
        .map(p => ({
          id: p.parent.id,
          name: `${p.parent.firstName} ${p.parent.lastName}`,
          email: p.parent.email,
          phone: p.parent.phone
        })),
      isDirectlyAssigned: student.studentOf.some(ts => ts.teacherId === userId && ts.isActive)
    }));

    const studentsData = {
      students: formattedStudents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        class: studentClass || 'all',
        section: section || 'all'
      },
      cached: false,
      generatedAt: new Date().toISOString()
    };

    // Cache teacher students data for 5 minutes (shorter TTL due to frequent updates)
    await CacheService.set('teacher', cacheKey, studentsData, 300);
    logger.info(`👨‍🏫 Teacher students cached for ${cacheKey}`);

    return studentsData;
  }

  /**
   * Get teacher profile
   * @param {string} userId - Teacher user ID
   * @param {string} schoolId - School identifier
   * @returns {Object} Teacher profile data
   */
  static async getTeacherProfile(userId, schoolId) {
    // Try to get cached profile data first
    const cacheKey = `profile:${userId}`;
    const cachedProfile = await CacheService.get('teacher', cacheKey);
    
    if (cachedProfile) {
      logger.info(`👨‍🏫 Teacher profile cache HIT for ${userId}`);
      return {
        ...cachedProfile,
        cached: true,
        cacheTimestamp: cachedProfile.generatedAt
      };
    }

    logger.info(`👨‍🏫 Teacher profile cache MISS for ${userId} - fetching from database`);

    // Get teacher information
    const teacher = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Get school information
    // Find school by either UUID (id) or human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });

    // If not found by UUID, try human-readable schoolId
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }

    const profileData = {
      teacher: {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        fullName: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        employeeId: teacher.employeeId,
        subjects: teacher.subjects || [],
        classes: teacher.classes || [],
        qualifications: teacher.qualifications || [],
        experience: teacher.experience,
        phone: teacher.phone,
        profileImage: teacher.profileImage,
        isActive: teacher.isActive,
        isVerified: teacher.isVerified,
        createdAt: teacher.createdAt,
        lastLoginAt: teacher.lastLoginAt
      },
      school: {
        id: school.id,
        schoolId: school.id,
        schoolName: school.schoolName,
        email: school.email
      },
      cached: false,
      generatedAt: new Date().toISOString()
    };

    // Cache teacher profile for 15 minutes
    await CacheService.set('teacher', cacheKey, profileData, 900);
    logger.info(`👨‍🏫 Teacher profile cached for ${userId}`);

    return profileData;
  }

  /**
   * Invalidate teacher-related caches
   * @param {string} schoolId - School identifier
   * @param {string} teacherId - Teacher identifier (optional)
   */
  static async invalidateTeacherCaches(schoolId, teacherId = null) {
    logger.info(`🗑️ Invalidating teacher caches for school ${schoolId}${teacherId ? ` and teacher ${teacherId}` : ''}`);
    
    // Invalidate specific teacher caches if teacherId provided
    if (teacherId) {
      await CacheService.del('teacher', `dashboard:${teacherId}`);
      await CacheService.del('teacher', `profile:${teacherId}`);
      
      // Invalidate teacher students caches (all variations)
      const teacherStudentsPattern = `educonnect:teacher:students:${teacherId}*`;
      const deletedCount = await CacheService.delPattern(teacherStudentsPattern);
      logger.info(`🗑️ Invalidated ${deletedCount} teacher-specific cache entries`);
    }
    
    // Invalidate dashboard caches that depend on teacher data
    const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
    const dashboardDeleted = await CacheService.delPattern(dashboardPattern);
    
    logger.info(`🗑️ Invalidated ${dashboardDeleted} dashboard entries for school ${schoolId}`);
  }

  /**
   * Warm up teacher caches (pre-populate with fresh data)
   * @param {string} teacherId - Teacher identifier
   * @param {string} schoolId - School identifier
   */
  static async warmUpTeacherCaches(teacherId, schoolId) {
    logger.info(`🔥 Warming up teacher caches for ${teacherId}`);
    
    try {
      // Pre-load teacher dashboard
      await this.getTeacherDashboard(teacherId, schoolId);
      
      // Pre-load teacher profile
      await this.getTeacherProfile(teacherId, schoolId);
      
      // Pre-load common student views
      await this.getMyStudents(teacherId, schoolId, { page: 1, limit: 20 });
      
      logger.info(`🔥 Teacher caches warmed up successfully for ${teacherId}`);
    } catch (error) {
      logger.error(`❌ Failed to warm up teacher caches for ${teacherId}:`, error.message);
    }
  }
}

module.exports = TeacherService;

/**
 * Teacher Service
 * Handles teacher dashboard and profile business logic
 * Enhanced with Redis caching for optimal performance
 */

const User = require('../models/User');
const Student = require('../models/Student');
const School = require('../models/School');
const CacheService = require('./cacheService');

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
      console.log(`👨‍🏫 Teacher dashboard cache HIT for ${userId}`);
      return {
        ...cachedData,
        cached: true,
        cacheTimestamp: cachedData.generatedAt
      };
    }

    console.log(`👨‍🏫 Teacher dashboard cache MISS for ${userId} - generating fresh data`);

    // Get teacher information
    const teacher = await User.findById(userId).select('-password');
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Get school information
    const school = await School.findOne({ schoolId });
    if (!school) {
      throw new Error('School not found');
    }

    // Get students assigned to this teacher
    // 1. Students directly assigned to teacher (via teacherIds field)
    const directlyAssignedStudents = await Student.find({
      schoolId: schoolId,
      $or: [
        { teacherIds: teacher._id }, // Updated to use new field name
        { teachers: teacher._id }    // Keep legacy field for backward compatibility
      ],
      isActive: true
    }).select('firstName lastName studentId class section grade');

    // 2. Students in teacher's assigned classes (only if teacher has classes assigned)
    let studentsInClasses = [];
    if (teacher.classes && teacher.classes.length > 0) {
      studentsInClasses = await Student.find({
        schoolId: schoolId,
        class: { $in: teacher.classes },
        isActive: true,
        // Exclude students already directly assigned to avoid duplicates
        _id: { $nin: directlyAssignedStudents.map(s => s._id) }
      }).select('firstName lastName studentId class section grade');
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
      const classKey = student.class || 'Unassigned';
      if (!studentsByClass[classKey]) {
        studentsByClass[classKey] = [];
      }
      studentsByClass[classKey].push({
        id: student._id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        section: student.section,
        grade: student.grade,
        isMyStudent: myStudents.some(ms => ms._id.equals(student._id))
      });
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
        id: teacher._id,
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
        id: school._id,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email
      },
      statistics: stats,
      myStudents: allStudents.map(student => ({
        id: student._id,
        studentId: student.studentId,
        name: `${student.firstName} ${student.lastName}`,
        class: student.class,
        section: student.section,
        classDisplay: student.class && student.section ? `${student.class}-${student.section}` : student.class || 'Not Assigned',
        grade: student.grade,
        isDirectlyAssigned: myStudents.some(ms => ms._id.equals(student._id))
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
    console.log(`👨‍🏫 Teacher dashboard cached for ${userId}`);

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
      console.log(`👨‍🏫 Teacher students cache HIT for ${cacheKey}`);
      return {
        ...cachedData,
        cached: true,
        cacheTimestamp: cachedData.generatedAt
      };
    }

    console.log(`👨‍🏫 Teacher students cache MISS for ${cacheKey} - querying database`);

    // Get teacher information
    const teacher = await User.findById(userId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Build query for students - both directly assigned AND in teacher's classes
    let studentQuery = {
      schoolId: schoolId,
      isActive: true
    };

    // Get directly assigned students
    const directAssignmentQuery = {
      ...studentQuery,
      $or: [
        { teacherIds: teacher._id }, // Updated to use new field name
        { teachers: teacher._id }    // Keep legacy field for backward compatibility
      ]
    };

    // Get students in teacher's classes (if teacher has classes)
    const classAssignmentQuery = teacher.classes && teacher.classes.length > 0 ? {
      ...studentQuery,
      class: { $in: teacher.classes }
    } : null;

    // Combine queries using $or to get both directly assigned and class-based students
    const combinedQuery = {
      ...studentQuery,
      $or: [
        // Directly assigned students
        ...(directAssignmentQuery.$or || []),
        // Students in teacher's classes (if teacher has classes)
        ...(classAssignmentQuery ? [{ class: { $in: teacher.classes } }] : [])
      ]
    };

    // If teacher has no classes and no direct assignments, show empty result
    if ((!teacher.classes || teacher.classes.length === 0) && !combinedQuery.$or.length) {
      combinedQuery._id = null; // This will return no results
    }

    // Add filters to the combined query
    if (studentClass && studentClass !== 'all') {
      combinedQuery.class = studentClass;
    }
    if (section && section !== 'all') {
      combinedQuery.section = section;
    }

    // Get students with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const students = await Student.find(combinedQuery)
      .sort({ class: 1, section: 1, firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('parentIds', 'firstName lastName email phone');

    const total = await Student.countDocuments(combinedQuery);

    // Format response
    const formattedStudents = students.map(student => ({
      id: student._id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      class: student.class,
      section: student.section,
      classDisplay: student.class && student.section ? `${student.class}-${student.section}` : student.class || 'Not Assigned',
      grade: student.grade,
      dateOfBirth: student.dateOfBirth,
      age: student.age,
      gender: student.gender,
      isActive: student.isActive,
      isEnrolled: student.isEnrolled,
      parents: student.parentIds.map(parent => ({
        id: parent._id,
        name: `${parent.firstName} ${parent.lastName}`,
        email: parent.email,
        phone: parent.phone
      })),
      isDirectlyAssigned: (student.teacherIds && student.teacherIds.includes(teacher._id)) || 
                       (student.teachers && student.teachers.includes(teacher._id))
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
    console.log(`👨‍🏫 Teacher students cached for ${cacheKey}`);

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
      console.log(`👨‍🏫 Teacher profile cache HIT for ${userId}`);
      return {
        ...cachedProfile,
        cached: true,
        cacheTimestamp: cachedProfile.generatedAt
      };
    }

    console.log(`👨‍🏫 Teacher profile cache MISS for ${userId} - fetching from database`);

    // Get teacher information
    const teacher = await User.findById(userId).select('-password');
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Get school information
    const school = await School.findOne({ schoolId });

    const profileData = {
      teacher: {
        id: teacher._id,
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
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email
      },
      cached: false,
      generatedAt: new Date().toISOString()
    };

    // Cache teacher profile for 15 minutes
    await CacheService.set('teacher', cacheKey, profileData, 900);
    console.log(`👨‍🏫 Teacher profile cached for ${userId}`);

    return profileData;
  }

  /**
   * Invalidate teacher-related caches
   * @param {string} schoolId - School identifier
   * @param {string} teacherId - Teacher identifier (optional)
   */
  static async invalidateTeacherCaches(schoolId, teacherId = null) {
    console.log(`🗑️ Invalidating teacher caches for school ${schoolId}${teacherId ? ` and teacher ${teacherId}` : ''}`);
    
    // Invalidate specific teacher caches if teacherId provided
    if (teacherId) {
      await CacheService.del('teacher', `dashboard:${teacherId}`);
      await CacheService.del('teacher', `profile:${teacherId}`);
      
      // Invalidate teacher students caches (all variations)
      const teacherStudentsPattern = `educonnect:teacher:students:${teacherId}*`;
      const deletedCount = await CacheService.delPattern(teacherStudentsPattern);
      console.log(`🗑️ Invalidated ${deletedCount} teacher-specific cache entries`);
    }
    
    // Invalidate dashboard caches that depend on teacher data
    const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
    const dashboardDeleted = await CacheService.delPattern(dashboardPattern);
    
    console.log(`🗑️ Invalidated ${dashboardDeleted} dashboard entries for school ${schoolId}`);
  }

  /**
   * Warm up teacher caches (pre-populate with fresh data)
   * @param {string} teacherId - Teacher identifier
   * @param {string} schoolId - School identifier
   */
  static async warmUpTeacherCaches(teacherId, schoolId) {
    console.log(`🔥 Warming up teacher caches for ${teacherId}`);
    
    try {
      // Pre-load teacher dashboard
      await this.getTeacherDashboard(teacherId, schoolId);
      
      // Pre-load teacher profile
      await this.getTeacherProfile(teacherId, schoolId);
      
      // Pre-load common student views
      await this.getMyStudents(teacherId, schoolId, { page: 1, limit: 20 });
      
      console.log(`🔥 Teacher caches warmed up successfully for ${teacherId}`);
    } catch (error) {
      console.error(`❌ Failed to warm up teacher caches for ${teacherId}:`, error.message);
    }
  }
}

module.exports = TeacherService;
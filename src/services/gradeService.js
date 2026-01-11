/**
 * Grade Service
 * Handles grade management business logic for teachers
 * Supports the workflow: Classes → Subjects → Students → Grades
 */

const Grade = require('../models/Grade');
const User = require('../models/User');
const Student = require('../models/Student');
const CacheService = require('./cacheService');

class GradeService {
  /**
   * Get teacher's classes (from User.classes array)
   * @param {string} teacherId - Teacher user ID
   * @param {string} schoolId - School identifier
   * @returns {Array} List of classes teacher teaches
   */
  static async getTeacherClasses(teacherId, schoolId) {
    const cacheKey = `classes:${teacherId}`;
    
    // Try cache first
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      console.log(`📚 Teacher classes cache HIT for ${teacherId}`);
      return cachedData;
    }

    console.log(`📚 Teacher classes cache MISS for ${teacherId}`);

    // Get teacher information
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    console.log(`👨‍🏫 Teacher found: ${teacher.firstName} ${teacher.lastName}`);
    console.log(`📚 Teacher classes from profile: ${JSON.stringify(teacher.classes)}`);

    // Use the SAME logic as TeacherService for consistency
    // 1. Students directly assigned to teacher (via teacherIds field)
    const directlyAssignedStudents = await Student.find({
      schoolId: schoolId,
      $or: [
        { teacherIds: teacher._id },
        { teachers: teacher._id }
      ],
      isActive: true
    }).select('class');

    // 2. Students in teacher's assigned classes (only if teacher has classes assigned)
    let studentsInClasses = [];
    if (teacher.classes && teacher.classes.length > 0) {
      studentsInClasses = await Student.find({
        schoolId: schoolId,
        class: { $in: teacher.classes },
        isActive: true,
        // Exclude students already directly assigned to avoid duplicates
        _id: { $nin: directlyAssignedStudents.map(s => s._id) }
      }).select('class');
    }

    // Combine both lists and get unique classes
    const allStudents = [...directlyAssignedStudents, ...studentsInClasses];
    const uniqueClasses = [...new Set(allStudents.map(s => s.class).filter(c => c))];
    
    console.log(`📚 Classes from directly assigned students: ${JSON.stringify(directlyAssignedStudents.map(s => s.class))}`);
    console.log(`📚 Classes from teacher profile: ${JSON.stringify(teacher.classes)}`);
    console.log(`📚 Final unique classes: ${JSON.stringify(uniqueClasses)}`);
    
    // Get student count for each class
    const classesWithCounts = await Promise.all(
      uniqueClasses.map(async (className) => {
        const studentCount = await Student.countDocuments({
          schoolId: schoolId,
          class: className,
          isActive: true,
          isEnrolled: true
        });
        
        console.log(`👥 Class ${className}: ${studentCount} students`);
        
        return {
          name: className,
          studentCount: studentCount
        };
      })
    );

    const result = {
      classes: classesWithCounts,
      totalClasses: uniqueClasses.length,
      generatedAt: new Date().toISOString()
    };

    console.log(`📊 Final result: ${JSON.stringify(result)}`);

    // Cache for 5 minutes (shorter for debugging)
    await CacheService.set('grades', cacheKey, result, 300);
    
    return result;
  }

  /**
   * Get subjects teacher teaches in a specific class
   * @param {string} teacherId - Teacher user ID
   * @param {string} className - Class name
   * @param {string} schoolId - School identifier
   * @returns {Array} List of subjects for the class
   */
  static async getSubjectsByClass(teacherId, className, schoolId) {
    const cacheKey = `subjects:${teacherId}:${className}`;
    
    // Try cache first
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      console.log(`📖 Teacher subjects cache HIT for ${teacherId}:${className}`);
      return cachedData;
    }

    console.log(`📖 Teacher subjects cache MISS for ${teacherId}:${className}`);

    // Get teacher information
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Verify teacher teaches this class
    if (!teacher.classes || !teacher.classes.includes(className)) {
      throw new Error('Access denied. You do not teach this class.');
    }

    // Get subjects from teacher's profile
    const subjects = teacher.subjects || [];
    
    // Get grade statistics for each subject in this class
    const subjectsWithStats = await Promise.all(
      subjects.map(async (subject) => {
        const studentCount = await Student.countDocuments({
          schoolId: schoolId,
          class: className,
          isActive: true,
          isEnrolled: true
        });
        
        const gradeCount = await Grade.countDocuments({
          teacherId: teacherId,
          class: className,
          subject: subject
        });
        
        return {
          name: subject,
          studentCount: studentCount,
          gradedCount: gradeCount,
          gradingProgress: studentCount > 0 ? Math.round((gradeCount / studentCount) * 100) : 0
        };
      })
    );

    const result = {
      className: className,
      subjects: subjectsWithStats,
      totalSubjects: subjects.length,
      generatedAt: new Date().toISOString()
    };

    // Cache for 5 minutes (shorter due to grading progress updates)
    await CacheService.set('grades', cacheKey, result, 300);
    
    return result;
  }

  /**
   * Get students in a class for a specific subject
   * @param {string} teacherId - Teacher user ID
   * @param {string} className - Class name
   * @param {string} subject - Subject name
   * @param {string} schoolId - School identifier
   * @param {Object} options - Query options
   * @returns {Object} Students data with grade information
   */
  static async getStudentsByClassAndSubject(teacherId, className, subject, schoolId, options = {}) {
    const { term = 'First Term', academicYear, page = 1, limit = 50 } = options;
    
    const cacheKey = `students:${teacherId}:${className}:${subject}:${term}:${page}:${limit}`;
    
    // Try cache first
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      console.log(`👥 Students cache HIT for ${cacheKey}`);
      return cachedData;
    }

    console.log(`👥 Students cache MISS for ${cacheKey}`);

    // Verify teacher access
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    if (!teacher.classes?.includes(className) || !teacher.subjects?.includes(subject)) {
      throw new Error('Access denied. You do not teach this subject in this class.');
    }

    // Get current academic year if not provided
    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    // Get students in the class
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const students = await Student.find({
      schoolId: schoolId,
      class: className,
      isActive: true,
      isEnrolled: true
    })
    .sort({ firstName: 1, lastName: 1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('parentIds', 'firstName lastName email');

    const totalStudents = await Student.countDocuments({
      schoolId: schoolId,
      class: className,
      isActive: true,
      isEnrolled: true
    });

    // Get existing grades for these students
    const studentIds = students.map(s => s._id);
    const existingGrades = await Grade.find({
      teacherId: teacherId,
      studentId: { $in: studentIds },
      subject: subject,
      class: className,
      term: term,
      academicYear: currentAcademicYear
    });

    // Create a map for quick grade lookup
    const gradeMap = {};
    existingGrades.forEach(grade => {
      gradeMap[grade.studentId.toString()] = grade;
    });

    // Format students with grade information
    const studentsWithGrades = students.map(student => {
      const existingGrade = gradeMap[student._id.toString()];
      
      return {
        id: student._id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        class: student.class,
        section: student.section,
        grade: existingGrade ? {
          id: existingGrade._id,
          totalScore: existingGrade.totalScore,
          totalMaxScore: existingGrade.totalMaxScore,
          percentage: existingGrade.percentage,
          letterGrade: existingGrade.letterGrade,
          gradePoints: existingGrade.gradePoints,
          assessments: existingGrade.assessments,
          remarks: existingGrade.remarks,
          isPublished: existingGrade.isPublished,
          lastUpdated: existingGrade.updatedAt
        } : null,
        hasGrade: !!existingGrade,
        hasPublishedGrade: existingGrade ? existingGrade.isPublished : false,
        parents: student.parentIds.map(parent => ({
          id: parent._id,
          name: `${parent.firstName} ${parent.lastName}`,
          email: parent.email
        }))
      };
    });

    const result = {
      className: className,
      subject: subject,
      term: term,
      academicYear: currentAcademicYear,
      students: studentsWithGrades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalStudents,
        pages: Math.ceil(totalStudents / parseInt(limit))
      },
      statistics: {
        totalStudents: totalStudents,
        gradedStudents: existingGrades.length,
        ungradedStudents: totalStudents - existingGrades.length,
        gradingProgress: totalStudents > 0 ? Math.round((existingGrades.length / totalStudents) * 100) : 0
      },
      generatedAt: new Date().toISOString()
    };

    // Cache for 2 minutes (short TTL due to frequent updates)
    await CacheService.set('grades', cacheKey, result, 120);
    
    return result;
  }

  /**
   * Assign or update grade for a student
   * @param {string} teacherId - Teacher user ID
   * @param {Object} gradeData - Grade data
   * @returns {Object} Created or updated grade
   */
  static async assignGrade(teacherId, gradeData) {
    const {
      studentId,
      subject,
      class: className,
      section,
      term = 'First Term',
      academicYear,
      assessments,
      remarks
    } = gradeData;

    // Verify teacher access
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Verify student exists and is in the right class
    const student = await Student.findById(studentId);
    if (!student || student.schoolId !== teacher.schoolId) {
      throw new Error('Student not found or not in your school.');
    }

    if (student.class !== className) {
      throw new Error('Student is not in the specified class.');
    }

    // Verify teacher teaches this subject and class
    if (!teacher.subjects?.includes(subject) || !teacher.classes?.includes(className)) {
      throw new Error('Access denied. You do not teach this subject in this class.');
    }

    // Get current academic year if not provided
    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    // Check if grade already exists
    let existingGrade = await Grade.findOne({
      teacherId: teacherId,
      studentId: studentId,
      subject: subject,
      class: className,
      term: term,
      academicYear: currentAcademicYear
    });

    if (existingGrade) {
      // Update existing grade
      existingGrade.assessments = assessments || existingGrade.assessments;
      existingGrade.remarks = remarks || existingGrade.remarks;
      existingGrade.section = section || existingGrade.section;
      existingGrade.updatedBy = teacherId;
      
      await existingGrade.save();
      
      // Invalidate related caches
      await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);
      
      return existingGrade;
    } else {
      // Create new grade
      const newGrade = new Grade({
        schoolId: teacher.schoolId,
        teacherId: teacherId,
        studentId: studentId,
        subject: subject,
        class: className,
        section: section,
        term: term,
        academicYear: currentAcademicYear,
        assessments: assessments || [],
        remarks: remarks,
        createdBy: teacherId,
        updatedBy: teacherId
      });

      await newGrade.save();
      
      // Invalidate related caches
      await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);
      
      return newGrade;
    }
  }

  /**
   * Get all grades for a specific student
   * @param {string} teacherId - Teacher user ID
   * @param {string} studentId - Student ID
   * @param {Object} options - Query options
   * @returns {Object} Student grades data
   */
  static async getStudentGrades(teacherId, studentId, options = {}) {
    const { term, academicYear, subject, publishedOnly = false } = options;
    
    const cacheKey = `student-grades:${teacherId}:${studentId}:${term || 'all'}:${academicYear || 'current'}:${subject || 'all'}:${publishedOnly}`;
    
    // Try cache first
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Verify teacher access
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Verify student exists and is in the same school
    const student = await Student.findById(studentId);
    if (!student || student.schoolId !== teacher.schoolId) {
      throw new Error('Student not found or not in your school.');
    }

    // Get current academic year if not provided
    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    // Build query options
    const queryOptions = {
      publishedOnly: publishedOnly
    };
    
    if (term) queryOptions.term = term;
    if (currentAcademicYear) queryOptions.academicYear = currentAcademicYear;
    if (subject) queryOptions.subject = subject;

    // Get grades for the student
    const grades = await Grade.findByStudent(studentId, queryOptions);

    // Filter grades to only include those from teachers in the same school
    // and optionally filter by teacher's subjects if specified
    const filteredGrades = grades.filter(grade => {
      // Basic school check (already done by student validation, but extra safety)
      if (grade.schoolId !== teacher.schoolId) return false;
      
      // If teacher doesn't teach all subjects, only show grades for subjects they teach
      // This is optional - you might want to show all grades regardless
      // Uncomment the next two lines if you want to restrict by teacher's subjects
      // if (teacher.subjects && teacher.subjects.length > 0 && !teacher.subjects.includes(grade.subject)) return false;
      
      return true;
    });

    // Group grades by subject for better organization
    const gradesBySubject = {};
    let totalGradePoints = 0;
    let totalCredits = 0;

    filteredGrades.forEach(grade => {
      if (!gradesBySubject[grade.subject]) {
        gradesBySubject[grade.subject] = [];
      }
      gradesBySubject[grade.subject].push({
        id: grade._id,
        subject: grade.subject,
        class: grade.class,
        section: grade.section,
        term: grade.term,
        academicYear: grade.academicYear,
        totalScore: grade.totalScore,
        totalMaxScore: grade.totalMaxScore,
        percentage: grade.percentage,
        letterGrade: grade.letterGrade,
        gradePoints: grade.gradePoints,
        assessments: grade.assessments,
        remarks: grade.remarks,
        isPublished: grade.isPublished,
        teacher: {
          id: grade.teacherId._id,
          name: `${grade.teacherId.firstName} ${grade.teacherId.lastName}`
        },
        createdAt: grade.createdAt,
        updatedAt: grade.updatedAt
      });

      // Calculate GPA (only for published grades)
      if (grade.isPublished && grade.gradePoints !== undefined) {
        totalGradePoints += grade.gradePoints;
        totalCredits += 1; // Assuming each subject has equal weight
      }
    });

    // Calculate GPA
    const gpa = totalCredits > 0 ? Math.round((totalGradePoints / totalCredits) * 100) / 100 : 0;

    const result = {
      student: {
        id: student._id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        class: student.class,
        section: student.section
      },
      academicYear: currentAcademicYear,
      term: term || 'All Terms',
      subject: subject || 'All Subjects',
      gradesBySubject: gradesBySubject,
      summary: {
        totalSubjects: Object.keys(gradesBySubject).length,
        totalGrades: filteredGrades.length,
        publishedGrades: filteredGrades.filter(g => g.isPublished).length,
        unpublishedGrades: filteredGrades.filter(g => !g.isPublished).length,
        gpa: gpa,
        averagePercentage: filteredGrades.length > 0 ? 
          Math.round((filteredGrades.reduce((sum, g) => sum + (g.percentage || 0), 0) / filteredGrades.length) * 100) / 100 : 0
      },
      generatedAt: new Date().toISOString()
    };

    // Cache for 5 minutes
    await CacheService.set('grades', cacheKey, result, 300);
    
    return result;
  }

  /**
   * Get grade details for a specific student
   * @param {string} teacherId - Teacher user ID
   * @param {string} gradeId - Grade ID
   * @returns {Object} Grade details
   */
  static async getGradeDetails(teacherId, gradeId) {
    const grade = await Grade.findById(gradeId)
      .populate('studentId', 'firstName lastName studentId class section')
      .populate('teacherId', 'firstName lastName');

    if (!grade) {
      throw new Error('Grade not found.');
    }

    // Verify teacher owns this grade
    if (grade.teacherId._id.toString() !== teacherId) {
      throw new Error('Access denied. You can only view your own grades.');
    }

    return grade;
  }

  /**
   * Delete a grade record
   * @param {string} teacherId - Teacher user ID
   * @param {string} gradeId - Grade ID
   * @returns {Object} Deletion result
   */
  static async deleteGrade(teacherId, gradeId) {
    const grade = await Grade.findById(gradeId);

    if (!grade) {
      throw new Error('Grade not found.');
    }

    // Verify teacher owns this grade
    if (grade.teacherId.toString() !== teacherId) {
      throw new Error('Access denied. You can only delete your own grades.');
    }

    // Don't allow deletion of published grades
    if (grade.isPublished) {
      throw new Error('Cannot delete published grades. Unpublish first.');
    }

    await Grade.findByIdAndDelete(gradeId);
    
    // Invalidate related caches
    await this.invalidateGradeCaches(grade.schoolId, teacherId, grade.class, grade.subject);
    
    return { success: true, message: 'Grade deleted successfully.' };
  }

  /**
   * Publish grades for a class and subject
   * @param {string} teacherId - Teacher user ID
   * @param {Object} publishData - Publish data
   * @returns {Object} Publish result
   */
  static async publishGrades(teacherId, publishData) {
    const { class: className, subject, term, academicYear } = publishData;

    console.log(`📚 Starting grade publishing process for teacher ${teacherId}`);
    console.log(`📋 Publish data:`, { className, subject, term, academicYear });

    try {
      // Verify teacher access
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        console.error(`❌ Teacher verification failed for ${teacherId}: ${teacher ? 'Invalid role' : 'Teacher not found'}`);
        throw new Error('Access denied. Teacher role required.');
      }

      console.log(`👨‍🏫 Teacher verified: ${teacher.firstName} ${teacher.lastName} (${teacher.email})`);

      // Verify teacher teaches this subject and class
      if (!teacher.subjects?.includes(subject)) {
        console.error(`❌ Teacher ${teacherId} does not teach subject: ${subject}. Teacher subjects:`, teacher.subjects);
        throw new Error(`Access denied. You do not teach the subject "${subject}". Please contact your administrator if this is incorrect.`);
      }

      if (!teacher.classes?.includes(className)) {
        console.error(`❌ Teacher ${teacherId} does not teach class: ${className}. Teacher classes:`, teacher.classes);
        throw new Error(`Access denied. You do not teach the class "${className}". Please contact your administrator if this is incorrect.`);
      }

      console.log(`✅ Teacher authorization verified for ${subject} in ${className}`);

      // Get current academic year if not provided
      const currentAcademicYear = academicYear || (() => {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-${currentYear + 1}`;
      })();

      const currentTerm = term || 'First Term';

      console.log(`📅 Using academic year: ${currentAcademicYear}, term: ${currentTerm}`);

      // First, check if any grades exist for this class/subject combination
      const existingGrades = await Grade.find({
        teacherId: teacherId,
        class: className,
        subject: subject,
        term: currentTerm,
        academicYear: currentAcademicYear
      });

      console.log(`📊 Found ${existingGrades.length} existing grades for ${subject} in ${className}`);

      if (existingGrades.length === 0) {
        console.error(`❌ No grades found for publishing: ${subject} in ${className} for ${currentTerm} ${currentAcademicYear}`);
        throw new Error(`No grades found to publish for ${subject} in ${className} for ${currentTerm} ${currentAcademicYear}. Please assign grades to students first.`);
      }

      // Log details about existing grades
      const publishedCount = existingGrades.filter(g => g.isPublished).length;
      const unpublishedCount = existingGrades.length - publishedCount;
      console.log(`📈 Grade status: ${publishedCount} already published, ${unpublishedCount} unpublished`);

      // Update all grades for this class/subject to published
      console.log(`🔄 Updating grades to published status...`);
      const result = await Grade.updateMany(
        {
          teacherId: teacherId,
          class: className,
          subject: subject,
          term: currentTerm,
          academicYear: currentAcademicYear
        },
        {
          isPublished: true,
          publishedAt: new Date(),
          publishedBy: teacherId
        }
      );

      console.log(`✅ Grade update result:`, {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        acknowledged: result.acknowledged
      });

      if (result.matchedCount === 0) {
        console.error(`❌ No grades matched the update criteria`);
        throw new Error(`No grades found matching the specified criteria. Please verify the class, subject, term, and academic year.`);
      }

      // Invalidate related caches
      console.log(`🗑️ Invalidating caches for teacher ${teacherId}, class ${className}, subject ${subject}`);
      await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);

      const successMessage = `Published ${result.modifiedCount} grades for ${subject} in ${className} (${currentTerm} ${currentAcademicYear})`;
      console.log(`🎉 ${successMessage}`);

      return {
        success: true,
        message: successMessage,
        publishedCount: result.modifiedCount,
        totalGrades: result.matchedCount,
        gradeIds: existingGrades.map(grade => grade._id.toString()),
        details: {
          className: className,
          subject: subject,
          term: currentTerm,
          academicYear: currentAcademicYear,
          teacherId: teacherId,
          teacherName: `${teacher.firstName} ${teacher.lastName}`,
          publishedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`❌ Error in publishGrades service:`, {
        teacherId,
        publishData,
        error: error.message,
        stack: error.stack
      });
      
      // Re-throw the error with additional context if it's not already detailed
      if (!error.message.includes('Access denied') && !error.message.includes('No grades found')) {
        throw new Error(`Failed to publish grades: ${error.message}`);
      }
      
      throw error;
    }
  }

  /**
   * Get class statistics for grades
   * @param {string} teacherId - Teacher user ID
   * @param {string} className - Class name
   * @param {string} subject - Subject name
   * @param {string} term - Term
   * @param {string} academicYear - Academic year
   * @returns {Object} Class statistics
   */
  static async getClassStatistics(teacherId, className, subject, term, academicYear) {
    const cacheKey = `stats:${teacherId}:${className}:${subject}:${term}:${academicYear}`;
    
    // Try cache first
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const stats = await Grade.getClassStatistics(teacherId, className, subject, term, academicYear);
    
    // Cache for 5 minutes
    await CacheService.set('grades', cacheKey, stats, 300);
    
    return stats;
  }

  /**
   * Invalidate grade-related caches
   * @param {string} schoolId - School identifier
   * @param {string} teacherId - Teacher identifier
   * @param {string} className - Class name (optional)
   * @param {string} subject - Subject name (optional)
   */
  static async invalidateGradeCaches(schoolId, teacherId, className = null, subject = null) {
    console.log(`🗑️ Invalidating grade caches for teacher ${teacherId}, school ${schoolId}`);
    
    // Invalidate teacher-specific caches
    await CacheService.del('grades', `classes:${teacherId}`);
    console.log(`🗑️ Invalidated teacher classes cache`);
    
    if (className) {
      await CacheService.del('grades', `subjects:${teacherId}:${className}`);
      console.log(`🗑️ Invalidated subjects cache for ${className}`);
      
      if (subject) {
        // Invalidate all student lists for this class/subject combination
        const studentPattern = `educonnect:grades:students:${teacherId}:${className}:${subject}*`;
        const deletedStudents = await CacheService.delPattern(studentPattern);
        console.log(`🗑️ Invalidated ${deletedStudents} student cache entries`);
        
        // Invalidate statistics
        const statsPattern = `educonnect:grades:stats:${teacherId}:${className}:${subject}*`;
        const deletedStats = await CacheService.delPattern(statsPattern);
        console.log(`🗑️ Invalidated ${deletedStats} statistics cache entries`);
      }
    }
    
    // Invalidate student grades caches (since we don't know which students are affected)
    const studentGradesPattern = `educonnect:grades:student-grades:${teacherId}*`;
    const deletedGrades = await CacheService.delPattern(studentGradesPattern);
    console.log(`🗑️ Invalidated ${deletedGrades} student grades cache entries`);
  }
}

module.exports = GradeService;
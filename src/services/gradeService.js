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

    // Get classes from teacher's profile
    const classes = teacher.classes || [];
    
    // Get student count for each class
    const classesWithCounts = await Promise.all(
      classes.map(async (className) => {
        const studentCount = await Student.countDocuments({
          schoolId: schoolId,
          class: className,
          isActive: true,
          isEnrolled: true
        });
        
        return {
          name: className,
          studentCount: studentCount
        };
      })
    );

    const result = {
      classes: classesWithCounts,
      totalClasses: classes.length,
      generatedAt: new Date().toISOString()
    };

    // Cache for 10 minutes
    await CacheService.set('grades', cacheKey, result, 600);
    
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
   * Get grade details for a specific student
   * @param {string} teacherId - Teacher user ID
   * @param {string} gradeId - Grade ID
   * @returns {Object} Grade details
   */
  static async getGradeDetails(teacherId, gradeId) {
    console.log(`🔍 Looking for grade with ID: ${gradeId} for teacher: ${teacherId}`);
    
    // Enhanced debugging - check if grade exists at all first
    const gradeExists = await Grade.findById(gradeId);
    console.log(`📋 Grade exists in database: ${!!gradeExists}`);
    
    if (gradeExists) {
      console.log(`📋 Grade found - Teacher: ${gradeExists.teacherId}, Subject: ${gradeExists.subject}, Class: ${gradeExists.class}`);
      console.log(`📋 Grade published: ${gradeExists.isPublished}, Created: ${gradeExists.createdAt}`);
    }
    
    // Check all grades for this teacher to help debug
    const teacherGrades = await Grade.find({ teacherId: teacherId });
    console.log(`📊 Teacher has ${teacherGrades.length} total grades. All IDs:`, 
      teacherGrades.map(g => g._id.toString()));
    
    const grade = await Grade.findById(gradeId)
      .populate('studentId', 'firstName lastName studentId class section')
      .populate('teacherId', 'firstName lastName');

    if (!grade) {
      console.log(`❌ Grade not found with ID: ${gradeId}`);
      
      // Check if grade exists but populate failed
      const gradeWithoutPopulate = await Grade.findById(gradeId);
      if (gradeWithoutPopulate) {
        console.log(`⚠️ Grade exists but populate failed. Raw grade:`, {
          id: gradeWithoutPopulate._id,
          teacherId: gradeWithoutPopulate.teacherId,
          studentId: gradeWithoutPopulate.studentId,
          subject: gradeWithoutPopulate.subject
        });
      }
      
      throw new Error('Grade not found.');
    }

    console.log(`✅ Found grade: ${grade._id} for student: ${grade.studentId?.firstName} ${grade.studentId?.lastName}`);

    // Verify teacher owns this grade
    if (grade.teacherId._id.toString() !== teacherId) {
      console.log(`❌ Access denied: Grade belongs to teacher ${grade.teacherId._id}, not ${teacherId}`);
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

    // Verify teacher access
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Access denied. Teacher role required.');
    }

    // Get current academic year if not provided
    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    const currentTerm = term || 'First Term';

    // First, check if any grades exist for this class/subject combination
    const existingGrades = await Grade.find({
      teacherId: teacherId,
      class: className,
      subject: subject,
      term: currentTerm,
      academicYear: currentAcademicYear
    });

    console.log(`📊 Publishing grades: Found ${existingGrades.length} existing grades for ${subject} in ${className}`);

    if (existingGrades.length === 0) {
      throw new Error(`No grades found to publish for ${subject} in ${className}. Please assign grades to students first.`);
    }

    // Update all grades for this class/subject to published
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

    console.log(`📊 Published ${result.modifiedCount} grades for ${subject} in ${className}`);

    // Invalidate related caches
    await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);

    return {
      success: true,
      message: `Published ${result.modifiedCount} grades for ${subject} in ${className}`,
      publishedCount: result.modifiedCount,
      gradeIds: existingGrades.map(grade => grade._id.toString())
    };
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
      console.log(`📊 Grade statistics cache HIT for ${cacheKey}`);
      return cachedData;
    }

    console.log(`📊 Grade statistics cache MISS for ${cacheKey}`);

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
    console.log(`🗑️ Invalidating grade caches for teacher ${teacherId}`);
    
    // Invalidate teacher-specific caches
    await CacheService.del('grades', `classes:${teacherId}`);
    
    if (className) {
      await CacheService.del('grades', `subjects:${teacherId}:${className}`);
      
      if (subject) {
        // Invalidate all student lists for this class/subject combination
        const studentPattern = `educonnect:grades:students:${teacherId}:${className}:${subject}*`;
        await CacheService.delPattern(studentPattern);
        
        // Invalidate statistics
        const statsPattern = `educonnect:grades:stats:${teacherId}:${className}:${subject}*`;
        await CacheService.delPattern(statsPattern);
      }
    }
    
    console.log(`🗑️ Grade caches invalidated for teacher ${teacherId}`);
  }
}

module.exports = GradeService;
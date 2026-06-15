/**
 * Grade Service
 * Handles grade management business logic for teachers
 * Supports the workflow: Classes → Subjects → Students → Grades
 */

const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const GradingScaleService = require('./gradingScaleService');
const logger = require('../utils/logger');
const { AppError, AuthorizationError, NotFoundError } = require('../utils/AppError');

const mapTermToPrisma = (term) => {
  const termMap = {
    'First Term': 'First_Term',
    'Second Term': 'Second_Term',
    'Third Term': 'Third_Term'
  };
  return termMap[term] || term;
};

const mapPrismaTermToString = (prismaTerm) => {
  const termMap = {
    'First_Term': 'First Term',
    'Second_Term': 'Second Term',
    'Third_Term': 'Third Term'
  };
  return termMap[prismaTerm] || prismaTerm;
};

class GradeService {
  /**
   * Get teacher's classes (from User.classes array)
   * @param {string} teacherId - Teacher user ID
   * @param {string} schoolId - School identifier
   * @returns {Array} List of classes teacher teaches
   */
  static async getTeacherClasses(teacherId, schoolId) {
    const cacheKey = `classes:${teacherId}`;
    
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      logger.info(`📚 Teacher classes cache HIT for ${teacherId}`);
      return cachedData;
    }

    logger.info(`📚 Teacher classes cache MISS for ${teacherId}`);

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AuthorizationError('Access denied. Teacher role required.');
    }

    logger.info(`👨‍🏫 Teacher found: ${teacher.firstName} ${teacher.lastName}`);
    logger.info(`📚 Teacher classes from profile: ${JSON.stringify(teacher.classes)}`);

    const teacherClasses = teacher.classes || [];
    
    const classesWithCounts = await Promise.all(
      teacherClasses.map(async (className) => {
        // Get class record by name
        const classRecord = await prisma.class.findFirst({
          where: {
            schoolId: schoolId,
            name: className,
            isActive: true
          }
        });
        
        const studentCount = await prisma.student.count({
          where: {
            schoolId: schoolId,
            classId: classRecord?.id,
            isActive: true,
            isEnrolled: true
          }
        });
        
        logger.info(`👥 Class ${className}: ${studentCount} students`);
        
        return {
          name: className,
          studentCount: studentCount
        };
      })
    );

    const result = {
      classes: classesWithCounts,
      totalClasses: teacherClasses.length,
      generatedAt: new Date().toISOString()
    };

    logger.info(`📊 Final result: ${JSON.stringify(result)}`);

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
    
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      logger.info(`📖 Teacher subjects cache HIT for ${teacherId}:${className}`);
      return cachedData;
    }

    logger.info(`📖 Teacher subjects cache MISS for ${teacherId}:${className}`);

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AuthorizationError('Access denied. Teacher role required.');
    }

    if (!teacher.classes || !teacher.classes.includes(className)) {
      throw new AuthorizationError('Access denied. You do not teach this class.');
    }

    const subjects = teacher.subjects || [];
    
    const subjectsWithStats = await Promise.all(
      subjects.map(async (subject) => {
        // Get class record by name
        const classRecord = await prisma.class.findFirst({
          where: {
            schoolId: schoolId,
            name: className,
            isActive: true
          }
        });
        
        const studentCount = await prisma.student.count({
          where: {
            schoolId: schoolId,
            classId: classRecord?.id,
            isActive: true,
            isEnrolled: true
          }
        });
        
        const gradeCount = await prisma.grade.count({
          where: {
            teacherId: teacherId,
            classId: classRecord?.id,
            subject: subject
          }
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
    
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      logger.info(`👥 Students cache HIT for ${cacheKey}`);
      return cachedData;
    }

    logger.info(`👥 Students cache MISS for ${cacheKey}`);

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AuthorizationError('Access denied. Teacher role required.');
    }

    if (!teacher.classes?.includes(className) || !teacher.subjects?.includes(subject)) {
      throw new AuthorizationError('Access denied. You do not teach this subject in this class.');
    }

    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    // Get class record by name
    const classRecord = await prisma.class.findFirst({
      where: {
        schoolId: schoolId,
        name: className,
        isActive: true
      }
    });

    if (!classRecord) {
      throw new NotFoundError(`Class ${className} not found`);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const students = await prisma.student.findMany({
      where: {
        schoolId: schoolId,
        classId: classRecord.id,
        isActive: true,
        isEnrolled: true
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ],
      skip: skip,
      take: parseInt(limit),
      include: {
        arm: { select: { name: true } },
        parentOf: {
          include: {
            parent: true
          }
        }
      }
    });

    const totalStudents = await prisma.student.count({
      where: {
        schoolId: schoolId,
        classId: classRecord.id,
        isActive: true,
        isEnrolled: true
      }
    });

    const studentIds = students.map(s => s.id);
    const prismaTerm = mapTermToPrisma(term);
    const existingGrades = await prisma.grade.findMany({
      where: {
        teacherId: teacherId,
        studentId: { in: studentIds },
        subject: subject,
        classId: classRecord.id,
        term: prismaTerm,
        academicYear: currentAcademicYear
      },
      include: {
        assessments: true
      }
    });

    const gradeMap = {};
    existingGrades.forEach(grade => {
      gradeMap[grade.studentId] = grade;
    });

    const studentsWithGrades = students.map(student => {
      const existingGrade = gradeMap[student.id];
      
      return {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        classId: student.classId,
      armId: student.armId,
        grade: existingGrade ? {
          id: existingGrade.id,
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
        parents: (student.parentOf || [])
          .filter(ps => ps.parent)
          .map(ps => ({
            id: ps.parent.id,
            name: `${ps.parent.firstName} ${ps.parent.lastName}`,
            email: ps.parent.email
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
      className,
      section,
      term = 'First Term',
      academicYear,
      assessments,
      remarks
    } = gradeData;

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AuthorizationError('Access denied. Teacher role required.');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.schoolId !== teacher.schoolId) {
      throw new NotFoundError('Student not found or not in your school.');
    }

    // Get student's class to verify
    const studentClass = await prisma.class.findFirst({
      where: { id: student.classId, schoolId: teacher.schoolId }
    });
    
    if (!studentClass || studentClass.name !== className) {
      throw new AppError('Student is not in the specified class.', 400);
    }

    if (!teacher.subjects?.includes(subject) || !teacher.classes?.includes(className)) {
      throw new AuthorizationError('Access denied. You do not teach this subject in this class.');
    }

    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    const prismaTerm = mapTermToPrisma(term);

    let existingGrade = await prisma.grade.findUnique({
      where: {
        schoolId_teacherId_studentId_subject_term_academicYear: {
          schoolId: teacher.schoolId,
          teacherId: teacherId,
          studentId: studentId,
          subject: subject,
          term: prismaTerm,
          academicYear: currentAcademicYear
        }
      },
      include: { assessments: true }
    });

    const totalScore = assessments ? assessments.reduce((sum, a) => sum + (a.score || 0), 0) : undefined;
    const totalMaxScore = assessments ? assessments.reduce((sum, a) => sum + (a.maxScore || 0), 0) : undefined;
    const percentage = totalScore !== undefined && totalMaxScore > 0
      ? Math.round((totalScore / totalMaxScore) * 100 * 100) / 100
      : undefined;

    let gradeLabel = null;
    let gradePoints = null;
    if (percentage !== undefined) {
      const resolved = await GradingScaleService.resolveGrade(teacher.schoolId, percentage);
      if (resolved) {
        gradeLabel = resolved.label;
        gradePoints = resolved.gradePoints;
      }
    }

    if (existingGrade) {
      await prisma.grade.update({
        where: { id: existingGrade.id },
        data: {
          remarks: remarks || existingGrade.remarks,
          section: section || existingGrade.section,
          totalScore: totalScore ?? existingGrade.totalScore,
          totalMaxScore: totalMaxScore ?? existingGrade.totalMaxScore,
          percentage: percentage ?? existingGrade.percentage,
          gradeLabel: gradeLabel || existingGrade.gradeLabel,
          gradePoints: gradePoints ?? existingGrade.gradePoints,
          updatedBy: teacherId
        }
      });

      if (assessments) {
        await prisma.assessment.deleteMany({ where: { gradeId: existingGrade.id } });
        if (assessments.length > 0) {
          await prisma.assessment.createMany({
            data: assessments.map(a => ({
              gradeId: existingGrade.id,
              type: a.type,
              title: a.title,
              score: a.score,
              maxScore: a.maxScore,
              weight: a.weight || 1,
              date: a.date ? new Date(a.date) : new Date(),
              remarks: a.remarks
            }))
          });
        }
      }

      const finalGrade = await prisma.grade.findUnique({
        where: { id: existingGrade.id },
        include: { teacher: true, student: true, assessments: true }
      });

      await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);
      return finalGrade;
    } else {
      const newGrade = await prisma.grade.create({
        data: {
          schoolId: teacher.schoolId,
          teacherId: teacherId,
          studentId: studentId,
          subject: subject,
          classId: studentClass.id,
          section: section,
          term: prismaTerm,
          academicYear: currentAcademicYear,
          totalScore,
          totalMaxScore,
          percentage,
          gradeLabel,
          gradePoints,
          remarks: remarks,
          createdBy: teacherId,
          updatedBy: teacherId,
          isPublished: false
        }
      });

      if (assessments && assessments.length > 0) {
        await prisma.assessment.createMany({
          data: assessments.map(a => ({
            gradeId: newGrade.id,
            type: a.type,
            title: a.title,
            score: a.score,
            maxScore: a.maxScore,
            weight: a.weight || 1,
            date: a.date ? new Date(a.date) : new Date(),
            remarks: a.remarks
          }))
        });
      }

      const finalGrade = await prisma.grade.findUnique({
        where: { id: newGrade.id },
        include: { teacher: true, student: true, assessments: true }
      });

      await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);
      return finalGrade;
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
    
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AuthorizationError('Access denied. Teacher role required.');
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || student.schoolId !== teacher.schoolId) {
      throw new NotFoundError('Student not found or not in your school.');
    }

    const currentAcademicYear = academicYear || (() => {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    })();

    const where = { studentId: studentId };
    if (term) where.term = mapTermToPrisma(term);
    if (currentAcademicYear) where.academicYear = currentAcademicYear;
    if (subject) where.subject = subject;
    if (publishedOnly) where.isPublished = true;

    const grades = await prisma.grade.findMany({
      where: where,
      include: {
        teacher: true,
        student: true,
        assessments: true
      }
    });

    const filteredGrades = grades.filter(grade => grade.schoolId === teacher.schoolId);

    const gradesBySubject = {};
    let totalGradePoints = 0;
    let totalCredits = 0;

    filteredGrades.forEach(grade => {
      if (!gradesBySubject[grade.subject]) {
        gradesBySubject[grade.subject] = [];
      }
      gradesBySubject[grade.subject].push({
        id: grade.id,
        subject: grade.subject,
        classId: grade.classId,
        section: grade.section,
        term: mapPrismaTermToString(grade.term),
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
          id: grade.teacher.id,
          name: `${grade.teacher.firstName} ${grade.teacher.lastName}`
        },
        createdAt: grade.createdAt,
        updatedAt: grade.updatedAt
      });

      if (grade.isPublished && grade.gradePoints !== undefined) {
        totalGradePoints += grade.gradePoints;
        totalCredits += 1;
      }
    });

    const gpa = totalCredits > 0 ? Math.round((totalGradePoints / totalCredits) * 100) / 100 : 0;

    const result = {
      student: {
        id: student.id,
        studentId: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName: `${student.firstName} ${student.lastName}`,
        classId: student.classId,
      armId: student.armId,
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
    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      include: {
        student: true,
        teacher: true,
        assessments: true
      }
    });

    if (!grade) {
      throw new NotFoundError('Grade not found.');
    }

    if (grade.teacherId !== teacherId) {
      throw new AuthorizationError('Access denied. You can only view your own grades.');
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
    const grade = await prisma.grade.findUnique({ where: { id: gradeId } });

    if (!grade) {
      throw new NotFoundError('Grade not found.');
    }

    if (grade.teacherId !== teacherId) {
      throw new AuthorizationError('Access denied. You can only delete your own grades.');
    }

    if (grade.isPublished) {
      throw new AppError('Cannot delete published grades. Unpublish first.', 400);
    }

    await prisma.assessment.deleteMany({ where: { gradeId: gradeId } });
    await prisma.grade.delete({ where: { id: gradeId } });
    
    // Get class name for cache invalidation
    const gradeClass = await prisma.class.findUnique({
      where: { id: grade.classId }
    });
    await this.invalidateGradeCaches(grade.schoolId, teacherId, gradeClass?.name, grade.subject);
    
    return { success: true, message: 'Grade deleted successfully.' };
  }

  /**
   * Publish grades for a class and subject
   * @param {string} teacherId - Teacher user ID
   * @param {Object} publishData - Publish data
   * @returns {Object} Publish result
   */
  static async publishGrades(teacherId, publishData) {
    const { className, subject, term, academicYear } = publishData;

    logger.info(`📚 Starting grade publishing process for teacher ${teacherId}`);
    logger.info(`📋 Publish data:`, { className, subject, term, academicYear });

    try {
      const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
      if (!teacher || teacher.role !== 'teacher') {
        logger.error(`❌ Teacher verification failed for ${teacherId}: ${teacher ? 'Invalid role' : 'Teacher not found'}`);
        throw new AuthorizationError('Access denied. Teacher role required.');
      }

      if (!teacher.classes?.includes(className) || !teacher.subjects?.includes(subject)) {
        logger.error(`❌ Teacher ${teacherId} does not teach ${subject} in ${className}`);
        throw new AuthorizationError('Access denied. You do not teach this subject in this class.');
      }

      // Get class record by name
      const classRecord = await prisma.class.findFirst({
        where: {
          schoolId: teacher.schoolId,
          name: className,
          isActive: true
        }
      });

      if (!classRecord) {
        throw new NotFoundError(`Class ${className} not found`);
      }

      const currentAcademicYear = academicYear || (() => {
        const currentYear = new Date().getFullYear();
        return `${currentYear}-${currentYear + 1}`;
      })();

      const currentTerm = term || 'First Term';
      const prismaTerm = mapTermToPrisma(currentTerm);

      logger.info(`📅 Using academic year: ${currentAcademicYear}, term: ${currentTerm}`);

      const existingGrades = await prisma.grade.findMany({
        where: {
          teacherId: teacherId,
          classId: classRecord.id,
          subject: subject,
          term: prismaTerm,
          academicYear: currentAcademicYear
        }
      });

      logger.info(`📊 Found ${existingGrades.length} existing grades for ${subject} in ${className}`);

      if (existingGrades.length === 0) {
        logger.error(`❌ No grades found for publishing: ${subject} in ${className} for ${currentTerm} ${currentAcademicYear}`);
        throw new NotFoundError(`No grades found for ${subject} in ${className} for ${currentTerm} ${currentAcademicYear}`);
      }

      const publishedCount = existingGrades.filter(g => g.isPublished).length;
      const unpublishedCount = existingGrades.length - publishedCount;
      logger.info(`📈 Grade status: ${publishedCount} already published, ${unpublishedCount} unpublished`);

      logger.info(`🔄 Updating grades to published status...`);
      const result = await prisma.grade.updateMany({
        where: {
          teacherId: teacherId,
          classId: classRecord.id,
          subject: subject,
          term: prismaTerm,
          academicYear: currentAcademicYear
        },
        data: {
          isPublished: true,
          publishedAt: new Date(),
          publishedBy: teacherId
        }
      });

      logger.info(`✅ Grade update result:`, {
        modified: result.count,
        acknowledged: true
      });

      if (result.count === 0) {
        logger.error(`❌ No grades matched the update criteria`);
        throw new NotFoundError(`No grades found matching the specified criteria. Please verify the class, subject, term, and academic year.`);
      }

      await this.invalidateGradeCaches(teacher.schoolId, teacherId, className, subject);

      const successMessage = `Published ${result.count} grades for ${subject} in ${className} (${currentTerm} ${currentAcademicYear})`;
      logger.info(`🎉 ${successMessage}`);

      return {
        success: true,
        message: successMessage,
        publishedCount: result.count,
        totalGrades: existingGrades.length,
        gradeIds: existingGrades.map(grade => grade.id),
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
      logger.error(`❌ Error in publishGrades service:`, {
        teacherId,
        publishData,
        error: error.message,
        stack: error.stack
      });
      
      if (!error.message.includes('Access denied') && !error.message.includes('No grades found')) {
        throw new AppError(`Failed to publish grades: ${error.message}`, 500);
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
    
    const cachedData = await CacheService.get('grades', cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const teacher = await prisma.user.findUnique({ where: { id: teacherId } });
    if (!teacher || teacher.role !== 'teacher') {
      throw new AuthorizationError('Access denied. Teacher role required.');
    }

    const prismaTerm = mapTermToPrisma(term);

    // Get class record by name
    const classRecord = await prisma.class.findFirst({
      where: {
        schoolId: teacher.schoolId,
        name: className,
        isActive: true
      }
    });

    if (!classRecord) {
      throw new NotFoundError(`Class ${className} not found`);
    }

    const grades = await prisma.grade.findMany({
      where: {
        teacherId: teacherId,
        classId: classRecord.id,
        subject: subject,
        term: prismaTerm,
        academicYear: academicYear
      },
      include: {
        assessments: true
      }
    });

    const totalGrades = grades.length;
    const publishedGrades = grades.filter(g => g.isPublished).length;
    const percentages = grades.map(g => g.percentage).filter(p => p !== null && p !== undefined);
    const averagePercentage = percentages.length > 0 ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100 : 0;
    const highestPercentage = percentages.length > 0 ? Math.max(...percentages) : 0;
    const lowestPercentage = percentages.length > 0 ? Math.min(...percentages) : 0;

    const stats = {
      className: className,
      subject: subject,
      term: term,
      academicYear: academicYear,
      totalGrades: totalGrades,
      publishedGrades: publishedGrades,
      unpublishedGrades: totalGrades - publishedGrades,
      averagePercentage: averagePercentage,
      highestPercentage: highestPercentage,
      lowestPercentage: lowestPercentage,
      gradingProgress: totalGrades > 0 ? Math.round((publishedGrades / totalGrades) * 100) : 0,
      generatedAt: new Date().toISOString()
    };

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
    logger.info(`🗑️ Invalidating grade caches for teacher ${teacherId}, school ${schoolId}`);
    
    await CacheService.del('grades', `classes:${teacherId}`);
    logger.info(`🗑️ Invalidated teacher classes cache`);
    
    if (className) {
      await CacheService.del('grades', `subjects:${teacherId}:${className}`);
      logger.info(`🗑️ Invalidated subjects cache for ${className}`);
      
      if (subject) {
        const studentPattern = `educonnect:grades:students:${teacherId}:${className}:${subject}*`;
        const deletedStudents = await CacheService.delPattern(studentPattern);
        logger.info(`🗑️ Invalidated ${deletedStudents} student cache entries`);
        
        const statsPattern = `educonnect:grades:stats:${teacherId}:${className}:${subject}*`;
        const deletedStats = await CacheService.delPattern(statsPattern);
        logger.info(`🗑️ Invalidated ${deletedStats} statistics cache entries`);
      }
    }
    
    const studentGradesPattern = `educonnect:grades:student-grades:${teacherId}*`;
    const deletedGrades = await CacheService.delPattern(studentGradesPattern);
    logger.info(`🗑️ Invalidated ${deletedGrades} student grades cache entries`);
  }
}

module.exports = GradeService;

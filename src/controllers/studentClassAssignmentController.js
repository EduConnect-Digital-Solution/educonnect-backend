/**
 * Student Class Assignment Controller
 * Handles student class assignment and unassignment operations
 */

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Bulk assign students to classes and arms
 * POST /api/admin/students/assign
 */
const bulkAssignStudents = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { assignments } = req.body;

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assignments array is required and cannot be empty'
      });
    }

    const validationErrors = [];
    const validAssignments = [];

    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      
      if (!assignment.studentId || !assignment.classId || !assignment.armId) {
        validationErrors.push(`Assignment at index ${i}: studentId, classId, and armId are required`);
        continue;
      }

      // Verify student belongs to school
      const student = await prisma.student.findFirst({
        where: { id: assignment.studentId, schoolId, isActive: true }
      });

      if (!student) {
        validationErrors.push(`Assignment at index ${i}: Student not found`);
        continue;
      }

      // Verify class belongs to school
      const classExists = await prisma.class.findFirst({
        where: { id: assignment.classId, schoolId, isActive: true }
      });

      if (!classExists) {
        validationErrors.push(`Assignment at index ${i}: Class not found`);
        continue;
      }

      // Verify arm belongs to class and school
      const armExists = await prisma.arm.findFirst({
        where: { 
          id: assignment.armId, 
          classId: assignment.classId, 
          schoolId, 
          isActive: true 
        }
      });

      if (!armExists) {
        validationErrors.push(`Assignment at index ${i}: Arm not found or not part of the specified class`);
        continue;
      }

      validAssignments.push({
        studentId: assignment.studentId,
        classId: assignment.classId,
        armId: assignment.armId
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate student assignments
    const duplicateCheck = await prisma.student.findMany({
      where: {
        schoolId,
        id: {
          in: validAssignments.map(a => a.studentId)
        },
        isActive: true
      },
      select: { id: true, classId: true, armId: true }
    });

    const alreadyAssigned = duplicateCheck.filter(student => 
      student.classId || student.armId
    );

    if (alreadyAssigned.length > 0) {
      const duplicates = alreadyAssigned.map(s => `Student ${s.id} already assigned to class ${s.classId}, arm ${s.armId}`);
      return res.status(409).json({
        success: false,
        message: 'Some students are already assigned to classes',
        duplicates
      });
    }

    // Perform assignments
    const assignmentResults = await Promise.all(
      validAssignments.map(assignment =>
        prisma.student.update({
          where: { id: assignment.studentId },
          data: {
            classId: assignment.classId,
            armId: assignment.armId,
            updatedAt: new Date()
          }
        })
      )
    );

    logger.info(`Assigned ${assignmentResults.length} students to classes for school ${schoolId}`);

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${assignmentResults.length} students to classes`,
      data: {
        assigned: assignmentResults.length,
        assignments: assignmentResults.map(student => ({
          studentId: student.id,
          classId: student.classId,
          armId: student.armId
        }))
      }
    });
  } catch (error) {
    logger.error('Error bulk assigning students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Bulk unassign students from classes
 * POST /api/admin/students/unassign
 */
const bulkUnassignStudents = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Student IDs array is required and cannot be empty'
      });
    }

    // Verify all students belong to school
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        schoolId,
        isActive: true
      },
      select: { id: true, classId: true, armId: true }
    });

    if (students.length !== studentIds.length) {
      return res.status(404).json({
        success: false,
        message: 'Some students not found',
        found: students.length,
        requested: studentIds.length
      });
    }

    // Check which students are actually assigned
    const assignedStudents = students.filter(s => s.classId || s.armId);
    
    if (assignedStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No students are currently assigned to classes'
      });
    }

    // Unassign students
    const unassignmentResults = await Promise.all(
      assignedStudents.map(student =>
        prisma.student.update({
          where: { id: student.id },
          data: {
            classId: null,
            armId: null,
            updatedAt: new Date()
          }
        })
      )
    );

    logger.info(`Unassigned ${unassignmentResults.length} students from classes for school ${schoolId}`);

    res.status(200).json({
      success: true,
      message: `Successfully unassigned ${unassignmentResults.length} students from classes`,
      data: {
        unassigned: unassignmentResults.length,
        unassignments: unassignmentResults.map(student => ({
          studentId: student.id
        }))
      }
    });
  } catch (error) {
    logger.error('Error bulk unassigning students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get class population statistics
 * GET /api/admin/classes/population
 */
const getClassPopulation = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.query;

    const whereClause = { schoolId, isActive: true };
    if (classId) {
      whereClause.id = classId;
    }

    const classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        arms: {
          where: { isActive: true },
          include: {
            _count: {
              select: {
                students: {
                  where: { isActive: true }
                }
              }
            }
          }
        },
        _count: {
          select: {
            students: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { baseLevel: 'asc' }
    });

    const populationStats = classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      baseLevel: cls.baseLevel,
      level: cls.level,
      totalStudents: cls._count.students,
      arms: cls.arms.map(arm => ({
        id: arm.id,
        name: arm.name,
        studentCount: arm._count.students
      }))
    }));

    logger.info(`Retrieved population statistics for ${populationStats.length} classes for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        classes: populationStats,
        totalClasses: populationStats.length,
        totalStudents: populationStats.reduce((sum, cls) => sum + cls.totalStudents, 0)
      }
    });
  } catch (error) {
    logger.error('Error fetching class population:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch class population statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get unassigned students
 * GET /api/admin/students/unassigned
 */
const getUnassignedStudents = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: {
          schoolId,
          isActive: true,
          OR: [
            { classId: null },
            { armId: null }
          ]
        },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          email: true,
          gender: true,
          rollNumber: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.student.count({
        where: {
          schoolId,
          isActive: true,
          OR: [
            { classId: null },
            { armId: null }
          ]
        }
      })
    ]);

    logger.info(`Retrieved ${students.length} unassigned students for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        students: students.map(student => ({
          id: student.id,
          studentId: student.studentId,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.firstName} ${student.lastName}`,
          email: student.email,
          gender: student.gender,
          rollNumber: student.rollNumber,
          createdAt: student.createdAt
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching unassigned students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unassigned students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  bulkAssignStudents,
  bulkUnassignStudents,
  getClassPopulation,
  getUnassignedStudents
};

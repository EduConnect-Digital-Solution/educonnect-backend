/**
 * Class Management Controller
 * Handles class CRUD operations for school administrators
 */

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get all classes for a school
 * GET /api/admin/classes
 */
const getSchoolClasses = async (req, res) => {
  try {
    const { schoolId } = req.user;

    const classes = await prisma.class.findMany({
      where: {
        schoolId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        baseLevel: true,
        arm: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { baseLevel: 'asc' },
        { arm: 'asc' }
      ]
    });

    logger.info(`Retrieved ${classes.length} classes for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        classes: classes.map(cls => ({
          id: cls.id,
          name: cls.name,
          baseLevel: cls.baseLevel,
          level: cls.level,
          arm: cls.arm
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching school classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Bulk create classes
 * POST /api/admin/classes/bulk
 */
const bulkCreateClasses = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classes } = req.body;

    // Validate input
    if (!classes || !Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Classes array is required and cannot be empty'
      });
    }

    // Validate each class object
    const validationErrors = [];
    const validClasses = [];
    for (let i = 0; i < classes.length; i++) {
      const classData = classes[i];
      
      if (classData.level === undefined || !classData.name) {
        validationErrors.push(`Class at index ${i}: level and name are required`);
        continue;
      }

      // Validate level is between 1-6
      if (classData.level < 1 || classData.level > 100) {
        validationErrors.push(`Class at index ${i}: level must be between 1-100`);
        continue;
      }

      // Convert numeric level back to baseLevel for database compatibility
      const baseLevelMap = {
        1: 'Crèche', 2: 'Pre-Nursery', 3: 'Nursery 1', 4: 'Nursery 2',
        5: 'Primary 1', 6: 'Primary 2', 7: 'Primary 3', 8: 'Primary 4',
        9: 'Primary 5', 10: 'Primary 6', 11: 'JSS 1', 12: 'JSS 2',
        13: 'JSS 3', 14: 'SS 1', 15: 'SS 2', 16: 'SS 3'
      };

      validClasses.push({
        schoolId,
        name: classData.name,
        baseLevel: baseLevelMap[classData.level],
        level: classData.level,
        arm: classData.arm || null
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate class names within the school
    const existingClassNames = await prisma.class.findMany({
      where: {
        schoolId,
        name: {
          in: validClasses.map(cls => cls.name)
        }
      },
      select: { name: true }
    });

    if (existingClassNames.length > 0) {
      const duplicates = existingClassNames.map(cls => cls.name);
      return res.status(409).json({
        success: false,
        message: 'Classes with these names already exist',
        duplicates
      });
    }

    // Create classes
    const createdClasses = await prisma.class.createMany({
      data: validClasses,
      skipDuplicates: false
    });

    // Fetch created classes with their IDs
    const newClasses = await prisma.class.findMany({
      where: {
        schoolId,
        name: {
          in: validClasses.map(cls => cls.name)
        }
      },
      select: {
        id: true,
        name: true,
        baseLevel: true,
        level: true,
        arm: true
      }
    });

    logger.info(`Created ${createdClasses.count} classes for school ${schoolId}`);

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdClasses.count} classes`,
      data: {
        classes: newClasses
      }
    });
  } catch (error) {
    logger.error('Error bulk creating classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create classes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a class by ID
 * DELETE /api/admin/classes/:id
 */
const deleteClass = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    // Check if class exists and belongs to the user's school
    const existingClass = await prisma.class.findFirst({
      where: {
        id,
        schoolId
      }
    });

    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Check if class has students
    const studentCount = await prisma.student.count({
      where: {
        classId: id
      }
    });

    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with enrolled students',
        data: {
          studentCount
        }
      });
    }

    // Check if class has grades
    const gradeCount = await prisma.grade.count({
      where: {
        classId: id
      }
    });

    if (gradeCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete class with associated grades',
        data: {
          gradeCount
        }
      });
    }

    // Soft delete by setting isActive to false
    const deletedClass = await prisma.class.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    logger.info(`Soft deleted class ${id} from school ${schoolId}`);

    res.json({
      success: true,
      message: 'Class deleted successfully',
      data: {
        deleted: 1,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error deleting class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get class details by ID
 * GET /api/admin/classes/:id
 */
const getClassById = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const classData = await prisma.class.findFirst({
      where: {
        id,
        schoolId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        baseLevel: true,
        arm: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        students: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentId: true,
            isActive: true
          },
          where: {
            isActive: true
          }
        },
        _count: {
          select: {
            students: true,
            grades: true
          }
        }
      }
    });

    if (!classData) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    logger.info(`Retrieved class details for class ${id}`);

    res.json({
      success: true,
      data: {
        class: {
          id: classData.id,
          name: classData.name,
          baseLevel: classData.baseLevel,
          level: classData.level,
          arm: classData.arm,
          isActive: classData.isActive,
          createdAt: classData.createdAt,
          updatedAt: classData.updatedAt,
          studentCount: classData._count.students,
          gradeCount: classData._count.grades,
          students: classData.students
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching class details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch class details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getSchoolClasses,
  bulkCreateClasses,
  deleteClass,
  getClassById
};

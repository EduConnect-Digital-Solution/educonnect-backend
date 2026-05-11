/**
 * Academic Structure Controller
 * Handles subjects, arms, and their relationships management
 */

const { prisma } = require('../config/database');
const logger = require('../utils/logger');

// =============== SUBJECT MANAGEMENT ===============

/**
 * Create subjects
 * POST /api/academic/subjects
 */
const createSubjects = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { subjects } = req.body;

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Subjects array is required and cannot be empty'
      });
    }

    const validationErrors = [];
    const validSubjects = [];

    for (let i = 0; i < subjects.length; i++) {
      const subjectData = subjects[i];
      
      if (!subjectData.name || !subjectData.code) {
        validationErrors.push(`Subject at index ${i}: name and code are required`);
        continue;
      }

      validSubjects.push({
        schoolId,
        name: subjectData.name,
        code: subjectData.code,
        description: subjectData.description || null,
        category: subjectData.category || 'core'
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate codes and names within school
    const existingSubjects = await prisma.subject.findMany({
      where: {
        schoolId,
        OR: [
          {
            code: {
              in: validSubjects.map(s => s.code)
            }
          },
          {
            name: {
              in: validSubjects.map(s => s.name)
            }
          }
        ]
      },
      select: { code: true, name: true }
    });

    if (existingSubjects.length > 0) {
      const duplicates = existingSubjects.map(s => `${s.name} (${s.code})`);
      return res.status(409).json({
        success: false,
        message: 'Subjects with these names or codes already exist',
        duplicates
      });
    }

    // Create subjects
    const createdSubjects = await prisma.subject.createMany({
      data: validSubjects,
      skipDuplicates: false
    });

    // Fetch created subjects with their IDs
    const newSubjects = await prisma.subject.findMany({
      where: {
        schoolId,
        code: {
          in: validSubjects.map(s => s.code)
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        category: true,
        isActive: true,
        createdAt: true
      }
    });

    logger.info(`Created ${createdSubjects.count} subjects for school ${schoolId}`);

    res.status(201).json({
      success: true,
      message: `${createdSubjects.count} subject(s) created successfully`,
      data: {
        subjects: newSubjects,
        total: createdSubjects.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error creating subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * List subjects
 * GET /api/academic/subjects
 */
const listSubjects = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { categoryId } = req.query;

    const whereClause = {
      schoolId,
      isActive: true
    };

    if (categoryId) {
      whereClause.category = categoryId;
    }

    const subjects = await prisma.subject.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        category: true,
        isActive: true,
        createdAt: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    logger.info(`Retrieved ${subjects.length} subjects for school ${schoolId}`);

    res.json({
      success: true,
      data: {
        subjects,
        total: subjects.length
      }
    });
  } catch (error) {
    logger.error('Error fetching subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get subjects by class
 * GET /api/academic/classes/:classId/subjects
 */
const getSubjectsByClass = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;

    // Verify class belongs to user's school
    const classExists = await prisma.class.findFirst({
      where: { id: classId, schoolId, isActive: true }
    });

    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const subjects = await prisma.subject.findMany({
      where: {
        schoolId,
        classSubjects: {
          some: {
            classId
          }
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        category: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    logger.info(`Retrieved ${subjects.length} subjects for class ${classId}`);

    res.json({
      success: true,
      data: {
        subjects,
        total: subjects.length
      }
    });
  } catch (error) {
    logger.error('Error fetching class subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch class subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update subject
 * PUT /api/academic/subjects/:subjectId
 */
const updateSubject = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { subjectId } = req.params;
    const { name, category, description, code } = req.body;

    // Verify subject belongs to user's school
    const existingSubject = await prisma.subject.findFirst({
      where: { id: subjectId, schoolId }
    });

    if (!existingSubject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (category) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (code) updateData.code = code;

    const updatedSubject = await prisma.subject.update({
      where: { id: subjectId },
      data: updateData
    });

    logger.info(`Updated subject ${subjectId} in school ${schoolId}`);

    res.json({
      success: true,
      message: 'Subject updated successfully',
      data: updatedSubject
    });
  } catch (error) {
    logger.error('Error updating subject:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subject',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete subjects
 * DELETE /api/academic/subjects
 */
const deleteSubjects = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { subjectIds } = req.body;

    if (!subjectIds) {
      return res.status(400).json({
        success: false,
        message: 'Subject IDs are required'
      });
    }

    // Convert to array if single string
    const idsToDelete = Array.isArray(subjectIds) ? subjectIds : [subjectIds];

    // Verify subjects belong to user's school
    const existingSubjects = await prisma.subject.findMany({
      where: {
        id: { in: idsToDelete },
        schoolId
      }
    });

    if (existingSubjects.length !== idsToDelete.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more subjects not found'
      });
    }

    // Check if subjects are assigned to any classes or arms
    const assignedSubjects = await prisma.subject.findMany({
      where: {
        id: { in: idsToDelete },
        OR: [
          {
            classSubjects: {
              some: {}
            }
          },
          {
            armSubjects: {
              some: {}
            }
          }
        ]
      }
    });

    if (assignedSubjects.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete subjects that are assigned to classes or arms',
        data: {
          assignedSubjects: assignedSubjects.map(s => ({ id: s.id, name: s.name }))
        }
      });
    }

    // Delete subjects
    const deletedSubjects = await prisma.subject.deleteMany({
      where: {
        id: { in: idsToDelete },
        schoolId
      }
    });

    logger.info(`Deleted ${deletedSubjects.count} subjects from school ${schoolId}`);

    res.json({
      success: true,
      message: `${deletedSubjects.count} subject(s) deleted successfully`,
      data: {
        deleted: deletedSubjects.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error deleting subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============== ARM MANAGEMENT ===============

/**
 * Create arms
 * POST /api/academic/arms
 */
const createArms = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { arms } = req.body;

    if (!arms || !Array.isArray(arms) || arms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Arms array is required and cannot be empty'
      });
    }

    const validationErrors = [];
    const validArms = [];

    for (let i = 0; i < arms.length; i++) {
      const armData = arms[i];
      
      if (!armData.classId || !armData.name) {
        validationErrors.push(`Arm at index ${i}: classId and name are required`);
        continue;
      }

      // Verify class belongs to user's school
      const classExists = await prisma.class.findFirst({
        where: { id: armData.classId, schoolId, isActive: true }
      });

      if (!classExists) {
        validationErrors.push(`Arm at index ${i}: Class not found`);
        continue;
      }

      validArms.push({
        schoolId,
        classId: armData.classId,
        name: armData.name,
        classTeacherId: armData.classTeacherId || null
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: validationErrors
      });
    }

    // Check for duplicate arm names within same class
    const existingArms = await prisma.arm.findMany({
      where: {
        schoolId,
        OR: validArms.map(arm => ({
          classId: arm.classId,
          name: arm.name
        }))
      },
      select: { classId: true, name: true }
    });

    if (existingArms.length > 0) {
      const duplicates = existingArms.map(a => `Class ${a.classId}: ${a.name}`);
      return res.status(409).json({
        success: false,
        message: 'Arms with these names already exist in their respective classes',
        duplicates
      });
    }

    // Create arms
    const createdArms = await prisma.arm.createMany({
      data: validArms,
      skipDuplicates: false
    });

    // Fetch created arms with their IDs
    const newArms = await prisma.arm.findMany({
      where: {
        schoolId,
        classId: {
          in: validArms.map(a => a.classId)
        },
        name: {
          in: validArms.map(a => a.name)
        }
      },
      select: {
        id: true,
        schoolId: true,
        classId: true,
        name: true,
        classTeacherId: true,
        isActive: true,
        createdAt: true
      }
    });

    logger.info(`Created ${createdArms.count} arms for school ${schoolId}`);

    res.status(201).json({
      success: true,
      message: `${createdArms.count} arm(s) created successfully`,
      data: {
        arms: newArms,
        total: createdArms.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error creating arms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create arms',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get arms by class
 * GET /api/academic/classes/:classId/arms
 */
const getArmsByClass = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;

    // Verify class belongs to user's school
    const classExists = await prisma.class.findFirst({
      where: { id: classId, schoolId, isActive: true }
    });

    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    const arms = await prisma.arm.findMany({
      where: {
        classId,
        isActive: true
      },
      select: {
        id: true,
        schoolId: true,
        classId: true,
        name: true,
        classTeacherId: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });

    logger.info(`Retrieved ${arms.length} arms for class ${classId}`);

    res.json({
      success: true,
      data: {
        arms,
        total: arms.length
      }
    });
  } catch (error) {
    logger.error('Error fetching class arms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch class arms',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update arm
 * PUT /api/academic/arms/:armId
 */
const updateArm = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armId } = req.params;
    const { name, classTeacherId } = req.body;

    // Verify arm belongs to user's school
    const existingArm = await prisma.arm.findFirst({
      where: { id: armId, schoolId }
    });

    if (!existingArm) {
      return res.status(404).json({
        success: false,
        message: 'Arm not found'
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (classTeacherId !== undefined) updateData.classTeacherId = classTeacherId;

    const updatedArm = await prisma.arm.update({
      where: { id: armId },
      data: updateData
    });

    logger.info(`Updated arm ${armId} in school ${schoolId}`);

    res.json({
      success: true,
      message: 'Arm updated successfully',
      data: updatedArm
    });
  } catch (error) {
    logger.error('Error updating arm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update arm',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete arms
 * DELETE /api/academic/arms
 */
const deleteArms = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armIds } = req.body;

    if (!armIds) {
      return res.status(400).json({
        success: false,
        message: 'Arm IDs are required'
      });
    }

    // Convert to array if single string
    const idsToDelete = Array.isArray(armIds) ? armIds : [armIds];

    // Verify arms belong to user's school
    const existingArms = await prisma.arm.findMany({
      where: {
        id: { in: idsToDelete },
        schoolId
      }
    });

    if (existingArms.length !== idsToDelete.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more arms not found'
      });
    }

    // Check if arms have students
    const armsWithStudents = await prisma.arm.findMany({
      where: {
        id: { in: idsToDelete },
        students: {
          some: {
            isActive: true
          }
        }
      }
    });

    if (armsWithStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete arms with enrolled students',
        data: {
          armsWithStudents: armsWithStudents.map(a => ({ id: a.id, name: a.name }))
        }
      });
    }

    // Delete arms
    const deletedArms = await prisma.arm.deleteMany({
      where: {
        id: { in: idsToDelete },
        schoolId
      }
    });

    logger.info(`Deleted ${deletedArms.count} arms from school ${schoolId}`);

    res.json({
      success: true,
      message: `${deletedArms.count} arm(s) deleted successfully`,
      data: {
        deleted: deletedArms.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error deleting arms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete arms',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============== ARM-SUBJECT RELATIONSHIP MANAGEMENT ===============

/**
 * Get arm subjects
 * GET /api/academic/arms/:armId/subjects
 */
const getArmSubjects = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armId } = req.params;

    // Verify arm belongs to user's school
    const armExists = await prisma.arm.findFirst({
      where: { id: armId, schoolId, isActive: true }
    });

    if (!armExists) {
      return res.status(404).json({
        success: false,
        message: 'Arm not found'
      });
    }

    const subjects = await prisma.subject.findMany({
      where: {
        schoolId,
        armSubjects: {
          some: {
            armId
          }
        }
      },
      select: {
        id: true,
        name: true,
        code: true,
        category: true
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    logger.info(`Retrieved ${subjects.length} subjects for arm ${armId}`);

    res.json({
      success: true,
      data: {
        subjects,
        total: subjects.length
      }
    });
  } catch (error) {
    logger.error('Error fetching arm subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch arm subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Add subjects to arm
 * POST /api/academic/arms/:armId/subjects
 */
const addSubjectsToArm = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armId } = req.params;
    const { subjectIds } = req.body;

    if (!subjectIds) {
      return res.status(400).json({
        success: false,
        message: 'Subject IDs are required'
      });
    }

    // Convert to array if single string
    const idsToAdd = Array.isArray(subjectIds) ? subjectIds : [subjectIds];

    // Verify arm belongs to user's school
    const armExists = await prisma.arm.findFirst({
      where: { id: armId, schoolId, isActive: true }
    });

    if (!armExists) {
      return res.status(404).json({
        success: false,
        message: 'Arm not found'
      });
    }

    // Verify subjects belong to user's school
    const existingSubjects = await prisma.subject.findMany({
      where: {
        id: { in: idsToAdd },
        schoolId,
        isActive: true
      }
    });

    if (existingSubjects.length !== idsToAdd.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more subjects not found'
      });
    }

    // Create arm-subject relationships
    const armSubjects = idsToAdd.map(subjectId => ({
      armId,
      subjectId
    }));

    const createdRelations = await prisma.armSubject.createMany({
      data: armSubjects,
      skipDuplicates: true
    });

    // Fetch the added subjects
    const addedSubjects = await prisma.subject.findMany({
      where: {
        id: { in: idsToAdd }
      },
      select: {
        id: true,
        name: true,
        code: true,
        category: true
      }
    });

    logger.info(`Added ${createdRelations.count} subjects to arm ${armId}`);

    res.json({
      success: true,
      message: `${createdRelations.count} subject(s) added to arm`,
      data: {
        added: addedSubjects.map(s => ({
          subjectId: s.id,
          subjectName: s.name
        })),
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error adding subjects to arm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add subjects to arm',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============== CLASS-SUBJECT RELATIONSHIP MANAGEMENT ===============

/**
 * Add subjects to class (all arms)
 * POST /api/academic/classes/:classId/subjects
 */
const addSubjectsToClass = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const { subjectIds } = req.body;

    if (!subjectIds) {
      return res.status(400).json({
        success: false,
        message: 'Subject IDs are required'
      });
    }

    // Convert to array if single string
    const idsToAdd = Array.isArray(subjectIds) ? subjectIds : [subjectIds];

    // Verify class belongs to user's school
    const classExists = await prisma.class.findFirst({
      where: { id: classId, schoolId, isActive: true }
    });

    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Verify subjects belong to user's school
    const existingSubjects = await prisma.subject.findMany({
      where: {
        id: { in: idsToAdd },
        schoolId,
        isActive: true
      }
    });

    if (existingSubjects.length !== idsToAdd.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more subjects not found'
      });
    }

    // Get all arms for this class
    const classArms = await prisma.arm.findMany({
      where: {
        classId,
        isActive: true
      }
    });

    if (classArms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No arms found for this class'
      });
    }

    // Create class-subject relationships
    const classSubjects = idsToAdd.map(subjectId => ({
      classId,
      subjectId
    }));

    const createdClassRelations = await prisma.classSubject.createMany({
      data: classSubjects,
      skipDuplicates: true
    });

    // Create arm-subject relationships for all arms
    const armSubjectRelations = [];
    classArms.forEach(arm => {
      idsToAdd.forEach(subjectId => {
        armSubjectRelations.push({
          armId: arm.id,
          subjectId
        });
      });
    });

    const createdArmRelations = await prisma.armSubject.createMany({
      data: armSubjectRelations,
      skipDuplicates: true
    });

    // Fetch added subjects
    const addedSubjects = await prisma.subject.findMany({
      where: {
        id: { in: idsToAdd }
      },
      select: {
        id: true,
        name: true,
        code: true,
        category: true
      }
    });

    logger.info(`Added ${createdClassRelations.count} subjects to class ${classId} and ${createdArmRelations.count} arm-subject relationships`);

    res.json({
      success: true,
      message: `${createdClassRelations.count} subject(s) added to class`,
      data: {
        subjects: addedSubjects,
        total: createdClassRelations.count,
        armsAffected: classArms.length,
        armSubjectRelationsCreated: createdArmRelations.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error adding subjects to class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add subjects to class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============== SUBJECT REMOVAL ENDPOINTS ===============

/**
 * Remove subjects from class (all arms)
 * DELETE /api/academic/classes/:classId/subjects
 */
const removeSubjectsFromClass = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { classId } = req.params;
    const { subjectIds } = req.body;

    if (!subjectIds) {
      return res.status(400).json({
        success: false,
        message: 'Subject IDs are required'
      });
    }

    // Convert to array if single string
    const idsToRemove = Array.isArray(subjectIds) ? subjectIds : [subjectIds];

    // Verify class belongs to user's school
    const classExists = await prisma.class.findFirst({
      where: { id: classId, schoolId, isActive: true }
    });

    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Remove class-subject relationships
    const deletedClassRelations = await prisma.classSubject.deleteMany({
      where: {
        classId,
        subjectId: { in: idsToRemove }
      }
    });

    // Remove arm-subject relationships for all arms in this class
    const classArms = await prisma.arm.findMany({
      where: { classId, isActive: true }
    });

    const deletedArmRelations = await prisma.armSubject.deleteMany({
      where: {
        armId: { in: classArms.map(arm => arm.id) },
        subjectId: { in: idsToRemove }
      }
    });

    // Fetch removed subjects
    const removedSubjects = await prisma.subject.findMany({
      where: { id: { in: idsToRemove } },
      select: { id: true, name: true, code: true }
    });

    logger.info(`Removed ${deletedClassRelations.count} subjects from class ${classId} and ${deletedArmRelations.count} arm-subject relationships`);

    res.json({
      success: true,
      message: `${deletedClassRelations.count} subject(s) removed from class`,
      data: {
        subjects: removedSubjects,
        total: deletedClassRelations.count,
        armsAffected: classArms.length,
        armSubjectRelationsRemoved: deletedArmRelations.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error removing subjects from class:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove subjects from class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Remove subjects from arm
 * DELETE /api/academic/arms/:armId/subjects
 */
const removeSubjectsFromArm = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armId } = req.params;
    const { subjectIds } = req.body;

    if (!subjectIds) {
      return res.status(400).json({
        success: false,
        message: 'Subject IDs are required'
      });
    }

    // Convert to array if single string
    const idsToRemove = Array.isArray(subjectIds) ? subjectIds : [subjectIds];

    // Verify arm belongs to user's school
    const armExists = await prisma.arm.findFirst({
      where: { id: armId, schoolId, isActive: true }
    });

    if (!armExists) {
      return res.status(404).json({
        success: false,
        message: 'Arm not found'
      });
    }

    // Remove arm-subject relationships
    const deletedRelations = await prisma.armSubject.deleteMany({
      where: {
        armId,
        subjectId: { in: idsToRemove }
      }
    });

    // Also remove class-subject relationship if this was the last arm with this subject
    const classArms = await prisma.arm.findMany({
      where: { 
        classId: armExists.classId,
        isActive: true 
      }
    });

    for (const subjectId of idsToRemove) {
      const otherArmsWithSubject = await prisma.armSubject.findMany({
        where: {
          subjectId,
          armId: { not: armId }
        }
      });

      if (otherArmsWithSubject.length === 0) {
        // No other arms have this subject, remove class-level assignment
        await prisma.classSubject.deleteMany({
          where: {
            classId: armExists.classId,
            subjectId
          }
        });
      }
    }

    // Fetch removed subjects
    const removedSubjects = await prisma.subject.findMany({
      where: { id: { in: idsToRemove } },
      select: { id: true, name: true, code: true }
    });

    logger.info(`Removed ${deletedRelations.count} subjects from arm ${armId}`);

    res.json({
      success: true,
      message: `${deletedRelations.count} subject(s) removed from arm`,
      data: {
        subjects: removedSubjects,
        total: deletedRelations.count,
        errors: []
      }
    });
  } catch (error) {
    logger.error('Error removing subjects from arm:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove subjects from arm',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Replace subjects for an arm
 * PUT /api/academic/arms/:armId/subjects/replace
 */
const replaceArmSubjects = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { armId } = req.params;
    const { subjectIds } = req.body;

    if (!subjectIds || !Array.isArray(subjectIds)) {
      return res.status(400).json({
        success: false,
        message: 'Subject IDs array is required'
      });
    }

    // Verify arm belongs to user's school
    const arm = await prisma.arm.findFirst({
      where: { id: armId, schoolId },
      include: {
        class: {
          select: { id: true, schoolId: true }
        }
      }
    });

    if (!arm) {
      return res.status(404).json({
        success: false,
        message: 'Arm not found'
      });
    }

    // Verify all subjects belong to school
    const subjects = await prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
        schoolId,
        isActive: true
      }
    });

    if (subjects.length !== subjectIds.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more subjects not found'
      });
    }

    // Remove all existing subjects from arm
    await prisma.armSubject.deleteMany({
      where: { armId }
    });

    // Add new subjects to arm
    const newRelations = subjectIds.map(subjectId => ({
      armId,
      subjectId
    }));

    await prisma.armSubject.createMany({
      data: newRelations,
      skipDuplicates: true
    });

    // Update class-subject relationships
    for (const subjectId of subjectIds) {
      await prisma.classSubject.upsert({
        where: {
          classId_subjectId: {
            classId: arm.classId,
            subjectId
          }
        },
        update: {},
        create: {
          classId: arm.classId,
          subjectId
        }
      });
    }

    // Fetch updated subjects
    const updatedSubjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, code: true, category: true }
    });

    logger.info(`Replaced subjects for arm ${armId} in school ${schoolId}`);

    res.json({
      success: true,
      message: 'Arm subjects replaced successfully',
      data: {
        subjects: updatedSubjects,
        total: updatedSubjects.length
      }
    });
  } catch (error) {
    logger.error('Error replacing arm subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to replace arm subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Copy subjects from one arm to another
 * POST /api/academic/arms/:sourceArmId/subjects/copy/:targetArmId
 */
const copyArmSubjects = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { sourceArmId, targetArmId } = req.params;

    // Verify both arms belong to user's school
    const [sourceArm, targetArm] = await Promise.all([
      prisma.arm.findFirst({
        where: { id: sourceArmId, schoolId },
        include: {
          class: {
            select: { id: true, schoolId: true }
          }
        }
      }),
      prisma.arm.findFirst({
        where: { id: targetArmId, schoolId },
        include: {
          class: {
            select: { id: true, schoolId: true }
          }
        }
      })
    ]);

    if (!sourceArm) {
      return res.status(404).json({
        success: false,
        message: 'Source arm not found'
      });
    }

    if (!targetArm) {
      return res.status(404).json({
        success: false,
        message: 'Target arm not found'
      });
    }

    // Get subjects from source arm
    const sourceSubjects = await prisma.armSubject.findMany({
      where: { armId: sourceArmId },
      select: { subjectId: true }
    });

    if (sourceSubjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Source arm has no subjects to copy'
      });
    }

    const subjectIds = sourceSubjects.map(s => s.subjectId);

    // Add subjects to target arm (skip duplicates)
    const newRelations = subjectIds.map(subjectId => ({
      armId: targetArmId,
      subjectId
    }));

    await prisma.armSubject.createMany({
      data: newRelations,
      skipDuplicates: true
    });

    // Update class-subject relationships for target arm's class
    for (const subjectId of subjectIds) {
      await prisma.classSubject.upsert({
        where: {
          classId_subjectId: {
            classId: targetArm.classId,
            subjectId
          }
        },
        update: {},
        create: {
          classId: targetArm.classId,
          subjectId
        }
      });
    }

    // Fetch copied subjects
    const copiedSubjects = await prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, code: true, category: true }
    });

    logger.info(`Copied ${copiedSubjects.length} subjects from arm ${sourceArmId} to arm ${targetArmId} in school ${schoolId}`);

    res.json({
      success: true,
      message: 'Subjects copied successfully',
      data: {
        subjects: copiedSubjects,
        total: copiedSubjects.length,
        sourceArmId,
        targetArmId
      }
    });
  } catch (error) {
    logger.error('Error copying arm subjects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to copy arm subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  // Subject management
  createSubjects,
  listSubjects,
  getSubjectsByClass,
  updateSubject,
  deleteSubjects,
  
  // Arm management
  createArms,
  getArmsByClass,
  updateArm,
  deleteArms,
  
  // Arm-Subject relationships
  getArmSubjects,
  addSubjectsToArm,
  replaceArmSubjects,
  copyArmSubjects,
  
  // Class-Subject relationships
  addSubjectsToClass,
  removeSubjectsFromClass,
  removeSubjectsFromArm
};

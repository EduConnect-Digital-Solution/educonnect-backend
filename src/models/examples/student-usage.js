/**
 * Student Model Usage Examples
 * This file demonstrates how to use the Student model for relationship management
 */

const Student = require('../Student');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * Example 1: Create a new student with automatic studentId generation (Requirement 5.1)
 */
async function createStudent(schoolId, studentData, createdBy) {
  try {
    const student = new Student({
      schoolId,
      firstName: studentData.firstName,
      lastName: studentData.lastName,
      email: studentData.email,
      class: studentData.class,
      section: studentData.section,
      rollNumber: studentData.rollNumber,
      grade: studentData.grade,
      dateOfBirth: studentData.dateOfBirth,
      gender: studentData.gender,
      address: studentData.address,
      phone: studentData.phone,
      createdBy
    });

    await student.save();

    logger.info('Student created successfully:');
    logger.info(`Name: ${student.fullName}`);
    logger.info(`Student ID: ${student.studentId}`);
    logger.info(`Display Name: ${student.displayName}`);
    logger.info(`Class: ${student.classDisplay}`);
    logger.info(`Age: ${student.age}`);
    logger.info(`Status: ${student.statusDisplay}`);
    
    return student;
  } catch (error) {
    logger.error('Error creating student:', error.message);
    throw error;
  }
}

/**
 * Example 2: Link student to parent (Requirement 5.3)
 */
async function linkStudentToParent(studentId, parentId) {
  try {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    await student.addParent(parentId);

    logger.info('Parent linked to student successfully:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Total Parents: ${student.parents.length}`);
    
    return student;
  } catch (error) {
    logger.error('Error linking parent to student:', error.message);
    throw error;
  }
}

/**
 * Example 3: Link student to teacher (Requirement 5.4)
 */
async function linkStudentToTeacher(studentId, teacherId) {
  try {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    await student.addTeacher(teacherId);

    logger.info('Teacher linked to student successfully:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Total Teachers: ${student.teachers.length}`);
    
    return student;
  } catch (error) {
    logger.error('Error linking teacher to student:', error.message);
    throw error;
  }
}

/**
 * Example 4: Student deactivation workflow (Requirement 5.5)
 */
async function deactivateStudent(studentId, deactivatedBy, reason) {
  try {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    await student.deactivate(deactivatedBy, reason);

    logger.info('Student deactivated successfully:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Status: ${student.statusDisplay}`);
    logger.info(`Deactivated At: ${student.deactivatedAt}`);
    logger.info(`Reason: ${student.deactivationReason}`);
    
    return student;
  } catch (error) {
    logger.error('Error deactivating student:', error.message);
    throw error;
  }
}

/**
 * Example 5: Student reactivation workflow
 */
async function reactivateStudent(studentId) {
  try {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    await student.reactivate();

    logger.info('Student reactivated successfully:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Status: ${student.statusDisplay}`);
    logger.info(`Active: ${student.isActive}`);
    
    return student;
  } catch (error) {
    logger.error('Error reactivating student:', error.message);
    throw error;
  }
}

/**
 * Example 6: Update student class information
 */
async function updateStudentClass(studentId, classInfo) {
  try {
    const student = await Student.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    await student.updateClassInfo(classInfo);

    logger.info('Student class information updated:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Class: ${student.classDisplay}`);
    logger.info(`Roll Number: ${student.rollNumber}`);
    logger.info(`Grade: ${student.grade}`);
    
    return student;
  } catch (error) {
    logger.error('Error updating student class:', error.message);
    throw error;
  }
}

/**
 * Example 7: Query students by different criteria
 */
async function queryStudents(schoolId) {
  try {
    // Find all active students in the school
    const allStudents = await Student.findBySchool(schoolId);
    logger.info(`Found ${allStudents.length} active students`);

    // Find students by class
    const grade10Students = await Student.findByClass(schoolId, 'Grade 10');
    logger.info(`Found ${grade10Students.length} students in Grade 10`);

    // Find students by class and section
    const grade10AStudents = await Student.findByClass(schoolId, 'Grade 10', 'A');
    logger.info(`Found ${grade10AStudents.length} students in Grade 10-A`);

    // Find students by parent
    const parentId = new mongoose.Types.ObjectId();
    const parentStudents = await Student.findByParent(parentId);
    logger.info(`Found ${parentStudents.length} students for parent`);

    // Find students by teacher
    const teacherId = new mongoose.Types.ObjectId();
    const teacherStudents = await Student.findByTeacher(teacherId);
    logger.info(`Found ${teacherStudents.length} students for teacher`);

    // Find student by studentId
    const specificStudent = await Student.findByStudentId(schoolId, '241234');
    logger.info(`Found student: ${specificStudent ? specificStudent.fullName : 'Not found'}`);

    return {
      allStudents,
      grade10Students,
      grade10AStudents,
      parentStudents,
      teacherStudents,
      specificStudent
    };
  } catch (error) {
    logger.error('Error querying students:', error.message);
    throw error;
  }
}

/**
 * Example 8: Get school statistics
 */
async function getSchoolStatistics(schoolId) {
  try {
    const stats = await Student.getSchoolStatistics(schoolId);

    logger.info('School Student Statistics:');
    logger.info(`Total Students: ${stats.totalStudents}`);
    logger.info(`Active Students: ${stats.activeStudents}`);
    logger.info(`Enrolled Students: ${stats.enrolledStudents}`);
    logger.info(`Deactivated Students: ${stats.deactivatedStudents}`);

    return stats;
  } catch (error) {
    logger.error('Error getting school statistics:', error.message);
    throw error;
  }
}

/**
 * Example 9: Manage parent-student relationships
 */
async function manageParentStudentRelationships(studentId) {
  try {
    const student = await Student.findById(studentId).populate('parents', 'firstName lastName email');
    if (!student) {
      throw new Error('Student not found');
    }

    logger.info('Current Parent-Student Relationships:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Parents: ${student.parents.length}`);
    
    if (student.parents.length > 0) {
      student.parents.forEach((parent, index) => {
        logger.info(`  ${index + 1}. ${parent.firstName} ${parent.lastName} (${parent.email})`);
      });
    }

    // Add a new parent
    const newParentId = new mongoose.Types.ObjectId();
    await student.addParent(newParentId);
    logger.info('New parent added');

    // Remove a parent (if exists)
    if (student.parents.length > 1) {
      await student.removeParent(student.parents[0]);
      logger.info('Parent removed');
    }

    return student;
  } catch (error) {
    logger.error('Error managing parent-student relationships:', error.message);
    throw error;
  }
}

/**
 * Example 10: Manage teacher-student relationships
 */
async function manageTeacherStudentRelationships(studentId) {
  try {
    const student = await Student.findById(studentId).populate('teachers', 'firstName lastName email subjects');
    if (!student) {
      throw new Error('Student not found');
    }

    logger.info('Current Teacher-Student Relationships:');
    logger.info(`Student: ${student.fullName}`);
    logger.info(`Teachers: ${student.teachers.length}`);
    
    if (student.teachers.length > 0) {
      student.teachers.forEach((teacher, index) => {
        logger.info(`  ${index + 1}. ${teacher.firstName} ${teacher.lastName} - ${teacher.subjects?.join(', ')}`);
      });
    }

    // Add a new teacher
    const newTeacherId = new mongoose.Types.ObjectId();
    await student.addTeacher(newTeacherId);
    logger.info('New teacher added');

    // Remove a teacher (if exists)
    if (student.teachers.length > 1) {
      await student.removeTeacher(student.teachers[0]);
      logger.info('Teacher removed');
    }

    return student;
  } catch (error) {
    logger.error('Error managing teacher-student relationships:', error.message);
    throw error;
  }
}

/**
 * Example 11: Student lifecycle management
 */
async function demonstrateStudentLifecycle(schoolId, adminUserId) {
  try {
    logger.info('=== Student Lifecycle Management ===');

    // 1. Create student
    const studentData = {
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@student.com',
      class: 'Grade 9',
      section: 'B',
      rollNumber: '015',
      grade: '9th',
      dateOfBirth: new Date('2009-03-20'),
      gender: 'female',
      address: '456 Student Avenue, Learning City',
      phone: '+1234567891'
    };

    const student = await createStudent(schoolId, studentData, adminUserId);
    logger.info('');

    // 2. Update class information
    await updateStudentClass(student._id, {
      class: 'Grade 10',
      section: 'A',
      rollNumber: '010',
      grade: '10th'
    });
    logger.info('');

    // 3. Link to parent and teacher
    const parentId = new mongoose.Types.ObjectId();
    const teacherId = new mongoose.Types.ObjectId();
    
    await linkStudentToParent(student._id, parentId);
    await linkStudentToTeacher(student._id, teacherId);
    logger.info('');

    // 4. Deactivate student
    await deactivateStudent(student._id, adminUserId, 'Transferred to another school');
    logger.info('');

    // 5. Reactivate student
    await reactivateStudent(student._id);
    logger.info('');

    return student;
  } catch (error) {
    logger.error('Error in student lifecycle demo:', error.message);
    throw error;
  }
}

/**
 * Example 12: Bulk student operations
 */
async function bulkStudentOperations(schoolId) {
  try {
    logger.info('=== Bulk Student Operations ===');

    // Create multiple students
    const studentsData = [
      {
        firstName: 'Bob',
        lastName: 'Smith',
        class: 'Grade 8',
        section: 'A',
        dateOfBirth: new Date('2010-01-15')
      },
      {
        firstName: 'Carol',
        lastName: 'Brown',
        class: 'Grade 8',
        section: 'B',
        dateOfBirth: new Date('2010-02-20')
      },
      {
        firstName: 'David',
        lastName: 'Wilson',
        class: 'Grade 9',
        section: 'A',
        dateOfBirth: new Date('2009-03-25')
      }
    ];

    const createdStudents = [];
    for (const data of studentsData) {
      const student = await createStudent(schoolId, data, null);
      createdStudents.push(student);
    }

    logger.info(`Created ${createdStudents.length} students`);

    // Query students by class
    const grade8Students = await Student.findByClass(schoolId, 'Grade 8');
    logger.info(`Grade 8 students: ${grade8Students.length}`);

    const grade9Students = await Student.findByClass(schoolId, 'Grade 9');
    logger.info(`Grade 9 students: ${grade9Students.length}`);

    // Get statistics
    await getSchoolStatistics(schoolId);

    return createdStudents;
  } catch (error) {
    logger.error('Error in bulk operations:', error.message);
    throw error;
  }
}

/**
 * Example usage function
 */
async function runExamples() {
  try {
    logger.info('=== Student Model Usage Examples ===\n');

    const schoolId = 'ABC1234';
    const adminUserId = new mongoose.Types.ObjectId();

    // Example 1: Student lifecycle
    logger.info('1. Student lifecycle management...');
    await demonstrateStudentLifecycle(schoolId, adminUserId);
    logger.info('');

    // Example 2: Query operations
    logger.info('2. Student query operations...');
    await queryStudents(schoolId);
    logger.info('');

    // Example 3: Bulk operations
    logger.info('3. Bulk student operations...');
    await bulkStudentOperations(schoolId);
    logger.info('');

    // Example 4: Statistics
    logger.info('4. School statistics...');
    await getSchoolStatistics(schoolId);
    logger.info('');

    logger.info('=== All examples completed ===');
  } catch (error) {
    logger.error('Error running examples:', error);
  }
}

// Export functions for use in other modules
module.exports = {
  createStudent,
  linkStudentToParent,
  linkStudentToTeacher,
  deactivateStudent,
  reactivateStudent,
  updateStudentClass,
  queryStudents,
  getSchoolStatistics,
  manageParentStudentRelationships,
  manageTeacherStudentRelationships,
  demonstrateStudentLifecycle,
  bulkStudentOperations,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}
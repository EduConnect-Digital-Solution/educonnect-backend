/**
 * Student Model Usage Examples
 * This file demonstrates how to use the Student model for relationship management
 */

const Student = require('../Student');
const mongoose = require('mongoose');

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

    console.log('Student created successfully:');
    console.log(`Name: ${student.fullName}`);
    console.log(`Student ID: ${student.studentId}`);
    console.log(`Display Name: ${student.displayName}`);
    console.log(`Class: ${student.classDisplay}`);
    console.log(`Age: ${student.age}`);
    console.log(`Status: ${student.statusDisplay}`);
    
    return student;
  } catch (error) {
    console.error('Error creating student:', error.message);
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

    console.log('Parent linked to student successfully:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Total Parents: ${student.parents.length}`);
    
    return student;
  } catch (error) {
    console.error('Error linking parent to student:', error.message);
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

    console.log('Teacher linked to student successfully:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Total Teachers: ${student.teachers.length}`);
    
    return student;
  } catch (error) {
    console.error('Error linking teacher to student:', error.message);
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

    console.log('Student deactivated successfully:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Status: ${student.statusDisplay}`);
    console.log(`Deactivated At: ${student.deactivatedAt}`);
    console.log(`Reason: ${student.deactivationReason}`);
    
    return student;
  } catch (error) {
    console.error('Error deactivating student:', error.message);
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

    console.log('Student reactivated successfully:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Status: ${student.statusDisplay}`);
    console.log(`Active: ${student.isActive}`);
    
    return student;
  } catch (error) {
    console.error('Error reactivating student:', error.message);
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

    console.log('Student class information updated:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Class: ${student.classDisplay}`);
    console.log(`Roll Number: ${student.rollNumber}`);
    console.log(`Grade: ${student.grade}`);
    
    return student;
  } catch (error) {
    console.error('Error updating student class:', error.message);
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
    console.log(`Found ${allStudents.length} active students`);

    // Find students by class
    const grade10Students = await Student.findByClass(schoolId, 'Grade 10');
    console.log(`Found ${grade10Students.length} students in Grade 10`);

    // Find students by class and section
    const grade10AStudents = await Student.findByClass(schoolId, 'Grade 10', 'A');
    console.log(`Found ${grade10AStudents.length} students in Grade 10-A`);

    // Find students by parent
    const parentId = new mongoose.Types.ObjectId();
    const parentStudents = await Student.findByParent(parentId);
    console.log(`Found ${parentStudents.length} students for parent`);

    // Find students by teacher
    const teacherId = new mongoose.Types.ObjectId();
    const teacherStudents = await Student.findByTeacher(teacherId);
    console.log(`Found ${teacherStudents.length} students for teacher`);

    // Find student by studentId
    const specificStudent = await Student.findByStudentId(schoolId, '241234');
    console.log(`Found student: ${specificStudent ? specificStudent.fullName : 'Not found'}`);

    return {
      allStudents,
      grade10Students,
      grade10AStudents,
      parentStudents,
      teacherStudents,
      specificStudent
    };
  } catch (error) {
    console.error('Error querying students:', error.message);
    throw error;
  }
}

/**
 * Example 8: Get school statistics
 */
async function getSchoolStatistics(schoolId) {
  try {
    const stats = await Student.getSchoolStatistics(schoolId);

    console.log('School Student Statistics:');
    console.log(`Total Students: ${stats.totalStudents}`);
    console.log(`Active Students: ${stats.activeStudents}`);
    console.log(`Enrolled Students: ${stats.enrolledStudents}`);
    console.log(`Deactivated Students: ${stats.deactivatedStudents}`);

    return stats;
  } catch (error) {
    console.error('Error getting school statistics:', error.message);
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

    console.log('Current Parent-Student Relationships:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Parents: ${student.parents.length}`);
    
    if (student.parents.length > 0) {
      student.parents.forEach((parent, index) => {
        console.log(`  ${index + 1}. ${parent.firstName} ${parent.lastName} (${parent.email})`);
      });
    }

    // Add a new parent
    const newParentId = new mongoose.Types.ObjectId();
    await student.addParent(newParentId);
    console.log('New parent added');

    // Remove a parent (if exists)
    if (student.parents.length > 1) {
      await student.removeParent(student.parents[0]);
      console.log('Parent removed');
    }

    return student;
  } catch (error) {
    console.error('Error managing parent-student relationships:', error.message);
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

    console.log('Current Teacher-Student Relationships:');
    console.log(`Student: ${student.fullName}`);
    console.log(`Teachers: ${student.teachers.length}`);
    
    if (student.teachers.length > 0) {
      student.teachers.forEach((teacher, index) => {
        console.log(`  ${index + 1}. ${teacher.firstName} ${teacher.lastName} - ${teacher.subjects?.join(', ')}`);
      });
    }

    // Add a new teacher
    const newTeacherId = new mongoose.Types.ObjectId();
    await student.addTeacher(newTeacherId);
    console.log('New teacher added');

    // Remove a teacher (if exists)
    if (student.teachers.length > 1) {
      await student.removeTeacher(student.teachers[0]);
      console.log('Teacher removed');
    }

    return student;
  } catch (error) {
    console.error('Error managing teacher-student relationships:', error.message);
    throw error;
  }
}

/**
 * Example 11: Student lifecycle management
 */
async function demonstrateStudentLifecycle(schoolId, adminUserId) {
  try {
    console.log('=== Student Lifecycle Management ===');

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
    console.log('');

    // 2. Update class information
    await updateStudentClass(student._id, {
      class: 'Grade 10',
      section: 'A',
      rollNumber: '010',
      grade: '10th'
    });
    console.log('');

    // 3. Link to parent and teacher
    const parentId = new mongoose.Types.ObjectId();
    const teacherId = new mongoose.Types.ObjectId();
    
    await linkStudentToParent(student._id, parentId);
    await linkStudentToTeacher(student._id, teacherId);
    console.log('');

    // 4. Deactivate student
    await deactivateStudent(student._id, adminUserId, 'Transferred to another school');
    console.log('');

    // 5. Reactivate student
    await reactivateStudent(student._id);
    console.log('');

    return student;
  } catch (error) {
    console.error('Error in student lifecycle demo:', error.message);
    throw error;
  }
}

/**
 * Example 12: Bulk student operations
 */
async function bulkStudentOperations(schoolId) {
  try {
    console.log('=== Bulk Student Operations ===');

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

    console.log(`Created ${createdStudents.length} students`);

    // Query students by class
    const grade8Students = await Student.findByClass(schoolId, 'Grade 8');
    console.log(`Grade 8 students: ${grade8Students.length}`);

    const grade9Students = await Student.findByClass(schoolId, 'Grade 9');
    console.log(`Grade 9 students: ${grade9Students.length}`);

    // Get statistics
    await getSchoolStatistics(schoolId);

    return createdStudents;
  } catch (error) {
    console.error('Error in bulk operations:', error.message);
    throw error;
  }
}

/**
 * Example usage function
 */
async function runExamples() {
  try {
    console.log('=== Student Model Usage Examples ===\n');

    const schoolId = 'ABC1234';
    const adminUserId = new mongoose.Types.ObjectId();

    // Example 1: Student lifecycle
    console.log('1. Student lifecycle management...');
    await demonstrateStudentLifecycle(schoolId, adminUserId);
    console.log('');

    // Example 2: Query operations
    console.log('2. Student query operations...');
    await queryStudents(schoolId);
    console.log('');

    // Example 3: Bulk operations
    console.log('3. Bulk student operations...');
    await bulkStudentOperations(schoolId);
    console.log('');

    // Example 4: Statistics
    console.log('4. School statistics...');
    await getSchoolStatistics(schoolId);
    console.log('');

    console.log('=== All examples completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
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
/**
 * Teacher Assignment Service
 * Business logic for teacher-student linking operations
 */

const Student = require('../models/Student');
const User = require('../models/User');
const School = require('../models/School');

/**
 * Assign Teacher to Students
 * Links a teacher to one or more students
 */
const assignTeacherToStudents = async (teacherId, studentIds, schoolId, adminUserId) => {
  // Validate school exists
  const school = await School.findOne({ schoolId, isActive: true, isVerified: true });
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Validate teacher exists and belongs to school
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId,
    role: 'teacher',
    isActive: true
  });

  if (!teacher) {
    throw new Error('Teacher not found or inactive in this school');
  }

  // Validate all students exist and belong to school
  const students = await Student.find({
    _id: { $in: studentIds },
    schoolId,
    isActive: true
  });

  if (students.length !== studentIds.length) {
    throw new Error('One or more students not found or inactive in this school');
  }

  // Track assignment results
  const results = {
    teacherId,
    teacherName: `${teacher.firstName} ${teacher.lastName}`,
    assignments: [],
    alreadyAssigned: [],
    errors: []
  };

  // Process each student
  for (const student of students) {
    try {
      // Check if teacher is already assigned
      if (student.teacherIds && student.teacherIds.includes(teacherId)) {
        results.alreadyAssigned.push({
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          message: 'Teacher already assigned to this student'
        });
        continue;
      }

      // Add teacher to student's teacherIds array
      await Student.findByIdAndUpdate(
        student._id,
        { 
          $addToSet: { teacherIds: teacherId },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      results.assignments.push({
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        message: 'Teacher assigned successfully'
      });

    } catch (error) {
      results.errors.push({
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Bulk Teacher Assignment
 * Assigns multiple teachers to multiple students
 */
const assignTeachersBulk = async (assignments, schoolId, adminUserId) => {
  // Validate school exists
  const school = await School.findOne({ schoolId, isActive: true, isVerified: true });
  if (!school) {
    throw new Error('School not found or inactive');
  }

  const results = {
    totalAssignments: assignments.length,
    successful: [],
    failed: []
  };

  // Process each assignment
  for (const assignment of assignments) {
    try {
      const { teacherId, studentIds } = assignment;
      
      const result = await assignTeacherToStudents(
        teacherId,
        studentIds,
        schoolId,
        adminUserId
      );

      results.successful.push({
        teacherId,
        result
      });

    } catch (error) {
      results.failed.push({
        teacherId: assignment.teacherId,
        studentIds: assignment.studentIds,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Unassign Teacher from Students
 * Removes a teacher from one or more students
 */
const unassignTeacherFromStudents = async (teacherId, studentIds, schoolId, adminUserId) => {
  // Validate school exists
  const school = await School.findOne({ schoolId, isActive: true, isVerified: true });
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Validate teacher exists and belongs to school
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId,
    role: 'teacher',
    isActive: true
  });

  if (!teacher) {
    throw new Error('Teacher not found or inactive in this school');
  }

  // Validate all students exist and belong to school
  const students = await Student.find({
    _id: { $in: studentIds },
    schoolId,
    isActive: true
  });

  if (students.length !== studentIds.length) {
    throw new Error('One or more students not found or inactive in this school');
  }

  // Track unassignment results
  const results = {
    teacherId,
    teacherName: `${teacher.firstName} ${teacher.lastName}`,
    unassignments: [],
    notAssigned: [],
    errors: []
  };

  // Process each student
  for (const student of students) {
    try {
      // Check if teacher is assigned
      if (!student.teacherIds || !student.teacherIds.includes(teacherId)) {
        results.notAssigned.push({
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          message: 'Teacher was not assigned to this student'
        });
        continue;
      }

      // Remove teacher from student's teacherIds array
      await Student.findByIdAndUpdate(
        student._id,
        { 
          $pull: { teacherIds: teacherId },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );

      results.unassignments.push({
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        message: 'Teacher unassigned successfully'
      });

    } catch (error) {
      results.errors.push({
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        error: error.message
      });
    }
  }

  return results;
};

/**
 * Get Teacher's Students
 * Retrieves all students assigned to a specific teacher
 */
const getTeacherStudents = async (teacherId, schoolId, pagination = {}) => {
  const { page = 1, limit = 20 } = pagination;

  // Validate teacher exists and belongs to school
  const teacher = await User.findOne({
    _id: teacherId,
    schoolId,
    role: 'teacher',
    isActive: true
  });

  if (!teacher) {
    throw new Error('Teacher not found or inactive in this school');
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Find students assigned to this teacher
  const students = await Student.find({
    schoolId,
    teacherIds: teacherId,
    isActive: true
  })
    .populate('parentIds', 'firstName lastName email phone')
    .sort({ firstName: 1, lastName: 1 })
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const total = await Student.countDocuments({
    schoolId,
    teacherIds: teacherId,
    isActive: true
  });

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
    rollNumber: student.rollNumber,
    grade: student.grade,
    parents: student.parentIds ? student.parentIds.map(parent => ({
      id: parent._id,
      name: `${parent.firstName} ${parent.lastName}`,
      email: parent.email,
      phone: parent.phone
    })) : []
  }));

  return {
    teacher: {
      id: teacher._id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      subjects: teacher.subjects || []
    },
    students: formattedStudents,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  };
};

/**
 * Get Student's Teachers
 * Retrieves all teachers assigned to a specific student
 */
const getStudentTeachers = async (studentId, schoolId) => {
  // Find student and populate teachers
  const student = await Student.findOne({
    _id: studentId,
    schoolId,
    isActive: true
  }).populate('teacherIds', 'firstName lastName email subjects');

  if (!student) {
    throw new Error('Student not found or inactive in this school');
  }

  // Format response
  const teachers = student.teacherIds ? student.teacherIds.map(teacher => ({
    id: teacher._id,
    name: `${teacher.firstName} ${teacher.lastName}`,
    email: teacher.email,
    subjects: teacher.subjects || []
  })) : [];

  return {
    student: {
      id: student._id,
      studentId: student.studentId,
      name: `${student.firstName} ${student.lastName}`,
      class: student.class,
      section: student.section
    },
    teachers,
    totalTeachers: teachers.length
  };
};

module.exports = {
  assignTeacherToStudents,
  assignTeachersBulk,
  unassignTeacherFromStudents,
  getTeacherStudents,
  getStudentTeachers
};
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { authenticateToken } = require('./auth');
const { requireRole } = require('./rbac');
const { ROLES } = require('./rbac');

const resolveStudentProfile = async (req, res, next) => {
  try {
    const { userId, schoolId } = req.user;

    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        classRef: { select: { id: true, name: true } },
        arm: { select: { id: true, name: true } },
        school: { select: { id: true, schoolName: true, schoolId: true } }
      }
    });

    if (!student) {
      return res.status(403).json({
        success: false,
        message: 'Student profile not found for this user'
      });
    }

    req.student = {
      id: student.id,
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      email: student.email,
      phone: student.phone,
      profileImage: student.profileImage,
      classId: student.classId,
      className: student.classRef?.name || student.currentClass,
      armId: student.armId,
      armName: student.arm?.name,
      schoolId: student.schoolId,
      schoolName: student.school?.schoolName,
      currentClass: student.currentClass,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      address: student.address,
      guardian: student.guardian,
      isActive: student.isActive,
      isEnrolled: student.isEnrolled,
      admissionDate: student.admissionDate
    };

    next();
  } catch (error) {
    logger.error('Error resolving student profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Error resolving student profile'
    });
  }
};

const authenticateStudent = [
  authenticateToken,
  requireRole([ROLES.STUDENT]),
  resolveStudentProfile
];

const requireStudent = (req, res, next) => {
  if (!req.student) {
    return res.status(403).json({
      success: false,
      message: 'Student profile required'
    });
  }
  next();
};

module.exports = {
  resolveStudentProfile,
  authenticateStudent,
  requireStudent
};

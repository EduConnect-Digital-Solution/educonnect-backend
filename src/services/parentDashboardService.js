/**
 * Parent Dashboard Service
 * Handles parent dashboard and profile business logic
 * Centralizes parent-specific operations
 */

const { prisma } = require('../config/database');

class ParentDashboardService {
  /**
   * Get parent dashboard data
   * @param {string} userId - Parent user ID
   * @param {string} schoolId - School identifier
   * @returns {Object} Parent dashboard data
   */
  static async getParentDashboard(userId, schoolId) {
    // Get parent information
    const parent = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Get school information
    // Find school by either UUID (id) or human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });

    // If not found by UUID, try human-readable schoolId
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }
    if (!school) {
      throw new Error('School not found');
    }

    // Get children (students linked to this parent)
    const children = await prisma.student.findMany({
      where: {
        schoolId: school.id,
        parentOf: {
          some: { parentId: userId }
        },
        isActive: true
      },
      include: {
        arm: {
          select: { name: true }
        },
        classRef: {
          select: { name: true }
        },
        studentOf: {
          include: {
            teacher: true
          }
        }
      }
    });

    // Calculate statistics
    const stats = {
      totalChildren: children.length,
      enrolledChildren: children.filter(child => child.isEnrolled).length,
      activeChildren: children.filter(child => child.isActive).length,
      classesRepresented: [...new Set(children.map(child => child.class).filter(Boolean))].length
    };

    // Group children by class for better organization
    const childrenByClass = {};
    children.forEach(child => {
      const classKey = child.class || 'Unassigned';
      if (!childrenByClass[classKey]) {
        childrenByClass[classKey] = [];
      }
      childrenByClass[classKey].push({
        id: child.id,
        studentId: child.studentId,
        name: `${child.firstName} ${child.lastName}`,
        grade: child.grade,
        age: child.age,
        gender: child.gender,
        isEnrolled: child.isEnrolled,
        teachers: child.studentOf.map(ts => ts.teacher).filter(Boolean).map(teacher => ({
          id: teacher.id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          subjects: teacher.subjects || []
        }))
      });
    });

    // Recent activity (placeholder for future implementation)
    const recentActivity = [
      {
        type: 'login',
        message: 'Logged into parent dashboard',
        timestamp: new Date()
      }
    ];

    // Quick actions for parents
    const quickActions = [
      {
        title: 'View Children',
        description: 'See all your children\'s information',
        action: 'view_children',
        count: children.length
      },
      {
        title: 'Academic Progress',
        description: 'Check grades and performance',
        action: 'view_progress',
        count: children.filter(child => child.isEnrolled).length
      },
      {
        title: 'Contact Teachers',
        description: 'Communicate with teachers',
        action: 'contact_teachers',
        count: [...new Set(children.flatMap(child => child.studentOf.map(ts => ts.teacherId).filter(Boolean)))].length
      },
      {
        title: 'Update Profile',
        description: 'Manage your contact information',
        action: 'update_profile',
        count: null
      }
    ];

    // Upcoming events/notifications (placeholder)
    const notifications = [
      {
        type: 'info',
        title: 'Welcome to Parent Dashboard',
        message: 'Stay connected with your children\'s education',
        timestamp: new Date(),
        isRead: false
      }
    ];

    return {
      parent: {
        id: parent.id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        fullName: `${parent.firstName} ${parent.lastName}`,
        email: parent.email,
        phone: parent.phone,
        address: parent.address,
        occupation: parent.occupation,
        emergencyContact: parent.emergencyContact,
        emergencyPhone: parent.emergencyPhone,
        profileImage: parent.profileImage,
        lastLoginAt: parent.lastLoginAt
      },
      school: {
        id: school.id,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email
      },
      statistics: stats,
      children: children.map(child => ({
        id: child.id,
        studentId: child.studentId,
        firstName: child.firstName,
        lastName: child.lastName,
        fullName: `${child.firstName} ${child.lastName}`,
        classId: child.classId,
        classDisplay: child.classRef?.name && child.arm?.name ? `${child.classRef.name} - ${child.arm.name}` : child.classId ? `Class ID: ${child.classId}` : 'Not Assigned',
        grade: child.grade,
        age: child.age,
        gender: child.gender,
        dateOfBirth: child.dateOfBirth,
        isEnrolled: child.isEnrolled,
        teachers: child.studentOf.map(ts => ts.teacher).filter(Boolean).map(teacher => ({
          id: teacher.id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          subjects: teacher.subjects || []
        }))
      })),
      childrenByClass: childrenByClass,
      recentActivity: recentActivity,
      quickActions: quickActions,
      notifications: notifications,
      navigation: {
        dashboard: '/parent/dashboard',
        children: '/parent/children',
        progress: '/parent/progress',
        communication: '/parent/messages',
        profile: '/parent/profile'
      }
    };
  }

  /**
   * Get parent's children details
   * @param {string} userId - Parent user ID
   * @param {string} schoolId - School identifier
   * @param {string} childId - Optional specific child ID
   * @returns {Object} Children details data
   */
  static async getMyChildren(userId, schoolId, childId = null) {
    // Get parent information
    const parent = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Get school
    // Find school by either UUID (id) or human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });

    // If not found by UUID, try human-readable schoolId
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }
    if (!school) {
      throw new Error('School not found');
    }

    // Build query
    const whereClause = {
      schoolId: school.id,
      parentOf: {
        some: { parentId: userId }
      },
      isActive: true
    };

    // If specific child requested
    if (childId) {
      whereClause.id = childId;
    }

    // Get children with detailed information
    const children = await prisma.student.findMany({
      where: whereClause,
      include: {
        classRef: {
          select: {
            id: true,
            name: true,
            baseLevel: true,
            level: true
          }
        },
        arm: {
          select: {
            id: true,
            name: true
          }
        },
        studentOf: {
          include: {
            teacher: true
          }
        },
        parentOf: {
          include: {
            parent: true
          }
        }
      },
      orderBy: [
        { classRef: { baseLevel: 'asc' } },
        { arm: { name: 'asc' } },
        { firstName: 'asc' }
      ]
    });

    if (childId && children.length === 0) {
      throw new Error('Child not found or not linked to your account');
    }

    // Format response
    const formattedChildren = children.map(child => {
      const otherParents = child.parentOf
        .filter(p => p.parentId !== userId)
        .map(p => p.parent)
        .filter(Boolean)
        .map(p => ({
          id: p.id,
          name: `${p.firstName} ${p.lastName}`,
          email: p.email,
          phone: p.phone
        }));

      return {
        id: child.id,
        studentId: child.studentId,
        firstName: child.firstName,
        lastName: child.lastName,
        fullName: `${child.firstName} ${child.lastName}`,
        email: child.email,
        classId: child.classId,
        armId: child.armId,
        class: child.classRef,
        arm: child.arm,
        classDisplay: child.classRef && child.arm 
          ? `${child.classRef.name} - ${child.arm.name}` 
          : child.classRef 
          ? child.classRef.name 
          : 'Not Assigned',
        rollNumber: child.rollNumber,
        grade: child.grade,
        dateOfBirth: child.dateOfBirth,
        age: child.age,
        gender: child.gender,
        address: child.address,
        phone: child.phone,
        isActive: child.isActive,
        isEnrolled: child.isEnrolled,
        teachers: child.studentOf.map(ts => ts.teacher).filter(Boolean).map(teacher => ({
          id: teacher.id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          phone: teacher.phone,
          subjects: teacher.subjects || []
        })),
        otherParents,
        createdAt: child.createdAt
      };
    });

    return {
      children: formattedChildren,
      totalChildren: formattedChildren.length
    };
  }

  /**
   * Get parent profile
   * @param {string} userId - Parent user ID
   * @param {string} schoolId - School identifier
   * @returns {Object} Parent profile data
   */
  static async getParentProfile(userId, schoolId) {
    // Get parent information
    const parent = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Get school information
    // Find school by either UUID (id) or human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });

    // If not found by UUID, try human-readable schoolId
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }

    // Get children count
    const childrenCount = await prisma.student.count({
      where: {
        schoolId: school.id,
        parentOf: {
          some: { parentId: userId }
        },
        isActive: true
      }
    });

    return {
      parent: {
        id: parent.id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        fullName: `${parent.firstName} ${parent.lastName}`,
        email: parent.email,
        phone: parent.phone,
        address: parent.address,
        occupation: parent.occupation,
        emergencyContact: parent.emergencyContact,
        emergencyPhone: parent.emergencyPhone,
        profileImage: parent.profileImage,
        isActive: parent.isActive,
        isVerified: parent.isVerified,
        createdAt: parent.createdAt,
        lastLoginAt: parent.lastLoginAt,
        childrenCount: childrenCount
      },
      school: {
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email
      }
    };
  }

  /**
   * Update parent profile
   * @param {string} userId - Parent user ID
   * @param {Object} updateData - Profile update data
   * @returns {Object} Updated parent profile
   */
  static async updateParentProfile(userId, updateData) {
    const {
      firstName,
      lastName,
      phone,
      address,
      occupation,
      emergencyContact,
      emergencyPhone
    } = updateData;

    // Get parent information
    const parent = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Build update data
    const updateData_prisma = {};
    if (firstName !== undefined) updateData_prisma.firstName = firstName;
    if (lastName !== undefined) updateData_prisma.lastName = lastName;
    if (phone !== undefined) updateData_prisma.phone = phone;
    if (address !== undefined) updateData_prisma.address = address;
    if (occupation !== undefined) updateData_prisma.occupation = occupation;
    if (emergencyContact !== undefined) updateData_prisma.emergencyContact = emergencyContact;
    if (emergencyPhone !== undefined) updateData_prisma.emergencyPhone = emergencyPhone;
    if (updateData.profileImage !== undefined) updateData_prisma.profileImage = updateData.profileImage;

    // Update parent record
    const updatedParent = await prisma.user.update({
      where: { id: userId },
      data: updateData_prisma
    });

    return {
      parent: {
        id: updatedParent.id,
        firstName: updatedParent.firstName,
        lastName: updatedParent.lastName,
        fullName: `${updatedParent.firstName} ${updatedParent.lastName}`,
        email: updatedParent.email,
        phone: updatedParent.phone,
        address: updatedParent.address,
        occupation: updatedParent.occupation,
        emergencyContact: updatedParent.emergencyContact,
        emergencyPhone: updatedParent.emergencyPhone,
        profileImage: updatedParent.profileImage,
        updatedAt: updatedParent.updatedAt
      }
    };
  }
}

module.exports = ParentDashboardService;

/**
 * Parent Dashboard Service
 * Handles parent dashboard and profile business logic
 * Centralizes parent-specific operations
 */

const User = require('../models/User');
const Student = require('../models/Student');
const School = require('../models/School');

class ParentDashboardService {
  /**
   * Get parent dashboard data
   * @param {string} userId - Parent user ID
   * @param {string} schoolId - School identifier
   * @returns {Object} Parent dashboard data
   */
  static async getParentDashboard(userId, schoolId) {
    // Get parent information
    const parent = await User.findById(userId).select('-password');
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Get school information
    const school = await School.findOne({ schoolId });
    if (!school) {
      throw new Error('School not found');
    }

    // Get children (students linked to this parent)
    const children = await Student.find({
      schoolId: schoolId,
      parentIds: parent._id,
      isActive: true
    })
    .populate('teachers', 'firstName lastName email subjects')
    .select('firstName lastName studentId class section grade dateOfBirth age gender isEnrolled teachers');

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
        id: child._id,
        studentId: child.studentId,
        name: `${child.firstName} ${child.lastName}`,
        section: child.section,
        grade: child.grade,
        age: child.age,
        gender: child.gender,
        isEnrolled: child.isEnrolled,
        teachers: child.teachers.map(teacher => ({
          id: teacher._id,
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
        count: [...new Set(children.flatMap(child => child.teachers.map(t => t._id.toString())))].length
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
        id: parent._id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        fullName: `${parent.firstName} ${parent.lastName}`,
        email: parent.email,
        phone: parent.phone,
        address: parent.address,
        occupation: parent.occupation,
        emergencyContact: parent.emergencyContact,
        emergencyPhone: parent.emergencyPhone,
        lastLoginAt: parent.lastLoginAt
      },
      school: {
        id: school._id,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email
      },
      statistics: stats,
      children: children.map(child => ({
        id: child._id,
        studentId: child.studentId,
        firstName: child.firstName,
        lastName: child.lastName,
        fullName: `${child.firstName} ${child.lastName}`,
        class: child.class,
        section: child.section,
        classDisplay: child.class && child.section ? `${child.class}-${child.section}` : child.class || 'Not Assigned',
        grade: child.grade,
        age: child.age,
        gender: child.gender,
        dateOfBirth: child.dateOfBirth,
        isEnrolled: child.isEnrolled,
        teachers: child.teachers.map(teacher => ({
          id: teacher._id,
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
    const parent = await User.findById(userId);
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Build query
    const query = {
      schoolId: schoolId,
      parentIds: parent._id,
      isActive: true
    };

    // If specific child requested
    if (childId) {
      query._id = childId;
    }

    // Get children with detailed information
    const children = await Student.find(query)
      .populate('teachers', 'firstName lastName email subjects phone')
      .populate('parentIds', 'firstName lastName email phone')
      .sort({ class: 1, section: 1, firstName: 1 });

    if (childId && children.length === 0) {
      throw new Error('Child not found or not linked to your account');
    }

    // Format response
    const formattedChildren = children.map(child => ({
      id: child._id,
      studentId: child.studentId,
      firstName: child.firstName,
      lastName: child.lastName,
      fullName: `${child.firstName} ${child.lastName}`,
      email: child.email,
      class: child.class,
      section: child.section,
      classDisplay: child.class && child.section ? `${child.class}-${child.section}` : child.class || 'Not Assigned',
      rollNumber: child.rollNumber,
      grade: child.grade,
      dateOfBirth: child.dateOfBirth,
      age: child.age,
      gender: child.gender,
      address: child.address,
      phone: child.phone,
      isActive: child.isActive,
      isEnrolled: child.isEnrolled,
      teachers: child.teachers.map(teacher => ({
        id: teacher._id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        phone: teacher.phone,
        subjects: teacher.subjects || []
      })),
      otherParents: child.parentIds
        .filter(p => !p._id.equals(parent._id))
        .map(p => ({
          id: p._id,
          name: `${p.firstName} ${p.lastName}`,
          email: p.email,
          phone: p.phone
        })),
      createdAt: child.createdAt
    }));

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
    const parent = await User.findById(userId).select('-password');
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Get school information
    const school = await School.findOne({ schoolId });

    // Get children count
    const childrenCount = await Student.countDocuments({
      schoolId: schoolId,
      parentIds: parent._id,
      isActive: true
    });

    return {
      parent: {
        id: parent._id,
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
    const parent = await User.findById(userId);
    if (!parent || parent.role !== 'parent') {
      throw new Error('Access denied. Parent role required.');
    }

    // Update allowed fields
    if (firstName) parent.firstName = firstName;
    if (lastName) parent.lastName = lastName;
    if (phone) parent.phone = phone;
    if (address) parent.address = address;
    if (occupation) parent.occupation = occupation;
    if (emergencyContact) parent.emergencyContact = emergencyContact;
    if (emergencyPhone) parent.emergencyPhone = emergencyPhone;

    await parent.save();

    return {
      parent: {
        id: parent._id,
        firstName: parent.firstName,
        lastName: parent.lastName,
        fullName: `${parent.firstName} ${parent.lastName}`,
        email: parent.email,
        phone: parent.phone,
        address: parent.address,
        occupation: parent.occupation,
        emergencyContact: parent.emergencyContact,
        emergencyPhone: parent.emergencyPhone,
        updatedAt: parent.updatedAt
      }
    };
  }
}

module.exports = ParentDashboardService;
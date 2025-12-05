/**
 * Dashboard Service
 * Handles dashboard analytics, user management, and reporting logic
 * Centralizes business logic for admin dashboard operations
 * Enhanced with Redis caching for optimal performance
 */

const User = require('../models/User');
const School = require('../models/School');
const Student = require('../models/Student');
const Invitation = require('../models/Invitation');
const CacheService = require('./cacheService');

class DashboardService {
  /**
   * Get comprehensive dashboard analytics for a school
   * @param {string} schoolId - School identifier
   * @returns {Object} Dashboard analytics data
   */
  static async getDashboardAnalytics(schoolId) {
    // Try to get cached dashboard data first
    const cacheKey = `analytics:${schoolId}`;
    const cachedData = await CacheService.get('dashboard', cacheKey);
    
    if (cachedData) {
      console.log(`📊 Dashboard cache HIT for school ${schoolId}`);
      return cachedData;
    }

    console.log(`📊 Dashboard cache MISS for school ${schoolId} - fetching from database`);

    // Get school information
    const school = await School.findOne({ schoolId });
    if (!school) {
      throw new Error('School not found');
    }

    // Get user statistics by role
    const userStats = await User.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: '$role',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
          verified: { $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] } },
          temporaryPassword: { $sum: { $cond: [{ $eq: ['$isTemporaryPassword', true] }, 1, 0] } }
        }
      }
    ]);

    // Get student statistics
    const studentStats = await Student.getSchoolStatistics(schoolId);

    // Get invitation statistics
    const invitationStats = await Invitation.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const recentUsers = await User.find({
      schoolId,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 }).limit(10).select('firstName lastName email role createdAt isActive');

    const recentStudents = await Student.find({
      schoolId,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 }).limit(10).select('firstName lastName class createdAt isActive');

    const recentInvitations = await Invitation.find({
      schoolId,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 }).limit(10).select('email role status createdAt');

    // Format user statistics
    const formattedUserStats = {
      admin: { total: 0, active: 0, verified: 0, temporaryPassword: 0 },
      teacher: { total: 0, active: 0, verified: 0, temporaryPassword: 0 },
      parent: { total: 0, active: 0, verified: 0, temporaryPassword: 0 }
    };

    userStats.forEach(stat => {
      if (formattedUserStats[stat._id]) {
        formattedUserStats[stat._id] = {
          total: stat.total,
          active: stat.active,
          verified: stat.verified,
          temporaryPassword: stat.temporaryPassword
        };
      }
    });

    // Format invitation statistics
    const formattedInvitationStats = {
      pending: 0,
      accepted: 0,
      cancelled: 0,
      expired: 0
    };

    invitationStats.forEach(stat => {
      if (formattedInvitationStats[stat._id] !== undefined) {
        formattedInvitationStats[stat._id] = stat.count;
      }
    });

    // Calculate totals
    const totalUsers = Object.values(formattedUserStats).reduce((sum, role) => sum + role.total, 0);
    const totalActiveUsers = Object.values(formattedUserStats).reduce((sum, role) => sum + role.active, 0);
    const totalInvitations = Object.values(formattedInvitationStats).reduce((sum, count) => sum + count, 0);

    const dashboardData = {
      school: {
        id: school._id,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email,
        isActive: school.isActive,
        isVerified: school.isVerified,
        createdAt: school.createdAt
      },
      overview: {
        totalUsers,
        totalActiveUsers,
        totalStudents: studentStats.totalStudents,
        totalActiveStudents: studentStats.activeStudents,
        totalInvitations,
        pendingInvitations: formattedInvitationStats.pending
      },
      userStatistics: {
        byRole: formattedUserStats,
        summary: {
          total: totalUsers,
          active: totalActiveUsers,
          inactive: totalUsers - totalActiveUsers,
          pendingRegistration: Object.values(formattedUserStats).reduce((sum, role) => sum + role.temporaryPassword, 0)
        }
      },
      studentStatistics: studentStats,
      invitationStatistics: {
        byStatus: formattedInvitationStats,
        summary: {
          total: totalInvitations,
          pending: formattedInvitationStats.pending,
          accepted: formattedInvitationStats.accepted,
          cancelled: formattedInvitationStats.cancelled,
          expired: formattedInvitationStats.expired
        }
      },
      recentActivity: {
        users: recentUsers.map(user => ({
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          isActive: user.isActive
        })),
        students: recentStudents.map(student => ({
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          class: student.class,
          createdAt: student.createdAt,
          isActive: student.isActive
        })),
        invitations: recentInvitations.map(invitation => ({
          id: invitation._id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          createdAt: invitation.createdAt
        }))
      },
      // Add cache metadata
      cached: false,
      generatedAt: new Date().toISOString()
    };

    // Cache the dashboard data for 15 minutes
    await CacheService.set('dashboard', cacheKey, dashboardData);
    console.log(`📊 Dashboard data cached for school ${schoolId}`);

    return dashboardData;
  }

  /**
   * Get user management data with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} User management data
   */
  static async getUserManagement({ schoolId, role, status, page = 1, limit = 20, search }) {
    // Build query
    const query = { schoolId };
    
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'pending') {
      query.isTemporaryPassword = true;
    }

    // Add search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Get users with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password')
      .populate('invitedBy', 'firstName lastName email');

    const total = await User.countDocuments(query);

    // Format response
    const formattedUsers = users.map(user => ({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isTemporaryPassword: user.isTemporaryPassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      invitedBy: user.invitedBy ? {
        name: `${user.invitedBy.firstName} ${user.invitedBy.lastName}`,
        email: user.invitedBy.email
      } : null,
      // Role-specific data
      subjects: user.role === 'teacher' ? user.subjects : undefined,
      qualifications: user.role === 'teacher' ? user.qualifications : undefined,
      experience: user.role === 'teacher' ? user.experience : undefined,
      address: user.role === 'parent' ? user.address : undefined,
      occupation: user.role === 'parent' ? user.occupation : undefined,
      // Status indicators
      statusDisplay: user.isActive ? 
        (user.isTemporaryPassword ? 'Pending Registration' : 'Active') : 
        'Inactive',
      canActivate: !user.isActive,
      canDeactivate: user.isActive && !user.isTemporaryPassword,
      canResendInvitation: user.isTemporaryPassword
    }));

    return {
      users: formattedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        role: role || 'all',
        status: status || 'all',
        search: search || ''
      }
    };
  }

  /**
   * Toggle user status (activate/deactivate)
   * @param {string} userId - User ID to toggle
   * @param {string} action - 'activate' or 'deactivate'
   * @param {string} schoolId - School identifier
   * @param {string} reason - Reason for action
   * @returns {Object} Updated user data
   */
  static async toggleUserStatus(userId, action, schoolId, reason) {
    // Find the user
    const user = await User.findOne({
      _id: userId,
      schoolId
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get admin user for tracking
    const adminUser = await User.findOne({ 
      schoolId, 
      role: 'admin' 
    });

    if (!adminUser) {
      throw new Error('No admin user found for this school');
    }

    // Perform the action
    if (action === 'activate') {
      if (user.isActive) {
        throw new Error('User is already active');
      }
      
      user.isActive = true;
      user.deactivatedAt = undefined;
      user.deactivatedBy = undefined;
      user.deactivationReason = undefined;
      
    } else if (action === 'deactivate') {
      if (!user.isActive) {
        throw new Error('User is already inactive');
      }
      
      if (user.isTemporaryPassword) {
        throw new Error('Cannot deactivate user with pending registration. Cancel their invitation instead.');
      }
      
      user.isActive = false;
      user.deactivatedAt = new Date();
      user.deactivatedBy = adminUser._id;
      user.deactivationReason = reason || 'Deactivated by administrator';
      
    } else {
      throw new Error('Invalid action. Must be "activate" or "deactivate"');
    }

    await user.save();

    return {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        deactivatedAt: user.deactivatedAt,
        deactivationReason: user.deactivationReason
      }
    };
  }

  /**
   * Remove user permanently
   * @param {string} userId - User ID to remove
   * @param {string} schoolId - School identifier
   * @param {string} reason - Reason for removal
   * @returns {Object} Removal confirmation data
   */
  static async removeUser(userId, schoolId, reason) {
    // Find the user
    const user = await User.findOne({
      _id: userId,
      schoolId
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent removal of admin users
    if (user.role === 'admin') {
      throw new Error('Cannot remove admin users');
    }

    // Get admin user for tracking
    const adminUser = await User.findOne({ 
      schoolId, 
      role: 'admin' 
    });

    if (!adminUser) {
      throw new Error('No admin user found for this school');
    }

    // Store user info for response before deletion
    const userInfo = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };

    // Cancel any pending invitations for this user
    await Invitation.updateMany(
      { 
        email: user.email,
        schoolId,
        status: 'pending'
      },
      { 
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: adminUser._id,
        cancellationReason: `User removed: ${reason || 'User account deleted'}`
      }
    );

    // Remove the user
    await User.findByIdAndDelete(userId);

    return {
      removedUser: userInfo,
      removedAt: new Date(),
      removedBy: {
        id: adminUser._id,
        name: `${adminUser.firstName} ${adminUser.lastName}`,
        email: adminUser.email
      },
      reason: reason || 'No reason provided'
    };
  }

  /**
   * Get or determine school ID for operations
   * @param {string} schoolId - Optional school ID
   * @returns {string} School ID to use
   */
  static async getSchoolId(schoolId) {
    if (schoolId) {
      return schoolId;
    }

    // For testing, get the most recent active school
    const recentSchool = await School.findOne({ 
      isActive: true, 
      isVerified: true 
    }).sort({ createdAt: -1 });
    
    if (!recentSchool) {
      throw new Error('No active school found');
    }

    return recentSchool.schoolId;
  }

  /**
   * Invalidate dashboard cache for a school
   * @param {string} schoolId - School identifier
   * @returns {Promise<boolean>} Success status
   */
  static async invalidateDashboardCache(schoolId) {
    const cacheKey = `analytics:${schoolId}`;
    const success = await CacheService.del('dashboard', cacheKey);
    
    if (success) {
      console.log(`🗑️ Dashboard cache invalidated for school ${schoolId}`);
    }
    
    return success;
  }

  /**
   * Refresh dashboard cache by invalidating and regenerating
   * @param {string} schoolId - School identifier
   * @returns {Object} Fresh dashboard data
   */
  static async refreshDashboardCache(schoolId) {
    // Invalidate existing cache
    await this.invalidateDashboardCache(schoolId);
    
    // Generate fresh data (which will be automatically cached)
    return await this.getDashboardAnalytics(schoolId);
  }
}

module.exports = DashboardService;
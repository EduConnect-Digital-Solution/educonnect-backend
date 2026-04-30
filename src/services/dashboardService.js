/**
 * Dashboard Service
 * Handles dashboard analytics, user management, and reporting logic
 * Centralizes business logic for admin dashboard operations
 * Enhanced with Redis caching for optimal performance
 */

const { prisma } = require('../config/database');
const CacheService = require('./cacheService');
const logger = require('../utils/logger');

class DashboardService {
  /**
   * Get comprehensive dashboard analytics for a school
   * @param {string} schoolId - School identifier
   * @returns {Object} Dashboard analytics data
   */
  static async getDashboardAnalytics(schoolId) {
    // TEMPORARILY DISABLE CACHING - Always fetch fresh data
    logger.info(`📊 Dashboard cache DISABLED for school ${schoolId} - fetching fresh data from database`);

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

    // Get user statistics by role using Prisma (user.schoolId is UUID)
    const users = await prisma.user.findMany({
      where: { schoolId: school.id },
      select: { role: true, isActive: true, isVerified: true, isTemporaryPassword: true }
    });
    
    const userStatsRaw = Object.values(
      users.reduce((acc, user) => {
        if (!acc[user.role]) {
          acc[user.role] = { _id: user.role, total: 0, active: 0, verified: 0, temporaryPassword: 0 };
        }
        acc[user.role].total++;
        if (user.isActive) acc[user.role].active++;
        if (user.isVerified) acc[user.role].verified++;
        if (user.isTemporaryPassword) acc[user.role].temporaryPassword++;
        return acc;
      }, {})
    );

    // Get student statistics (student.schoolId is UUID)
    const studentStats = await this._getStudentStatistics(school.id);

    // Get invitation statistics using Prisma (invitation.schoolId is human-readable)
    const invitationStatsRaw = await prisma.invitation.groupBy({
      by: ['status'],
      where: { schoolId: school.schoolId },
      _count: { status: true }
    });

    logger.info(`📊 DEBUG: Raw invitation stats for ${school.schoolId}:`, invitationStatsRaw);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Recent users (user.schoolId is UUID)
    const recentUsers = await prisma.user.findMany({
      where: {
        schoolId: school.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
        isActive: true
      }
    });

    // Recent students (student.schoolId is UUID)
    const recentStudents = await prisma.student.findMany({
      where: {
        schoolId: school.id,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        class: true,
        createdAt: true,
        isActive: true
      }
    });

    // Recent invitations (invitation.schoolId is human-readable)
    const recentInvitations = await prisma.invitation.findMany({
      where: {
        schoolId: school.schoolId,
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    // Format user statistics
    const formattedUserStats = {
      admin: { total: 0, active: 0, verified: 0, temporaryPassword: 0 },
      teacher: { total: 0, active: 0, verified: 0, temporaryPassword: 0 },
      parent: { total: 0, active: 0, verified: 0, temporaryPassword: 0 }
    };

    userStatsRaw.forEach(stat => {
      const role = stat._id;
      if (formattedUserStats[role]) {
        formattedUserStats[role] = {
          total: Number(stat.total),
          active: Number(stat.active),
          verified: Number(stat.verified),
          temporaryPassword: Number(stat.temporaryPassword)
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

    invitationStatsRaw.forEach(stat => {
      const status = stat._id;
      if (formattedInvitationStats[status] !== undefined) {
        formattedInvitationStats[status] = Number(stat.count);
      }
    });

    logger.info(`📊 DEBUG: Formatted invitation stats for ${schoolId}:`, formattedInvitationStats);

    // Calculate totals
    const totalUsers = Object.values(formattedUserStats).reduce((sum, role) => sum + role.total, 0);
    const totalActiveUsers = Object.values(formattedUserStats).reduce((sum, role) => sum + role.active, 0);
    const totalInvitations = Object.values(formattedInvitationStats).reduce((sum, count) => sum + count, 0);

    const dashboardData = {
      school: {
        id: school.id,
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
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          isActive: user.isActive
        })),
        students: recentStudents.map(student => ({
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          class: student.class,
          createdAt: student.createdAt,
          isActive: student.isActive
        })),
        invitations: recentInvitations.map(invitation => ({
          id: invitation.id,
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

    // TEMPORARILY DISABLE CACHING - Don't cache the data
    logger.info(`📊 Dashboard caching DISABLED for school ${schoolId} - returning fresh data`);

    return dashboardData;
  }

  /**
   * Helper: Get student statistics for a school
   * @param {string} schoolId - School identifier
   * @returns {Object} Student statistics
   */
  static async _getStudentStatistics(schoolId) {
    // schoolId here is UUID (from school.id) since student.schoolId is UUID
    const totalStudents = await prisma.student.count({
      where: { schoolId }
    });

    const activeStudents = await prisma.student.count({
      where: {
        schoolId,
        isActive: true
      }
    });

    return {
      totalStudents,
      activeStudents,
      inactiveStudents: totalStudents - activeStudents
    };
  }

  /**
   * Get user management data with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} User management data
   */
  static async getUserManagement({ schoolId, role, status, page = 1, limit = 20, search }) {
    // Build where clause
    // First, get the school to use UUID for user lookup
    // Handle both UUID and human-readable schoolId
    let school = await prisma.school.findFirst({
      where: { id: schoolId }
    });
    
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: schoolId }
      });
    }
    
    if (!school) {
      throw new Error('School not found');
    }
    
    const where = { schoolId: school.id };
    
    if (role && role !== 'all') {
      where.role = role;
    }
    
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'pending') {
      where.isTemporaryPassword = true;
    }
    
    // Add search functionality
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get users with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        isTemporaryPassword: true,
        lastLoginAt: true,
        createdAt: true,
        subjects: true,
        classes: true,
        invitedBy: true
      }
    });

    const total = await prisma.user.count({ where });

    // Fetch inviter details for users who have invitedBy
    const inviterIds = users.filter(u => u.invitedBy).map(u => u.invitedBy);
    const inviters = inviterIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, firstName: true, lastName: true, email: true }
    }) : [];
    const inviterMap = inviters.reduce((map, inviter) => {
      map[inviter.id] = inviter;
      return map;
    }, {});

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isTemporaryPassword: user.isTemporaryPassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      invitedBy: user.invitedBy && inviterMap[user.invitedBy] ? {
        name: `${inviterMap[user.invitedBy].firstName} ${inviterMap[user.invitedBy].lastName}`,
        email: inviterMap[user.invitedBy].email
      } : null,
      // Role-specific data
      subjects: user.role === 'teacher' ? user.subjects : undefined,
      classes: user.role === 'teacher' ? user.classes : undefined,
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
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        schoolId
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get admin user for tracking
    const adminUser = await prisma.user.findFirst({
      where: {
        schoolId,
        role: 'admin'
      }
    });

    if (!adminUser) {
      throw new Error('No admin user found for this school');
    }

    // Perform the action
    let updateData = {};

    if (action === 'activate') {
      if (user.isActive) {
        throw new Error('User is already active');
      }

      updateData = {
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null
      };

    } else if (action === 'deactivate') {
      if (!user.isActive) {
        throw new Error('User is already inactive');
      }

      if (user.isTemporaryPassword) {
        throw new Error('Cannot deactivate user with pending registration. Cancel their invitation instead.');
      }

      updateData = {
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: adminUser.id,
        deactivationReason: reason || 'Deactivated by administrator'
      };

    } else {
      throw new Error('Invalid action. Must be "activate" or "deactivate"');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    return {
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        deactivatedAt: updatedUser.deactivatedAt,
        deactivationReason: updatedUser.deactivationReason
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
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        schoolId
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Prevent removal of admin users
    if (user.role === 'admin') {
      throw new Error('Cannot remove admin users');
    }

    // Get admin user for tracking
    const adminUser = await prisma.user.findFirst({
      where: {
        schoolId,
        role: 'admin'
      }
    });

    if (!adminUser) {
      throw new Error('No admin user found for this school');
    }

    // Store user info for response before deletion
    const userInfo = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };

    // Cancel any pending invitations for this user
    await prisma.invitation.updateMany({
      where: {
        email: user.email,
        schoolId,
        status: 'pending'
      },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: adminUser.id,
        cancellationReason: `User removed: ${reason || 'User account deleted'}`
      }
    });

    // Remove the user
    await prisma.user.delete({
      where: { id: userId }
    });

    return {
      removedUser: userInfo,
      removedAt: new Date(),
      removedBy: {
        id: adminUser.id,
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
    const recentSchool = await prisma.school.findFirst({
      where: {
        isActive: true,
        isVerified: true
      },
      orderBy: { createdAt: 'desc' }
    });

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
      logger.info(`🗑️ Dashboard cache invalidated for school ${schoolId}`);
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

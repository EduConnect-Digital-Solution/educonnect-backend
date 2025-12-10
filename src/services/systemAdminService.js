/**
 * System Admin Service
 * Provides platform overview, school management, and cross-school user management
 * Centralizes business logic for system admin operations
 * Requirements: 1.1, 2.1, 3.1
 */

const mongoose = require('mongoose');
const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const SystemAlert = require('../models/SystemAlert');
const PlatformAuditLog = require('../models/PlatformAuditLog');
const SystemConfiguration = require('../models/SystemConfiguration');
const CrossSchoolAggregator = require('./crossSchoolAggregator');
const CacheService = require('./cacheService');

class SystemAdminService {
  /**
   * Get comprehensive platform overview and metrics
   * @param {Object} options - Query options
   * @returns {Object} Platform overview data
   */
  static async getPlatformOverview(options = {}) {
    const cacheKey = `overview:${JSON.stringify(options)}`;
    const cachedData = await CacheService.getPlatformCache(cacheKey);
    
    if (cachedData) {
      console.log('📊 Platform overview cache HIT');
      return { ...cachedData, cached: true };
    }

    console.log('📊 Platform overview cache MISS - generating fresh data');

    try {
      // Get platform KPIs
      const platformKPIs = await CrossSchoolAggregator.calculatePlatformKPIs();
      
      // Get recent activity
      const recentActivity = await this._getRecentPlatformActivity();
      
      // Get system health
      const systemHealth = await this._getSystemHealth();
      
      // Get critical alerts
      const criticalAlerts = await this._getCriticalAlerts();
      
      // Get subscription overview
      const subscriptionOverview = await this._getSubscriptionOverview();

      const overview = {
        kpis: platformKPIs,
        recentActivity,
        systemHealth,
        criticalAlerts,
        subscriptionOverview,
        generatedAt: new Date().toISOString(),
        cached: false
      };

      // Cache for 5 minutes (platform overview needs to be fresh)
      await CacheService.setPlatformCache(cacheKey, overview, 300);
      console.log('📊 Platform overview cached');

      return overview;

    } catch (error) {
      console.error('Error generating platform overview:', error);
      throw new Error(`Failed to generate platform overview: ${error.message}`);
    }
  }

  /**
   * Get platform metrics with filtering and time range
   * @param {Object} filters - Metric filters
   * @param {Object} timeRange - Time range for metrics
   * @returns {Object} Platform metrics data
   */
  static async getPlatformMetrics(filters = {}, timeRange = {}) {
    const { metric = 'overview', schoolIds = null } = filters;
    
    try {
      return await CrossSchoolAggregator.aggregateMetrics(schoolIds, metric, timeRange);
    } catch (error) {
      console.error('Error getting platform metrics:', error);
      throw new Error(`Failed to get platform metrics: ${error.message}`);
    }
  }

  /**
   * Get school comparison analytics
   * @param {Array<string>} schoolIds - School IDs to compare
   * @param {Array<string>} criteria - Comparison criteria
   * @param {Object} timeRange - Time range for comparison
   * @returns {Object} School comparison data
   */
  static async getSchoolComparisons(schoolIds, criteria, timeRange = {}) {
    try {
      return await CrossSchoolAggregator.compareSchoolPerformance(schoolIds, criteria, timeRange);
    } catch (error) {
      console.error('Error getting school comparisons:', error);
      throw new Error(`Failed to get school comparisons: ${error.message}`);
    }
  }

  /**
   * Get system health status and metrics
   * @returns {Object} System health data
   */
  static async getSystemHealth() {
    const cacheKey = 'system-health';
    const cachedData = await CacheService.getPlatformCache(cacheKey);
    
    if (cachedData) {
      console.log('🏥 System health cache HIT');
      return { ...cachedData, cached: true };
    }

    console.log('🏥 System health cache MISS - checking system health');

    try {
      const systemHealth = await this._getSystemHealth();
      
      // Cache for 2 minutes (system health should be very fresh)
      await CacheService.setPlatformCache(cacheKey, systemHealth, 120);
      console.log('🏥 System health cached');

      return { ...systemHealth, cached: false };

    } catch (error) {
      console.error('Error getting system health:', error);
      throw new Error(`Failed to get system health: ${error.message}`);
    }
  }

  // ========================================
  // SCHOOL MANAGEMENT METHODS
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
  // ========================================

  /**
   * Get school management data with filtering and pagination
   * @param {Object} options - Options including filters and pagination
   * @returns {Object} School management data
   */
  static async getSchoolManagement(options = {}) {
    const { page = 1, limit = 20, status, tier, search } = options;
    
    // Build filters
    const filters = {};
    if (status && status !== 'all') {
      filters.isActive = status === 'active';
    }
    if (tier && tier !== 'all') {
      filters.subscriptionTier = tier;
    }
    if (search) {
      filters.search = search;
    }

    // Build pagination
    const pagination = { page, limit, sortBy: 'createdAt', sortOrder: 'desc' };

    // Use getAllSchools method
    return await this.getAllSchools(filters, pagination);
  }

  /**
   * Get all schools with filtering and pagination
   * @param {Object} filters - School filters
   * @param {Object} pagination - Pagination options
   * @returns {Object} Schools data with pagination
   */
  static async getAllSchools(filters = {}, pagination = {}) {
    const {
      isActive,
      subscriptionTier,
      subscriptionStatus,
      search,
      hasFlags
    } = filters;

    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = pagination;

    try {
      // Build query
      const query = {};
      
      if (isActive !== undefined) query.isActive = isActive;
      if (subscriptionTier) query['systemConfig.subscriptionTier'] = subscriptionTier;
      if (subscriptionStatus) query['systemConfig.subscriptionStatus'] = subscriptionStatus;
      if (hasFlags) query['systemMetadata.flags.isActive'] = true;
      
      if (search) {
        query.$or = [
          { schoolName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { schoolId: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [schools, total] = await Promise.all([
        School.find(query)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        School.countDocuments(query)
      ]);

      // Enhance school data with statistics
      const enhancedSchools = await Promise.all(
        schools.map(async (school) => {
          const [userCount, studentCount, activeFlags] = await Promise.all([
            User.countDocuments({ schoolId: school.schoolId }),
            Student.countDocuments({ schoolId: school.schoolId, isActive: true }),
            school.systemMetadata?.flags?.filter(flag => flag.isActive).length || 0
          ]);

          return {
            ...school,
            statistics: {
              totalUsers: userCount,
              totalStudents: studentCount,
              activeFlags
            }
          };
        })
      );

      return {
        schools: enhancedSchools,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        filters
      };

    } catch (error) {
      console.error('Error getting all schools:', error);
      throw new Error(`Failed to get schools: ${error.message}`);
    }
  }

  /**
   * Create a new school instance
   * @param {Object} schoolData - School creation data
   * @param {string} systemAdminId - System admin ID for tracking
   * @returns {Object} Created school data
   */
  static async createSchool(schoolData, systemAdminId) {
    const {
      schoolName,
      email,
      password,
      phone,
      address,
      principalName,
      schoolType = 'public',
      subscriptionTier = 'basic',
      adminUserData = {}
    } = schoolData;

    try {
      // Check if school with email already exists
      const existingSchool = await School.findOne({ email: email.toLowerCase() });
      if (existingSchool) {
        throw new Error('A school with this email already exists');
      }

      // Create school
      const school = new School({
        schoolName: schoolName.trim(),
        email: email.toLowerCase().trim(),
        password,
        phone: phone?.trim(),
        address: address?.trim(),
        principalName: principalName?.trim(),
        schoolType,
        systemConfig: {
          subscriptionTier,
          subscriptionStatus: 'trial',
          subscriptionStartDate: new Date(),
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
          features: [
            {
              featureName: 'basic_features',
              isEnabled: true,
              enabledBy: systemAdminId,
              enabledAt: new Date()
            }
          ]
        },
        systemMetadata: {
          createdBy: systemAdminId,
          systemNotes: [
            {
              note: 'School created by system administrator',
              createdBy: systemAdminId,
              category: 'general',
              createdAt: new Date()
            }
          ]
        }
      });

      await school.save();

      // Create admin user for the school
      const adminUser = new User({
        firstName: adminUserData.firstName || 'Admin',
        lastName: adminUserData.lastName || 'User',
        email: email.toLowerCase(),
        password: password, // Will be hashed by pre-save middleware
        role: 'admin',
        schoolId: school.schoolId,
        isActive: true,
        isVerified: true,
        isTemporaryPassword: true // Admin should change password on first login
      });

      await adminUser.save();

      // Update school with admin user reference
      school.adminUserId = adminUser._id;
      await school.save();

      // Log the creation
      await PlatformAuditLog.createAuditLog({
        operation: 'Create new school',
        operationType: 'create',
        userId: systemAdminId,
        userRole: 'system_admin',
        userEmail: 'system@educonnect.com',
        targetSchoolId: school._id,
        resourceType: 'school',
        resourceId: school.schoolId,
        metadata: {
          ip: '127.0.0.1', // This should come from request in real implementation
          userAgent: 'System Admin Dashboard'
        },
        severity: 'high',
        category: 'user_management'
      });

      // Invalidate platform caches
      await CacheService.invalidateCrossSchoolCaches();

      return {
        school: {
          id: school._id,
          schoolId: school.schoolId,
          schoolName: school.schoolName,
          email: school.email,
          isActive: school.isActive,
          subscriptionTier: school.systemConfig.subscriptionTier,
          subscriptionStatus: school.systemConfig.subscriptionStatus,
          createdAt: school.createdAt
        },
        adminUser: {
          id: adminUser._id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          isTemporaryPassword: adminUser.isTemporaryPassword
        }
      };

    } catch (error) {
      console.error('Error creating school:', error);
      throw new Error(`Failed to create school: ${error.message}`);
    }
  }

  /**
   * Update school configuration
   * @param {string} schoolId - School ID to update
   * @param {Object} configData - Configuration data to update
   * @param {string} systemAdminId - System admin ID for tracking
   * @returns {Object} Updated school data
   */
  static async updateSchoolConfig(schoolId, configData, systemAdminId) {
    try {
      const school = await School.findOne({ schoolId });
      if (!school) {
        throw new Error('School not found');
      }

      const {
        subscriptionTier,
        subscriptionStatus,
        features,
        limits,
        billing,
        systemNote
      } = configData;

      // Track changes for audit log
      const changes = { before: {}, after: {} };

      // Update subscription tier
      if (subscriptionTier && subscriptionTier !== school.systemConfig.subscriptionTier) {
        changes.before.subscriptionTier = school.systemConfig.subscriptionTier;
        changes.after.subscriptionTier = subscriptionTier;
        await school.updateSubscriptionTier(subscriptionTier, systemAdminId);
      }

      // Update subscription status
      if (subscriptionStatus && subscriptionStatus !== school.systemConfig.subscriptionStatus) {
        changes.before.subscriptionStatus = school.systemConfig.subscriptionStatus;
        changes.after.subscriptionStatus = subscriptionStatus;
        await school.updateSubscriptionStatus(subscriptionStatus, systemAdminId);
      }

      // Update features
      if (features && Array.isArray(features)) {
        for (const feature of features) {
          const { featureName, isEnabled, expiresAt } = feature;
          await school.toggleFeature(featureName, isEnabled, systemAdminId, expiresAt);
        }
        changes.after.features = features;
      }

      // Update limits
      if (limits) {
        changes.before.limits = { ...school.systemConfig.limits };
        changes.after.limits = limits;
        await school.updateLimits(limits, systemAdminId);
      }

      // Update billing information
      if (billing) {
        changes.before.billing = { ...school.systemConfig.billing };
        changes.after.billing = billing;
        Object.assign(school.systemConfig.billing, billing);
        await school.save();
      }

      // Add system note if provided
      if (systemNote) {
        await school.addSystemNote(systemNote, systemAdminId, 'configuration');
      }

      // Log the update
      await PlatformAuditLog.createAuditLog({
        operation: 'Update school configuration',
        operationType: 'update',
        userId: systemAdminId,
        userRole: 'system_admin',
        userEmail: 'system@educonnect.com',
        targetSchoolId: school._id,
        resourceType: 'school',
        resourceId: school.schoolId,
        changes,
        metadata: {
          ip: '127.0.0.1',
          userAgent: 'System Admin Dashboard'
        },
        severity: 'high',
        category: 'configuration'
      });

      // Invalidate caches
      await CacheService.invalidatePlatformCachesForSchool(schoolId);

      // Return updated school
      const updatedSchool = await School.findOne({ schoolId });
      return {
        school: updatedSchool.getSystemSummary()
      };

    } catch (error) {
      console.error('Error updating school config:', error);
      throw new Error(`Failed to update school configuration: ${error.message}`);
    }
  }

  /**
   * Deactivate a school
   * @param {string} schoolId - School ID to deactivate
   * @param {string} reason - Reason for deactivation
   * @param {string} systemAdminId - System admin ID for tracking
   * @returns {Object} Deactivation result
   */
  static async deactivateSchool(schoolId, reason, systemAdminId) {
    try {
      const school = await School.findOne({ schoolId });
      if (!school) {
        throw new Error('School not found');
      }

      if (!school.isActive) {
        throw new Error('School is already inactive');
      }

      // Deactivate the school
      school.isActive = false;
      school.systemMetadata.lastModifiedBy = systemAdminId;
      await school.save();

      // Add system note
      await school.addSystemNote(
        `School deactivated: ${reason}`,
        systemAdminId,
        'general'
      );

      // Add system flag
      await school.addSystemFlag(
        'attention',
        `School deactivated: ${reason}`,
        systemAdminId
      );

      // Log the deactivation
      await PlatformAuditLog.createAuditLog({
        operation: 'Deactivate school',
        operationType: 'admin_action',
        userId: systemAdminId,
        userRole: 'system_admin',
        userEmail: 'system@educonnect.com',
        targetSchoolId: school._id,
        resourceType: 'school',
        resourceId: school.schoolId,
        changes: {
          before: { isActive: true },
          after: { isActive: false, reason }
        },
        metadata: {
          ip: '127.0.0.1',
          userAgent: 'System Admin Dashboard'
        },
        severity: 'critical',
        category: 'user_management'
      });

      // Invalidate caches
      await CacheService.invalidatePlatformCachesForSchool(schoolId);

      return {
        school: {
          schoolId: school.schoolId,
          schoolName: school.schoolName,
          isActive: school.isActive,
          deactivatedAt: new Date(),
          reason
        }
      };

    } catch (error) {
      console.error('Error deactivating school:', error);
      throw new Error(`Failed to deactivate school: ${error.message}`);
    }
  }

  /**
   * Reactivate a school
   * @param {string} schoolId - School ID to reactivate
   * @param {Object} options - Reactivation options
   * @returns {Object} Reactivation result
   */
  static async reactivateSchool(schoolId, options = {}) {
    const { reason, reactivatedBy, reactivatedAt } = options;
    
    try {
      const school = await School.findOne({ schoolId });
      if (!school) {
        throw new Error('School not found');
      }

      if (school.isActive) {
        throw new Error('School is already active');
      }

      // Reactivate the school
      school.isActive = true;
      school.systemMetadata.lastModifiedBy = reactivatedBy || 'system';
      await school.save();

      // Add system note
      await school.addSystemNote(
        `School reactivated: ${reason || 'No reason provided'}`,
        reactivatedBy || 'system',
        'general'
      );

      // Remove deactivation flags
      if (school.systemMetadata.flags) {
        school.systemMetadata.flags = school.systemMetadata.flags.filter(
          flag => !flag.flagType.includes('deactivated')
        );
        await school.save();
      }

      // Log the reactivation
      await PlatformAuditLog.createAuditLog({
        operation: 'Reactivate school',
        operationType: 'admin_action',
        userId: reactivatedBy || 'system',
        userRole: 'system_admin',
        userEmail: 'system@educonnect.com',
        targetSchoolId: school._id,
        resourceType: 'school',
        resourceId: school.schoolId,
        changes: {
          before: { isActive: false },
          after: { isActive: true, reason }
        },
        metadata: {
          ip: '127.0.0.1',
          userAgent: 'System Admin Dashboard'
        },
        severity: 'high',
        category: 'user_management'
      });

      // Invalidate caches
      await CacheService.invalidatePlatformCachesForSchool(schoolId);

      return {
        school: {
          schoolId: school.schoolId,
          schoolName: school.schoolName,
          isActive: school.isActive,
          reactivatedAt: reactivatedAt || new Date(),
          reason
        }
      };

    } catch (error) {
      console.error('Error reactivating school:', error);
      throw new Error(`Failed to reactivate school: ${error.message}`);
    }
  }

  // ========================================
  // CROSS-SCHOOL USER MANAGEMENT METHODS
  // Requirements: 3.1, 3.2, 3.3
  // ========================================

  /**
   * Get cross-school users with filtering and pagination
   * @param {Object} filters - User filters
   * @param {Object} pagination - Pagination options
   * @returns {Object} Cross-school users data
   */
  static async getCrossSchoolUsers(filters = {}, pagination = {}) {
    const {
      role,
      isActive,
      isVerified,
      schoolIds,
      search,
      hasFlags
    } = filters;

    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = pagination;

    try {
      // Build query
      const query = {};
      
      if (role && role !== 'all') query.role = role;
      if (isActive !== undefined) query.isActive = isActive;
      if (isVerified !== undefined) query.isVerified = isVerified;
      if (schoolIds && schoolIds.length > 0) query.schoolId = { $in: schoolIds };
      
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { schoolId: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      const [users, total] = await Promise.all([
        User.find(query)
          .populate('schoolId', 'schoolName schoolId')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .select('-password')
          .lean(),
        User.countDocuments(query)
      ]);

      // Enhance user data
      const enhancedUsers = users.map(user => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`,
        school: user.schoolId ? {
          schoolId: user.schoolId.schoolId,
          schoolName: user.schoolId.schoolName
        } : null,
        statusDisplay: this._getUserStatusDisplay(user)
      }));

      return {
        users: enhancedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        filters,
        summary: {
          totalUsers: total,
          byRole: await this._getUserSummaryByRole(query),
          byStatus: await this._getUserSummaryByStatus(query)
        }
      };

    } catch (error) {
      console.error('Error getting cross-school users:', error);
      throw new Error(`Failed to get cross-school users: ${error.message}`);
    }
  }

  /**
   * Manage user access across schools
   * @param {string} userId - User ID to manage
   * @param {Object} permissions - Permission changes
   * @param {string} systemAdminId - System admin ID for tracking
   * @returns {Object} Updated user data
   */
  static async manageUserAccess(userId, permissions, systemAdminId) {
    // Debug logging
    console.log('manageUserAccess called with:', {
      userId,
      permissions,
      systemAdminId,
      permissionsType: typeof permissions,
      permissionsKeys: permissions ? Object.keys(permissions) : 'null'
    });

    const { action, reason, newRole, schoolTransfer } = permissions;

    // Debug the extracted values
    console.log('Extracted values:', { action, reason, newRole, schoolTransfer });

    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const changes = { before: {}, after: {} };
      let operationDescription = '';

      switch (action) {
        case 'activate':
          if (user.isActive) {
            throw new Error('User is already active');
          }
          changes.before.isActive = user.isActive;
          user.isActive = true;
          changes.after.isActive = true;
          operationDescription = 'Activate user';
          break;

        case 'deactivate':
          if (!user.isActive) {
            throw new Error('User is already inactive');
          }
          changes.before.isActive = user.isActive;
          user.isActive = false;
          changes.after.isActive = false;
          operationDescription = 'Deactivate user';
          break;

        case 'change_role':
          if (!newRole || newRole === user.role) {
            throw new Error('Invalid or same role specified');
          }

          // Define allowed role transitions for security
          const allowedTransitions = {
            'admin': ['teacher'], // Admin can become teacher
            'teacher': ['admin'], // Teacher can become admin
            'parent': ['teacher'] // Parent can only become teacher (NOT admin)
          };

          const currentRole = user.role;
          if (!allowedTransitions[currentRole] || !allowedTransitions[currentRole].includes(newRole)) {
            throw new Error(`Role transition from ${currentRole} to ${newRole} is not allowed. Allowed transitions: ${allowedTransitions[currentRole]?.join(', ') || 'none'}`);
          }

          changes.before.role = user.role;
          changes.before.subjects = user.subjects;
          changes.before.classes = user.classes;
          
          user.role = newRole;
          
          // Handle role-specific field changes
          if (newRole === 'teacher') {
            // If changing TO teacher, ensure they have at least one subject
            if (!user.subjects || user.subjects.length === 0) {
              user.subjects = ['General']; // Default subject
            }
          } else {
            // If changing FROM teacher to admin/parent, clear subjects and classes
            user.subjects = [];
            user.classes = [];
          }
          
          changes.after.role = newRole;
          changes.after.subjects = user.subjects;
          changes.after.classes = user.classes;
          operationDescription = `Change user role from ${changes.before.role} to ${newRole}`;
          break;

        case 'transfer_school':
          if (!schoolTransfer || !schoolTransfer.targetSchoolId) {
            throw new Error('Target school ID required for transfer');
          }
          
          // Verify target school exists
          const targetSchool = await School.findOne({ schoolId: schoolTransfer.targetSchoolId });
          if (!targetSchool) {
            throw new Error('Target school not found');
          }
          
          changes.before.schoolId = user.schoolId;
          user.schoolId = schoolTransfer.targetSchoolId;
          changes.after.schoolId = schoolTransfer.targetSchoolId;
          operationDescription = `Transfer user to school ${schoolTransfer.targetSchoolId}`;
          break;

        default:
          throw new Error('Invalid action specified');
      }

      await user.save();

      // Log the action - Create a temporary ObjectId for system admin since they don't have User records
      const systemAdminObjectId = new mongoose.Types.ObjectId();
      
      try {
        await PlatformAuditLog.createAuditLog({
          operation: operationDescription,
          operationType: 'admin_action',
          userId: systemAdminObjectId, // Use temporary ObjectId for system admin
          userRole: 'system_admin',
          userEmail: systemAdminId, // Use the actual system admin email
          targetUserId: user._id,
          targetSchoolId: user.schoolId,
          resourceType: 'user',
          resourceId: user._id.toString(),
          changes,
          requestDetails: {
            method: 'PUT',
            path: `/api/system-admin/users/${userId}/access`,
            body: { action, reason, newRole }
          },
          metadata: {
            reason,
            ip: '127.0.0.1',
            userAgent: 'System Admin Dashboard',
            systemAdminEmail: systemAdminId
          },
          severity: 'high',
          category: 'user_management'
        });
      } catch (auditError) {
        console.error('Audit log creation failed (non-blocking):', auditError.message);
        // Don't throw - audit logging failure shouldn't break the main operation
      }

      // Invalidate caches
      await CacheService.invalidateUserCache(userId, user.schoolId);
      await CacheService.invalidatePlatformCachesForSchool(user.schoolId);

      return {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          isActive: user.isActive,
          updatedAt: user.updatedAt
        },
        action: operationDescription,
        reason
      };

    } catch (error) {
      console.error('Error managing user access:', error);
      throw new Error(`Failed to manage user access: ${error.message}`);
    }
  }

  /**
   * Get security alerts across all schools
   * @param {Object} filters - Alert filters
   * @returns {Object} Security alerts data
   */
  static async getSecurityAlerts(filters = {}) {
    const {
      severity,
      alertType,
      isResolved = false,
      schoolIds,
      timeRange
    } = filters;

    try {
      const query = { isActive: true, isResolved };
      
      if (severity) query.severity = severity;
      if (alertType) query.alertType = alertType;
      if (schoolIds && schoolIds.length > 0) query.affectedSchools = { $in: schoolIds };
      
      if (timeRange && (timeRange.startDate || timeRange.endDate)) {
        query.createdAt = {};
        if (timeRange.startDate) query.createdAt.$gte = new Date(timeRange.startDate);
        if (timeRange.endDate) query.createdAt.$lte = new Date(timeRange.endDate);
      }

      const alerts = await SystemAlert.find(query)
        .populate('affectedSchools', 'schoolName schoolId')
        .populate('resolvedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(100) // Limit to prevent performance issues
        .lean();

      const alertSummary = {
        total: alerts.length,
        bySeverity: this._groupAlertsBySeverity(alerts),
        byType: this._groupAlertsByType(alerts),
        bySchool: this._groupAlertsBySchool(alerts)
      };

      return {
        alerts: alerts.map(alert => ({
          ...alert,
          ageInMinutes: Math.floor((Date.now() - alert.createdAt.getTime()) / (1000 * 60)),
          affectedSchoolNames: alert.affectedSchools?.map(school => school.schoolName) || []
        })),
        summary: alertSummary,
        filters
      };

    } catch (error) {
      console.error('Error getting security alerts:', error);
      throw new Error(`Failed to get security alerts: ${error.message}`);
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Get recent platform activity
   * @private
   */
  static async _getRecentPlatformActivity() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const recentLogs = await PlatformAuditLog.find({
      timestamp: { $gte: twentyFourHoursAgo }
    })
    .sort({ timestamp: -1 })
    .limit(20)
    .populate('userId', 'firstName lastName email')
    .populate('targetSchoolId', 'schoolName schoolId')
    .lean();

    return {
      totalOperations: recentLogs.length,
      recentOperations: recentLogs.map(log => ({
        operation: log.operation,
        operationType: log.operationType,
        user: log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'System',
        school: log.targetSchoolId?.schoolName || 'Platform',
        timestamp: log.timestamp,
        severity: log.severity
      }))
    };
  }

  /**
   * Get system health metrics
   * @private
   */
  static async _getSystemHealth() {
    const [
      criticalAlerts,
      errorAlerts,
      cacheStats,
      recentErrors
    ] = await Promise.all([
      SystemAlert.countDocuments({ severity: 'critical', isResolved: false }),
      SystemAlert.countDocuments({ severity: 'error', isResolved: false }),
      CacheService.getCachePerformanceMetrics(),
      PlatformAuditLog.countDocuments({
        isSuccessful: false,
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
      })
    ]);

    let healthStatus = 'healthy';
    if (criticalAlerts > 0) healthStatus = 'critical';
    else if (errorAlerts > 5 || recentErrors > 10) healthStatus = 'warning';

    return {
      status: healthStatus,
      criticalAlerts,
      errorAlerts,
      recentErrors,
      cache: {
        available: cacheStats.available,
        hitRate: cacheStats.stats?.hitRate || 0
      },
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Get critical alerts
   * @private
   */
  static async _getCriticalAlerts() {
    const criticalAlerts = await SystemAlert.find({
      severity: 'critical',
      isResolved: false,
      isActive: true
    })
    .populate('affectedSchools', 'schoolName schoolId')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

    return criticalAlerts.map(alert => ({
      id: alert._id,
      title: alert.title,
      description: alert.description,
      alertType: alert.alertType,
      affectedSchools: alert.affectedSchools?.map(school => school.schoolName) || [],
      createdAt: alert.createdAt,
      ageInMinutes: Math.floor((Date.now() - alert.createdAt.getTime()) / (1000 * 60))
    }));
  }

  /**
   * Get subscription overview
   * @private
   */
  static async _getSubscriptionOverview() {
    const subscriptionStats = await School.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$systemConfig.subscriptionTier',
          count: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$systemConfig.billing.monthlyRevenue', 0] } }
        }
      }
    ]);

    const statusStats = await School.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$systemConfig.subscriptionStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      byTier: subscriptionStats.reduce((acc, stat) => {
        acc[stat._id || 'basic'] = { count: stat.count, revenue: stat.revenue };
        return acc;
      }, {}),
      byStatus: statusStats.reduce((acc, stat) => {
        acc[stat._id || 'trial'] = stat.count;
        return acc;
      }, {})
    };
  }

  /**
   * Get user status display text
   * @private
   */
  static _getUserStatusDisplay(user) {
    if (!user.isActive) return 'Inactive';
    if (user.isTemporaryPassword) return 'Pending Registration';
    if (!user.isVerified) return 'Unverified';
    return 'Active';
  }

  /**
   * Get user summary by role
   * @private
   */
  static async _getUserSummaryByRole(baseQuery) {
    const roleStats = await User.aggregate([
      { $match: baseQuery },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    return roleStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {});
  }

  /**
   * Get user summary by status
   * @private
   */
  static async _getUserSummaryByStatus(baseQuery) {
    const statusStats = await User.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            isActive: '$isActive',
            isVerified: '$isVerified',
            isTemporaryPassword: '$isTemporaryPassword'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = {
      active: 0,
      inactive: 0,
      verified: 0,
      unverified: 0,
      pendingRegistration: 0
    };

    statusStats.forEach(stat => {
      if (stat._id.isActive) summary.active += stat.count;
      else summary.inactive += stat.count;
      
      if (stat._id.isVerified) summary.verified += stat.count;
      else summary.unverified += stat.count;
      
      if (stat._id.isTemporaryPassword) summary.pendingRegistration += stat.count;
    });

    return summary;
  }

  /**
   * Group alerts by severity
   * @private
   */
  static _groupAlertsBySeverity(alerts) {
    return alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Group alerts by type
   * @private
   */
  static _groupAlertsByType(alerts) {
    return alerts.reduce((acc, alert) => {
      acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Group alerts by school
   * @private
   */
  static _groupAlertsBySchool(alerts) {
    const schoolCounts = {};
    
    alerts.forEach(alert => {
      if (alert.affectedSchools && alert.affectedSchools.length > 0) {
        alert.affectedSchools.forEach(school => {
          const schoolName = school.schoolName || school;
          schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
        });
      }
    });
    
    return schoolCounts;
  }
}

module.exports = SystemAdminService;
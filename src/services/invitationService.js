/**
 * Invitation Service
 * Centralized business logic for teacher and parent invitation operations
 * Enhanced with Redis caching for invitation data and rate limiting
 */

const User = require('../models/User');
const School = require('../models/School');
const Student = require('../models/Student');
const Invitation = require('../models/Invitation');
const EmailService = require('../config/email');
const CacheService = require('./cacheService');
const crypto = require('crypto');

/**
 * Create Teacher Invitation Service
 * Creates invitation for a new teacher and sends invitation email
 */
const createTeacherInvitation = async (invitationData, schoolId, adminUserId) => {
  const {
    email,
    firstName,
    lastName,
    subjects,
    classes,
    message
  } = invitationData;

  // Check if school exists and is active
  const school = await School.findOne({ schoolId, isActive: true, isVerified: true });
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Find admin user
  const adminUser = await User.findOne({
    _id: adminUserId,
    schoolId,
    role: 'admin',
    isActive: true
  });

  if (!adminUser) {
    throw new Error('No admin user found for this school');
  }

  // Check if invitation already exists for this email
  const existingInvitation = await Invitation.findOne({
    email: email.toLowerCase(),
    schoolId,
    role: 'teacher',
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (existingInvitation) {
    throw new Error('Active invitation already exists for this email');
  }

  // Generate temporary password
  const tempPassword = crypto.randomBytes(8).toString('hex');

  // Create teacher user account immediately with temporary password
  const teacher = new User({
    schoolId,
    firstName,
    lastName,
    email: email.toLowerCase(),
    password: tempPassword, // Will be hashed by pre-save middleware
    role: 'teacher',
    isVerified: true, // Teachers are verified through invitation
    isActive: false, // Inactive until they complete registration
    isTemporaryPassword: true, // Flag to force password change on first login
    verifiedAt: new Date(),
    // Teacher-specific fields - ONLY subjects, NO classes initially
    subjects: subjects || [],
    // classes: classes || [], // ← REMOVED: Teachers should not get classes automatically
    // Set invitation details
    invitedBy: adminUser._id,
    invitedAt: new Date()
  });

  await teacher.save();

  // Create invitation record for tracking
  const invitation = new Invitation({
    email: email.toLowerCase(),
    role: 'teacher',
    schoolId,
    invitedBy: adminUser._id,
    subjects: subjects && subjects.length > 0 ? subjects : ['General'],
    metadata: {
      firstName,
      lastName,
      message: message || null,
      userId: teacher._id,
      tempPassword: tempPassword,
      classes: classes || []
    },
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
  });

  await invitation.save();

  // Invalidate invitation-related caches
  await invalidateInvitationCaches(schoolId);

  // Also directly invalidate dashboard cache to ensure immediate update
  const DashboardService = require('./dashboardService');
  await DashboardService.invalidateDashboardCache(schoolId);

  // Send invitation email with login credentials
  const emailResult = await EmailService.sendTemplatedEmail(
    'teacher-invitation',
    email.toLowerCase(),
    `Welcome to ${school.schoolName} - Complete Your Registration`,
    {
      teacherName: `${firstName} ${lastName}`,
      schoolName: school.schoolName,
      schoolId: school.schoolId,
      email: email.toLowerCase(),
      tempPassword: tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'https://educonnect-frontend-one.vercel.app'}/login`,
      completeRegistrationUrl: `${process.env.FRONTEND_URL || 'https://educonnect-frontend-one.vercel.app'}/complete-registration?role=teacher`,
      subjects: subjects ? subjects.join(', ') : 'Not specified',
      // classes: classes ? classes.join(', ') : 'Not specified', // ← REMOVED: Don't mention classes in invitation
      message: message || null,
      expirationHours: 72
    }
  );

  return {
    invitation: {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt
    },
    user: {
      id: teacher._id,
      email: teacher.email,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      role: teacher.role,
      subjects: teacher.subjects,
      // classes: teacher.classes, // ← REMOVED: Don't return classes in response
      isActive: teacher.isActive,
      isTemporaryPassword: teacher.isTemporaryPassword
    },
    temporaryPassword: tempPassword,
    emailSent: emailResult.success
  };
};

/**
 * Create Parent Invitation Service
 * Creates invitation for a new parent and links to students
 */
const createParentInvitation = async (invitationData, schoolId, adminUserId) => {
  const {
    email,
    firstName,
    lastName,
    studentIds,
    message
  } = invitationData;

  // Check if school exists and is active
  const school = await School.findOne({ schoolId, isActive: true, isVerified: true });
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Find admin user
  const adminUser = await User.findOne({
    _id: adminUserId,
    schoolId,
    role: 'admin',
    isActive: true
  });

  if (!adminUser) {
    throw new Error('No admin user found for this school');
  }

  // Verify that all student IDs exist and belong to this school
  if (!studentIds || studentIds.length === 0) {
    throw new Error('At least one student ID is required for parent invitation');
  }

  const students = await Student.find({
    _id: { $in: studentIds },
    schoolId,
    isActive: true
  });

  if (students.length !== studentIds.length) {
    throw new Error('One or more student IDs are invalid or do not belong to this school');
  }

  // Check if invitation already exists for this email
  const existingInvitation = await Invitation.findOne({
    email: email.toLowerCase(),
    schoolId,
    role: 'parent',
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (existingInvitation) {
    throw new Error('Active invitation already exists for this email');
  }

  // Generate temporary password
  const tempPassword = crypto.randomBytes(8).toString('hex');

  // Create parent user account immediately with temporary password
  const parent = new User({
    schoolId,
    firstName,
    lastName,
    email: email.toLowerCase(),
    password: tempPassword, // Will be hashed by pre-save middleware
    role: 'parent',
    isVerified: true, // Parents are verified through invitation
    isActive: false, // Inactive until they complete registration
    isTemporaryPassword: true, // Flag to force password change on first login
    verifiedAt: new Date(),
    // Parent-specific fields
    studentIds: studentIds, // Link to students
    // Set invitation details
    invitedBy: adminUser._id,
    invitedAt: new Date()
  });

  await parent.save();

  // Update students to link to this parent
  await Student.updateMany(
    { _id: { $in: studentIds } },
    { $addToSet: { parentIds: parent._id } }
  );

  // Create invitation record for tracking
  const invitation = new Invitation({
    email: email.toLowerCase(),
    role: 'parent',
    schoolId,
    invitedBy: adminUser._id,
    studentIds: studentIds,
    metadata: {
      firstName,
      lastName,
      message: message || null,
      userId: parent._id,
      tempPassword: tempPassword,
      studentNames: students.map(s => `${s.firstName} ${s.lastName}`)
    },
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours
  });

  await invitation.save();

  // Invalidate invitation-related caches
  await invalidateInvitationCaches(schoolId);

  // Also directly invalidate dashboard cache to ensure immediate update
  const DashboardService = require('./dashboardService');
  await DashboardService.invalidateDashboardCache(schoolId);

  // Send invitation email with login credentials
  const emailResult = await EmailService.sendTemplatedEmail(
    'parent-invitation',
    email.toLowerCase(),
    `Welcome to ${school.schoolName} - Complete Your Registration`,
    {
      parentName: `${firstName} ${lastName}`,
      schoolName: school.schoolName,
      schoolId: school.schoolId,
      email: email.toLowerCase(),
      tempPassword: tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/login`,
      completeRegistrationUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/complete-registration?role=parent`,
      children: students.map(s => `${s.firstName} ${s.lastName}`).join(', '),
      message: message || null,
      expirationHours: 72
    }
  );

  return {
    invitation: {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      studentIds: invitation.studentIds,
      expiresAt: invitation.expiresAt
    },
    user: {
      id: parent._id,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      role: parent.role,
      studentIds: parent.studentIds,
      isActive: parent.isActive,
      isTemporaryPassword: parent.isTemporaryPassword
    },
    students: students.map(student => ({
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      class: student.class
    })),
    temporaryPassword: tempPassword,
    emailSent: emailResult.success
  };
};

/**
 * Resend Invitation Service
 * Resends invitation email for pending invitations
 */
const resendInvitation = async (invitationId, schoolId) => {
  // Find the invitation
  const invitation = await Invitation.findOne({
    _id: invitationId,
    schoolId
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check invitation status
  if (invitation.status === 'accepted') {
    throw new Error('Cannot resend invitation - user has already completed registration');
  }

  // Check expired FIRST before status (expired invitations may still have status: 'pending')
  if (invitation.isExpired && invitation.isExpired()) {
    throw new Error('Invitation has expired. Please create a new invitation.');
  }

  if (invitation.status === 'cancelled') {
    throw new Error('Cannot resend cancelled invitation. Please create a new invitation.');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Can only resend pending invitations');
  }

  // Get school and user details (null-safe metadata access)
  const school = await School.findOne({ schoolId });
  const userId = invitation.metadata?.userId;
  const user = userId ? await User.findById(userId) : null;

  if (!school) {
    throw new Error('Associated school not found');
  }

  // Resend invitation using the model method
  await invitation.resend(72); // 72 hours

  // Send invitation email again
  const templateName = invitation.role === 'teacher' ? 'teacher-invitation' : 'parent-invitation';
  const emailResult = await EmailService.sendTemplatedEmail(
    templateName,
    invitation.email,
    `Reminder: Complete Your Registration at ${school.schoolName}`,
    {
      [`${invitation.role}Name`]: `${invitation.metadata?.firstName || ''} ${invitation.metadata?.lastName || ''}`.trim(),
      schoolName: school.schoolName,
      schoolId: school.schoolId,
      email: invitation.email,
      tempPassword: invitation.metadata?.tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/login`,
      completeRegistrationUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/complete-registration?role=${invitation.role}`,
      subjects: invitation.role === 'teacher' ? (invitation.subjects ? invitation.subjects.join(', ') : 'Not specified') : undefined,
      message: invitation.metadata?.message || null,
      expirationHours: 72,
      isResend: true
    }
  );

  // Invalidate invitation-related caches
  await invalidateInvitationCaches(schoolId);

  // Also directly invalidate dashboard cache to ensure immediate update
  const DashboardService = require('./dashboardService');
  await DashboardService.invalidateDashboardCache(schoolId);

  return {
    invitation: {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      resendCount: invitation.resendCount,
      lastResendAt: invitation.lastResendAt,
      expiresAt: invitation.expiresAt
    },
    emailSent: emailResult.success
  };
};

/**
 * List Invitations Service
 * Retrieves invitations with filtering and pagination
 */
const listInvitations = async (filters, pagination) => {
  const { schoolId, status, role } = filters;
  const { page = 1, limit = 10 } = pagination;

  // Create cache key based on query parameters
  const cacheKey = `invitations:${schoolId}:${status || 'all'}:${role || 'all'}:${page}:${limit}`;

  // Try cache first
  const cachedData = await CacheService.get('invitation', cacheKey);
  if (cachedData) {
    console.log(`📧 Invitation list cache HIT for ${cacheKey}`);
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: cachedData.generatedAt
    };
  }

  console.log(`📧 Invitation list cache MISS for ${cacheKey} - querying database`);

  // Build query
  const query = { schoolId };
  if (status) query.status = status;
  if (role) query.role = role;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get invitations with populated data
  const invitations = await Invitation.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('invitedBy', 'firstName lastName email role');

  // Get total count for pagination
  const total = await Invitation.countDocuments(query);

  // Format response
  const formattedInvitations = invitations.map(invitation => ({
    id: invitation._id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    statusDisplay: invitation.statusDisplay,
    firstName: invitation.metadata?.firstName,
    lastName: invitation.metadata?.lastName,
    subjects: invitation.subjects,
    invitedBy: invitation.invitedBy ? {
      name: `${invitation.invitedBy.firstName} ${invitation.invitedBy.lastName}`,
      email: invitation.invitedBy.email
    } : null,
    invitedAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    isExpired: invitation.isExpired(),
    resendCount: invitation.resendCount,
    lastResendAt: invitation.lastResendAt,
    acceptedAt: invitation.acceptedAt,
    cancelledAt: invitation.cancelledAt,
    cancellationReason: invitation.cancellationReason
  }));

  const invitationData = {
    invitations: formattedInvitations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    },
    summary: {
      total,
      pending: await Invitation.countDocuments({ ...query, status: 'pending' }),
      accepted: await Invitation.countDocuments({ ...query, status: 'accepted' }),
      cancelled: await Invitation.countDocuments({ ...query, status: 'cancelled' }),
      expired: await Invitation.countDocuments({
        ...query,
        status: 'pending',
        expiresAt: { $lt: new Date() }
      })
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache invitation data for 5 minutes (shorter TTL due to frequent updates)
  await CacheService.set('invitation', cacheKey, invitationData, 300);
  console.log(`📧 Invitation list cached for ${cacheKey}`);

  return invitationData;
};

/**
 * Cancel Invitation Service
 * Cancels a pending invitation and deactivates associated user
 */
const cancelInvitation = async (invitationId, schoolId, adminUserId, reason) => {
  // Find the invitation
  const invitation = await Invitation.findOne({
    _id: invitationId,
    schoolId
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Get admin user for cancellation tracking
  const adminUser = await User.findOne({
    _id: adminUserId,
    schoolId,
    role: 'admin'
  });

  if (!adminUser) {
    throw new Error('No admin user found for this school');
  }

  // Check if invitation can be cancelled
  if (invitation.status === 'accepted') {
    throw new Error('Cannot cancel invitation - user has already completed registration');
  }

  if (invitation.status === 'cancelled') {
    throw new Error('Invitation is already cancelled');
  }

  // Check if invitation is expired (expired invitations still have status: 'pending')
  if (invitation.isExpired && invitation.isExpired()) {
    throw new Error('Invitation has already expired. No action needed.');
  }

  // Cancel invitation using the model method
  await invitation.cancel(adminUser._id, reason || 'Cancelled by administrator');

  // Also deactivate the associated user if they haven't completed registration
  const userId = invitation.metadata?.userId;
  if (userId) {
    const user = await User.findById(userId);
    if (user && user.isTemporaryPassword) {
      user.isActive = false;
      user.deactivatedAt = new Date();
      user.deactivatedBy = adminUser._id;
      user.deactivationReason = `Invitation cancelled: ${reason || 'Cancelled by administrator'}`;
      await user.save();
    }
  }

  // Invalidate invitation-related caches
  await invalidateInvitationCaches(schoolId);

  // Also directly invalidate dashboard cache to ensure immediate update
  const DashboardService = require('./dashboardService');
  await DashboardService.invalidateDashboardCache(schoolId);

  return {
    invitation: {
      id: invitation._id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      cancelledAt: invitation.cancelledAt,
      cancellationReason: invitation.cancellationReason
    },
    message: 'Invitation cancelled successfully'
  };
};

/**
 * Invalidate invitation-related caches
 * @param {string} schoolId - School identifier
 */
const invalidateInvitationCaches = async (schoolId) => {
  console.log(`🗑️ Invalidating invitation caches for school ${schoolId}`);

  // Invalidate invitation list caches (all variations)
  const invitationListPattern = `educonnect:invitation:invitations:${schoolId}*`;
  const deletedCount = await CacheService.delPattern(invitationListPattern);

  // Invalidate dashboard caches that depend on invitation data
  const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
  const dashboardDeleted = await CacheService.delPattern(dashboardPattern);

  console.log(`🗑️ Invalidated ${deletedCount} invitation list entries and ${dashboardDeleted} dashboard entries for school ${schoolId}`);
};

/**
 * Cache invitation rate limiting data
 * @param {string} email - Email address
 * @param {string} schoolId - School identifier
 * @param {Object} rateLimitData - Rate limiting data
 */
const cacheInvitationRateLimit = async (email, schoolId, rateLimitData) => {
  const cacheKey = `rate_limit:${email}:${schoolId}`;

  try {
    // Cache rate limit data for 24 hours
    await CacheService.set('invitation', cacheKey, {
      ...rateLimitData,
      cachedAt: new Date().toISOString()
    }, 86400); // 24 hours

    console.log(`📧 Invitation rate limit cached for ${email}:${schoolId}`);
  } catch (error) {
    console.error(`❌ Failed to cache invitation rate limit for ${email}:`, error.message);
  }
};

/**
 * Get cached invitation rate limiting data
 * @param {string} email - Email address
 * @param {string} schoolId - School identifier
 * @returns {Object|null} Cached rate limit data or null
 */
const getCachedInvitationRateLimit = async (email, schoolId) => {
  const cacheKey = `rate_limit:${email}:${schoolId}`;

  try {
    const cachedData = await CacheService.get('invitation', cacheKey);
    if (cachedData) {
      console.log(`📧 Invitation rate limit cache HIT for ${email}:${schoolId}`);
      return cachedData;
    }

    console.log(`📧 Invitation rate limit cache MISS for ${email}:${schoolId}`);
    return null;
  } catch (error) {
    console.error(`❌ Failed to get cached invitation rate limit for ${email}:`, error.message);
    return null;
  }
};

/**
 * Warm up invitation caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpInvitationCaches = async (schoolId) => {
  console.log(`🔥 Warming up invitation caches for school ${schoolId}`);

  try {
    // Pre-load common invitation views
    await listInvitations({ schoolId, status: 'pending' }, { page: 1, limit: 20 });
    await listInvitations({ schoolId }, { page: 1, limit: 20 });

    console.log(`🔥 Invitation caches warmed up successfully for school ${schoolId}`);
  } catch (error) {
    console.error(`❌ Failed to warm up invitation caches for school ${schoolId}:`, error.message);
  }
};

module.exports = {
  createTeacherInvitation,
  createParentInvitation,
  resendInvitation,
  listInvitations,
  cancelInvitation,
  // Cache management functions
  invalidateInvitationCaches,
  cacheInvitationRateLimit,
  getCachedInvitationRateLimit,
  warmUpInvitationCaches
};
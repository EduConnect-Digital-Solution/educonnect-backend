/**
 * Invitation Service
 * Centralized business logic for teacher and parent invitation operations
 * Enhanced with Redis caching for invitation data and rate limiting
 */

const { prisma } = require('../config/database');
const EmailService = require('../config/email');
const CacheService = require('./cacheService');
const crypto = require('crypto');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');

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

  // Check if school exists and is active - try UUID first, then human-readable
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

   // Find admin user using school's UUID (User.schoolId is a foreign key to School.id)
   const adminUser = await prisma.user.findFirst({
     where: {
       id: adminUserId,
       schoolId: school.id,
       role: 'admin',
       isActive: true
     }
   });

   if (!adminUser) {
     throw new Error('No admin user found for this school');
   }

   // Check if invitation already exists for this email
   const existingInvitation = await prisma.invitation.findFirst({
     where: {
       email: email.toLowerCase(),
       schoolId: school.id,
       role: 'teacher',
       status: 'pending',
       expiresAt: { gt: new Date() }
     }
   });

   if (existingInvitation) {
     throw new Error('Active invitation already exists for this email');
   }

   // Check if user already exists with this email in this school
   const existingUser = await prisma.user.findFirst({
     where: {
       email: email.toLowerCase(),
       schoolId: school.id
     }
   });

   if (existingUser) {
     throw new Error('A user with this email already exists in this school');
   }

   // Generate temporary password and hash it
   const tempPassword = crypto.randomBytes(8).toString('hex');
   const hashedPassword = await bcrypt.hash(tempPassword, 10);

   // Create teacher user account immediately with temporary password
   const teacher = await prisma.user.create({
    data: {
      schoolId: school.id,  // Use UUID for foreign key
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'teacher',
      isVerified: true,
      isActive: false,
      isTemporaryPassword: true,
      subjects: subjects || [],
      classes: [], // Teachers do not get classes automatically
      invitedBy: adminUser.id
    }
  });

  // Generate invitation token
  const invitationToken = crypto.randomBytes(32).toString('hex');

  // Create invitation record for tracking
  const invitation = await prisma.invitation.create({
    data: {
      schoolId,
      email: email.toLowerCase(),
      role: 'teacher',
      token: invitationToken,
      status: 'pending',
      invitedBy: adminUser.id,
      subjects: subjects && subjects.length > 0 ? subjects : ['General'],
      firstName,
      lastName,
      message: message || null,
      classes: classes || [],
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    }
  });

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
      schoolId: school.id,
      email: email.toLowerCase(),
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'https://educonnect-frontend-one.vercel.app'}/login`,
      completeRegistrationUrl: `${process.env.FRONTEND_URL || 'https://educonnect-frontend-one.vercel.app'}/complete-registration?role=teacher`,
      subjects: subjects ? subjects.join(', ') : 'Not specified',
      message: message || null,
      expirationHours: 72
    }
  );

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt
    },
    user: {
      id: teacher.id,
      email: teacher.email,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      role: teacher.role,
      subjects: teacher.subjects,
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

  // Check if school exists and is active - try UUID first, then human-readable
  let school = await prisma.school.findFirst({
    where: { id: schoolId, isActive: true, isVerified: true }
  });
  
  if (!school) {
    school = await prisma.school.findFirst({
      where: { schoolId: schoolId, isActive: true, isVerified: true }
    });
  }
  
  if (!school) {
    throw new Error('School not found or inactive');
  }

  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: {
      id: adminUserId,
      schoolId: school.id,
      role: 'admin',
      isActive: true
    }
  });

  if (!adminUser) {
    throw new Error('No admin user found for this school');
  }

  // Verify that all student IDs exist and belong to this school
  if (!studentIds || studentIds.length === 0) {
    throw new Error('At least one student ID is required for parent invitation');
  }

  const students = await prisma.student.findMany({
    where: {
      id: { in: studentIds },
      schoolId: school.id,
      isActive: true
    }
  });

  if (students.length !== studentIds.length) {
    throw new Error('One or more student IDs are invalid or do not belong to this school');
  }

  // Check if invitation already exists for this email
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email: email.toLowerCase(),
      schoolId: school.id,
      role: 'parent',
      status: 'pending',
      expiresAt: { gt: new Date() }
    }
  });

  if (existingInvitation) {
    throw new Error('Active invitation already exists for this email');
  }

  // Check if user already exists with this email in this school
  const existingUser = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      schoolId: school.id
    }
  });

  if (existingUser) {
    throw new Error('A user with this email already exists in this school');
  }

  // Generate temporary password and hash it
  const tempPassword = crypto.randomBytes(8).toString('hex');
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  // Create parent user account immediately with temporary password
  const parent = await prisma.user.create({
    data: {
      schoolId: school.id,  // Use UUID for foreign key
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: 'parent',
      isVerified: true,
      isActive: false,
      isTemporaryPassword: true,
      invitedBy: adminUser.id
    }
  });

  // Link parent to students via ParentStudent junction table
  await prisma.parentStudent.createMany({
    data: studentIds.map(studentId => ({
      parentId: parent.id,
      studentId
    }))
  });

  // Generate invitation token
  const invitationToken = crypto.randomBytes(32).toString('hex');

  // Create invitation record for tracking
  const invitation = await prisma.invitation.create({
    data: {
      schoolId,
      email: email.toLowerCase(),
      role: 'parent',
      token: invitationToken,
      status: 'pending',
      invitedBy: adminUser.id,
      firstName,
      lastName,
      message: message || null,
      classes: [],
      subjects: [],
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    }
  });

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
      schoolId: school.id,
      email: email.toLowerCase(),
      tempPassword,
      loginUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/login`,
      completeRegistrationUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/complete-registration?role=parent`,
      children: students.map(s => `${s.firstName} ${s.lastName}`).join(', '),
      message: message || null,
      expirationHours: 72
    }
  );

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt
    },
    user: {
      id: parent.id,
      email: parent.email,
      firstName: parent.firstName,
      lastName: parent.lastName,
      role: parent.role,
      isActive: parent.isActive,
      isTemporaryPassword: parent.isTemporaryPassword
    },
    students: students.map(student => ({
      id: student.id,
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
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, schoolId }
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check invitation status
  if (invitation.status === 'accepted') {
    throw new Error('Cannot resend invitation - user has already completed registration');
  }

  // Check if expired
  const isExpired = invitation.expiresAt < new Date() && invitation.status === 'pending';
  if (isExpired) {
    throw new Error('Invitation has expired. Please create a new invitation.');
  }

  if (invitation.status === 'revoked') {
    throw new Error('Cannot resend cancelled invitation. Please create a new invitation.');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Can only resend pending invitations');
  }

   // Get school details - invitation.schoolId is the school's internal UUID
   const school = await prisma.school.findFirst({ where: { id: schoolId } });
  if (!school) {
    throw new Error('Associated school not found');
  }

  // Update invitation expiresAt (resend for 72 hours)
  const updatedInvitation = await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    }
  });

  // Send invitation email again
  const templateName = invitation.role === 'teacher' ? 'teacher-invitation' : 'parent-invitation';
  const emailResult = await EmailService.sendTemplatedEmail(
    templateName,
    invitation.email,
    `Reminder: Complete Your Registration at ${school.schoolName}`,
    {
      [`${invitation.role}Name`]: `${invitation.firstName || ''} ${invitation.lastName || ''}`.trim(),
      schoolName: school.schoolName,
      schoolId: school.id,
      email: invitation.email,
      loginUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/login`,
      completeRegistrationUrl: `${process.env.FRONTEND_URL || 'https://educonnect.com.ng'}/complete-registration?role=${invitation.role}`,
      subjects: invitation.role === 'teacher' ? (invitation.subjects?.join(', ') || 'Not specified') : undefined,
      message: invitation.message || null,
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
      id: updatedInvitation.id,
      email: updatedInvitation.email,
      role: updatedInvitation.role,
      status: updatedInvitation.status,
      expiresAt: updatedInvitation.expiresAt
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
    logger.info(`📧 Invitation list cache HIT for ${cacheKey}`);
    return {
      ...cachedData,
      cached: true,
      cacheTimestamp: cachedData.generatedAt
    };
  }

  logger.info(`📧 Invitation list cache MISS for ${cacheKey} - querying database`);

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

  // Build query using human-readable schoolId for Invitation model
  const where = { schoolId: school.schoolId };
  if (status) where.status = status;
  if (role) where.role = role;

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  // Get invitations
  const invitations = await prisma.invitation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take
  });

  // Get total count for pagination
  const total = await prisma.invitation.count({ where });

  // Format response — override status for expired invitations
  const formattedInvitations = await Promise.all(invitations.map(async (invitation) => {
    const isExpired = invitation.expiresAt < new Date() && invitation.status === 'pending';
    const effectiveStatus = isExpired ? 'expired' : invitation.status;
    const effectiveStatusDisplay = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1);

    // Get invitedBy user details
    let invitedBy = null;
    if (invitation.invitedBy) {
      const invitedByUser = await prisma.user.findFirst({
        where: { id: invitation.invitedBy },
        select: { firstName: true, lastName: true, email: true }
      });
      if (invitedByUser) {
        invitedBy = {
          name: `${invitedByUser.firstName} ${invitedByUser.lastName}`,
          email: invitedByUser.email
        };
      }
    }

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: effectiveStatus,
      statusDisplay: effectiveStatusDisplay,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      subjects: invitation.subjects,
      invitedBy,
      invitedAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      isExpired,
      acceptedAt: invitation.acceptedAt
    };
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
      pending: await prisma.invitation.count({
        where: { ...where, status: 'pending' }
      }),
      accepted: await prisma.invitation.count({
        where: { ...where, status: 'accepted' }
      }),
      revoked: await prisma.invitation.count({
        where: { ...where, status: 'revoked' }
      }),
      expired: await prisma.invitation.count({
        where: {
          ...where,
          status: 'pending',
          expiresAt: { lt: new Date() }
        }
      })
    },
    cached: false,
    generatedAt: new Date().toISOString()
  };

  // Cache invitation data for 5 minutes
  await CacheService.set('invitation', cacheKey, invitationData, 300);
  logger.info(`📧 Invitation list cached for ${cacheKey}`);

  return invitationData;
};

/**
 * Cancel Invitation Service
 * Cancels a pending invitation and deactivates associated user
 */
const cancelInvitation = async (invitationId, schoolId, adminUserId, reason) => {
  // Find the invitation
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, schoolId }
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check if invitation can be cancelled
  if (invitation.status === 'accepted') {
    throw new Error('Cannot cancel invitation - user has already completed registration');
  }

  if (invitation.status === 'revoked') {
    throw new Error('Invitation is already cancelled');
  }

  // Check if invitation is expired
  const isExpired = invitation.expiresAt < new Date() && invitation.status === 'pending';
  if (isExpired) {
    throw new Error('Invitation has already expired. No action needed.');
  }

  // Update invitation status to revoked
  const updatedInvitation = await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: 'revoked' }
  });

  // Deactivate associated user if they haven't completed registration
  const user = await prisma.user.findFirst({
    where: {
      email: invitation.email,
      schoolId,
      isTemporaryPassword: true
    }
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false }
    });
  }

  // Invalidate invitation-related caches
  await invalidateInvitationCaches(schoolId);

  // Also directly invalidate dashboard cache to ensure immediate update
  const DashboardService = require('./dashboardService');
  await DashboardService.invalidateDashboardCache(schoolId);

  return {
    invitation: {
      id: updatedInvitation.id,
      email: updatedInvitation.email,
      role: updatedInvitation.role,
      status: updatedInvitation.status
    },
    message: 'Invitation cancelled successfully'
  };
};

/**
 * Invalidate invitation-related caches
 * @param {string} schoolId - School identifier
 */
const invalidateInvitationCaches = async (schoolId) => {
  logger.info(`🗑️ Invalidating invitation caches for school ${schoolId}`);

  // Invalidate invitation list caches (all variations)
  const invitationListPattern = `educonnect:invitation:invitations:${schoolId}*`;
  const deletedCount = await CacheService.delPattern(invitationListPattern);

  // Invalidate dashboard caches that depend on invitation data
  const dashboardPattern = `educonnect:dashboard:analytics:${schoolId}*`;
  const dashboardDeleted = await CacheService.delPattern(dashboardPattern);

  logger.info(`🗑️ Invalidated ${deletedCount} invitation list entries and ${dashboardDeleted} dashboard entries for school ${schoolId}`);
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
    }, 86400);

    logger.info(`📧 Invitation rate limit cached for ${email}:${schoolId}`);
  } catch (error) {
    logger.error(`❌ Failed to cache invitation rate limit for ${email}:`, error.message);
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
      logger.info(`📧 Invitation rate limit cache HIT for ${email}:${schoolId}`);
      return cachedData;
    }

    logger.info(`📧 Invitation rate limit cache MISS for ${email}:${schoolId}`);
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get cached invitation rate limit for ${email}:`, error.message);
    return null;
  }
};

/**
 * Warm up invitation caches (pre-populate with fresh data)
 * @param {string} schoolId - School identifier
 */
const warmUpInvitationCaches = async (schoolId) => {
  logger.info(`🔥 Warming up invitation caches for school ${schoolId}`);

  try {
    // Pre-load common invitation views
    await listInvitations({ schoolId, status: 'pending' }, { page: 1, limit: 20 });
    await listInvitations({ schoolId }, { page: 1, limit: 20 });

    logger.info(`🔥 Invitation caches warmed up successfully for school ${schoolId}`);
  } catch (error) {
    logger.error(`❌ Failed to warm up invitation caches for school ${schoolId}:`, error.message);
  }
};

/**
 * Delete Invitation Service
 * Permanently removes a cancelled or expired invitation from the database
 * Only cancelled/revoked, expired, or pending invitations can be deleted
 */
const deleteInvitation = async (invitationId, schoolId) => {
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, schoolId }
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Cannot delete accepted invitations (user already registered)
  if (invitation.status === 'accepted') {
    throw new Error('Cannot delete invitation - user has already completed registration');
  }

  // Deactivate associated user if they haven't completed registration
  const user = await prisma.user.findFirst({
    where: {
      email: invitation.email,
      schoolId,
      isTemporaryPassword: true
    }
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false }
    });
  }

  // Permanently remove the invitation
  await prisma.invitation.delete({
    where: { id: invitationId }
  });

  // Invalidate caches
  await invalidateInvitationCaches(schoolId);
  const DashboardService = require('./dashboardService');
  await DashboardService.invalidateDashboardCache(schoolId);

  return {
    message: 'Invitation deleted successfully',
    deletedInvitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status
    }
  };
};

module.exports = {
  createTeacherInvitation,
  createParentInvitation,
  resendInvitation,
  listInvitations,
  cancelInvitation,
  deleteInvitation,
  // Cache management functions
  invalidateInvitationCaches,
  cacheInvitationRateLimit,
  getCachedInvitationRateLimit,
  warmUpInvitationCaches
};

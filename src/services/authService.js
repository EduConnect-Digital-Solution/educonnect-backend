/**
 * Authentication Service
 * Centralized business logic for authentication operations
 * Enhanced with Redis caching for user sessions and authentication data
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const EmailService = require('../config/email');
const CacheService = require('./cacheService');
const {
  validateSystemAdminCredentials,
  generateSystemAdminToken,
  verifySystemAdminToken
} = require('./systemAdminAuthService');
const {
  generateTokenPair,
  verifyRefreshToken: verifyRefreshTokenFn
} = require('../middleware/auth');
const SessionService = require('./sessionService');
const logger = require('../utils/logger');
const { prisma } = require('../config/database');

// Helper function to generate schoolId
const generateSchoolId = (schoolName) => {
  const prefix = schoolName
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
};

// Helper function to create OTP
const createOTP = async (prisma, data) => {
  const { email, purpose, schoolId, expirationMinutes = 10, createdFromIP } = data;
  
  // Generate 6-digit OTP
  const plainOTP = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash OTP
  const hashedOTP = crypto.createHash('sha256').update(plainOTP).digest('hex');
  
  // Calculate expiration
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  
  // Store in database
  const otp = await prisma.oTP.create({
    data: {
      email: email.toLowerCase(),
      otp: hashedOTP,
      purpose,
      schoolId,
      expiresAt,
      createdFromIP
    }
  });
  
  return { otpDocument: otp, plainOTP, expiresAt };
};

// Helper function to verify OTP
const verifyOTP = async (prisma, data) => {
  const { email, otp, purpose, schoolId, requestIP } = data;
  
  const otpRecord = await prisma.oTP.findFirst({
    where: {
      email: email.toLowerCase(),
      purpose,
      schoolId,
      isUsed: false,
      expiresAt: { gt: new Date() }
    }
  });

  if (!otpRecord) {
    return { success: false, message: 'No valid OTP found' };
  }

  // Check attempt count
  if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
    return { success: false, message: 'Maximum verification attempts exceeded' };
  }

  // Increment attempt
  await prisma.oTP.update({
    where: { id: otpRecord.id },
    data: { attemptCount: { increment: 1 } }
  });

  // Verify OTP
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
  
  if (hashedOTP === otpRecord.otp) {
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
        usedFromIP: requestIP
      }
    });
    return { success: true, message: 'OTP verified successfully' };
  }

  return { success: false, message: 'Invalid OTP' };
};

/**
 * School Registration Service
 * Creates a new school with admin user and sends verification OTP
 */
const registerSchool = async (schoolData, requestIP) => {
  const {
    schoolName,
    email,
    password,
    adminFirstName,
    adminLastName,
    phone,
    address,
    website,
    description
  } = schoolData;

  // Check if school email already exists
  const existingSchool = await prisma.school.findFirst({
    where: { email: email.toLowerCase() }
  });
  if (existingSchool) {
    throw new Error('A school with this email address already exists');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create new school with generated schoolId
  const schoolId = generateSchoolId(schoolName);
  
  const school = await prisma.school.create({
    data: {
      schoolId,
      schoolName,
      email: email.toLowerCase(),
      password: hashedPassword,
      phone,
      address,
      website,
      description,
      isVerified: false,
      isActive: false
    }
  });

  // Create admin user for the school
  const adminUser = await prisma.user.create({
    data: {
      schoolId: school.id,  // Use UUID for foreign key reference
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: adminFirstName,
      lastName: adminLastName,
      role: 'admin',
      isActive: true,
      isVerified: false // Will be verified when school is verified
    }
  });

  // Generate OTP for email verification
  const otpResult = await createOTP(prisma, {
    email: email.toLowerCase(),
    purpose: 'school-signup',
    schoolId: schoolId,
    expirationMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
    createdFromIP: requestIP
  });

  // Send OTP verification email
  const emailResult = await EmailService.sendOTPEmail(
    email.toLowerCase(),
    otpResult.plainOTP,
    schoolName,
    {
      title: 'Welcome to EduConnect!',
      message: `Thank you for registering <strong>${schoolName}</strong> with EduConnect. Please use the following OTP to verify your email address:`,
      expirationMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10
    }
  );

  return {
    school: {
      schoolId: school.schoolId,  // Return human-readable schoolId, not UUID
      schoolName: school.schoolName,
      email: school.email
    },
    adminUser: {
      id: adminUser.id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role
    },
    otpSent: emailResult.success,
    emailResult
  };
};

/**
 * Email Verification Service
 * Verifies school email using OTP
 */
const verifyEmail = async (email, otp, requestIP) => {
  // Find the school by email
  const school = await prisma.school.findFirst({
    where: {
      email: email.toLowerCase(),
      isVerified: false
    },
    select: { id: true, schoolId: true, schoolName: true }
  });

  if (!school) {
    throw new Error('School not found or already verified');
  }

  // Verify OTP
  const verificationResult = await verifyOTP(prisma, {
    email: email.toLowerCase(),
    otp,
    purpose: 'school-signup',
    schoolId: school.id,
    requestIP
  });

  if (!verificationResult.success) {
    throw new Error(verificationResult.message);
  }

  // Update school verification status
  await prisma.school.update({
    where: { id: school.id },
    data: {
      isVerified: true,
      isActive: true
    }
  });

  // Update admin user verification status
  await prisma.user.updateMany({
    where: {
      schoolId: school.id,
      role: 'admin',
      email: school.email
    },
    data: {
      isVerified: true
    }
  });

  // Invalidate OTP caches
  await invalidateOTPData(email, 'school-signup');

  return {
    success: true,
    message: 'Email verified successfully. Your school account is now active.',
    school: {
      schoolId: school.schoolId,  // Return human-readable schoolId
      schoolName: school.schoolName,
      isVerified: true,
      isActive: true
    }
  };
};

/**
 * School Admin Login Service
 * Authenticates school admin and returns tokens
 */
const loginSchool = async (schoolId, email, password) => {
  // Find school by schoolId and email
  const school = await prisma.school.findFirst({
    where: { 
      schoolId,
      email: email.toLowerCase()
    },
    select: { id: true, schoolId: true, email: true, password: true, isVerified: true, isActive: true, schoolName: true }
  });

  if (!school) {
    throw new Error('Invalid credentials');
  }

  // Check if school is verified and active
  if (!school.isVerified) {
    throw new Error('School email is not verified. Please verify your email before logging in.');
  }

  if (!school.isActive) {
    throw new Error('School account has been deactivated. Please contact support.');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, school.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Find admin user
  const adminUser = await prisma.user.findFirst({
    where: {
      schoolId: school.id,  // Use UUID for foreign key lookup
      role: 'admin',
      email: school.email,
      isActive: true
    }
  });

  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  // Generate tokens with school UUID (not human-readable schoolId)
  const tokens = generateTokens(adminUser.id, school.id, adminUser.role);

  // Cache user session data
  await cacheUserSession(adminUser.id, {
    user: {
      id: adminUser.id,
      schoolId: adminUser.schoolId,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
      isVerified: adminUser.isVerified,
      isActive: adminUser.isActive
    },
    school: {
      schoolId: school.schoolId,  // Return human-readable schoolId in cache as well
      schoolName: school.schoolName,
      email: school.email,
      isVerified: school.isVerified,
      isActive: school.isActive
    },
    loginAt: new Date().toISOString()
  });

  // Create tracked session in Redis
  const sessionId = await SessionService.createSession({
    userId: String(adminUser.id),
    role: adminUser.role,
    schoolId: school.id,
    email: adminUser.email,
    tokens
  });

  return {
    user: {
      id: adminUser.id,
      schoolId: adminUser.schoolId,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
      isVerified: adminUser.isVerified,
      isActive: adminUser.isActive,
      profileImage: adminUser.profileImage
    },
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email,
      isVerified: school.isVerified,
      isActive: school.isActive
    },
    tokens,
    sessionId
  };
};

/**
 * User Login Service
 * Authenticates regular users (teachers, parents)
 */
const loginUser = async (email, password, schoolId) => {
  // First, find the school by human-readable schoolId to get its UUID
  const school = await prisma.school.findFirst({
    where: { schoolId: schoolId },
    select: { id: true, schoolId: true, isVerified: true, isActive: true }
  });

  if (!school) {
    throw new Error('Invalid credentials');
  }

  // Find user by email and school UUID
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      schoolId: school.id
    },
    select: { id: true, schoolId: true, email: true, password: true, firstName: true, lastName: true, role: true, isVerified: true, isActive: true, isTemporaryPassword: true }
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if user is verified
  if (!user.isVerified) {
    throw new Error('User account is not verified');
  }

  // Allow users with temporary passwords to login even if not fully active
  if (!user.isActive && !user.isTemporaryPassword) {
    throw new Error('User account is deactivated. Please contact school administration.');
  }

  // Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Re-fetch school with full details for response
  const schoolDetails = await prisma.school.findFirst({
    where: { id: school.id },
    select: { schoolId: true, schoolName: true }
  });
  
  // Use schoolDetails for response, fallback to original school if not found
  const schoolForResponse = schoolDetails || school;

  // Check if user has temporary password (needs to complete registration)
  if (user.isTemporaryPassword) {
    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      schoolId: school.schoolId,
        schoolName: school ? school.schoolName : null,
        isTemporaryPassword: user.isTemporaryPassword,
        requiresRegistrationCompletion: true,
        profileImage: user.profileImage
      },
      // Don't provide JWT tokens for temporary password users
      redirectTo: '/complete-registration'
    };
  }

  // Generate tokens with school UUID (not human-readable schoolId)
  const tokens = generateTokens(user.id, user.schoolId, user.role);

  // Cache user session data
  await cacheUserSession(user.id, {
    user: {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive
    },
    school: school ? {
      schoolId: school.schoolId,
      schoolName: school.schoolName
    } : null,
    loginAt: new Date().toISOString()
  });

  // Create tracked session in Redis
  const sessionId = await SessionService.createSession({
    userId: String(user.id),
    role: user.role,
    schoolId: user.schoolId,
    email: user.email,
    tokens
  });

  return {
    user: {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive,
      profileImage: user.profileImage
    },
    school: schoolForResponse ? {
      schoolId: schoolForResponse.schoolId,
      schoolName: schoolForResponse.schoolName
    } : null,
    tokens,
    sessionId
  };
};

/**
 * Forgot Password Service
 * Sends password reset OTP
 */
const forgotPassword = async (email, requestIP) => {
  // Find the school by email
  const school = await prisma.school.findFirst({
    where: {
      email: email.toLowerCase(),
      isVerified: true,
      isActive: true
    },
    select: { schoolId: true, schoolName: true, email: true }
  });

  if (!school) {
    // Don't reveal if school exists or not for security
    return {
      success: true,
      message: 'If a school with this email exists, a password reset OTP has been sent.'
    };
  }

  // Invalidate existing password reset OTPs
  await prisma.oTP.deleteMany({
    where: {
      email: email.toLowerCase(),
      purpose: 'password-reset',
      schoolId: school.schoolId
    }
  });

  // Generate new OTP for password reset
  const otpResult = await createOTP(prisma, {
    email: email.toLowerCase(),
    purpose: 'password-reset',
    schoolId: school.schoolId,
    expirationMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
    createdFromIP: requestIP
  });

  // Send password reset OTP email
  const emailResult = await EmailService.sendOTPEmail(
    email.toLowerCase(),
    otpResult.plainOTP,
    school.schoolName,
    {
      title: 'Password Reset Request',
      subject: 'Reset Your School Admin Password - EduConnect',
      message: `You requested to reset your password for <strong>${school.schoolName}</strong>. Please use the following OTP to reset your password:`,
      expirationMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10
    }
  );

  if (!emailResult.success) {
    throw new Error('Failed to send password reset OTP. Please try again later.');
  }

  return {
    success: true,
    message: 'Password reset OTP has been sent to your email address.',
    emailSent: true,
    expiresIn: `${parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10} minutes`
  };
};

/**
 * Reset Password Service
 * Resets password using OTP verification
 */
const resetPassword = async (email, otp, newPassword, requestIP) => {
  // Find the school by email
  const school = await prisma.school.findFirst({
    where: {
      email: email.toLowerCase(),
      isVerified: true,
      isActive: true
    }
  });

  if (!school) {
    throw new Error('School not found');
  }

  // Verify OTP
  const verificationResult = await verifyOTP(prisma, {
    email: email.toLowerCase(),
    otp,
    purpose: 'password-reset',
    schoolId: school.schoolId,
    requestIP
  });

  if (!verificationResult.success) {
    throw new Error(verificationResult.message);
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Update school password
  await prisma.school.update({
    where: { id: school.id },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date()
    }
  });

  // Update admin user password as well (they share the same password)
  const adminUser = await prisma.user.findFirst({
    where: {
      schoolId: school.id,
      role: 'admin',
      email: school.email
    }
  });

  if (adminUser) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        password: hashedPassword,
        passwordChangedAt: new Date()
      }
    });
  }

  return {
    success: true,
    message: 'Password has been reset successfully. You can now log in with your new password.',
    passwordReset: true,
    schoolId: school.schoolId
  };
};

/**
 * Complete User Registration Service
 * Allows users with temporary passwords to complete their registration
 */
const completeRegistration = async (userData) => {
  const {
    email,
    schoolId,
    currentPassword,
    newPassword,
    firstName,
    lastName,
    phone,
    subjects
  } = userData;

  // Find user with temporary password
  // First, find the school to get the UUID for user lookup
  const school = await prisma.school.findFirst({
    where: { schoolId }
  });
  
  if (!school) {
    throw new Error('School not found');
  }
  
  const user = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      schoolId: school.id,  // Use UUID for foreign key lookup
      isTemporaryPassword: true
    },
    select: { id: true, password: true, role: true, subjects: true, firstName: true, lastName: true }
  });

  if (!user) {
    throw new Error('User not found or registration already completed');
  }

  // Verify current (temporary) password
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    throw new Error('Invalid current password');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  // Prepare update data
  const updateData = {
    firstName: firstName || user.firstName,
    lastName: lastName || user.lastName,
    phone: phone || user.phone,
    password: hashedPassword,
    isTemporaryPassword: false,
    isActive: true
  };

  // Role-specific updates
  if (user.role === 'teacher') {
    updateData.subjects = subjects || user.subjects;
  } else if (user.role === 'parent') {
    // Parent-specific updates if needed
  }

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });

  // Update invitation status to 'accepted' when user completes registration
  try {
    // Use school.id (UUID) since invitations store schoolId as UUID
    const schoolUuid = school.id;

    // First try to find by exact match
    let invitation = await prisma.invitation.findFirst({
      where: {
        email: email.toLowerCase(),
        schoolId: schoolUuid,
        role: user.role,
        status: 'pending'
      }
    });

    // If not found, try to find any invitation for this email and school
    if (!invitation) {
      invitation = await prisma.invitation.findFirst({
        where: {
          email: email.toLowerCase(),
          schoolId: schoolUuid,
          role: user.role
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (invitation) {
      // Check if invitation is already accepted
      if (invitation.status === 'accepted') {
        logger.info(`ℹ️ Invitation already marked as accepted for ${email}`);
      } else {
        // Update invitation status
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: updatedUser.id
          }
        });
        logger.info(`✅ Invitation status updated to 'accepted' for ${email} (was: ${invitation.status})`);
      }

      // Invalidate invitation-related caches
      const { invalidateInvitationCaches } = require('./invitationService');
      await invalidateInvitationCaches(schoolUuid);

      // Also directly invalidate dashboard cache to ensure immediate update
      const DashboardService = require('./dashboardService');
      await DashboardService.invalidateDashboardCache(schoolUuid);
    } else {
      logger.info(`⚠️ No invitation found for ${email} in school ${schoolId} with role ${user.role}`);

      // Log all invitations for this email to help debug
      const allInvitations = await prisma.invitation.findMany({
        where: { email: email.toLowerCase() }
      });
      logger.info(`📊 Found ${allInvitations.length} total invitations for ${email}:`,
        allInvitations.map(inv => ({
          schoolId: inv.schoolId,
          role: inv.role,
          status: inv.status,
          createdAt: inv.createdAt
        }))
      );
    }
  } catch (invitationError) {
    logger.error('Error updating invitation status:', invitationError);
    // Don't fail registration if invitation update fails
  }

  return {
    success: true,
    message: 'Registration completed successfully. You can now log in with your new password.',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      role: updatedUser.role,
      schoolId: updatedUser.schoolId,
      isActive: updatedUser.isActive,
      isTemporaryPassword: updatedUser.isTemporaryPassword,
      profileImage: updatedUser.profileImage
    }
  };
};

/**
 * Token Generation Helper
 * Delegates to the canonical token functions in middleware/auth.js
 */
const generateTokens = (userId, schoolId, role) => {
  const payload = { userId, schoolId, role };
  return generateTokenPair(payload);
};

/**
 * Token Refresh Service
 * Generates new access token using refresh token
 * Supports both cookie-based and body-based refresh tokens
 */
const refreshToken = async (refreshTokenValue, source = 'body') => {
  if (!refreshTokenValue) {
    throw new Error('Refresh token is required');
  }

  console.log('Auth Service: Refreshing token with value:', refreshTokenValue?.substring(0, 20) + '...');

  // Verify refresh token
  const decoded = verifyRefreshTokenFn(refreshTokenValue);
  console.log('Auth Service: Token verification result:', !!decoded);
  
  if (!decoded) {
    console.log('Auth Service: Token verification failed - invalid or expired');
    throw new Error('Invalid refresh token');
  }

  // Find the user
  console.log('Auth Service: Looking up user with ID:', decoded.userId);
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, schoolId: true, email: true, firstName: true, lastName: true, role: true, isActive: true }
  });
  
  console.log('Auth Service: User lookup result:', !!user, 'isActive:', user?.isActive);
  
  if (!user || !user.isActive) {
    console.log('Auth Service: User lookup failed - throwing Invalid refresh token');
    throw new Error('Invalid refresh token');
  }

  // Find the school
  console.log('Auth Service: Looking up school with ID:', decoded.schoolId);
  const school = await prisma.school.findFirst({
    where: { id: decoded.schoolId },
    select: { id: true, schoolId: true, schoolName: true, isActive: true }
  });
  
  console.log('Auth Service: School lookup result:', !!school, 'isActive:', school?.isActive);
  
  if (!school || !school.isActive) {
    console.log('Auth Service: School lookup failed - throwing Invalid refresh token');
    throw new Error('Invalid refresh token');
  }

  // Generate new tokens
  const tokens = generateTokens(user.id, user.schoolId, user.role);

  // Update cached session data
  await cacheUserSession(user.id, {
    user: {
      id: user.id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profileImage: user.profileImage
    },
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName
    },
    tokenRefreshedAt: new Date().toISOString(),
    refreshSource: source // Track if refresh came from cookie or body
  });

  logger.info(`🔄 Token refreshed for user ${user.id} via ${source}`);

  return {
    user: {
      id: user.id,
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      profileImage: user.profileImage
    },
    tokens
  };
};

/**
 * Resend OTP Service
 * Resends OTP for school email verification
 */
const resendOTP = async (email, requestIP) => {
  // Find the school by email only
  const school = await prisma.school.findFirst({
    where: {
      email: email.toLowerCase(),
      isVerified: false // Only find unverified schools
    }
  });

  if (!school) {
    throw new Error('School not found or already verified');
  }

  // Invalidate existing OTPs
  await prisma.oTP.deleteMany({
    where: {
      email: email.toLowerCase(),
      purpose: 'school-signup',
      schoolId: school.id
    }
  });

  // Generate new OTP
  const otpResult = await createOTP(prisma, {
    email: email.toLowerCase(),
    purpose: 'school-signup',
    schoolId: school.id,
      expirationMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
    createdFromIP: requestIP
  });

  // Send OTP email
  const emailResult = await EmailService.sendOTPEmail(
    email.toLowerCase(),
    otpResult.plainOTP,
    school.schoolName,
    {
      title: 'Email Verification - Resent',
      message: `Please use the following OTP to verify your email address for <strong>${school.schoolName}</strong>:`,
      expirationMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10
    }
  );

  if (!emailResult.success) {
    throw new Error('Failed to send OTP email');
  }

  return {
    success: true,
    message: 'OTP has been resent to your email address',
    emailSent: true,
    expiresIn: `${parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10} minutes`
  };
};

/**
 * Cache User Session Data
 * Stores user session information in Redis for quick access
 * @param {string} userId - User identifier
 * @param {Object} sessionData - Session data to cache
 */
const cacheUserSession = async (userId, sessionData) => {
  const cacheKey = `session:${userId}`;

  try {
    // Cache session for 24 hours (same as JWT expiry)
    await CacheService.set('auth', cacheKey, {
      ...sessionData,
      cachedAt: new Date().toISOString()
    }, 86400); // 24 hours

    logger.info(`🔐 User session cached for ${userId}`);
  } catch (error) {
    logger.error(`❌ Failed to cache session for ${userId}:`, error.message);
  }
};

/**
 * Get Cached User Session
 * Retrieves user session from cache
 * @param {string} userId - User identifier
 * @returns {Object|null} Cached session data or null
 */
const getCachedUserSession = async (userId) => {
  const cacheKey = `session:${userId}`;

  try {
    const cachedSession = await CacheService.get('auth', cacheKey);
    if (cachedSession) {
      logger.info(`🔐 User session cache HIT for ${userId}`);
      return cachedSession;
    }

    logger.info(`🔐 User session cache MISS for ${userId}`);
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get cached session for ${userId}:`, error.message);
    return null;
  }
};

/**
 * Invalidate User Session
 * Removes user session from cache (logout)
 * @param {string} userId - User identifier
 */
const invalidateUserSession = async (userId) => {
  const cacheKey = `session:${userId}`;

  try {
    await CacheService.del('auth', cacheKey);
    // Also revoke all tracked sessions for this user
    const revokedCount = await SessionService.revokeAllSessions(String(userId));
    logger.info(`🔐 User session invalidated for ${userId} (${revokedCount} tracked sessions revoked)`);
  } catch (error) {
    logger.error(`❌ Failed to invalidate session for ${userId}:`, error.message);
  }
};

/**
 * Cache OTP Data
 * Stores OTP verification attempts and rate limiting data
 * @param {string} email - Email address
 * @param {string} purpose - OTP purpose
 * @param {Object} otpData - OTP data to cache
 */
const cacheOTPData = async (email, purpose, otpData) => {
  const cacheKey = `otp:${email}:${purpose}`;

  try {
    // Cache OTP data for the OTP expiration time
    const expirationMinutes = parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10;
    await CacheService.set('auth', cacheKey, {
      ...otpData,
      cachedAt: new Date().toISOString()
    }, expirationMinutes * 60);

    logger.info(`📧 OTP data cached for ${email}:${purpose}`);
  } catch (error) {
    logger.error(`❌ Failed to cache OTP data for ${email}:`, error.message);
  }
};

/**
 * Get Cached OTP Data
 * Retrieves OTP data from cache for rate limiting
 * @param {string} email - Email address
 * @param {string} purpose - OTP purpose
 * @returns {Object|null} Cached OTP data or null
 */
const getCachedOTPData = async (email, purpose) => {
  const cacheKey = `otp:${email}:${purpose}`;

  try {
    const cachedOTP = await CacheService.get('auth', cacheKey);
    if (cachedOTP) {
      logger.info(`📧 OTP cache HIT for ${email}:${purpose}`);
      return cachedOTP;
    }

    logger.info(`📧 OTP cache MISS for ${email}:${purpose}`);
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get cached OTP for ${email}:`, error.message);
    return null;
  }
};

/**
 * Invalidate OTP Data
 * Removes OTP data from cache
 * @param {string} email - Email address
 * @param {string} purpose - OTP purpose
 */
const invalidateOTPData = async (email, purpose) => {
  const cacheKey = `otp:${email}:${purpose}`;

  try {
    await CacheService.del('auth', cacheKey);
    logger.info(`📧 OTP data invalidated for ${email}:${purpose}`);
  } catch (error) {
    logger.error(`❌ Failed to invalidate OTP data for ${email}:`, error.message);
  }
};

/**
 * Invalidate Authentication Caches
 * Clears all auth-related caches for a user
 * @param {string} userId - User identifier
 * @param {string} email - User email (optional)
 */
const invalidateAuthCaches = async (userId, email = null) => {
  logger.info(`🗑️ Invalidating auth caches for user ${userId}`);

  try {
    // Invalidate user session
    await invalidateUserSession(userId);

    // Invalidate OTP caches if email provided
    if (email) {
      const otpPurposes = ['school-signup', 'password-reset', 'email-verification'];
      for (const purpose of otpPurposes) {
        await CacheService.del('auth', `otp:${email}:${purpose}`);
      }
    }

    logger.info(`🗑️ Auth caches invalidated for user ${userId}`);
  } catch (error) {
    logger.error(`❌ Failed to invalidate auth caches for ${userId}:`, error.message);
  }
};

// ============================================================================
// SYSTEM ADMIN ENHANCEMENTS
// ============================================================================

/**
 * System Admin Credential Validation
 * Enhanced validation with additional security checks
 */
const validateSystemAdminCredentialsEnhanced = async (email, password, requestContext = {}) => {
  try {
    // Basic credential validation
    const isValid = await validateSystemAdminCredentials(email, password);

    if (!isValid) {
      // Log failed attempt for security monitoring
      logger.warn(`🚫 System admin login attempt failed: ${email} from ${requestContext.ip || 'unknown IP'}`);
      return { valid: false, reason: 'invalid_credentials' };
    }

    // Additional security checks
    const securityChecks = await checkSystemAdminSecurity(email, requestContext);

    if (!securityChecks.passed) {
      logger.warn(`🚫 System admin security check failed: ${email} - ${securityChecks.reason}`);
      return { valid: false, reason: securityChecks.reason };
    }

    // Log successful validation
    logger.info(`✅ System admin credentials validated: ${email}`);

    return {
      valid: true,
      email,
      securityLevel: 'high',
      validatedAt: new Date()
    };

  } catch (error) {
    logger.error('System admin credential validation error:', error);
    return { valid: false, reason: 'validation_error' };
  }
};

/**
 * System Admin Security Checks
 * Additional security validations for system admin access
 */
const checkSystemAdminSecurity = async (email, requestContext) => {
  try {
    // Check for suspicious IP patterns (basic implementation)
    if (requestContext.ip) {
      const suspiciousIPs = await getCachedSuspiciousIPs();
      if (suspiciousIPs.includes(requestContext.ip)) {
        return { passed: false, reason: 'suspicious_ip' };
      }
    }

    // Check for rate limiting
    const rateLimitKey = `system_admin_attempts:${email}`;
    const attempts = await CacheService.get('auth', rateLimitKey) || 0;

    if (attempts >= 3) { // Max 3 attempts per hour
      return { passed: false, reason: 'rate_limited' };
    }

    // Check time-based restrictions (optional - can be configured)
    const currentHour = new Date().getHours();
    const allowedHours = process.env.SYSTEM_ADMIN_ALLOWED_HOURS;

    if (allowedHours) {
      const allowedHoursList = allowedHours.split(',').map(h => parseInt(h.trim()));
      if (!allowedHoursList.includes(currentHour)) {
        return { passed: false, reason: 'time_restricted' };
      }
    }

    return { passed: true };

  } catch (error) {
    logger.error('System admin security check error:', error);
    return { passed: false, reason: 'security_check_error' };
  }
};

/**
 * System Admin Impersonation Service
 * Allows system admin to impersonate users for support purposes
 */
const impersonateUser = async (systemAdminEmail, targetUserId, reason = 'support') => {
  try {
    // Verify system admin is authenticated
    if (!systemAdminEmail) {
      throw new Error('System admin authentication required');
    }

    // Find target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, schoolId: true }
    });

    if (!targetUser) {
      throw new Error('Target user not found');
    }

    // Find target user's school
    const school = await prisma.school.findFirst({
      where: { id: targetUser.schoolId },
      select: { schoolId: true, schoolName: true }
    });

    if (!school) {
      throw new Error('Target user school not found');
    }

    // Generate impersonation token with special claims
    const impersonationToken = jwt.sign(
      {
        userId: targetUser.id,
        schoolId: targetUser.schoolId,
        role: targetUser.role,
        type: 'impersonation',
        systemAdminEmail,
        impersonationReason: reason,
        impersonatedAt: new Date(),
        originalRole: 'system_admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' } // Shorter expiry for impersonation
    );

    // Log impersonation for audit
    const impersonationLog = {
      systemAdminEmail,
      targetUserId: targetUser.id,
      targetUserEmail: targetUser.email,
      schoolId: targetUser.schoolId,
      reason,
      timestamp: new Date(),
      ipAddress: null, // Will be filled by middleware
      userAgent: null  // Will be filled by middleware
    };

    // Cache impersonation session
    await CacheService.set('auth', `impersonation:${targetUser.id}`, impersonationLog, 7200); // 2 hours

    logger.info(`🎭 System admin impersonation started: ${systemAdminEmail} -> ${targetUser.email}`);

    return {
      success: true,
      impersonationToken,
      targetUser: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        role: targetUser.role,
        schoolId: targetUser.schoolId,
        schoolName: school.schoolName
      },
      impersonationDetails: {
        systemAdminEmail,
        reason,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        impersonatedAt: new Date()
      }
    };

  } catch (error) {
    logger.error('Impersonation error:', error);
    throw new Error(`Impersonation failed: ${error.message}`);
  }
};

/**
 * End Impersonation Session
 * Terminates an active impersonation session
 */
const endImpersonation = async (impersonationToken) => {
  try {
    // Verify and decode impersonation token
    const decoded = jwt.verify(impersonationToken, process.env.JWT_SECRET);

    if (decoded.type !== 'impersonation') {
      throw new Error('Invalid impersonation token');
    }

    // Remove impersonation session from cache
    await CacheService.del('auth', `impersonation:${decoded.userId}`);

    logger.info(`🎭 System admin impersonation ended: ${decoded.systemAdminEmail} -> ${decoded.userId}`);

    return {
      success: true,
      message: 'Impersonation session ended',
      systemAdminEmail: decoded.systemAdminEmail,
      endedAt: new Date()
    };

  } catch (error) {
    logger.error('End impersonation error:', error);
    throw new Error(`Failed to end impersonation: ${error.message}`);
  }
};

/**
 * System Admin Session Management
 * Enhanced session management for system administrators
 */
const manageSystemAdminSession = async (systemAdminEmail, action, sessionData = {}) => {
  const sessionKey = `system_admin_session:${systemAdminEmail}`;

  try {
    switch (action) {
      case 'create':
        const newSession = {
          email: systemAdminEmail,
          loginAt: new Date(),
          lastActivity: new Date(),
          ipAddress: sessionData.ipAddress,
          userAgent: sessionData.userAgent,
          sessionId: `sa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          permissions: ['cross_school_access', 'user_impersonation', 'system_management'],
          securityLevel: 'maximum'
        };

        // Cache session for 8 hours (default system admin session timeout)
        const timeout = parseInt(process.env.SYSTEM_ADMIN_SESSION_TIMEOUT) || 28800; // 8 hours
        await CacheService.set('auth', sessionKey, newSession, timeout);

        logger.info(`🔐 System admin session created: ${systemAdminEmail}`);
        return newSession;

      case 'update':
        const existingSession = await CacheService.get('auth', sessionKey);
        if (!existingSession) {
          throw new Error('Session not found');
        }

        const updatedSession = {
          ...existingSession,
          lastActivity: new Date(),
          ...sessionData
        };

        const remainingTTL = await CacheService.getTTL('auth', sessionKey);
        await CacheService.set('auth', sessionKey, updatedSession, remainingTTL || 28800);

        return updatedSession;

      case 'get':
        const retrievedSession = await CacheService.get('auth', sessionKey);
        if (retrievedSession) {
          logger.info(`🔐 System admin session retrieved: ${systemAdminEmail}`);
        }
        return retrievedSession;

      case 'destroy':
        await CacheService.del('auth', sessionKey);
        logger.info(`🔐 System admin session destroyed: ${systemAdminEmail}`);
        return { destroyed: true };

      default:
        throw new Error(`Unknown session action: ${action}`);
    }

  } catch (error) {
    logger.error(`System admin session management error (${action}):`, error);
    throw error;
  }
};

/**
 * Get Cached Suspicious IPs
 * Retrieves list of suspicious IP addresses for security checks
 */
const getCachedSuspiciousIPs = async () => {
  try {
    const suspiciousIPs = await CacheService.get('security', 'suspicious_ips') || [];
    return suspiciousIPs;
  } catch (error) {
    logger.error('Error getting suspicious IPs:', error);
    return [];
  }
};

/**
 * Add Suspicious IP
 * Adds an IP address to the suspicious list
 */
const addSuspiciousIP = async (ipAddress, reason = 'security_violation') => {
  try {
    const suspiciousIPs = await getCachedSuspiciousIPs();

    if (!suspiciousIPs.includes(ipAddress)) {
      suspiciousIPs.push(ipAddress);
      await CacheService.set('security', 'suspicious_ips', suspiciousIPs, 86400); // 24 hours

      logger.info(`🚨 IP added to suspicious list: ${ipAddress} (${reason})`);
    }
  } catch (error) {
    logger.error('Error adding suspicious IP:', error);
  }
};

/**
 * System Admin Activity Logging
 * Enhanced logging for system admin activities
 */
const logSystemAdminActivity = async (systemAdminEmail, activity, details = {}) => {
  try {
    const logEntry = {
      systemAdminEmail,
      activity,
      details,
      timestamp: new Date(),
      severity: details.severity || 'medium',
      category: details.category || 'general'
    };

    // Store in cache for recent activity tracking
    const activityKey = `system_admin_activity:${systemAdminEmail}`;
    const recentActivities = await CacheService.get('audit', activityKey) || [];

    recentActivities.unshift(logEntry);

    // Keep only last 100 activities in cache
    if (recentActivities.length > 100) {
      recentActivities.splice(100);
    }

    await CacheService.set('audit', activityKey, recentActivities, 86400); // 24 hours

    logger.info(`📋 System admin activity logged: ${systemAdminEmail} - ${activity}`);

  } catch (error) {
    logger.error('System admin activity logging error:', error);
  }
};

module.exports = {
  registerSchool,
  verifyEmail,
  loginSchool,
  loginUser,
  forgotPassword,
  resetPassword,
  completeRegistration,
  generateTokens,
  refreshToken,
  resendOTP,
  // Session management functions
  cacheUserSession,
  getCachedUserSession,
  invalidateUserSession,
  // OTP caching functions
  cacheOTPData,
  getCachedOTPData,
  invalidateOTPData,
  // Cache invalidation
  invalidateAuthCaches,
  // System admin enhancements
  validateSystemAdminCredentialsEnhanced,
  checkSystemAdminSecurity,
  impersonateUser,
  endImpersonation,
  manageSystemAdminSession,
  getCachedSuspiciousIPs,
  addSuspiciousIP,
  logSystemAdminActivity
};
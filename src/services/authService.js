/**
 * Authentication Service
 * Centralized business logic for authentication operations
 * Enhanced with Redis caching for user sessions and authentication data
 */

const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const OTP = require('../models/OTP');
const Invitation = require('../models/Invitation');
const EmailService = require('../config/email');
const CacheService = require('./cacheService');
const jwt = require('jsonwebtoken');

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
  const existingSchool = await School.findOne({ email: email.toLowerCase() });
  if (existingSchool) {
    throw new Error('A school with this email address already exists');
  }

  // Create new school with generated schoolId
  const school = new School({
    schoolName,
    email: email.toLowerCase(),
    password, // Will be hashed by pre-save middleware
    phone,
    address,
    website,
    description,
    isVerified: false,
    isActive: false
  });

  // Save school (this will generate the schoolId)
  await school.save();

  // Create admin user for the school
  const adminUser = new User({
    schoolId: school.schoolId,
    email: email.toLowerCase(),
    password, // Will be hashed by pre-save middleware
    firstName: adminFirstName,
    lastName: adminLastName,
    role: 'admin',
    isActive: true,
    isVerified: false // Will be verified when school is verified
  });

  await adminUser.save();

  // Generate OTP for email verification
  const otpResult = await OTP.createOTP({
    email: email.toLowerCase(),
    purpose: 'school-signup',
    schoolId: school.schoolId,
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
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email
    },
    adminUser: {
      id: adminUser._id,
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
 * Verifies OTP and activates school and admin user
 */
const verifyEmail = async (email, otp, requestIP) => {
  // Find the school by email
  const school = await School.findOne({ 
    email: email.toLowerCase(),
    isVerified: false 
  });

  if (!school) {
    throw new Error('School not found or already verified');
  }

  // Verify OTP
  const verificationResult = await OTP.verifyAndConsumeOTP(
    email.toLowerCase(),
    otp,
    'school-signup',
    school.schoolId,
    requestIP
  );

  if (!verificationResult.success) {
    throw new Error(verificationResult.message);
  }

  // Update school verification status
  school.isVerified = true;
  school.isActive = true;
  school.verifiedAt = new Date();
  await school.save();

  // Update admin user verification status
  const adminUser = await User.findOne({
    schoolId: school.schoolId,
    role: 'admin',
    email: school.email
  });

  if (adminUser) {
    adminUser.isVerified = true;
    adminUser.verifiedAt = new Date();
    await adminUser.save();
  }

  // Send school ID email
  const emailResult = await EmailService.sendSchoolIdEmail(
    school.email,
    school.schoolName,
    school.schoolId
  );

  return {
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email,
      isVerified: school.isVerified,
      isActive: school.isActive
    },
    adminUser: adminUser ? {
      id: adminUser._id,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
      isVerified: adminUser.isVerified
    } : null,
    emailSent: emailResult.success
  };
};

/**
 * School Admin Login Service
 * Authenticates school admin and returns tokens
 */
const loginSchool = async (schoolId, email, password) => {
  // Find school by schoolId and email
  const school = await School.findOne({
    schoolId,
    email: email.toLowerCase()
  }).select('+password');

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
  const isPasswordValid = await school.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Find admin user
  const adminUser = await User.findOne({
    schoolId: school.schoolId,
    role: 'admin',
    email: school.email,
    isActive: true
  });

  if (!adminUser) {
    throw new Error('Admin user not found');
  }

  // Generate tokens
  const tokens = generateTokens(adminUser._id, school.schoolId, adminUser.role);

  // Cache user session data
  await cacheUserSession(adminUser._id, {
    user: {
      id: adminUser._id,
      schoolId: adminUser.schoolId,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
      isVerified: adminUser.isVerified,
      isActive: adminUser.isActive
    },
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email,
      isVerified: school.isVerified,
      isActive: school.isActive
    },
    loginAt: new Date().toISOString()
  });

  return {
    user: {
      id: adminUser._id,
      schoolId: adminUser.schoolId,
      email: adminUser.email,
      firstName: adminUser.firstName,
      lastName: adminUser.lastName,
      role: adminUser.role,
      isVerified: adminUser.isVerified,
      isActive: adminUser.isActive
    },
    school: {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      email: school.email,
      isVerified: school.isVerified,
      isActive: school.isActive
    },
    tokens
  };
};

/**
 * User Login Service
 * Authenticates regular users (teachers, parents)
 */
const loginUser = async (email, password, schoolId) => {
  // Find user
  const user = await User.findOne({
    email: email.toLowerCase(),
    schoolId
  }).select('+password');

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
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Find school to include in response
  const school = await School.findOne({ schoolId: user.schoolId });

  // Check if user has temporary password (needs to complete registration)
  if (user.isTemporaryPassword) {
    return {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        schoolName: school ? school.schoolName : null,
        isTemporaryPassword: user.isTemporaryPassword,
        requiresRegistrationCompletion: true
      },
      // Don't provide JWT tokens for temporary password users
      redirectTo: '/complete-registration'
    };
  }

  // Generate tokens
  const tokens = generateTokens(user._id, user.schoolId, user.role);

  // Cache user session data
  await cacheUserSession(user._id, {
    user: {
      id: user._id,
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

  return {
    user: {
      id: user._id,
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
    tokens
  };
};

/**
 * Forgot Password Service
 * Sends password reset OTP
 */
const forgotPassword = async (email, requestIP) => {
  // Find the school by email
  const school = await School.findOne({ 
    email: email.toLowerCase(),
    isVerified: true,
    isActive: true
  });

  if (!school) {
    // Don't reveal if school exists or not for security
    return {
      success: true,
      message: 'If a school with this email exists, a password reset OTP has been sent.'
    };
  }

  // Invalidate existing password reset OTPs
  await OTP.invalidateOTPs(email.toLowerCase(), 'password-reset', school.schoolId);

  // Generate new OTP for password reset
  const otpResult = await OTP.createOTP({
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
  const school = await School.findOne({ 
    email: email.toLowerCase(),
    isVerified: true,
    isActive: true
  });

  if (!school) {
    throw new Error('School not found');
  }

  // Verify OTP
  const verificationResult = await OTP.verifyAndConsumeOTP(
    email.toLowerCase(),
    otp,
    'password-reset',
    school.schoolId,
    requestIP
  );

  if (!verificationResult.success) {
    throw new Error(verificationResult.message);
  }

  // Update password
  school.password = newPassword; // Will be hashed by pre-save middleware
  school.passwordChangedAt = new Date();
  await school.save();

  // Update admin user password as well (they share the same password)
  const adminUser = await User.findOne({
    schoolId: school.schoolId,
    role: 'admin',
    email: school.email
  });

  if (adminUser) {
    adminUser.password = newPassword; // Will be hashed by pre-save middleware
    adminUser.passwordChangedAt = new Date();
    await adminUser.save();
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
    subjects,
    qualifications,
    experience,
    address,
    occupation,
    emergencyContact,
    emergencyPhone
  } = userData;

  // Find user with temporary password
  const user = await User.findOne({
    email: email.toLowerCase(),
    schoolId,
    isTemporaryPassword: true,
    isActive: false
  }).select('+password');

  if (!user) {
    throw new Error('User not found or registration already completed');
  }

  // Verify current (temporary) password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new Error('Invalid current password');
  }

  // Update user information
  user.firstName = firstName || user.firstName;
  user.lastName = lastName || user.lastName;
  user.phone = phone || user.phone;
  user.password = newPassword; // Will be hashed by pre-save middleware
  user.isTemporaryPassword = false;
  user.isActive = true;
  user.passwordChangedAt = new Date();

  // Role-specific updates
  if (user.role === 'teacher') {
    user.subjects = subjects || user.subjects;
    user.qualifications = qualifications || user.qualifications;
    user.experience = experience || user.experience;
  } else if (user.role === 'parent') {
    user.address = address || user.address;
    user.occupation = occupation || user.occupation;
    user.emergencyContact = emergencyContact || user.emergencyContact;
    user.emergencyPhone = emergencyPhone || user.emergencyPhone;
  }

  await user.save();

  // Generate tokens for immediate login
  const tokens = generateTokens(user._id, user.schoolId, user.role);

  // Cache user session data
  await cacheUserSession(user._id, {
    user: {
      id: user._id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      isVerified: user.isVerified,
      isActive: user.isActive,
      isTemporaryPassword: user.isTemporaryPassword
    },
    loginAt: new Date().toISOString(),
    registrationCompleted: true
  });

  return {
    user: {
      id: user._id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      isVerified: user.isVerified,
      isActive: user.isActive,
      isTemporaryPassword: user.isTemporaryPassword,
      subjects: user.role === 'teacher' ? user.subjects : undefined,
      qualifications: user.role === 'teacher' ? user.qualifications : undefined,
      experience: user.role === 'teacher' ? user.experience : undefined,
      address: user.role === 'parent' ? user.address : undefined,
      occupation: user.role === 'parent' ? user.occupation : undefined
    },
    tokens,
    message: 'Registration completed successfully'
  };
};

/**
 * Token Generation Helper
 * Generates access and refresh tokens
 */
const generateTokens = (userId, schoolId, role) => {
  const accessToken = jwt.sign(
    { 
      userId, 
      schoolId, 
      role,
      type: 'access'
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const refreshToken = jwt.sign(
    { 
      userId, 
      schoolId, 
      role,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  };
};

/**
 * Token Refresh Service
 * Generates new access token using refresh token
 */
const refreshToken = async (refreshTokenValue) => {
  if (!refreshTokenValue) {
    throw new Error('Refresh token is required');
  }

  // Verify refresh token
  const decoded = jwt.verify(
    refreshTokenValue, 
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
  );

  // Find the user
  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) {
    throw new Error('Invalid refresh token');
  }

  // Find the school
  const school = await School.findOne({ schoolId: decoded.schoolId });
  if (!school || !school.isActive) {
    throw new Error('Invalid refresh token');
  }

  // Generate new tokens
  const tokens = generateTokens(user._id, user.schoolId, user.role);

  // Update cached session data
  await cacheUserSession(user._id, {
    user: {
      id: user._id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    },
    tokenRefreshedAt: new Date().toISOString()
  });

  return {
    user: {
      id: user._id,
      schoolId: user.schoolId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
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
  const school = await School.findOne({ 
    email: email.toLowerCase(),
    isVerified: false // Only find unverified schools
  });

  if (!school) {
    throw new Error('School not found or already verified');
  }

  // Invalidate existing OTPs
  await OTP.invalidateOTPs(email.toLowerCase(), 'school-signup', school.schoolId);

  // Generate new OTP
  const otpResult = await OTP.createOTP({
    email: email.toLowerCase(),
    purpose: 'school-signup',
    schoolId: school.schoolId,
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
    
    console.log(`🔐 User session cached for ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to cache session for ${userId}:`, error.message);
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
      console.log(`🔐 User session cache HIT for ${userId}`);
      return cachedSession;
    }
    
    console.log(`🔐 User session cache MISS for ${userId}`);
    return null;
  } catch (error) {
    console.error(`❌ Failed to get cached session for ${userId}:`, error.message);
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
    console.log(`🔐 User session invalidated for ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to invalidate session for ${userId}:`, error.message);
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
    
    console.log(`📧 OTP data cached for ${email}:${purpose}`);
  } catch (error) {
    console.error(`❌ Failed to cache OTP data for ${email}:`, error.message);
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
      console.log(`📧 OTP cache HIT for ${email}:${purpose}`);
      return cachedOTP;
    }
    
    console.log(`📧 OTP cache MISS for ${email}:${purpose}`);
    return null;
  } catch (error) {
    console.error(`❌ Failed to get cached OTP for ${email}:`, error.message);
    return null;
  }
};

/**
 * Invalidate Authentication Caches
 * Clears all auth-related caches for a user
 * @param {string} userId - User identifier
 * @param {string} email - User email (optional)
 */
const invalidateAuthCaches = async (userId, email = null) => {
  console.log(`🗑️ Invalidating auth caches for user ${userId}`);
  
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
    
    console.log(`🗑️ Auth caches invalidated for user ${userId}`);
  } catch (error) {
    console.error(`❌ Failed to invalidate auth caches for ${userId}:`, error.message);
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
  // Cache invalidation
  invalidateAuthCaches
};
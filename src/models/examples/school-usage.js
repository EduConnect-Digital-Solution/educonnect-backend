/**
 * School Model Usage Examples
 * This file demonstrates how to use the School model in various scenarios
 */

const School = require('../School');
const logger = require('../../utils/logger');

/**
 * Example 1: Create a new school with automatic schoolId generation
 */
async function createSchool() {
  try {
    const schoolData = {
      schoolName: 'Greenwood High School',
      email: 'admin@greenwood.edu',
      password: 'SecurePassword123!',
      address: '123 Education Lane, Learning City, LC 12345',
      phone: '+1-555-0123',
      principalName: 'Dr. Sarah Johnson',
      schoolType: 'public'
    };

    const school = new School(schoolData);
    await school.save();

    logger.info('School created successfully:');
    logger.info(`School ID: ${school.schoolId}`);
    logger.info(`Display Name: ${school.displayName}`);
    logger.info(`Verification Status: ${school.verificationStatus}`);
    
    return school;
  } catch (error) {
    logger.error('Error creating school:', error.message);
    throw error;
  }
}

/**
 * Example 2: School email verification workflow
 */
async function verifySchoolEmail(schoolId) {
  try {
    // Find the school
    const school = await School.findBySchoolId(schoolId);
    if (!school) {
      throw new Error('School not found');
    }

    // Generate OTP for email verification
    const otp = school.generateVerificationOTP();
    await school.save();

    logger.info(`OTP generated for ${school.email}: ${otp}`);
    logger.info(`OTP expires at: ${school.otpExpires}`);

    // Simulate email verification
    const userEnteredOTP = otp; // In real app, this comes from user input
    
    if (school.verifyOTP(userEnteredOTP)) {
      await school.completeVerification();
      logger.info('Email verification completed successfully!');
      logger.info(`School ${school.schoolName} is now verified`);
    } else {
      logger.info('Invalid or expired OTP');
    }

    return school;
  } catch (error) {
    logger.error('Error in email verification:', error.message);
    throw error;
  }
}

/**
 * Example 3: School login authentication (Requirement 2.1)
 * Schools must login with schoolId, email, and password
 */
async function authenticateSchool(schoolId, email, password) {
  try {
    // Find school by both schoolId and email, include password field
    const school = await School.findOne({ 
      schoolId, 
      email 
    }).select('+password');
    
    if (!school) {
      throw new Error('Invalid schoolId or email');
    }

    // Check if school is active and verified
    if (!school.isActive) {
      throw new Error('School account is deactivated');
    }

    if (!school.isVerified) {
      throw new Error('School email not verified');
    }

    // Compare password
    const isPasswordValid = await school.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    logger.info(`Authentication successful for ${school.schoolName}`);
    logger.info(`School ID: ${school.schoolId}`);
    logger.info(`Email: ${school.email}`);
    
    // Return school without sensitive data
    return school.toJSON();
  } catch (error) {
    logger.error('Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Example 4: Password reset workflow
 */
async function resetSchoolPassword(email) {
  try {
    // Find school by email
    const school = await School.findOne({ email });
    if (!school) {
      throw new Error('School not found');
    }

    // Generate password reset token
    const resetToken = school.generatePasswordResetToken();
    await school.save();

    logger.info(`Password reset token generated for ${school.email}`);
    logger.info(`Reset token: ${resetToken}`);
    logger.info(`Token expires at: ${school.passwordResetExpires}`);

    // Simulate password reset
    const newPassword = 'NewSecurePassword123!';
    
    if (school.verifyPasswordResetToken(resetToken)) {
      await school.resetPassword(newPassword);
      logger.info('Password reset completed successfully!');
    } else {
      logger.info('Invalid or expired reset token');
    }

    return school;
  } catch (error) {
    logger.error('Error in password reset:', error.message);
    throw error;
  }
}

/**
 * Example 5: School management operations
 */
async function manageSchool(schoolId) {
  try {
    const school = await School.findBySchoolId(schoolId);
    if (!school) {
      throw new Error('School not found');
    }

    logger.info('School Information:');
    logger.info(`Name: ${school.schoolName}`);
    logger.info(`Email: ${school.email}`);
    logger.info(`School ID: ${school.schoolId}`);
    logger.info(`Type: ${school.schoolType}`);
    logger.info(`Principal: ${school.principalName}`);
    logger.info(`Verified: ${school.isVerified}`);
    logger.info(`Active: ${school.isActive}`);
    logger.info(`Created: ${school.createdAt}`);

    // Update school information
    school.principalName = 'Dr. Michael Brown';
    school.phone = '+1-555-0456';
    await school.save();

    logger.info('School information updated successfully');

    // Deactivate school
    await school.setActiveStatus(false);
    logger.info('School deactivated');

    // Reactivate school
    await school.setActiveStatus(true);
    logger.info('School reactivated');

    return school;
  } catch (error) {
    logger.error('Error managing school:', error.message);
    throw error;
  }
}

/**
 * Example 6: Query schools with different filters
 */
async function querySchools() {
  try {
    // Find all verified schools
    const verifiedSchools = await School.findVerified();
    logger.info(`Found ${verifiedSchools.length} verified schools`);

    // Find schools pending verification
    const pendingSchools = await School.findPendingVerification();
    logger.info(`Found ${pendingSchools.length} schools pending verification`);

    // Find schools by type
    const publicSchools = await School.find({ 
      schoolType: 'public', 
      isActive: true 
    });
    logger.info(`Found ${publicSchools.length} public schools`);

    // Find schools created in the last 30 days
    const recentSchools = await School.find({
      createdAt: { 
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
      },
      isActive: true
    });
    logger.info(`Found ${recentSchools.length} schools created in the last 30 days`);

    return {
      verified: verifiedSchools,
      pending: pendingSchools,
      public: publicSchools,
      recent: recentSchools
    };
  } catch (error) {
    logger.error('Error querying schools:', error.message);
    throw error;
  }
}

/**
 * Example 7: Error handling and validation
 */
async function handleSchoolErrors() {
  try {
    // Attempt to create school with invalid data
    const invalidSchool = new School({
      schoolName: 'A', // Too short
      email: 'invalid-email', // Invalid format
      password: '123', // Too short
      phone: 'invalid-phone', // Invalid format
      schoolType: 'invalid-type' // Invalid enum value
    });

    await invalidSchool.save();
  } catch (error) {
    logger.info('Validation errors caught:');
    
    if (error.name === 'ValidationError') {
      Object.keys(error.errors).forEach(field => {
        logger.info(`${field}: ${error.errors[field].message}`);
      });
    } else {
      logger.info('Other error:', error.message);
    }
  }

  try {
    // Attempt to create school with duplicate email
    const school1 = new School({
      schoolName: 'First School',
      email: 'duplicate@test.com',
      password: 'Password123!'
    });
    await school1.save();

    const school2 = new School({
      schoolName: 'Second School',
      email: 'duplicate@test.com', // Duplicate email
      password: 'Password123!'
    });
    await school2.save();
  } catch (error) {
    logger.info('Duplicate email error:', error.message);
  }
}

/**
 * Example usage function
 */
async function runExamples() {
  try {
    logger.info('=== School Model Usage Examples ===\n');

    // Example 1: Create school
    logger.info('1. Creating a new school...');
    const school = await createSchool();
    logger.info('');

    // Example 2: Email verification
    logger.info('2. Email verification workflow...');
    await verifySchoolEmail(school.schoolId);
    logger.info('');

    // Example 3: Authentication
    logger.info('3. School authentication...');
    await authenticateSchool(school.schoolId, school.email, 'SecurePassword123!');
    logger.info('');

    // Example 4: Password reset
    logger.info('4. Password reset workflow...');
    await resetSchoolPassword(school.email);
    logger.info('');

    // Example 5: School management
    logger.info('5. School management operations...');
    await manageSchool(school.schoolId);
    logger.info('');

    // Example 6: Query schools
    logger.info('6. Querying schools...');
    await querySchools();
    logger.info('');

    // Example 7: Error handling
    logger.info('7. Error handling examples...');
    await handleSchoolErrors();
    logger.info('');

    logger.info('=== All examples completed ===');
  } catch (error) {
    logger.error('Error running examples:', error);
  }
}

// Export functions for use in other modules
module.exports = {
  createSchool,
  verifySchoolEmail,
  authenticateSchool,
  resetSchoolPassword,
  manageSchool,
  querySchools,
  handleSchoolErrors,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}
/**
 * School Model Usage Examples
 * This file demonstrates how to use the School model in various scenarios
 */

const School = require('../School');

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

    console.log('School created successfully:');
    console.log(`School ID: ${school.schoolId}`);
    console.log(`Display Name: ${school.displayName}`);
    console.log(`Verification Status: ${school.verificationStatus}`);
    
    return school;
  } catch (error) {
    console.error('Error creating school:', error.message);
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

    console.log(`OTP generated for ${school.email}: ${otp}`);
    console.log(`OTP expires at: ${school.otpExpires}`);

    // Simulate email verification
    const userEnteredOTP = otp; // In real app, this comes from user input
    
    if (school.verifyOTP(userEnteredOTP)) {
      await school.completeVerification();
      console.log('Email verification completed successfully!');
      console.log(`School ${school.schoolName} is now verified`);
    } else {
      console.log('Invalid or expired OTP');
    }

    return school;
  } catch (error) {
    console.error('Error in email verification:', error.message);
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

    console.log(`Authentication successful for ${school.schoolName}`);
    console.log(`School ID: ${school.schoolId}`);
    console.log(`Email: ${school.email}`);
    
    // Return school without sensitive data
    return school.toJSON();
  } catch (error) {
    console.error('Authentication failed:', error.message);
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

    console.log(`Password reset token generated for ${school.email}`);
    console.log(`Reset token: ${resetToken}`);
    console.log(`Token expires at: ${school.passwordResetExpires}`);

    // Simulate password reset
    const newPassword = 'NewSecurePassword123!';
    
    if (school.verifyPasswordResetToken(resetToken)) {
      await school.resetPassword(newPassword);
      console.log('Password reset completed successfully!');
    } else {
      console.log('Invalid or expired reset token');
    }

    return school;
  } catch (error) {
    console.error('Error in password reset:', error.message);
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

    console.log('School Information:');
    console.log(`Name: ${school.schoolName}`);
    console.log(`Email: ${school.email}`);
    console.log(`School ID: ${school.schoolId}`);
    console.log(`Type: ${school.schoolType}`);
    console.log(`Principal: ${school.principalName}`);
    console.log(`Verified: ${school.isVerified}`);
    console.log(`Active: ${school.isActive}`);
    console.log(`Created: ${school.createdAt}`);

    // Update school information
    school.principalName = 'Dr. Michael Brown';
    school.phone = '+1-555-0456';
    await school.save();

    console.log('School information updated successfully');

    // Deactivate school
    await school.setActiveStatus(false);
    console.log('School deactivated');

    // Reactivate school
    await school.setActiveStatus(true);
    console.log('School reactivated');

    return school;
  } catch (error) {
    console.error('Error managing school:', error.message);
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
    console.log(`Found ${verifiedSchools.length} verified schools`);

    // Find schools pending verification
    const pendingSchools = await School.findPendingVerification();
    console.log(`Found ${pendingSchools.length} schools pending verification`);

    // Find schools by type
    const publicSchools = await School.find({ 
      schoolType: 'public', 
      isActive: true 
    });
    console.log(`Found ${publicSchools.length} public schools`);

    // Find schools created in the last 30 days
    const recentSchools = await School.find({
      createdAt: { 
        $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
      },
      isActive: true
    });
    console.log(`Found ${recentSchools.length} schools created in the last 30 days`);

    return {
      verified: verifiedSchools,
      pending: pendingSchools,
      public: publicSchools,
      recent: recentSchools
    };
  } catch (error) {
    console.error('Error querying schools:', error.message);
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
    console.log('Validation errors caught:');
    
    if (error.name === 'ValidationError') {
      Object.keys(error.errors).forEach(field => {
        console.log(`${field}: ${error.errors[field].message}`);
      });
    } else {
      console.log('Other error:', error.message);
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
    console.log('Duplicate email error:', error.message);
  }
}

/**
 * Example usage function
 */
async function runExamples() {
  try {
    console.log('=== School Model Usage Examples ===\n');

    // Example 1: Create school
    console.log('1. Creating a new school...');
    const school = await createSchool();
    console.log('');

    // Example 2: Email verification
    console.log('2. Email verification workflow...');
    await verifySchoolEmail(school.schoolId);
    console.log('');

    // Example 3: Authentication
    console.log('3. School authentication...');
    await authenticateSchool(school.schoolId, school.email, 'SecurePassword123!');
    console.log('');

    // Example 4: Password reset
    console.log('4. Password reset workflow...');
    await resetSchoolPassword(school.email);
    console.log('');

    // Example 5: School management
    console.log('5. School management operations...');
    await manageSchool(school.schoolId);
    console.log('');

    // Example 6: Query schools
    console.log('6. Querying schools...');
    await querySchools();
    console.log('');

    // Example 7: Error handling
    console.log('7. Error handling examples...');
    await handleSchoolErrors();
    console.log('');

    console.log('=== All examples completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
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
/**
 * OTP Model Usage Examples
 * Demonstrates how to use the OTP model for email verification workflows
 */

const mongoose = require('mongoose');
const OTP = require('../OTP');

async function otpExamples() {
  try {
    // Connect to MongoDB (in real app, this would be done in app startup)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/educonnect-test');

    console.log('=== OTP Model Usage Examples ===\n');

    // Example 1: Generate OTP
    console.log('1. Generating OTPs:');
    const otp6 = OTP.generateOTP(); // Default 6 digits
    const otp4 = OTP.generateOTP(4); // Custom 4 digits
    console.log('Generated OTPs:', {
      sixDigit: otp6,
      fourDigit: otp4,
      sixDigitType: typeof otp6,
      fourDigitType: typeof otp4
    });

    // Example 2: Create OTP for School Signup
    console.log('\n2. Creating OTP for School Signup:');
    const schoolSignupResult = await OTP.createOTP({
      email: 'school@example.com',
      purpose: 'school-signup',
      schoolId: 'SCH001',
      expirationMinutes: 10,
      createdFromIP: '192.168.1.1',
      metadata: { 
        schoolName: 'Example High School',
        adminName: 'John Admin'
      }
    });

    console.log('School signup OTP created:', {
      email: schoolSignupResult.otpDocument.email,
      purpose: schoolSignupResult.otpDocument.purpose,
      plainOTP: schoolSignupResult.plainOTP,
      expiresAt: schoolSignupResult.expiresAt,
      timeRemaining: schoolSignupResult.otpDocument.timeRemaining
    });

    // Example 3: Create OTP for Password Reset
    console.log('\n3. Creating OTP for Password Reset:');
    const passwordResetResult = await OTP.createOTP({
      email: 'user@example.com',
      purpose: 'password-reset',
      userId: new mongoose.Types.ObjectId(),
      expirationMinutes: 15,
      maxAttempts: 5,
      createdFromIP: '192.168.1.2'
    });

    console.log('Password reset OTP created:', {
      email: passwordResetResult.otpDocument.email,
      purpose: passwordResetResult.otpDocument.purpose,
      plainOTP: passwordResetResult.plainOTP,
      maxAttempts: passwordResetResult.otpDocument.maxAttempts,
      statusDisplay: passwordResetResult.otpDocument.statusDisplay
    });

    // Example 4: Verify OTP (Correct)
    console.log('\n4. Verifying OTP (Correct):');
    const correctVerification = await OTP.verifyAndConsumeOTP(
      'school@example.com',
      schoolSignupResult.plainOTP,
      'school-signup',
      'SCH001',
      '192.168.1.1'
    );
    console.log('Correct OTP verification:', correctVerification);

    // Example 5: Verify OTP (Incorrect)
    console.log('\n5. Verifying OTP (Incorrect):');
    const incorrectVerification = await OTP.verifyAndConsumeOTP(
      'user@example.com',
      '999999', // Wrong OTP
      'password-reset',
      null,
      '192.168.1.2'
    );
    console.log('Incorrect OTP verification:', incorrectVerification);

    // Example 6: Find Valid OTP
    console.log('\n6. Finding Valid OTP:');
    const validOTP = await OTP.findValidOTP('user@example.com', 'password-reset');
    if (validOTP) {
      console.log('Found valid OTP:', {
        email: validOTP.email,
        purpose: validOTP.purpose,
        attemptCount: validOTP.attemptCount,
        maxAttempts: validOTP.maxAttempts,
        isValid: validOTP.isValid(),
        timeRemaining: validOTP.timeRemaining
      });
    }

    // Example 7: Create OTP for Email Verification
    console.log('\n7. Creating OTP for Email Verification:');
    const emailVerificationResult = await OTP.createOTP({
      email: 'newuser@example.com',
      purpose: 'email-verification',
      expirationMinutes: 5,
      createdFromIP: '192.168.1.3'
    });

    console.log('Email verification OTP created:', {
      email: emailVerificationResult.otpDocument.email,
      plainOTP: emailVerificationResult.plainOTP,
      timeRemaining: emailVerificationResult.otpDocument.timeRemaining
    });

    // Example 8: Manual OTP Verification (Instance Method)
    console.log('\n8. Manual OTP Verification:');
    const manualOTP = await OTP.findValidOTP('newuser@example.com', 'email-verification');
    if (manualOTP) {
      // Try wrong OTP first
      const wrongResult = manualOTP.verifyOTP('123456');
      console.log('Wrong OTP result:', wrongResult);
      console.log('Attempt count after wrong:', manualOTP.attemptCount);

      // Try correct OTP
      const correctResult = manualOTP.verifyOTP(emailVerificationResult.plainOTP);
      console.log('Correct OTP result:', correctResult);
      console.log('OTP status after correct:', {
        isUsed: manualOTP.isUsed,
        usedAt: manualOTP.usedAt,
        statusDisplay: manualOTP.statusDisplay
      });

      await manualOTP.save();
    }

    // Example 9: Invalidate OTPs
    console.log('\n9. Invalidating OTPs:');
    // Create multiple OTPs for same email/purpose
    await OTP.createOTP({
      email: 'test@example.com',
      purpose: 'password-reset',
      expirationMinutes: 10
    });
    await OTP.createOTP({
      email: 'test@example.com',
      purpose: 'password-reset',
      expirationMinutes: 10
    });

    const invalidatedCount = await OTP.invalidateOTPs('test@example.com', 'password-reset');
    console.log(`Invalidated ${invalidatedCount} OTPs for test@example.com`);

    // Example 10: Get OTP Statistics
    console.log('\n10. Getting OTP Statistics:');
    const stats = await OTP.getStatistics();
    console.log('OTP statistics:', stats);

    // Example 11: Get School-Specific Statistics
    console.log('\n11. Getting School-Specific Statistics:');
    const schoolStats = await OTP.getStatistics('SCH001');
    console.log('School SCH001 OTP statistics:', schoolStats);

    // Example 12: Cleanup Expired OTPs
    console.log('\n12. Cleaning up Expired OTPs:');
    const cleanedCount = await OTP.cleanupExpired();
    console.log(`Cleaned up ${cleanedCount} expired OTPs`);

    // Example 13: Create Account Activation OTP
    console.log('\n13. Creating Account Activation OTP:');
    const activationResult = await OTP.createOTP({
      email: 'activate@example.com',
      purpose: 'account-activation',
      userId: new mongoose.Types.ObjectId(),
      expirationMinutes: 30,
      metadata: {
        activationType: 'teacher',
        schoolId: 'SCH002'
      }
    });

    console.log('Account activation OTP created:', {
      email: activationResult.otpDocument.email,
      purpose: activationResult.otpDocument.purpose,
      plainOTP: activationResult.plainOTP,
      metadata: activationResult.otpDocument.metadata
    });

    console.log('\n=== All Examples Completed Successfully ===');

  } catch (error) {
    console.error('Error in OTP examples:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  otpExamples();
}

module.exports = otpExamples;
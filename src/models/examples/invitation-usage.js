/**
 * Invitation Model Usage Examples
 * Demonstrates how to use the Invitation model for teacher and parent invitations
 */

const mongoose = require('mongoose');
const Invitation = require('../Invitation');

async function invitationExamples() {
  try {
    // Connect to MongoDB (in real app, this would be done in app startup)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/educonnect-test');

    console.log('=== Invitation Model Usage Examples ===\n');

    // Example 1: Create Teacher Invitation
    console.log('1. Creating Teacher Invitation:');
    const teacherInvitation = new Invitation({
      schoolId: 'SCH001',
      email: 'john.doe@email.com',
      role: 'teacher',
      invitedBy: new mongoose.Types.ObjectId(),
      subjects: ['Mathematics', 'Physics'],
      classes: ['Grade 10A', 'Grade 11B'],
      firstName: 'John',
      lastName: 'Doe',
      message: 'Welcome to our school! We are excited to have you join our teaching staff.',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
    });

    await teacherInvitation.save();
    console.log('Teacher invitation created:', {
      id: teacherInvitation._id,
      email: teacherInvitation.email,
      role: teacherInvitation.role,
      token: teacherInvitation.token,
      status: teacherInvitation.status,
      subjects: teacherInvitation.subjects,
      timeRemaining: teacherInvitation.timeRemaining
    });

    // Example 2: Create Parent Invitation
    console.log('\n2. Creating Parent Invitation:');
    const parentInvitation = new Invitation({
      schoolId: 'SCH001',
      email: 'jane.smith@email.com',
      role: 'parent',
      invitedBy: new mongoose.Types.ObjectId(),
      studentIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      firstName: 'Jane',
      lastName: 'Smith',
      message: 'Your children are enrolled in our school. Please join our parent portal.',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    });

    await parentInvitation.save();
    console.log('Parent invitation created:', {
      id: parentInvitation._id,
      email: parentInvitation.email,
      role: parentInvitation.role,
      token: parentInvitation.token,
      studentIds: parentInvitation.studentIds,
      displayName: parentInvitation.displayName
    });

    // Example 3: Find Invitation by Token
    console.log('\n3. Finding Invitation by Token:');
    const foundInvitation = await Invitation.findByToken(teacherInvitation.token);
    console.log('Found invitation:', {
      email: foundInvitation.email,
      role: foundInvitation.role,
      isValid: foundInvitation.isValid(),
      statusDisplay: foundInvitation.statusDisplay
    });

    // Example 4: Accept Invitation
    console.log('\n4. Accepting Invitation:');
    const acceptedBy = new mongoose.Types.ObjectId();
    await foundInvitation.accept(acceptedBy);
    console.log('Invitation accepted:', {
      status: foundInvitation.status,
      acceptedAt: foundInvitation.acceptedAt,
      acceptedBy: foundInvitation.acceptedBy
    });

    // Example 5: Resend Invitation
    console.log('\n5. Resending Parent Invitation:');
    await parentInvitation.resend(48); // 48 hours
    console.log('Invitation resent:', {
      resendCount: parentInvitation.resendCount,
      lastResendAt: parentInvitation.lastResendAt,
      newExpiresAt: parentInvitation.expiresAt,
      timeRemaining: parentInvitation.timeRemaining
    });

    // Example 6: Cancel Invitation
    console.log('\n6. Cancelling Invitation:');
    const newInvitation = new Invitation({
      schoolId: 'SCH001',
      email: 'test@email.com',
      role: 'teacher',
      invitedBy: new mongoose.Types.ObjectId(),
      subjects: ['English'],
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
    });
    await newInvitation.save();

    const cancelledBy = new mongoose.Types.ObjectId();
    await newInvitation.cancel(cancelledBy, 'Position no longer available');
    console.log('Invitation cancelled:', {
      status: newInvitation.status,
      cancelledAt: newInvitation.cancelledAt,
      cancellationReason: newInvitation.cancellationReason
    });

    // Example 7: Find Invitations by School and Status
    console.log('\n7. Finding School Invitations:');
    const schoolInvitations = await Invitation.findBySchoolAndStatus('SCH001', 'pending');
    console.log(`Found ${schoolInvitations.length} pending invitations for school SCH001`);

    // Example 8: Get School Statistics
    console.log('\n8. Getting School Statistics:');
    const stats = await Invitation.getSchoolStatistics('SCH001');
    console.log('School invitation statistics:', stats);

    // Example 9: Expire Old Invitations
    console.log('\n9. Expiring Old Invitations:');
    const expiredCount = await Invitation.expireOldInvitations();
    console.log(`Expired ${expiredCount} old invitations`);

    // Example 10: Find Invitations by Email and School
    console.log('\n10. Finding Invitations by Email:');
    const emailInvitations = await Invitation.findByEmailAndSchool('jane.smith@email.com', 'SCH001');
    console.log(`Found ${emailInvitations.length} invitations for jane.smith@email.com`);

    console.log('\n=== All Examples Completed Successfully ===');

  } catch (error) {
    console.error('Error in invitation examples:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  invitationExamples();
}

module.exports = invitationExamples;
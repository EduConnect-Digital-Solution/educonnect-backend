/**
 * User Model Usage Examples
 * This file demonstrates how to use the User model for different roles
 */

const User = require('../User');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

/**
 * Example 1: Create admin user (automatically created during school registration)
 */
async function createAdminUser(schoolId, adminData) {
  try {
    const adminUser = new User({
      schoolId,
      email: adminData.email,
      password: adminData.password,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      role: 'admin',
      phone: adminData.phone,
      isVerified: true // Admin is verified during school registration
    });

    await adminUser.save();

    logger.info('Admin user created successfully:');
    logger.info(`Name: ${adminUser.fullName}`);
    logger.info(`Role: ${adminUser.role}`);
    logger.info(`School Admin: ${adminUser.isSchoolAdmin}`);
    logger.info(`Display Name: ${adminUser.displayName}`);
    
    return adminUser;
  } catch (error) {
    logger.error('Error creating admin user:', error.message);
    throw error;
  }
}

/**
 * Example 2: Teacher invitation workflow (Requirement 3.4)
 */
async function inviteTeacher(schoolId, inviterUserId, teacherData) {
  try {
    // Create teacher user with invitation token
    const teacher = new User({
      schoolId,
      email: teacherData.email,
      password: 'temporary_password', // Will be set during invitation acceptance
      firstName: teacherData.firstName || 'Pending',
      lastName: teacherData.lastName || 'Teacher',
      role: 'teacher',
      employeeId: teacherData.employeeId,
      subjects: teacherData.subjects,
      classes: teacherData.classes || [],
      invitedBy: inviterUserId,
      invitedAt: new Date()
    });

    // Generate invitation token (72 hours expiry)
    const invitationToken = teacher.generateInvitationToken(72);
    await teacher.save();

    logger.info('Teacher invitation created:');
    logger.info(`Email: ${teacher.email}`);
    logger.info(`Invitation Token: ${invitationToken}`);
    logger.info(`Expires: ${teacher.invitationExpires}`);
    logger.info(`Status: ${teacher.invitationStatus}`);
    logger.info(`Subjects: ${teacher.subjects.join(', ')}`);

    return { teacher, invitationToken };
  } catch (error) {
    logger.error('Error inviting teacher:', error.message);
    throw error;
  }
}

/**
 * Example 3: Accept teacher invitation (Requirement 3.4)
 */
async function acceptTeacherInvitation(invitationToken, userData) {
  try {
    // Find user by invitation token
    const teacher = await User.findByInvitationToken(invitationToken);
    if (!teacher) {
      throw new Error('Invalid or expired invitation token');
    }

    // Verify the token
    if (!teacher.verifyInvitationToken(invitationToken)) {
      throw new Error('Invalid or expired invitation token');
    }

    // Accept invitation with user data
    await teacher.acceptInvitation({
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: userData.password,
      phone: userData.phone
    });

    logger.info('Teacher invitation accepted successfully:');
    logger.info(`Name: ${teacher.fullName}`);
    logger.info(`Email: ${teacher.email}`);
    logger.info(`Verified: ${teacher.isVerified}`);
    logger.info(`Status: ${teacher.invitationStatus}`);

    return teacher;
  } catch (error) {
    logger.error('Error accepting teacher invitation:', error.message);
    throw error;
  }
}

/**
 * Example 4: Parent invitation with student linking (Requirement 4.2)
 */
async function inviteParent(schoolId, inviterUserId, parentData, studentIds) {
  try {
    // Create parent user with invitation token
    const parent = new User({
      schoolId,
      email: parentData.email,
      password: 'temporary_password', // Will be set during invitation acceptance
      firstName: parentData.firstName || 'Pending',
      lastName: parentData.lastName || 'Parent',
      role: 'parent',
      children: studentIds, // Link to students immediately
      invitedBy: inviterUserId,
      invitedAt: new Date()
    });

    // Generate invitation token (72 hours expiry)
    const invitationToken = parent.generateInvitationToken(72);
    await parent.save();

    logger.info('Parent invitation created:');
    logger.info(`Email: ${parent.email}`);
    logger.info(`Invitation Token: ${invitationToken}`);
    logger.info(`Linked Students: ${parent.children.length}`);
    logger.info(`Status: ${parent.invitationStatus}`);

    return { parent, invitationToken };
  } catch (error) {
    logger.error('Error inviting parent:', error.message);
    throw error;
  }
}

/**
 * Example 5: User authentication (Requirement 2.1)
 */
async function authenticateUser(schoolId, email, password) {
  try {
    // Authenticate user with schoolId, email, and password
    const user = await User.authenticate(schoolId, email, password);

    logger.info('User authentication successful:');
    logger.info(`Name: ${user.firstName} ${user.lastName}`);
    logger.info(`Role: ${user.role}`);
    logger.info(`School ID: ${user.schoolId}`);
    logger.info(`Last Login: ${user.lastLogin}`);

    return user;
  } catch (error) {
    logger.error('Authentication failed:', error.message);
    throw error;
  }
}

/**
 * Example 6: Teacher class management (Requirement 6.3)
 */
async function manageTeacherClasses(teacherId) {
  try {
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher') {
      throw new Error('Teacher not found');
    }

    logger.info('Current teacher classes:', teacher.classes);

    // Add new classes
    await teacher.addClass('Grade 6A');
    await teacher.addClass('Grade 6B');
    logger.info('Added classes. New classes:', teacher.classes);

    // Remove a class
    await teacher.removeClass('Grade 6A');
    logger.info('Removed class. Final classes:', teacher.classes);

    return teacher;
  } catch (error) {
    logger.error('Error managing teacher classes:', error.message);
    throw error;
  }
}

/**
 * Example 7: Parent-student relationship management (Requirement 6.4)
 */
async function manageParentChildren(parentId) {
  try {
    const parent = await User.findById(parentId);
    if (!parent || parent.role !== 'parent') {
      throw new Error('Parent not found');
    }

    logger.info('Current linked children:', parent.children);

    // Add new child
    const newStudentId = new mongoose.Types.ObjectId();
    await parent.addChild(newStudentId);
    logger.info('Added child. New children:', parent.children);

    // Remove a child
    if (parent.children.length > 1) {
      await parent.removeChild(parent.children[0]);
      logger.info('Removed child. Final children:', parent.children);
    }

    return parent;
  } catch (error) {
    logger.error('Error managing parent children:', error.message);
    throw error;
  }
}

/**
 * Example 8: Password reset workflow
 */
async function resetUserPassword(email, schoolId) {
  try {
    // Find user by email and schoolId
    const user = await User.findOne({ email, schoolId });
    if (!user) {
      throw new Error('User not found');
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    logger.info(`Password reset token generated for ${user.fullName}`);
    logger.info(`Reset token: ${resetToken}`);
    logger.info(`Token expires: ${user.passwordResetExpires}`);

    // Simulate password reset
    const newPassword = 'NewSecurePassword123!';
    
    if (user.verifyPasswordResetToken(resetToken)) {
      await user.resetPassword(newPassword);
      logger.info('Password reset completed successfully!');
    } else {
      logger.info('Invalid or expired reset token');
    }

    return user;
  } catch (error) {
    logger.error('Error in password reset:', error.message);
    throw error;
  }
}

/**
 * Example 9: Query users by school and role
 */
async function queryUsersBySchoolAndRole(schoolId) {
  try {
    // Find all teachers in the school
    const teachers = await User.findTeachers(schoolId);
    logger.info(`Found ${teachers.length} teachers`);

    // Find all parents in the school
    const parents = await User.findParents(schoolId);
    logger.info(`Found ${parents.length} parents`);

    // Find all admins in the school
    const admins = await User.findAdmins(schoolId);
    logger.info(`Found ${admins.length} admins`);

    // Find users by specific role
    const allTeachers = await User.findBySchoolAndRole(schoolId, 'teacher');
    logger.info(`Total teachers: ${allTeachers.length}`);

    return {
      teachers,
      parents,
      admins,
      allTeachers
    };
  } catch (error) {
    logger.error('Error querying users:', error.message);
    throw error;
  }
}

/**
 * Example 10: User account management
 */
async function manageUserAccount(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User Information:');
    logger.info(`Name: ${user.fullName}`);
    logger.info(`Email: ${user.email}`);
    logger.info(`Role: ${user.role}`);
    logger.info(`School ID: ${user.schoolId}`);
    logger.info(`Active: ${user.isActive}`);
    logger.info(`Verified: ${user.isVerified}`);
    logger.info(`Last Login: ${user.lastLogin}`);

    // Update user information
    user.phone = '+1-555-0123';
    await user.save();
    logger.info('User phone updated');

    // Deactivate user
    await user.setActiveStatus(false);
    logger.info('User deactivated');

    // Reactivate user
    await user.setActiveStatus(true);
    logger.info('User reactivated');

    return user;
  } catch (error) {
    logger.error('Error managing user account:', error.message);
    throw error;
  }
}

/**
 * Example 11: Role-specific validation examples
 */
async function demonstrateRoleValidation() {
  try {
    logger.info('=== Role-Specific Validation Examples ===');

    // Valid teacher with subjects
    const validTeacher = new User({
      schoolId: 'ABC1234',
      email: 'teacher@school.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Teacher',
      role: 'teacher',
      subjects: ['Math', 'Science'],
      employeeId: 'EMP001'
    });
    
    logger.info('Valid teacher created:', validTeacher.displayName);

    // Valid parent with children
    const validParent = new User({
      schoolId: 'ABC1234',
      email: 'parent@school.com',
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Parent',
      role: 'parent',
      children: [new mongoose.Types.ObjectId()]
    });
    
    logger.info('Valid parent created:', validParent.displayName);

    // Try invalid combinations
    try {
      const invalidTeacher = new User({
        schoolId: 'ABC1234',
        email: 'invalid@school.com',
        password: 'Password123!',
        firstName: 'Invalid',
        lastName: 'Teacher',
        role: 'teacher'
        // Missing subjects - should fail validation
      });
      
      await invalidTeacher.validate();
    } catch (error) {
      logger.info('Validation error caught (expected):', error.message);
    }

    try {
      const invalidAdmin = new User({
        schoolId: 'ABC1234',
        email: 'admin@school.com',
        password: 'Password123!',
        firstName: 'Invalid',
        lastName: 'Admin',
        role: 'admin',
        subjects: ['Math'] // Admins cannot have subjects
      });
      
      await invalidAdmin.validate();
    } catch (error) {
      logger.info('Validation error caught (expected):', error.message);
    }

  } catch (error) {
    logger.error('Error in role validation demo:', error.message);
  }
}

/**
 * Example usage function
 */
async function runExamples() {
  try {
    logger.info('=== User Model Usage Examples ===\n');

    const schoolId = 'ABC1234';

    // Example 1: Create admin user
    logger.info('1. Creating admin user...');
    const admin = await createAdminUser(schoolId, {
      email: 'admin@testschool.com',
      password: 'AdminPassword123!',
      firstName: 'John',
      lastName: 'Admin',
      phone: '+1234567890'
    });
    logger.info('');

    // Example 2: Teacher invitation
    logger.info('2. Teacher invitation workflow...');
    const { teacher, invitationToken } = await inviteTeacher(schoolId, admin._id, {
      email: 'teacher@testschool.com',
      employeeId: 'EMP001',
      subjects: ['Mathematics', 'Physics'],
      classes: ['Grade 10A', 'Grade 11B']
    });
    logger.info('');

    // Example 3: Accept teacher invitation
    logger.info('3. Accepting teacher invitation...');
    await acceptTeacherInvitation(invitationToken, {
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'TeacherPassword123!',
      phone: '+1234567891'
    });
    logger.info('');

    // Example 4: Parent invitation
    logger.info('4. Parent invitation workflow...');
    const studentIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const { parent } = await inviteParent(schoolId, admin._id, {
      email: 'parent@testschool.com'
    }, studentIds);
    logger.info('');

    // Example 5: User authentication
    logger.info('5. User authentication...');
    await authenticateUser(schoolId, admin.email, 'AdminPassword123!');
    logger.info('');

    // Example 6: Query users
    logger.info('6. Querying users by role...');
    await queryUsersBySchoolAndRole(schoolId);
    logger.info('');

    // Example 7: Role validation
    logger.info('7. Role-specific validation...');
    await demonstrateRoleValidation();
    logger.info('');

    logger.info('=== All examples completed ===');
  } catch (error) {
    logger.error('Error running examples:', error);
  }
}

// Export functions for use in other modules
module.exports = {
  createAdminUser,
  inviteTeacher,
  acceptTeacherInvitation,
  inviteParent,
  authenticateUser,
  manageTeacherClasses,
  manageParentChildren,
  resetUserPassword,
  queryUsersBySchoolAndRole,
  manageUserAccount,
  demonstrateRoleValidation,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}
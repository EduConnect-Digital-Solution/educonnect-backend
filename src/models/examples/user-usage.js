/**
 * User Model Usage Examples
 * This file demonstrates how to use the User model for different roles
 */

const User = require('../User');
const mongoose = require('mongoose');

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

    console.log('Admin user created successfully:');
    console.log(`Name: ${adminUser.fullName}`);
    console.log(`Role: ${adminUser.role}`);
    console.log(`School Admin: ${adminUser.isSchoolAdmin}`);
    console.log(`Display Name: ${adminUser.displayName}`);
    
    return adminUser;
  } catch (error) {
    console.error('Error creating admin user:', error.message);
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

    console.log('Teacher invitation created:');
    console.log(`Email: ${teacher.email}`);
    console.log(`Invitation Token: ${invitationToken}`);
    console.log(`Expires: ${teacher.invitationExpires}`);
    console.log(`Status: ${teacher.invitationStatus}`);
    console.log(`Subjects: ${teacher.subjects.join(', ')}`);

    return { teacher, invitationToken };
  } catch (error) {
    console.error('Error inviting teacher:', error.message);
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

    console.log('Teacher invitation accepted successfully:');
    console.log(`Name: ${teacher.fullName}`);
    console.log(`Email: ${teacher.email}`);
    console.log(`Verified: ${teacher.isVerified}`);
    console.log(`Status: ${teacher.invitationStatus}`);

    return teacher;
  } catch (error) {
    console.error('Error accepting teacher invitation:', error.message);
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

    console.log('Parent invitation created:');
    console.log(`Email: ${parent.email}`);
    console.log(`Invitation Token: ${invitationToken}`);
    console.log(`Linked Students: ${parent.children.length}`);
    console.log(`Status: ${parent.invitationStatus}`);

    return { parent, invitationToken };
  } catch (error) {
    console.error('Error inviting parent:', error.message);
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

    console.log('User authentication successful:');
    console.log(`Name: ${user.firstName} ${user.lastName}`);
    console.log(`Role: ${user.role}`);
    console.log(`School ID: ${user.schoolId}`);
    console.log(`Last Login: ${user.lastLogin}`);

    return user;
  } catch (error) {
    console.error('Authentication failed:', error.message);
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

    console.log('Current teacher classes:', teacher.classes);

    // Add new classes
    await teacher.addClass('Grade 6A');
    await teacher.addClass('Grade 6B');
    console.log('Added classes. New classes:', teacher.classes);

    // Remove a class
    await teacher.removeClass('Grade 6A');
    console.log('Removed class. Final classes:', teacher.classes);

    return teacher;
  } catch (error) {
    console.error('Error managing teacher classes:', error.message);
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

    console.log('Current linked children:', parent.children);

    // Add new child
    const newStudentId = new mongoose.Types.ObjectId();
    await parent.addChild(newStudentId);
    console.log('Added child. New children:', parent.children);

    // Remove a child
    if (parent.children.length > 1) {
      await parent.removeChild(parent.children[0]);
      console.log('Removed child. Final children:', parent.children);
    }

    return parent;
  } catch (error) {
    console.error('Error managing parent children:', error.message);
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

    console.log(`Password reset token generated for ${user.fullName}`);
    console.log(`Reset token: ${resetToken}`);
    console.log(`Token expires: ${user.passwordResetExpires}`);

    // Simulate password reset
    const newPassword = 'NewSecurePassword123!';
    
    if (user.verifyPasswordResetToken(resetToken)) {
      await user.resetPassword(newPassword);
      console.log('Password reset completed successfully!');
    } else {
      console.log('Invalid or expired reset token');
    }

    return user;
  } catch (error) {
    console.error('Error in password reset:', error.message);
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
    console.log(`Found ${teachers.length} teachers`);

    // Find all parents in the school
    const parents = await User.findParents(schoolId);
    console.log(`Found ${parents.length} parents`);

    // Find all admins in the school
    const admins = await User.findAdmins(schoolId);
    console.log(`Found ${admins.length} admins`);

    // Find users by specific role
    const allTeachers = await User.findBySchoolAndRole(schoolId, 'teacher');
    console.log(`Total teachers: ${allTeachers.length}`);

    return {
      teachers,
      parents,
      admins,
      allTeachers
    };
  } catch (error) {
    console.error('Error querying users:', error.message);
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

    console.log('User Information:');
    console.log(`Name: ${user.fullName}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
    console.log(`School ID: ${user.schoolId}`);
    console.log(`Active: ${user.isActive}`);
    console.log(`Verified: ${user.isVerified}`);
    console.log(`Last Login: ${user.lastLogin}`);

    // Update user information
    user.phone = '+1-555-0123';
    await user.save();
    console.log('User phone updated');

    // Deactivate user
    await user.setActiveStatus(false);
    console.log('User deactivated');

    // Reactivate user
    await user.setActiveStatus(true);
    console.log('User reactivated');

    return user;
  } catch (error) {
    console.error('Error managing user account:', error.message);
    throw error;
  }
}

/**
 * Example 11: Role-specific validation examples
 */
async function demonstrateRoleValidation() {
  try {
    console.log('=== Role-Specific Validation Examples ===');

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
    
    console.log('Valid teacher created:', validTeacher.displayName);

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
    
    console.log('Valid parent created:', validParent.displayName);

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
      console.log('Validation error caught (expected):', error.message);
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
      console.log('Validation error caught (expected):', error.message);
    }

  } catch (error) {
    console.error('Error in role validation demo:', error.message);
  }
}

/**
 * Example usage function
 */
async function runExamples() {
  try {
    console.log('=== User Model Usage Examples ===\n');

    const schoolId = 'ABC1234';

    // Example 1: Create admin user
    console.log('1. Creating admin user...');
    const admin = await createAdminUser(schoolId, {
      email: 'admin@testschool.com',
      password: 'AdminPassword123!',
      firstName: 'John',
      lastName: 'Admin',
      phone: '+1234567890'
    });
    console.log('');

    // Example 2: Teacher invitation
    console.log('2. Teacher invitation workflow...');
    const { teacher, invitationToken } = await inviteTeacher(schoolId, admin._id, {
      email: 'teacher@testschool.com',
      employeeId: 'EMP001',
      subjects: ['Mathematics', 'Physics'],
      classes: ['Grade 10A', 'Grade 11B']
    });
    console.log('');

    // Example 3: Accept teacher invitation
    console.log('3. Accepting teacher invitation...');
    await acceptTeacherInvitation(invitationToken, {
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'TeacherPassword123!',
      phone: '+1234567891'
    });
    console.log('');

    // Example 4: Parent invitation
    console.log('4. Parent invitation workflow...');
    const studentIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const { parent } = await inviteParent(schoolId, admin._id, {
      email: 'parent@testschool.com'
    }, studentIds);
    console.log('');

    // Example 5: User authentication
    console.log('5. User authentication...');
    await authenticateUser(schoolId, admin.email, 'AdminPassword123!');
    console.log('');

    // Example 6: Query users
    console.log('6. Querying users by role...');
    await queryUsersBySchoolAndRole(schoolId);
    console.log('');

    // Example 7: Role validation
    console.log('7. Role-specific validation...');
    await demonstrateRoleValidation();
    console.log('');

    console.log('=== All examples completed ===');
  } catch (error) {
    console.error('Error running examples:', error);
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
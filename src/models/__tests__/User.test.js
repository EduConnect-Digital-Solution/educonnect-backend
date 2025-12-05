const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../User');

// Mock mongoose connection for testing
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(),
    connection: {
      readyState: 1
    }
  };
});

describe('User Model', () => {
  let adminData, teacherData, parentData;

  beforeEach(() => {
    adminData = {
      schoolId: 'ABC1234',
      email: 'admin@testschool.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Admin',
      role: 'admin',
      phone: '+1234567890'
    };

    teacherData = {
      schoolId: 'ABC1234',
      email: 'teacher@testschool.com',
      password: 'Password123!',
      firstName: 'Jane',
      lastName: 'Teacher',
      role: 'teacher',
      employeeId: 'EMP001',
      subjects: ['Math', 'Science'],
      classes: ['Grade 5A', 'Grade 5B']
    };

    parentData = {
      schoolId: 'ABC1234',
      email: 'parent@testschool.com',
      password: 'Password123!',
      firstName: 'Bob',
      lastName: 'Parent',
      role: 'parent',
      studentIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()]
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should create a valid admin user', () => {
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(user.role).toBe('admin');
      expect(user.isSchoolAdmin).toBe(true);
      expect(user.isActive).toBe(true);
      expect(user.isVerified).toBe(false);
    });

    test('should create a valid teacher user', () => {
      const user = new User(teacherData);
      const validationError = user.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(user.role).toBe('teacher');
      expect(user.isSchoolAdmin).toBe(false);
      expect(user.subjects).toEqual(['Math', 'Science']);
      expect(user.classes).toEqual(['Grade 5A', 'Grade 5B']);
    });

    test('should create a valid parent user', () => {
      const user = new User(parentData);
      const validationError = user.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(user.role).toBe('parent');
      expect(user.isSchoolAdmin).toBe(false);
      expect(user.studentIds).toHaveLength(2);
    });

    test('should require schoolId', () => {
      delete adminData.schoolId;
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.schoolId).toBeDefined();
      expect(validationError.errors.schoolId.message).toBe('School ID is required');
    });

    test('should require email', () => {
      delete adminData.email;
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Email is required');
    });

    test('should require password', () => {
      delete adminData.password;
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.password).toBeDefined();
      expect(validationError.errors.password.message).toBe('Password is required');
    });

    test('should require firstName', () => {
      delete adminData.firstName;
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.firstName).toBeDefined();
      expect(validationError.errors.firstName.message).toBe('First name is required');
    });

    test('should require lastName', () => {
      delete adminData.lastName;
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.lastName).toBeDefined();
      expect(validationError.errors.lastName.message).toBe('Last name is required');
    });

    test('should require role', () => {
      delete adminData.role;
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.role).toBeDefined();
      expect(validationError.errors.role.message).toBe('Role is required');
    });

    test('should validate role enum', () => {
      adminData.role = 'invalid-role';
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.role).toBeDefined();
      expect(validationError.errors.role.message).toBe('Role must be admin, teacher, or parent');
    });

    test('should validate email format', () => {
      adminData.email = 'invalid-email';
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Please enter a valid email');
    });

    test('should validate phone format', () => {
      adminData.phone = 'invalid-phone';
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.phone).toBeDefined();
      expect(validationError.errors.phone.message).toBe('Please enter a valid phone number');
    });

    test('should validate password length', () => {
      adminData.password = '1234567'; // Too short
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.password).toBeDefined();
      expect(validationError.errors.password.message).toBe('Password must be at least 8 characters');
    });

    test('should validate firstName length', () => {
      adminData.firstName = 'A'; // Too short
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.firstName).toBeDefined();
      expect(validationError.errors.firstName.message).toBe('First name must be at least 2 characters');
    });
  });

  describe('Role-Specific Validation', () => {
    test('should require subjects for teachers', () => {
      delete teacherData.subjects;
      const user = new User(teacherData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.subjects).toBeDefined();
      expect(validationError.errors.subjects.message).toBe('Teachers must have at least one subject, non-teachers cannot have subjects');
    });

    test('should not allow subjects for non-teachers', () => {
      adminData.subjects = ['Math'];
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.subjects).toBeDefined();
      expect(validationError.errors.subjects.message).toBe('Teachers must have at least one subject, non-teachers cannot have subjects');
    });

    test('should not allow classes for non-teachers', () => {
      adminData.classes = ['Grade 1A'];
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.classes).toBeDefined();
      expect(validationError.errors.classes.message).toBe('Only teachers can be assigned to classes');
    });

    test('should not allow children for non-parents', () => {
      adminData.children = [new mongoose.Types.ObjectId()];
      const user = new User(adminData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.children).toBeDefined();
      expect(validationError.errors.children.message).toBe('Only parents can have linked children');
    });

    test('should validate employeeId format for teachers', () => {
      teacherData.employeeId = 'invalid-id';
      const user = new User(teacherData);
      const validationError = user.validateSync();
      
      expect(validationError.errors.employeeId).toBeDefined();
      expect(validationError.errors.employeeId.message).toBe('Employee ID must be 3-20 alphanumeric characters');
    });
  });

  describe('Password Hashing', () => {
    test('should have password hashing functionality', () => {
      const user = new User(adminData);
      
      // Test that the model has the comparePassword method
      expect(typeof user.comparePassword).toBe('function');
      
      // Test that password field exists
      expect(user.password).toBe(adminData.password);
    });

    test('comparePassword should work with bcrypt', async () => {
      const user = new User(adminData);
      user.password = 'hashed_password';
      
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      
      const result = await user.comparePassword('test_password');
      
      expect(bcrypt.compare).toHaveBeenCalledWith('test_password', 'hashed_password');
      expect(result).toBe(true);
    });
  });

  describe('Instance Methods', () => {
    let user;

    beforeEach(() => {
      user = new User(adminData);
      user.password = 'hashed_password'; // Simulate hashed password
    });

    describe('comparePassword', () => {
      test('should compare password correctly', async () => {
        const candidatePassword = 'Password123!';
        jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
        
        const result = await user.comparePassword(candidatePassword);
        
        expect(bcrypt.compare).toHaveBeenCalledWith(candidatePassword, user.password);
        expect(result).toBe(true);
      });

      test('should throw error if password not available', async () => {
        user.password = undefined;
        
        await expect(user.comparePassword('test')).rejects.toThrow('Password not available for comparison');
      });
    });

    describe('generateInvitationToken', () => {
      test('should generate invitation token with default expiration', () => {
        const token = user.generateInvitationToken();
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes * 2 (hex)
        expect(user.invitationToken).toBeDefined();
        expect(user.invitationExpires).toBeDefined();
        expect(user.invitationExpires.getTime()).toBeGreaterThan(Date.now());
      });

      test('should generate invitation token with custom expiration', () => {
        const token = user.generateInvitationToken(24); // 24 hours
        
        expect(token).toBeDefined();
        expect(user.invitationExpires).toBeDefined();
        
        const expectedExpiry = Date.now() + (24 * 60 * 60 * 1000);
        const actualExpiry = user.invitationExpires.getTime();
        
        // Allow 1 second tolerance
        expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
      });
    });

    describe('verifyInvitationToken', () => {
      test('should verify correct invitation token', () => {
        const token = user.generateInvitationToken();
        const result = user.verifyInvitationToken(token);
        
        expect(result).toBe(true);
      });

      test('should reject incorrect invitation token', () => {
        user.generateInvitationToken();
        const result = user.verifyInvitationToken('invalid-token');
        
        expect(result).toBe(false);
      });

      test('should reject expired invitation token', () => {
        const token = user.generateInvitationToken();
        user.invitationExpires = new Date(Date.now() - 1000); // Expired
        
        const result = user.verifyInvitationToken(token);
        
        expect(result).toBe(false);
      });

      test('should return false if no invitation token set', () => {
        const result = user.verifyInvitationToken('some-token');
        
        expect(result).toBe(false);
      });
    });

    describe('acceptInvitation', () => {
      test('should accept invitation and clear token data', async () => {
        user.generateInvitationToken();
        user.save = jest.fn().mockResolvedValue(user);
        
        const userData = {
          firstName: 'Updated',
          lastName: 'Name'
        };
        
        await user.acceptInvitation(userData);
        
        expect(user.firstName).toBe('Updated');
        expect(user.lastName).toBe('Name');
        expect(user.isVerified).toBe(true);
        expect(user.invitationToken).toBeUndefined();
        expect(user.invitationExpires).toBeUndefined();
        expect(user.save).toHaveBeenCalled();
      });
    });

    describe('generatePasswordResetToken', () => {
      test('should generate password reset token', () => {
        const token = user.generatePasswordResetToken();
        
        expect(token).toBeDefined();
        expect(typeof token).toBe('string');
        expect(token.length).toBe(64); // 32 bytes * 2 (hex)
        expect(user.passwordResetToken).toBeDefined();
        expect(user.passwordResetExpires).toBeDefined();
      });
    });

    describe('verifyPasswordResetToken', () => {
      test('should verify correct reset token', () => {
        const token = user.generatePasswordResetToken();
        const result = user.verifyPasswordResetToken(token);
        
        expect(result).toBe(true);
      });

      test('should reject incorrect reset token', () => {
        user.generatePasswordResetToken();
        const result = user.verifyPasswordResetToken('invalid-token');
        
        expect(result).toBe(false);
      });

      test('should reject expired reset token', () => {
        const token = user.generatePasswordResetToken();
        user.passwordResetExpires = new Date(Date.now() - 1000); // Expired
        
        const result = user.verifyPasswordResetToken(token);
        
        expect(result).toBe(false);
      });
    });

    describe('resetPassword', () => {
      test('should reset password and clear reset data', async () => {
        const newPassword = 'NewPassword123!';
        user.generatePasswordResetToken();
        user.save = jest.fn().mockResolvedValue(user);
        
        await user.resetPassword(newPassword);
        
        expect(user.password).toBe(newPassword);
        expect(user.passwordResetToken).toBeUndefined();
        expect(user.passwordResetExpires).toBeUndefined();
        expect(user.save).toHaveBeenCalled();
      });
    });

    describe('updateLastLogin', () => {
      test('should update last login timestamp', async () => {
        user.save = jest.fn().mockResolvedValue(user);
        
        await user.updateLastLogin();
        
        expect(user.lastLogin).toBeInstanceOf(Date);
        expect(user.save).toHaveBeenCalled();
      });
    });

    describe('setActiveStatus', () => {
      test('should set active status', async () => {
        user.save = jest.fn().mockResolvedValue(user);
        
        await user.setActiveStatus(false);
        
        expect(user.isActive).toBe(false);
        expect(user.save).toHaveBeenCalled();
      });
    });

    describe('addChild (Parent-specific)', () => {
      test('should add child to parent', async () => {
        const parent = new User(parentData);
        parent.save = jest.fn().mockResolvedValue(parent);
        const studentId = new mongoose.Types.ObjectId();
        
        await parent.addChild(studentId);
        
        expect(parent.children).toContain(studentId);
        expect(parent.save).toHaveBeenCalled();
      });

      test('should not add duplicate child', async () => {
        const parent = new User(parentData);
        parent.save = jest.fn().mockResolvedValue(parent);
        const studentId = parentData.studentIds[0];
        
        await parent.addChild(studentId);
        
        // Should still have only the original children
        expect(parent.studentIds).toHaveLength(2);
        expect(parent.save).toHaveBeenCalled();
      });

      test('should throw error for non-parent', () => {
        const studentId = new mongoose.Types.ObjectId();
        
        expect(() => user.addChild(studentId)).toThrow('Only parents can have children linked');
      });
    });

    describe('removeChild (Parent-specific)', () => {
      test('should remove child from parent', async () => {
        const parent = new User(parentData);
        parent.save = jest.fn().mockResolvedValue(parent);
        const studentId = parentData.studentIds[0];
        
        await parent.removeChild(studentId);
        
        expect(parent.studentIds).not.toContain(studentId);
        expect(parent.studentIds).toHaveLength(1);
        expect(parent.save).toHaveBeenCalled();
      });

      test('should throw error for non-parent', () => {
        const studentId = new mongoose.Types.ObjectId();
        
        expect(() => user.removeChild(studentId)).toThrow('Only parents can have children unlinked');
      });
    });

    describe('addClass (Teacher-specific)', () => {
      test('should add class to teacher', async () => {
        const teacher = new User(teacherData);
        teacher.save = jest.fn().mockResolvedValue(teacher);
        const className = 'Grade 6A';
        
        await teacher.addClass(className);
        
        expect(teacher.classes).toContain(className);
        expect(teacher.save).toHaveBeenCalled();
      });

      test('should not add duplicate class', async () => {
        const teacher = new User(teacherData);
        teacher.save = jest.fn().mockResolvedValue(teacher);
        const className = teacherData.classes[0];
        
        await teacher.addClass(className);
        
        // Should still have only the original classes
        expect(teacher.classes).toHaveLength(2);
        expect(teacher.save).toHaveBeenCalled();
      });

      test('should throw error for non-teacher', () => {
        const className = 'Grade 1A';
        
        expect(() => user.addClass(className)).toThrow('Only teachers can be assigned to classes');
      });
    });

    describe('removeClass (Teacher-specific)', () => {
      test('should remove class from teacher', async () => {
        const teacher = new User(teacherData);
        teacher.save = jest.fn().mockResolvedValue(teacher);
        const className = teacherData.classes[0];
        
        await teacher.removeClass(className);
        
        expect(teacher.classes).not.toContain(className);
        expect(teacher.classes).toHaveLength(1);
        expect(teacher.save).toHaveBeenCalled();
      });

      test('should throw error for non-teacher', () => {
        const className = 'Grade 1A';
        
        expect(() => user.removeClass(className)).toThrow('Only teachers can be unassigned from classes');
      });
    });
  });

  describe('Static Methods', () => {
    describe('authenticate', () => {
      test('should authenticate user with valid credentials', async () => {
        const mockUser = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: true,
          isVerified: true,
          comparePassword: jest.fn().mockResolvedValue(true),
          updateLastLogin: jest.fn().mockResolvedValue(),
          toJSON: jest.fn().mockReturnValue({ schoolId: 'ABC1234', firstName: 'Test', lastName: 'User' })
        };

        User.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });

        const result = await User.authenticate('ABC1234', 'test@school.com', 'password123');

        expect(User.findOne).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          email: 'test@school.com'
        });
        expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
        expect(mockUser.updateLastLogin).toHaveBeenCalled();
        expect(result).toEqual({ schoolId: 'ABC1234', firstName: 'Test', lastName: 'User' });
      });

      test('should reject authentication with invalid credentials', async () => {
        User.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(null)
        });

        await expect(
          User.authenticate('INVALID', 'test@school.com', 'password123')
        ).rejects.toThrow('Invalid schoolId or email');
      });

      test('should reject authentication for inactive user', async () => {
        const mockUser = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: false,
          isVerified: true
        };

        User.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });

        await expect(
          User.authenticate('ABC1234', 'test@school.com', 'password123')
        ).rejects.toThrow('User account is deactivated');
      });

      test('should reject authentication for unverified user', async () => {
        const mockUser = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: true,
          isVerified: false
        };

        User.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });

        await expect(
          User.authenticate('ABC1234', 'test@school.com', 'password123')
        ).rejects.toThrow('User account not verified');
      });

      test('should reject authentication with invalid password', async () => {
        const mockUser = {
          schoolId: 'ABC1234',
          email: 'test@school.com',
          isActive: true,
          isVerified: true,
          comparePassword: jest.fn().mockResolvedValue(false)
        };

        User.findOne = jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue(mockUser)
        });

        await expect(
          User.authenticate('ABC1234', 'test@school.com', 'wrongpassword')
        ).rejects.toThrow('Invalid password');
      });
    });

    describe('findBySchoolAndRole', () => {
      test('should find users by school and role', () => {
        User.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        User.findBySchoolAndRole('ABC1234', 'teacher');
        
        expect(User.find).toHaveBeenCalledWith({ schoolId: 'ABC1234', role: 'teacher', isActive: true });
      });
    });

    describe('findTeachers', () => {
      test('should find teachers by school', () => {
        User.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        User.findTeachers('ABC1234');
        
        expect(User.find).toHaveBeenCalledWith({ schoolId: 'ABC1234', role: 'teacher', isActive: true });
      });
    });

    describe('findParents', () => {
      test('should find parents by school', () => {
        User.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        User.findParents('ABC1234');
        
        expect(User.find).toHaveBeenCalledWith({ schoolId: 'ABC1234', role: 'parent', isActive: true });
      });
    });

    describe('findAdmins', () => {
      test('should find admins by school', () => {
        User.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        User.findAdmins('ABC1234');
        
        expect(User.find).toHaveBeenCalledWith({ schoolId: 'ABC1234', role: 'admin', isActive: true });
      });
    });

    describe('findByInvitationToken', () => {
      test('should find user by valid invitation token', async () => {
        const mockUser = { firstName: 'Test', lastName: 'User' };
        User.findOne = jest.fn().mockResolvedValue(mockUser);
        
        const result = await User.findByInvitationToken('test-token');
        
        expect(User.findOne).toHaveBeenCalledWith({
          invitationToken: expect.any(String),
          invitationExpires: { $gt: expect.any(Number) }
        });
        expect(result).toBe(mockUser);
      });
    });
  });

  describe('Virtual Properties', () => {
    test('should generate fullName virtual', () => {
      const user = new User(adminData);
      
      expect(user.fullName).toBe('John Admin');
    });

    test('should generate displayName virtual', () => {
      const user = new User(adminData);
      
      expect(user.displayName).toBe('John Admin (admin)');
    });

    test('should generate invitationStatus virtual', () => {
      const user = new User(adminData);
      
      // No invitation token
      expect(user.invitationStatus).toBe('accepted');
      
      // Valid invitation token
      user.generateInvitationToken();
      expect(user.invitationStatus).toBe('pending');
      
      // Expired invitation token
      user.invitationExpires = new Date(Date.now() - 1000);
      expect(user.invitationStatus).toBe('expired');
    });
  });

  describe('JSON Transformation', () => {
    test('should remove sensitive data from JSON output', () => {
      const user = new User(adminData);
      user.password = 'hashed_password';
      user.invitationToken = 'invitation_token';
      user.passwordResetToken = 'reset_token';
      
      const json = user.toJSON();
      
      expect(json.password).toBeUndefined();
      expect(json.invitationToken).toBeUndefined();
      expect(json.invitationExpires).toBeUndefined();
      expect(json.passwordResetToken).toBeUndefined();
      expect(json.passwordResetExpires).toBeUndefined();
      expect(json.__v).toBeUndefined();
      expect(json.firstName).toBe(adminData.firstName);
      expect(json.lastName).toBe(adminData.lastName);
    });
  });
});
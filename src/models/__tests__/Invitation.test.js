const mongoose = require('mongoose');
const Invitation = require('../Invitation');

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

describe('Invitation Model', () => {
  let teacherInvitationData, parentInvitationData;

  beforeEach(() => {
    teacherInvitationData = {
      schoolId: 'ABC1234',
      email: 'teacher@testschool.com',
      role: 'teacher',
      invitedBy: new mongoose.Types.ObjectId(),
      subjects: ['Math', 'Science'],
      classes: ['Grade 10A', 'Grade 10B'],
      firstName: 'Jane',
      lastName: 'Smith',
      message: 'Welcome to our school!',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
    };

    parentInvitationData = {
      schoolId: 'ABC1234',
      email: 'parent@testschool.com',
      role: 'parent',
      invitedBy: new mongoose.Types.ObjectId(),
      studentIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      firstName: 'Bob',
      lastName: 'Johnson',
      message: 'Your children are enrolled in our school.',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should create a valid teacher invitation', () => {
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(invitation.role).toBe('teacher');
      expect(invitation.subjects).toEqual(['Math', 'Science']);
      expect(invitation.classes).toEqual(['Grade 10A', 'Grade 10B']);
      expect(invitation.status).toBe('pending');
    });

    test('should create a valid parent invitation', () => {
      const invitation = new Invitation(parentInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(invitation.role).toBe('parent');
      expect(invitation.studentIds).toHaveLength(2);
      expect(invitation.status).toBe('pending');
    });

    test('should require schoolId', () => {
      delete teacherInvitationData.schoolId;
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.schoolId).toBeDefined();
      expect(validationError.errors.schoolId.message).toBe('School ID is required');
    });

    test('should require email', () => {
      delete teacherInvitationData.email;
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Email is required');
    });

    test('should require role', () => {
      delete teacherInvitationData.role;
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.role).toBeDefined();
      expect(validationError.errors.role.message).toBe('Role is required');
    });

    test('should require invitedBy', () => {
      delete teacherInvitationData.invitedBy;
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.invitedBy).toBeDefined();
      expect(validationError.errors.invitedBy.message).toBe('Invited by user is required');
    });

    test('should require expiresAt', () => {
      delete teacherInvitationData.expiresAt;
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.expiresAt).toBeDefined();
      expect(validationError.errors.expiresAt.message).toBe('Expiration date is required');
    });

    test('should validate email format', () => {
      teacherInvitationData.email = 'invalid-email';
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Please enter a valid email');
    });

    test('should validate role enum', () => {
      teacherInvitationData.role = 'invalid-role';
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.role).toBeDefined();
      expect(validationError.errors.role.message).toBe('Role must be teacher or parent');
    });

    test('should validate status enum', () => {
      teacherInvitationData.status = 'invalid-status';
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.status).toBeDefined();
      expect(validationError.errors.status.message).toBe('Status must be pending, accepted, expired, or cancelled');
    });
  });

  describe('Role-Specific Validation', () => {
    test('should require subjects for teacher invitations', () => {
      delete teacherInvitationData.subjects;
      const invitation = new Invitation(teacherInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.subjects).toBeDefined();
      expect(validationError.errors.subjects.message).toBe('Teacher invitations must include subjects, parent invitations must not');
    });

    test('should require studentIds for parent invitations', () => {
      const invalidData = { ...parentInvitationData };
      delete invalidData.studentIds;
      const invitation = new Invitation(invalidData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.studentIds).toBeDefined();
      expect(validationError.errors.studentIds.message).toBe('Parent invitations must include student IDs, teacher invitations must not');
    });

    test('should not allow subjects for parent invitations', () => {
      const invalidData = { ...parentInvitationData, subjects: ['Math'] };
      const invitation = new Invitation(invalidData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.subjects).toBeDefined();
      expect(validationError.errors.subjects.message).toBe('Teacher invitations must include subjects, parent invitations must not');
    });

    test('should not allow studentIds for teacher invitations', () => {
      const invalidData = { ...teacherInvitationData, studentIds: [new mongoose.Types.ObjectId()] };
      const invitation = new Invitation(invalidData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.studentIds).toBeDefined();
      expect(validationError.errors.studentIds.message).toBe('Parent invitations must include student IDs, teacher invitations must not');
    });

    test('should not allow classes for parent invitations', () => {
      parentInvitationData.classes = ['Grade 1A'];
      const invitation = new Invitation(parentInvitationData);
      const validationError = invitation.validateSync();
      
      expect(validationError.errors.classes).toBeDefined();
      expect(validationError.errors.classes.message).toBe('Only teacher invitations can include classes');
    });
  });

  describe('Token Generation', () => {
    test('should have token generation logic', () => {
      const invitation = new Invitation(teacherInvitationData);
      
      // Test that token field exists in schema
      expect(Invitation.schema.paths.token).toBeDefined();
      expect(Invitation.schema.paths.token.options.unique).toBe(true);
    });

    test('should preserve existing token', () => {
      const existingToken = 'existing-token-123';
      const invitation = new Invitation({ ...teacherInvitationData, token: existingToken });
      
      expect(invitation.token).toBe(existingToken);
    });
  });

  describe('Instance Methods', () => {
    let invitation;

    beforeEach(() => {
      invitation = new Invitation(teacherInvitationData);
      invitation.save = jest.fn().mockResolvedValue(invitation);
    });

    describe('isExpired', () => {
      test('should return false for non-expired invitation', () => {
        invitation.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        expect(invitation.isExpired()).toBe(false);
      });

      test('should return true for expired invitation', () => {
        invitation.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
        
        expect(invitation.isExpired()).toBe(true);
      });
    });

    describe('isValid', () => {
      test('should return true for valid pending invitation', () => {
        invitation.status = 'pending';
        invitation.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        expect(invitation.isValid()).toBe(true);
      });

      test('should return false for accepted invitation', () => {
        invitation.status = 'accepted';
        invitation.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        expect(invitation.isValid()).toBe(false);
      });

      test('should return false for expired invitation', () => {
        invitation.status = 'pending';
        invitation.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
        
        expect(invitation.isValid()).toBe(false);
      });
    });

    describe('accept', () => {
      test('should accept valid invitation', async () => {
        const acceptedBy = new mongoose.Types.ObjectId();
        invitation.status = 'pending';
        invitation.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        await invitation.accept(acceptedBy);
        
        expect(invitation.status).toBe('accepted');
        expect(invitation.acceptedBy).toBe(acceptedBy);
        expect(invitation.acceptedAt).toBeInstanceOf(Date);
        expect(invitation.save).toHaveBeenCalled();
      });

      test('should throw error for expired invitation', () => {
        const acceptedBy = new mongoose.Types.ObjectId();
        invitation.status = 'pending';
        invitation.expiresAt = new Date(Date.now() - 60000); // 1 minute ago
        
        expect(() => invitation.accept(acceptedBy)).toThrow('Invitation is not valid or has expired');
      });

      test('should throw error for already accepted invitation', () => {
        const acceptedBy = new mongoose.Types.ObjectId();
        invitation.status = 'accepted';
        invitation.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
        
        expect(() => invitation.accept(acceptedBy)).toThrow('Invitation is not valid or has expired');
      });
    });

    describe('cancel', () => {
      test('should cancel pending invitation', async () => {
        const cancelledBy = new mongoose.Types.ObjectId();
        const reason = 'No longer needed';
        invitation.status = 'pending';
        
        await invitation.cancel(cancelledBy, reason);
        
        expect(invitation.status).toBe('cancelled');
        expect(invitation.cancelledBy).toBe(cancelledBy);
        expect(invitation.cancellationReason).toBe(reason);
        expect(invitation.cancelledAt).toBeInstanceOf(Date);
        expect(invitation.save).toHaveBeenCalled();
      });

      test('should throw error for non-pending invitation', () => {
        const cancelledBy = new mongoose.Types.ObjectId();
        const reason = 'No longer needed';
        invitation.status = 'accepted';
        
        expect(() => invitation.cancel(cancelledBy, reason)).toThrow('Only pending invitations can be cancelled');
      });
    });

    describe('resend', () => {
      test('should resend pending invitation', async () => {
        invitation.status = 'pending';
        invitation.resendCount = 1;
        
        await invitation.resend(48); // 48 hours
        
        expect(invitation.status).toBe('pending');
        expect(invitation.resendCount).toBe(2);
        expect(invitation.lastResendAt).toBeInstanceOf(Date);
        expect(invitation.expiresAt.getTime()).toBeGreaterThan(Date.now());
        expect(invitation.save).toHaveBeenCalled();
      });

      test('should resend expired invitation', async () => {
        invitation.status = 'expired';
        invitation.resendCount = 0;
        
        await invitation.resend();
        
        expect(invitation.status).toBe('pending');
        expect(invitation.resendCount).toBe(1);
        expect(invitation.save).toHaveBeenCalled();
      });

      test('should throw error for accepted invitation', () => {
        invitation.status = 'accepted';
        
        expect(() => invitation.resend()).toThrow('Only pending or expired invitations can be resent');
      });
    });

    describe('extendExpiration', () => {
      test('should extend expiration for pending invitation', async () => {
        invitation.status = 'pending';
        const originalExpiry = invitation.expiresAt.getTime();
        
        await invitation.extendExpiration(24); // 24 hours
        
        expect(invitation.expiresAt.getTime()).toBe(originalExpiry + (24 * 60 * 60 * 1000));
        expect(invitation.save).toHaveBeenCalled();
      });

      test('should throw error for non-pending invitation', () => {
        invitation.status = 'accepted';
        
        expect(() => invitation.extendExpiration()).toThrow('Only pending invitations can be extended');
      });
    });
  });

  describe('Static Methods', () => {
    describe('findBySchoolAndStatus', () => {
      test('should find invitations by school and status', () => {
        Invitation.find = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(Promise.resolve([]))
        });
        
        Invitation.findBySchoolAndStatus('ABC1234', 'pending');
        
        expect(Invitation.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          status: 'pending'
        });
      });

      test('should find invitations by school without status filter', () => {
        Invitation.find = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue(Promise.resolve([]))
        });
        
        Invitation.findBySchoolAndStatus('ABC1234');
        
        expect(Invitation.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234'
        });
      });
    });

    describe('findPendingBySchool', () => {
      test('should find pending invitations by school', () => {
        Invitation.findBySchoolAndStatus = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Invitation.findPendingBySchool('ABC1234');
        
        expect(Invitation.findBySchoolAndStatus).toHaveBeenCalledWith('ABC1234', 'pending');
      });
    });

    describe('findExpiredBySchool', () => {
      test('should find expired invitations by school', () => {
        Invitation.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Invitation.findExpiredBySchool('ABC1234');
        
        expect(Invitation.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          status: 'pending',
          expiresAt: { $lt: expect.any(Date) }
        });
      });
    });

    describe('findByToken', () => {
      test('should find invitation by token', () => {
        Invitation.findOne = jest.fn().mockReturnValue(Promise.resolve({}));
        
        Invitation.findByToken('test-token');
        
        expect(Invitation.findOne).toHaveBeenCalledWith({ token: 'test-token' });
      });
    });

    describe('findByEmailAndSchool', () => {
      test('should find invitations by email and school', () => {
        Invitation.find = jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue(Promise.resolve([]))
        });
        
        Invitation.findByEmailAndSchool('test@example.com', 'ABC1234');
        
        expect(Invitation.find).toHaveBeenCalledWith({
          email: 'test@example.com',
          schoolId: 'ABC1234'
        });
      });
    });

    describe('expireOldInvitations', () => {
      test('should expire old invitations', async () => {
        Invitation.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 5 });
        
        const result = await Invitation.expireOldInvitations();
        
        expect(Invitation.updateMany).toHaveBeenCalledWith(
          {
            status: 'pending',
            expiresAt: { $lt: expect.any(Date) }
          },
          {
            $set: { status: 'expired' }
          }
        );
        expect(result).toBe(5);
      });
    });

    describe('getSchoolStatistics', () => {
      test('should return school statistics', async () => {
        const mockStats = [
          { _id: 'pending', count: 5 },
          { _id: 'accepted', count: 10 },
          { _id: 'expired', count: 2 }
        ];

        Invitation.aggregate = jest.fn().mockResolvedValue(mockStats);
        
        const result = await Invitation.getSchoolStatistics('ABC1234');
        
        expect(Invitation.aggregate).toHaveBeenCalled();
        expect(result).toEqual({
          total: 17,
          pending: 5,
          accepted: 10,
          expired: 2,
          cancelled: 0
        });
      });
    });
  });

  describe('Virtual Properties', () => {
    test('should generate fullName virtual with first and last name', () => {
      const invitation = new Invitation(teacherInvitationData);
      
      expect(invitation.fullName).toBe('Jane Smith');
    });

    test('should generate fullName virtual with email when no names', () => {
      const invitation = new Invitation({
        ...teacherInvitationData,
        firstName: undefined,
        lastName: undefined
      });
      
      expect(invitation.fullName).toBe(teacherInvitationData.email);
    });

    test('should generate displayName virtual', () => {
      const invitation = new Invitation(teacherInvitationData);
      
      expect(invitation.displayName).toBe('Jane Smith (teacher)');
    });

    test('should generate statusDisplay virtual for pending invitation', () => {
      const invitation = new Invitation({
        ...teacherInvitationData,
        status: 'pending',
        expiresAt: new Date(Date.now() + 60000) // 1 minute from now
      });
      
      expect(invitation.statusDisplay).toBe('Pending');
    });

    test('should generate statusDisplay virtual for expired invitation', () => {
      const invitation = new Invitation({
        ...teacherInvitationData,
        status: 'pending',
        expiresAt: new Date(Date.now() - 60000) // 1 minute ago
      });
      
      expect(invitation.statusDisplay).toBe('Expired');
    });

    test('should generate timeRemaining virtual for pending invitation', () => {
      const invitation = new Invitation({
        ...teacherInvitationData,
        status: 'pending',
        expiresAt: new Date(Date.now() + 25 * 60 * 60 * 1000) // 25 hours from now
      });
      
      expect(invitation.timeRemaining).toBe('1 day remaining');
    });

    test('should generate timeRemaining virtual for accepted invitation', () => {
      const invitation = new Invitation({
        ...teacherInvitationData,
        status: 'accepted'
      });
      
      expect(invitation.timeRemaining).toBeNull();
    });
  });

  describe('JSON Transformation', () => {
    test('should remove version field from JSON output', () => {
      const invitation = new Invitation(teacherInvitationData);
      invitation.__v = 0;
      
      const json = invitation.toJSON();
      
      expect(json.__v).toBeUndefined();
      expect(json.email).toBe(teacherInvitationData.email);
      expect(json.role).toBe(teacherInvitationData.role);
    });
  });
});
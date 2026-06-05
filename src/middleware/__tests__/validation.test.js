const {
  commonSchemas,
  schoolAuthSchemas,
  userSchemas,
  invitationSchemas,
  validateBody,
  validateParams,
  validateQuery,
  validateRequest,
  sanitizeInput
} = require('../validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('Common Schemas', () => {
    test('should validate email correctly', () => {
      const validEmails = ['test@example.com', 'user.name@domain.co.uk'];
      const invalidEmails = ['invalid-email', 'test@', '@domain.com'];

      validEmails.forEach(email => {
        const { error } = commonSchemas.email.validate(email);
        expect(error).toBeUndefined();
      });

      invalidEmails.forEach(email => {
        const { error } = commonSchemas.email.validate(email);
        expect(error).toBeDefined();
      });
    });

    test('should validate password with strong requirements', () => {
      const validPasswords = ['Password123!', 'MyStr0ng@Pass'];
      const invalidPasswords = ['weak', '12345678', 'NoSpecialChar123', 'nouppercasechar123!'];

      validPasswords.forEach(password => {
        const { error } = commonSchemas.password.validate(password);
        expect(error).toBeUndefined();
      });

      invalidPasswords.forEach(password => {
        const { error } = commonSchemas.password.validate(password);
        expect(error).toBeDefined();
      });
    });

    test('should validate UUID format', () => {
      const validIds = ['550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'];
      const invalidIds = ['invalid-id', '123', 'short', '550e8400-e29b-41d4-a716-44665544000G'];

      validIds.forEach(id => {
        const { error } = commonSchemas.uuid.validate(id);
        expect(error).toBeUndefined();
      });

      invalidIds.forEach(id => {
        const { error } = commonSchemas.uuid.validate(id);
        expect(error).toBeDefined();
      });
    });

    test('should validate role correctly', () => {
      const validRoles = ['admin', 'teacher', 'parent'];
      const invalidRoles = ['student', 'user', 'invalid'];

      validRoles.forEach(role => {
        const { error } = commonSchemas.role.validate(role);
        expect(error).toBeUndefined();
      });

      invalidRoles.forEach(role => {
        const { error } = commonSchemas.role.validate(role);
        expect(error).toBeDefined();
      });
    });
  });

  describe('School Auth Schemas', () => {
    test('should validate school signup data', () => {
      const validData = {
        schoolName: 'Test School',
        email: 'admin@testschool.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        adminFirstName: 'John',
        adminLastName: 'Doe'
      };

      const { error } = schoolAuthSchemas.signup.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should reject mismatched passwords', () => {
      const invalidData = {
        schoolName: 'Test School',
        email: 'admin@testschool.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
        adminFirstName: 'John',
        adminLastName: 'Doe'
      };

      const { error } = schoolAuthSchemas.signup.validate(invalidData);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('Passwords do not match');
    });

    test('should validate login data', () => {
      const validData = {
        schoolId: 'ABC1234',
        email: 'admin@testschool.com',
        password: 'Password123!'
      };

      const { error } = schoolAuthSchemas.login.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should validate email verification data', () => {
      const validData = {
        email: 'admin@testschool.com',
        otp: '123456',
        schoolId: 'ABC1234'
      };

      const { error } = schoolAuthSchemas.verifyEmail.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should reject invalid OTP format', () => {
      const invalidData = {
        email: 'admin@testschool.com',
        otp: '12345', // Too short
        schoolId: 'ABC1234'
      };

      const { error } = schoolAuthSchemas.verifyEmail.validate(invalidData);
      expect(error).toBeDefined();
    });
  });

  describe('User Schemas', () => {
    test('should validate user creation data', () => {
      const validTeacherData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@testschool.com',
        role: 'teacher',
        subjects: ['Math', 'Science']
      };

      const { error } = userSchemas.createUser.validate(validTeacherData);
      expect(error).toBeUndefined();
    });

    test('should require subjects for teachers', () => {
      const invalidTeacherData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@testschool.com',
        role: 'teacher'
        // Missing subjects
      };

      const { error } = userSchemas.createUser.validate(invalidTeacherData);
      expect(error).toBeDefined();
    });

    test('should forbid subjects for non-teachers', () => {
      const invalidParentData = {
        firstName: 'John',
        lastName: 'Parent',
        email: 'parent@testschool.com',
        role: 'parent',
        subjects: ['Math'] // Should not be allowed for parents
      };

      const { error } = userSchemas.createUser.validate(invalidParentData);
      expect(error).toBeDefined();
    });

    test('should validate password change data', () => {
      const validData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };

      const { error } = userSchemas.changePassword.validate(validData);
      expect(error).toBeUndefined();
    });
  });

  describe('Invitation Schemas', () => {
    test('should validate invitation data', () => {
      const validData = {
        email: 'newuser@testschool.com',
        role: 'teacher',
        firstName: 'New',
        lastName: 'Teacher'
      };

      const { error } = invitationSchemas.sendInvitation.validate(validData);
      expect(error).toBeUndefined();
    });

    test('should validate invitation acceptance data', () => {
      const validData = {
        token: 'invitation-token-123',
        password: 'Password123!'
      };

      const { error } = invitationSchemas.acceptInvitation.validate(validData);
      expect(error).toBeUndefined();
    });
  });

  describe('Validation Middleware Functions', () => {
    test('validateBody should validate request body', () => {
      req.body = {
        schoolId: 'ABC1234',
        email: 'test@example.com',
        password: 'Password123!'
      };

      const middleware = validateBody(schoolAuthSchemas.login);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateBody should return validation errors', () => {
      req.body = {
        email: 'invalid-email',
        password: 'weak'
      };

      const middleware = validateBody(schoolAuthSchemas.login);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Validation failed',
        errors: expect.any(Array)
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('validateParams should validate request parameters', () => {
      req.params = {
        id: '550e8400-e29b-41d4-a716-446655440000'
      };

      const paramSchema = require('joi').object({
        id: commonSchemas.uuid.required()
      });

      const middleware = validateParams(paramSchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateQuery should validate query parameters', () => {
      req.query = {
        page: '1',
        limit: '10',
        sort: 'asc'
      };

      const querySchema = require('joi').object({
        page: commonSchemas.page,
        limit: commonSchemas.limit,
        sort: commonSchemas.sort
      });

      const middleware = validateQuery(querySchema);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('validateRequest should combine multiple validations', () => {
      req.body = { email: 'test@example.com' };
      req.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      req.query = { page: '1' };

      const bodySchema = require('joi').object({
        email: commonSchemas.email.required()
      });
      const paramSchema = require('joi').object({
        id: commonSchemas.uuid.required()
      });
      const querySchema = require('joi').object({
        page: commonSchemas.page
      });

      const middlewares = validateRequest({
        body: bodySchema,
        params: paramSchema,
        query: querySchema
      });

      expect(middlewares).toHaveLength(3);
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize XSS attempts in body', () => {
      req.body = {
        name: '<script>alert("xss")</script>John Doe',
        description: '<img src="x" onerror="alert(1)">Test description'
      };

      sanitizeInput(req, res, next);

      expect(req.body.name).toBe('John Doe');
      expect(req.body.description).toBe('Test description');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize HTML tags', () => {
      req.body = {
        content: '<div>Hello <b>World</b></div>'
      };

      sanitizeInput(req, res, next);

      expect(req.body.content).toBe('Hello World');
      expect(next).toHaveBeenCalled();
    });

    test('should handle nested objects', () => {
      req.body = {
        user: {
          name: '<script>alert("xss")</script>John',
          profile: {
            bio: '<img src="x" onerror="alert(1)">Bio text'
          }
        }
      };

      sanitizeInput(req, res, next);

      expect(req.body.user.name).toBe('John');
      expect(req.body.user.profile.bio).toBe('Bio text');
      expect(next).toHaveBeenCalled();
    });

    test('should sanitize query parameters', () => {
      req.query = {
        search: '<script>alert("xss")</script>test query'
      };

      sanitizeInput(req, res, next);

      expect(req.query.search).toBe('test query');
      expect(next).toHaveBeenCalled();
    });
  });
});
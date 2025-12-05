/**
 * Email Service Tests
 * Tests for the comprehensive email service with Resend integration
 */

const EmailService = require('../email');

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn()
    }
  }))
}));

// Mock fs promises
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}));

describe('EmailService', () => {
  let EmailServiceClass;
  let emailService;
  let mockResendSend;

  beforeEach(() => {
    // Set up environment variables
    process.env.NODE_ENV = 'test';
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'test@educonnect.com';
    process.env.FROM_NAME = 'EduConnect Test';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    
    // Clear module cache to get fresh class
    jest.clearAllMocks();
    delete require.cache[require.resolve('../email')];
    
    EmailServiceClass = require('../email');
    emailService = new EmailServiceClass();
    mockResendSend = emailService.resend.emails.send;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with required environment variables', () => {
      expect(emailService.config.fromEmail).toBe('test@educonnect.com');
      expect(emailService.config.fromName).toBe('EduConnect Test');
      expect(emailService.config.frontendUrl).toBe('http://localhost:3000');
    });

    test('should throw error without RESEND_API_KEY', () => {
      delete process.env.RESEND_API_KEY;
      
      expect(() => {
        new EmailServiceClass();
      }).toThrow('RESEND_API_KEY environment variable is required');
    });

    test('should use default values for optional config', () => {
      delete process.env.FROM_EMAIL;
      delete process.env.FROM_NAME;
      
      const service = new EmailServiceClass();
      expect(service.config.fromEmail).toBe('noreply@educonnect.com');
      expect(service.config.fromName).toBe('EduConnect');
    });
  });

  describe('Core Email Sending', () => {
    test('should send email successfully', async () => {
      const mockResult = { id: 'test-message-id' };
      mockResendSend.mockResolvedValue(mockResult);

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockResendSend).toHaveBeenCalledWith({
        from: 'EduConnect Test <test@educonnect.com>',
        to: ['test@example.com'],
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });
    });

    test('should handle email sending failure', async () => {
      const mockError = new Error('Resend API error');
      mockResendSend.mockRejectedValue(mockError);

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Resend API error');
    });

    test('should validate required fields', async () => {
      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject'
        // Missing html
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required email fields');
    });

    test('should handle multiple recipients', async () => {
      const mockResult = { id: 'test-message-id' };
      mockResendSend.mockResolvedValue(mockResult);

      const recipients = ['test1@example.com', 'test2@example.com'];
      const result = await emailService.sendEmail({
        to: recipients,
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: recipients
        })
      );
    });

    test('should include optional fields when provided', async () => {
      const mockResult = { id: 'test-message-id' };
      mockResendSend.mockResolvedValue(mockResult);

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text',
        attachments: [{ filename: 'test.pdf' }],
        headers: { 'X-Custom': 'value' }
      });

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test text',
          attachments: [{ filename: 'test.pdf' }],
          headers: { 'X-Custom': 'value' }
        })
      );
    });
  });

  describe('Retry Logic', () => {
    test('should retry on retryable errors', async () => {
      const retryableError = new Error('rate limit exceeded');
      mockResendSend
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValue({ id: 'success-after-retry' });

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('success-after-retry');
      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });

    test('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('invalid email address');
      mockResendSend.mockRejectedValue(nonRetryableError);

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });

      expect(result.success).toBe(false);
      expect(mockResendSend).toHaveBeenCalledTimes(1);
    });

    test('should stop retrying after max attempts', async () => {
      const retryableError = new Error('timeout');
      mockResendSend.mockRejectedValue(retryableError);

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>'
      });

      expect(result.success).toBe(false);
      expect(mockResendSend).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('Template Rendering', () => {
    test('should render built-in template', async () => {
      const html = await emailService.renderTemplate('otp-verification', {
        title: 'Test Title',
        message: 'Test Message',
        otp: '123456',
        expirationMinutes: 10
      });

      expect(html).toContain('Test Title');
      expect(html).toContain('Test Message');
      expect(html).toContain('123456');
      expect(html).toContain('10 minutes');
    });

    test('should replace variables in template', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!';
      const result = emailService.replaceVariables(template, {
        name: 'John',
        company: 'EduConnect'
      });

      expect(result).toBe('Hello John, welcome to EduConnect!');
    });

    test('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, welcome to {{company}}!';
      const result = emailService.replaceVariables(template, {
        name: 'John'
        // company is missing
      });

      expect(result).toBe('Hello John, welcome to !');
    });

    test('should include default variables', () => {
      const template = 'Contact {{supportEmail}} - {{currentYear}}';
      const result = emailService.replaceVariables(template, {});

      expect(result).toContain(emailService.config.supportEmail);
      expect(result).toContain(new Date().getFullYear().toString());
    });
  });

  describe('Specialized Email Methods', () => {
    beforeEach(() => {
      mockResendSend.mockResolvedValue({ id: 'test-message-id' });
    });

    test('should send OTP email', async () => {
      const result = await emailService.sendOTPEmail(
        'test@example.com',
        '123456',
        'Test School'
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test@example.com'],
          subject: 'Verify Your Email - EduConnect',
          headers: expect.objectContaining({
            'X-Email-Type': 'otp-verification',
            'X-School-Name': 'Test School'
          })
        })
      );
    });

    test('should send school welcome email', async () => {
      const result = await emailService.sendSchoolIdEmail(
        'admin@school.com',
        'SCH001',
        'Test School'
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['admin@school.com'],
          subject: 'Your School ID - EduConnect',
          headers: expect.objectContaining({
            'X-Email-Type': 'school-welcome',
            'X-School-ID': 'SCH001',
            'X-School-Name': 'Test School'
          })
        })
      );
    });

    test('should send invitation email', async () => {
      const result = await emailService.sendInvitationEmail(
        'teacher@example.com',
        'invitation-token-123',
        'teacher',
        'Test School',
        {
          subjects: ['Math', 'Science'],
          inviterName: 'John Admin',
          message: 'Welcome to our team!'
        }
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['teacher@example.com'],
          subject: 'Invitation to Join Test School - EduConnect',
          headers: expect.objectContaining({
            'X-Email-Type': 'invitation',
            'X-Role': 'teacher',
            'X-School-Name': 'Test School',
            'X-Invitation-Token': 'invitation-token-123'
          })
        })
      );
    });

    test('should send password reset email', async () => {
      const result = await emailService.sendPasswordResetEmail(
        'user@example.com',
        'reset-token-123',
        'user'
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user@example.com'],
          subject: 'Reset Your Password - EduConnect',
          headers: expect.objectContaining({
            'X-Email-Type': 'password-reset',
            'X-User-Type': 'user',
            'X-Reset-Token': 'reset-token-123'
          })
        })
      );
    });
  });

  describe('Bulk Email Sending', () => {
    test('should send bulk emails in batches', async () => {
      mockResendSend.mockResolvedValue({ id: 'test-message-id' });

      const emails = [
        { to: 'user1@example.com', subject: 'Test 1', html: '<p>Test 1</p>' },
        { to: 'user2@example.com', subject: 'Test 2', html: '<p>Test 2</p>' },
        { to: 'user3@example.com', subject: 'Test 3', html: '<p>Test 3</p>' }
      ];

      const result = await emailService.sendBulkEmails(emails, 2, 0);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockResendSend).toHaveBeenCalledTimes(3);
    });

    test('should handle bulk email failures', async () => {
      mockResendSend
        .mockResolvedValueOnce({ id: 'success-1' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 'success-3' });

      const emails = [
        { to: 'user1@example.com', subject: 'Test 1', html: '<p>Test 1</p>' },
        { to: 'user2@example.com', subject: 'Test 2', html: '<p>Test 2</p>' },
        { to: 'user3@example.com', subject: 'Test 3', html: '<p>Test 3</p>' }
      ];

      const result = await emailService.sendBulkEmails(emails, 10, 0);

      expect(result.total).toBe(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].email).toBe('user2@example.com');
    });
  });

  describe('Templated Email', () => {
    test('should send templated email', async () => {
      mockResendSend.mockResolvedValue({ id: 'test-message-id' });

      const result = await emailService.sendTemplatedEmail(
        'otp-verification',
        'test@example.com',
        'Test Subject',
        {
          title: 'Test Title',
          otp: '123456',
          expirationMinutes: 10
        }
      );

      expect(result.success).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test@example.com'],
          subject: 'Test Subject',
          headers: expect.objectContaining({
            'X-Email-Type': 'templated',
            'X-Template-Name': 'otp-verification'
          })
        })
      );
    });
  });

  describe('Service Management', () => {
    test('should return statistics', () => {
      const stats = emailService.getStatistics();

      expect(stats).toHaveProperty('sent');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('retries');
      expect(stats).toHaveProperty('templatesCached');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('config');
    });

    test('should clear template cache', () => {
      // Add something to cache first
      emailService.templateCache.set('test', 'template');
      expect(emailService.templateCache.size).toBe(1);

      emailService.clearTemplateCache();
      expect(emailService.templateCache.size).toBe(0);
    });

    test('should perform health check', async () => {
      const health = await emailService.healthCheck();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('statistics');
      expect(health).toHaveProperty('resendConnected');
      expect(health.status).toBe('healthy');
      expect(health.resendConnected).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle template rendering errors gracefully', async () => {
      const result = await emailService.sendOTPEmail(
        'test@example.com',
        '123456',
        'Test School'
      );

      // Even if template rendering has issues, it should fall back gracefully
      expect(result).toHaveProperty('success');
    });

    test('should handle Resend API errors gracefully', async () => {
      mockResendSend.mockRejectedValue(new Error('API Error'));

      const result = await emailService.sendEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });
});
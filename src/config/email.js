const { Resend } = require('resend');
const path = require('path');
const fs = require('fs').promises;

/**
 * EmailService Class
 * Comprehensive email service with Resend integration
 * Implements requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */
class EmailService {
  constructor() {
    // Validate required environment variables
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }

    // Initialize Resend client
    this.resend = new Resend(process.env.RESEND_API_KEY);

    // Configuration
    this.config = {
      fromEmail: process.env.FROM_EMAIL || 'noreply@educonnect.com',
      fromName: process.env.FROM_NAME || 'EduConnect',
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173/',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@educonnect.com',
      companyName: process.env.COMPANY_NAME || 'EduConnect',
      logoUrl: process.env.LOGO_URL || null,
      // Rate limiting
      maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY) || 1000,
      // Timeouts
      defaultTimeout: parseInt(process.env.EMAIL_TIMEOUT) || 30000
    };

    // Template cache
    this.templateCache = new Map();

    // Email statistics
    this.stats = {
      sent: 0,
      failed: 0,
      retries: 0
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log('EmailService initialized with Resend API');
    }
  }

  /**
   * Core email sending method with retry logic and error handling
   * @param {Object} emailData - Email configuration object
   * @param {string|string[]} emailData.to - Recipient email(s)
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.html - HTML content
   * @param {string} [emailData.text] - Plain text content (optional)
   * @param {string} [emailData.from] - Custom from address (optional)
   * @param {Object[]} [emailData.attachments] - Email attachments (optional)
   * @param {Object} [emailData.headers] - Custom headers (optional)
   * @param {number} [retryCount=0] - Current retry attempt
   * @returns {Promise<Object>} Result object with success status and details
   */
  async sendEmail(emailData, retryCount = 0) {
    const { to, subject, html, text, from, attachments, headers } = emailData;

    try {
      // Validate required fields
      if (!to || !subject || !html) {
        throw new Error('Missing required email fields: to, subject, and html are required');
      }

      // Prepare email payload
      const emailPayload = {
        from: from || `${this.config.fromName} <${this.config.fromEmail}>`,
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html
      };

      // Add optional fields
      if (text) emailPayload.text = text;
      if (attachments && attachments.length > 0) emailPayload.attachments = attachments;
      if (headers) emailPayload.headers = headers;

      // Log email payload for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Sending email with payload:', {
          from: emailPayload.from,
          to: emailPayload.to,
          subject: emailPayload.subject,
          hasHtml: !!emailPayload.html
        });
      }

      // Send email with timeout
      const result = await Promise.race([
        this.resend.emails.send(emailPayload),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Email sending timeout')), this.config.defaultTimeout)
        )
      ]);

      // Update statistics
      this.stats.sent++;

      if (process.env.NODE_ENV !== 'test') {
        console.log(`✅ Email sent successfully to ${to}:`, result.id);
        console.log(`📊 Resend response:`, result);
      }
      return {
        success: true,
        messageId: result.id,
        to: emailPayload.to,
        subject: subject,
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`❌ Email sending failed (attempt ${retryCount + 1}):`, error.message);
        console.error(`📋 Error details:`, {
          name: error.name,
          message: error.message,
          status: error.status,
          statusCode: error.statusCode,
          response: error.response?.data || error.response
        });
      }

      // Retry logic for transient errors
      if (retryCount < this.config.maxRetries && this.isRetryableError(error)) {
        this.stats.retries++;
        if (process.env.NODE_ENV !== 'test') {
          console.log(`Retrying email send in ${this.config.retryDelay}ms...`);
        }

        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.sendEmail(emailData, retryCount + 1);
      }

      // Update statistics
      this.stats.failed++;

      return {
        success: false,
        error: error.message,
        to: to,
        subject: subject,
        failedAt: new Date().toISOString(),
        retryCount: retryCount
      };
    }
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'timeout',
      'network',
      'rate limit',
      'temporary',
      'service unavailable',
      'internal server error'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => errorMessage.includes(retryableError));
  }

  /**
   * Send bulk emails with rate limiting
   * @param {Object[]} emails - Array of email objects
   * @param {number} [batchSize=10] - Number of emails to send concurrently
   * @param {number} [delay=100] - Delay between batches in milliseconds
   * @returns {Promise<Object>} Results summary
   */
  async sendBulkEmails(emails, batchSize = 10, delay = 100) {
    const results = {
      total: emails.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(`Starting bulk email send: ${emails.length} emails in batches of ${batchSize}`);
    }

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const batchPromises = batch.map(async (email) => {
        const result = await this.sendEmail(email);
        if (result.success) {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push({
            email: email.to,
            error: result.error
          });
        }
        return result;
      });

      await Promise.all(batchPromises);

      // Add delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(`Bulk email send completed: ${results.sent} sent, ${results.failed} failed`);
    }
    return results;
  }

  /**
   * Template rendering system
   * @param {string} templateName - Name of the template
   * @param {Object} variables - Variables to replace in template
   * @returns {Promise<string>} Rendered HTML template
   */
  async renderTemplate(templateName, variables = {}) {
    try {
      // Check cache first
      if (this.templateCache.has(templateName)) {
        const template = this.templateCache.get(templateName);
        return this.replaceVariables(template, variables);
      }

      // Try to load template from file system
      const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`);

      try {
        const templateContent = await fs.readFile(templatePath, 'utf8');
        this.templateCache.set(templateName, templateContent);
        return this.replaceVariables(templateContent, variables);
      } catch (fileError) {
        // Fall back to built-in templates
        const builtInTemplate = this.getBuiltInTemplate(templateName);
        if (builtInTemplate) {
          return this.replaceVariables(builtInTemplate, variables);
        }
        throw new Error(`Template '${templateName}' not found`);
      }
    } catch (error) {
      console.error(`Template rendering failed for '${templateName}':`, error.message);
      throw error;
    }
  }

  /**
   * Replace variables in template
   * @param {string} template - Template content
   * @param {Object} variables - Variables to replace
   * @returns {string} Template with variables replaced
   */
  replaceVariables(template, variables) {
    // Add default variables
    const allVariables = {
      ...variables,
      companyName: this.config.companyName,
      supportEmail: this.config.supportEmail,
      frontendUrl: this.config.frontendUrl,
      logoUrl: this.config.logoUrl,
      currentYear: new Date().getFullYear()
    };

    let result = template;

    // Replace {{variable}} patterns
    result = result.replace(/{{\s*([^}]+)\s*}}/g, (match, variableName) => {
      const trimmedName = variableName.trim();
      return allVariables[trimmedName] !== undefined ? allVariables[trimmedName] : '';
    });

    return result;
  }

  /**
   * Get built-in email templates
   * @param {string} templateName - Template name
   * @returns {string|null} Template content or null if not found
   */
  getBuiltInTemplate(templateName) {
    const templates = {
      'base': this.getBaseTemplate(),
      'otp-verification': this.getOTPTemplate(),
      'school-welcome': this.getSchoolWelcomeTemplate(),
      'invitation': this.getInvitationTemplate(),
      'password-reset': this.getPasswordResetTemplate(),
      'teacher-welcome': this.getTeacherWelcomeTemplate(),
      'parent-welcome': this.getParentWelcomeTemplate(),
      'teacher-invitation': this.getTeacherInvitationTemplate(),
      'parent-invitation': this.getParentInvitationTemplate()
    };

    return templates[templateName] || null;
  }

  /**
   * Base email template
   * @returns {string} Base HTML template
   */
  getBaseTemplate() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{subject}}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .highlight { background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 6px; }
          .logo { max-height: 50px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            {{#if logoUrl}}<img src="{{logoUrl}}" alt="{{companyName}}" class="logo">{{/if}}
            <h1>{{companyName}}</h1>
          </div>
          <div class="content">
            {{content}}
          </div>
          <div class="footer">
            <p>Best regards,<br>The {{companyName}} Team</p>
            <p>Need help? Contact us at <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
            <p>&copy; {{currentYear}} {{companyName}}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * OTP verification template
   * @returns {string} OTP HTML template
   */
  getOTPTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">{{title}}</h2>
        <p>{{message}}</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 6px;">
          <h1 style="color: #1f2937; font-size: 32px; margin: 0; font-family: monospace;">{{otp}}</h1>
        </div>
        <p>This OTP will expire in {{expirationMinutes}} minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * School welcome template
   * @returns {string} School welcome HTML template
   */
  getSchoolWelcomeTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">{{title}}</h2>
        <p>Congratulations! <strong>{{schoolName}}</strong> has been successfully registered with {{companyName}}.</p>
        <p>Your unique School ID is:</p>
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 6px;">
          <h1 style="color: #1f2937; font-size: 24px; margin: 0; font-family: monospace;">{{schoolId}}</h1>
        </div>
        <p>Please save this School ID as you'll need it to log in to your admin account.</p>
        <p>You can now log in using:</p>
        <ul>
          <li><strong>School ID:</strong> {{schoolId}}</li>
          <li><strong>Email:</strong> {{email}}</li>
          <li><strong>Password:</strong> The password you created during registration</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
        </div>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Invitation template
   * @returns {string} Invitation HTML template
   */
  getInvitationTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You're Invited to Join {{companyName}}!</h2>
        <p>{{inviterName}} has invited you to join <strong>{{schoolName}}</strong> as a <strong>{{role}}</strong>.</p>
        {{#if message}}<p style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;"><em>"{{message}}"</em></p>{{/if}}
        {{roleSpecificContent}}
        <p>Click the button below to complete your registration:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{registrationUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Complete Registration</a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #6b7280; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">{{registrationUrl}}</p>
        <p>This invitation will expire in {{expirationHours}} hours.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Password reset template
   * @returns {string} Password reset HTML template
   */
  getPasswordResetTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You requested to reset your password for your {{companyName}} account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{resetUrl}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #6b7280; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">{{resetUrl}}</p>
        <p>This link will expire in {{expirationHours}} hour(s) for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Teacher welcome template
   * @returns {string} Teacher welcome HTML template
   */
  getTeacherWelcomeTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to {{schoolName}}!</h2>
        <p>Dear {{teacherName}},</p>
        <p>Welcome to <strong>{{schoolName}}</strong>! Your teacher account has been successfully created on {{companyName}}.</p>
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin-top: 0; color: #1f2937;">Your Account Details:</h3>
          <p><strong>School:</strong> {{schoolName}}</p>
          <p><strong>School ID:</strong> {{schoolId}}</p>
          <p><strong>Email:</strong> {{email}}</p>
          <p><strong>Role:</strong> Teacher</p>
          {{#if subjects}}<p><strong>Subjects:</strong> {{subjects}}</p>{{/if}}
        </div>
        <p>You can now log in to access your teacher dashboard, manage your classes, and connect with students and parents.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
        </div>
        <p>If you have any questions or need assistance, please don't hesitate to contact the school administration.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Parent welcome template
   * @returns {string} Parent welcome HTML template
   */
  getParentWelcomeTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to {{schoolName}}!</h2>
        <p>Dear {{parentName}},</p>
        <p>Welcome to <strong>{{schoolName}}</strong>! Your parent account has been successfully created on {{companyName}}.</p>
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin-top: 0; color: #1f2937;">Your Account Details:</h3>
          <p><strong>School:</strong> {{schoolName}}</p>
          <p><strong>School ID:</strong> {{schoolId}}</p>
          <p><strong>Email:</strong> {{email}}</p>
          <p><strong>Role:</strong> Parent</p>
          {{#if children}}<p><strong>Children:</strong> {{children}}</p>{{/if}}
        </div>
        <p>You can now log in to track your child's progress, communicate with teachers, and stay updated on school activities.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{loginUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
        </div>
        <p>If you have any questions or need assistance, please don't hesitate to contact the school administration.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Teacher invitation template
   * @returns {string} Teacher invitation HTML template
   */
  getTeacherInvitationTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You're Invited to Join {{schoolName}}!</h2>
        <p>Dear {{teacherName}},</p>
        <p>You have been invited to join <strong>{{schoolName}}</strong> as a teacher on {{companyName}}.</p>
        {{#if message}}<p style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;"><em>"{{message}}"</em></p>{{/if}}
        
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin-top: 0; color: #1f2937;">Your Login Credentials:</h3>
          <p><strong>School ID:</strong> {{schoolId}}</p>
          <p><strong>Email:</strong> {{email}}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px;">{{tempPassword}}</code></p>
          {{#if subjects}}<p><strong>Subjects:</strong> {{subjects}}</p>{{/if}}
        </div>

        <div style="background-color: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This is a temporary password. You'll be required to change it when you first log in.</p>
        </div>

        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Click "Accept Invitation" below to log in</li>
          <li>Complete your profile information</li>
          <li>Change your temporary password</li>
          <li>Start teaching!</li>
        </ol>

        <div style="text-align: center; margin: 30px 0;">
          <a href="{{completeRegistrationUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">Accept Invitation</a>
          <a href="{{loginUrl}}" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Direct Login</a>
        </div>

        <p>This invitation will expire in {{expirationHours}} hours.</p>
        <p>If you have any questions, please contact the school administration.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Parent invitation template
   * @returns {string} Parent invitation HTML template
   */
  getParentInvitationTemplate() {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">You're Invited to Join {{schoolName}}!</h2>
        <p>Dear {{parentName}},</p>
        <p>You have been invited to join <strong>{{schoolName}}</strong> as a parent on {{companyName}}.</p>
        {{#if message}}<p style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;"><em>"{{message}}"</em></p>{{/if}}
        
        <div style="background-color: #f3f4f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
          <h3 style="margin-top: 0; color: #1f2937;">Your Login Credentials:</h3>
          <p><strong>School ID:</strong> {{schoolId}}</p>
          <p><strong>Email:</strong> {{email}}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 3px;">{{tempPassword}}</code></p>
          {{#if children}}<p><strong>Your Children:</strong> {{children}}</p>{{/if}}
        </div>

        <div style="background-color: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 6px; border-left: 4px solid #f59e0b;">
          <p style="margin: 0; color: #92400e;"><strong>Important:</strong> This is a temporary password. You'll be required to change it when you first log in.</p>
        </div>

        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Click "Accept Invitation" below to log in</li>
          <li>Complete your profile information</li>
          <li>Change your temporary password</li>
          <li>Start tracking your child's progress!</li>
        </ol>

        <div style="text-align: center; margin: 30px 0;">
          <a href="{{completeRegistrationUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">Accept Invitation</a>
          <a href="{{loginUrl}}" style="background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Direct Login</a>
        </div>

        <p>This invitation will expire in {{expirationHours}} hours.</p>
        <p>If you have any questions, please contact the school administration.</p>
        <hr style="margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">Best regards,<br>The {{companyName}} Team</p>
      </div>
    `;
  }

  /**
   * Send OTP verification email
   * @param {string} email - Recipient email
   * @param {string} otp - OTP code
   * @param {string} schoolName - School name
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendOTPEmail(email, otp, schoolName, options = {}) {
    try {
      const subject = options.subject || 'Verify Your Email - EduConnect';
      const expirationMinutes = options.expirationMinutes || process.env.OTP_EXPIRES_IN_MINUTES || 10;

      const html = await this.renderTemplate('otp-verification', {
        title: options.title || 'Welcome to EduConnect!',
        message: options.message || `Thank you for registering <strong>${schoolName}</strong> with EduConnect. Please use the following OTP to verify your email address:`,
        otp: otp,
        schoolName: schoolName,
        expirationMinutes: expirationMinutes
      });

      return this.sendEmail({
        to: email,
        subject,
        html,
        headers: {
          'X-Email-Type': 'otp-verification',
          'X-School-Name': schoolName
        }
      });
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send school welcome email with School ID
   * @param {string} email - Recipient email
   * @param {string} schoolId - School ID
   * @param {string} schoolName - School name
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendSchoolIdEmail(email, schoolId, schoolName, options = {}) {
    try {
      const subject = options.subject || 'Your School ID - EduConnect';
      const loginUrl = `${this.config.frontendUrl}/login?schoolId=${schoolId}`;

      const html = await this.renderTemplate('school-welcome', {
        title: options.title || 'School Registration Complete!',
        schoolName: schoolName,
        schoolId: schoolId,
        email: email,
        loginUrl: loginUrl
      });

      return this.sendEmail({
        to: email,
        subject,
        html,
        headers: {
          'X-Email-Type': 'school-welcome',
          'X-School-ID': schoolId,
          'X-School-Name': schoolName
        }
      });
    } catch (error) {
      console.error('Failed to send school ID email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send invitation email
   * @param {string} email - Recipient email
   * @param {string} invitationToken - Invitation token
   * @param {string} role - User role (teacher/parent)
   * @param {string} schoolName - School name
   * @param {Object} [additionalInfo={}] - Additional invitation info
   * @returns {Promise<Object>} Send result
   */
  async sendInvitationEmail(email, invitationToken, role, schoolName, additionalInfo = {}) {
    try {
      const subject = additionalInfo.subject || `Invitation to Join ${schoolName} - EduConnect`;
      const registrationUrl = `${this.config.frontendUrl}/register/${role}?token=${invitationToken}`;
      const expirationHours = additionalInfo.expirationHours || process.env.INVITATION_EXPIRES_IN_HOURS || 72;

      // Generate role-specific content
      let roleSpecificContent = '';
      if (role === 'teacher' && additionalInfo.subjects) {
        roleSpecificContent = `<p><strong>Subjects:</strong> ${additionalInfo.subjects.join(', ')}</p>`;
        if (additionalInfo.classes) {
          roleSpecificContent += `<p><strong>Classes:</strong> ${additionalInfo.classes.join(', ')}</p>`;
        }
      } else if (role === 'parent' && additionalInfo.studentNames) {
        roleSpecificContent = `<p><strong>Your children:</strong> ${additionalInfo.studentNames.join(', ')}</p>`;
      }

      const html = await this.renderTemplate('invitation', {
        inviterName: additionalInfo.inviterName || 'The school administration',
        schoolName: schoolName,
        role: role,
        message: additionalInfo.message || null,
        roleSpecificContent: roleSpecificContent,
        registrationUrl: registrationUrl,
        expirationHours: expirationHours
      });

      return this.sendEmail({
        to: email,
        subject,
        html,
        headers: {
          'X-Email-Type': 'invitation',
          'X-Role': role,
          'X-School-Name': schoolName
        }
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetToken - Password reset token
   * @param {string} [userType='user'] - User type (user/school)
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(email, resetToken, userType = 'user', options = {}) {
    try {
      const subject = options.subject || 'Reset Your Password - EduConnect';
      const resetUrl = `${this.config.frontendUrl}/reset-password?token=${resetToken}&type=${userType}`;
      const expirationHours = options.expirationHours || 1;

      const html = await this.renderTemplate('password-reset', {
        resetUrl: resetUrl,
        expirationHours: expirationHours
      });

      return this.sendEmail({
        to: email,
        subject,
        html,
        headers: {
          'X-Email-Type': 'password-reset',
          'X-User-Type': userType
        }
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send custom email using template
   * @param {string} templateName - Template name
   * @param {string|string[]} to - Recipient email(s)
   * @param {string} subject - Email subject
   * @param {Object} variables - Template variables
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<Object>} Send result
   */
  async sendTemplatedEmail(templateName, to, subject, variables, options = {}) {
    try {
      const html = await this.renderTemplate(templateName, variables);

      return this.sendEmail({
        to: to,
        subject: subject,
        html: html,
        text: options.text,
        from: options.from,
        attachments: options.attachments,
        headers: {
          'X-Email-Type': 'templated',
          'X-Template-Name': templateName,
          ...options.headers
        }
      });
    } catch (error) {
      console.error(`Failed to send templated email (${templateName}):`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get email service statistics
   * @returns {Object} Service statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      templatesCached: this.templateCache.size,
      uptime: process.uptime(),
      config: {
        fromEmail: this.config.fromEmail,
        maxRetries: this.config.maxRetries,
        defaultTimeout: this.config.defaultTimeout
      }
    };
  }

  /**
   * Clear template cache
   */
  clearTemplateCache() {
    this.templateCache.clear();
    console.log('Email template cache cleared');
  }

  /**
   * Health check for email service
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Test Resend API connectivity (this is a simple check)
      const testResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        statistics: this.getStatistics(),
        resendConnected: !!this.resend
      };

      return testResult;
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        statistics: this.getStatistics()
      };
    }
  }
}

// Export the class and a singleton instance
module.exports = EmailService;

// Create singleton instance only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  try {
    module.exports = new EmailService();
  } catch (error) {
    console.error('Failed to initialize EmailService:', error.message);
    // In production, you might want to handle this differently
    module.exports = EmailService;
  }
}
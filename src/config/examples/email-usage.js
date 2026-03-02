/**
 * Email Service Usage Examples
 * Demonstrates how to use the comprehensive email service with Resend integration
 */

const EmailService = require('../email');
const logger = require('../../utils/logger');

async function emailServiceExamples() {
  try {
    logger.info('=== Email Service Usage Examples ===\n');

    // Example 1: Basic Email Sending
    logger.info('1. Basic Email Sending:');
    const basicResult = await EmailService.sendEmail({
      to: 'user@example.com',
      subject: 'Welcome to EduConnect',
      html: '<h1>Welcome!</h1><p>Thank you for joining EduConnect.</p>',
      text: 'Welcome! Thank you for joining EduConnect.'
    });
    logger.info('Basic email result:', basicResult);

    // Example 2: Send OTP Email
    logger.info('\n2. Sending OTP Email:');
    const otpResult = await EmailService.sendOTPEmail(
      'school@example.com',
      '123456',
      'Example High School',
      {
        title: 'Verify Your School Registration',
        message: 'Please verify your email to complete school registration.',
        expirationMinutes: 15
      }
    );
    logger.info('OTP email result:', otpResult);

    // Example 3: Send School Welcome Email
    logger.info('\n3. Sending School Welcome Email:');
    const welcomeResult = await EmailService.sendSchoolIdEmail(
      'admin@school.com',
      'SCH001',
      'Example High School',
      {
        title: 'Welcome to EduConnect!',
        subject: 'Your School Registration is Complete'
      }
    );
    logger.info('School welcome result:', welcomeResult);

    // Example 4: Send Teacher Invitation
    logger.info('\n4. Sending Teacher Invitation:');
    const teacherInviteResult = await EmailService.sendInvitationEmail(
      'teacher@example.com',
      'invitation-token-abc123',
      'teacher',
      'Example High School',
      {
        subjects: ['Mathematics', 'Physics', 'Chemistry'],
        classes: ['Grade 10A', 'Grade 11B'],
        inviterName: 'John Admin',
        message: 'We are excited to have you join our teaching staff!',
        expirationHours: 48
      }
    );
    logger.info('Teacher invitation result:', teacherInviteResult);

    // Example 5: Send Parent Invitation
    logger.info('\n5. Sending Parent Invitation:');
    const parentInviteResult = await EmailService.sendInvitationEmail(
      'parent@example.com',
      'invitation-token-def456',
      'parent',
      'Example High School',
      {
        studentNames: ['Alice Johnson', 'Bob Johnson'],
        inviterName: 'School Administration',
        message: 'Your children are enrolled in our school. Please join our parent portal.',
        expirationHours: 72
      }
    );
    logger.info('Parent invitation result:', parentInviteResult);

    // Example 6: Send Password Reset Email
    logger.info('\n6. Sending Password Reset Email:');
    const resetResult = await EmailService.sendPasswordResetEmail(
      'user@example.com',
      'reset-token-ghi789',
      'user',
      {
        subject: 'Reset Your EduConnect Password',
        expirationHours: 2
      }
    );
    logger.info('Password reset result:', resetResult);

    // Example 7: Send Custom Templated Email
    logger.info('\n7. Sending Custom Templated Email:');
    const templatedResult = await EmailService.sendTemplatedEmail(
      'otp-verification',
      'custom@example.com',
      'Custom OTP Verification',
      {
        title: 'Custom Verification Required',
        message: 'Please verify your email for account activation.',
        otp: '789012',
        expirationMinutes: 20
      },
      {
        headers: {
          'X-Custom-Header': 'CustomValue'
        }
      }
    );
    logger.info('Templated email result:', templatedResult);

    // Example 8: Bulk Email Sending
    logger.info('\n8. Bulk Email Sending:');
    const bulkEmails = [
      {
        to: 'teacher1@example.com',
        subject: 'Monthly Newsletter',
        html: '<h1>Newsletter</h1><p>This month\'s updates...</p>'
      },
      {
        to: 'teacher2@example.com',
        subject: 'Monthly Newsletter',
        html: '<h1>Newsletter</h1><p>This month\'s updates...</p>'
      },
      {
        to: 'teacher3@example.com',
        subject: 'Monthly Newsletter',
        html: '<h1>Newsletter</h1><p>This month\'s updates...</p>'
      }
    ];

    const bulkResult = await EmailService.sendBulkEmails(bulkEmails, 2, 100);
    logger.info('Bulk email result:', bulkResult);

    // Example 9: Email with Attachments
    logger.info('\n9. Email with Attachments:');
    const attachmentResult = await EmailService.sendEmail({
      to: 'recipient@example.com',
      subject: 'Document Attached',
      html: '<p>Please find the attached document.</p>',
      attachments: [
        {
          filename: 'report.pdf',
          content: Buffer.from('PDF content here'), // In real usage, this would be actual file content
          contentType: 'application/pdf'
        }
      ]
    });
    logger.info('Email with attachment result:', attachmentResult);

    // Example 10: Multiple Recipients
    logger.info('\n10. Multiple Recipients:');
    const multipleResult = await EmailService.sendEmail({
      to: ['admin1@school.com', 'admin2@school.com', 'admin3@school.com'],
      subject: 'Important School Announcement',
      html: '<h1>Announcement</h1><p>Important information for all admins.</p>'
    });
    logger.info('Multiple recipients result:', multipleResult);

    // Example 11: Custom Template Rendering
    logger.info('\n11. Custom Template Rendering:');
    const customTemplate = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Hello {{name}}!</h2>
        <p>Welcome to {{schoolName}}.</p>
        <p>Your role: {{role}}</p>
        <p>Contact us at {{supportEmail}}</p>
      </div>
    `;

    const renderedHtml = EmailService.replaceVariables(customTemplate, {
      name: 'John Doe',
      schoolName: 'Example High School',
      role: 'Teacher'
    });
    logger.info('Rendered template:', renderedHtml);

    // Example 12: Service Statistics
    logger.info('\n12. Service Statistics:');
    const stats = EmailService.getStatistics();
    logger.info('Email service statistics:', stats);

    // Example 13: Health Check
    logger.info('\n13. Health Check:');
    const health = await EmailService.healthCheck();
    logger.info('Email service health:', health);

    // Example 14: Template Cache Management
    logger.info('\n14. Template Cache Management:');
    logger.info('Templates cached before clear:', EmailService.templateCache.size);
    EmailService.clearTemplateCache();
    logger.info('Templates cached after clear:', EmailService.templateCache.size);

    // Example 15: Error Handling
    logger.info('\n15. Error Handling Example:');
    const errorResult = await EmailService.sendEmail({
      // Missing required fields to demonstrate error handling
      subject: 'Test',
      html: '<p>Test</p>'
      // Missing 'to' field
    });
    logger.info('Error handling result:', errorResult);

    // Example 16: Custom Headers and Options
    logger.info('\n16. Custom Headers and Options:');
    const customResult = await EmailService.sendEmail({
      to: 'test@example.com',
      subject: 'Custom Email',
      html: '<p>Email with custom headers</p>',
      headers: {
        'X-Priority': 'High',
        'X-Custom-ID': 'EMAIL-001',
        'Reply-To': 'noreply@educonnect.com'
      }
    });
    logger.info('Custom headers result:', customResult);

    logger.info('\n=== All Email Service Examples Completed ===');

  } catch (error) {
    logger.error('Error in email service examples:', error);
  }
}

// Example of integrating with other services
async function integrationExamples() {
  logger.info('\n=== Integration Examples ===\n');

  // Example: Integration with OTP service
  logger.info('1. OTP Service Integration:');
  try {
    // Simulate OTP creation (would normally use OTP model)
    const otpData = {
      email: 'user@example.com',
      otp: '123456',
      purpose: 'school-signup',
      expirationMinutes: 10
    };

    const result = await EmailService.sendOTPEmail(
      otpData.email,
      otpData.otp,
      'Example School',
      {
        expirationMinutes: otpData.expirationMinutes
      }
    );

    logger.info('OTP integration result:', result);
  } catch (error) {
    logger.error('OTP integration error:', error);
  }

  // Example: Integration with Invitation service
  logger.info('\n2. Invitation Service Integration:');
  try {
    // Simulate invitation creation (would normally use Invitation model)
    const invitationData = {
      email: 'teacher@example.com',
      token: 'inv-token-123',
      role: 'teacher',
      schoolName: 'Example School',
      subjects: ['Math', 'Science'],
      inviterName: 'Admin User'
    };

    const result = await EmailService.sendInvitationEmail(
      invitationData.email,
      invitationData.token,
      invitationData.role,
      invitationData.schoolName,
      {
        subjects: invitationData.subjects,
        inviterName: invitationData.inviterName
      }
    );

    logger.info('Invitation integration result:', result);
  } catch (error) {
    logger.error('Invitation integration error:', error);
  }

  logger.info('\n=== Integration Examples Completed ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  emailServiceExamples()
    .then(() => integrationExamples())
    .catch(console.error);
}

module.exports = {
  emailServiceExamples,
  integrationExamples
};
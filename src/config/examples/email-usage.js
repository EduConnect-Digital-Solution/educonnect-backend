/**
 * Email Service Usage Examples
 * Demonstrates how to use the comprehensive email service with Resend integration
 */

const EmailService = require('../email');

async function emailServiceExamples() {
  try {
    console.log('=== Email Service Usage Examples ===\n');

    // Example 1: Basic Email Sending
    console.log('1. Basic Email Sending:');
    const basicResult = await EmailService.sendEmail({
      to: 'user@example.com',
      subject: 'Welcome to EduConnect',
      html: '<h1>Welcome!</h1><p>Thank you for joining EduConnect.</p>',
      text: 'Welcome! Thank you for joining EduConnect.'
    });
    console.log('Basic email result:', basicResult);

    // Example 2: Send OTP Email
    console.log('\n2. Sending OTP Email:');
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
    console.log('OTP email result:', otpResult);

    // Example 3: Send School Welcome Email
    console.log('\n3. Sending School Welcome Email:');
    const welcomeResult = await EmailService.sendSchoolIdEmail(
      'admin@school.com',
      'SCH001',
      'Example High School',
      {
        title: 'Welcome to EduConnect!',
        subject: 'Your School Registration is Complete'
      }
    );
    console.log('School welcome result:', welcomeResult);

    // Example 4: Send Teacher Invitation
    console.log('\n4. Sending Teacher Invitation:');
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
    console.log('Teacher invitation result:', teacherInviteResult);

    // Example 5: Send Parent Invitation
    console.log('\n5. Sending Parent Invitation:');
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
    console.log('Parent invitation result:', parentInviteResult);

    // Example 6: Send Password Reset Email
    console.log('\n6. Sending Password Reset Email:');
    const resetResult = await EmailService.sendPasswordResetEmail(
      'user@example.com',
      'reset-token-ghi789',
      'user',
      {
        subject: 'Reset Your EduConnect Password',
        expirationHours: 2
      }
    );
    console.log('Password reset result:', resetResult);

    // Example 7: Send Custom Templated Email
    console.log('\n7. Sending Custom Templated Email:');
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
    console.log('Templated email result:', templatedResult);

    // Example 8: Bulk Email Sending
    console.log('\n8. Bulk Email Sending:');
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
    console.log('Bulk email result:', bulkResult);

    // Example 9: Email with Attachments
    console.log('\n9. Email with Attachments:');
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
    console.log('Email with attachment result:', attachmentResult);

    // Example 10: Multiple Recipients
    console.log('\n10. Multiple Recipients:');
    const multipleResult = await EmailService.sendEmail({
      to: ['admin1@school.com', 'admin2@school.com', 'admin3@school.com'],
      subject: 'Important School Announcement',
      html: '<h1>Announcement</h1><p>Important information for all admins.</p>'
    });
    console.log('Multiple recipients result:', multipleResult);

    // Example 11: Custom Template Rendering
    console.log('\n11. Custom Template Rendering:');
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
    console.log('Rendered template:', renderedHtml);

    // Example 12: Service Statistics
    console.log('\n12. Service Statistics:');
    const stats = EmailService.getStatistics();
    console.log('Email service statistics:', stats);

    // Example 13: Health Check
    console.log('\n13. Health Check:');
    const health = await EmailService.healthCheck();
    console.log('Email service health:', health);

    // Example 14: Template Cache Management
    console.log('\n14. Template Cache Management:');
    console.log('Templates cached before clear:', EmailService.templateCache.size);
    EmailService.clearTemplateCache();
    console.log('Templates cached after clear:', EmailService.templateCache.size);

    // Example 15: Error Handling
    console.log('\n15. Error Handling Example:');
    const errorResult = await EmailService.sendEmail({
      // Missing required fields to demonstrate error handling
      subject: 'Test',
      html: '<p>Test</p>'
      // Missing 'to' field
    });
    console.log('Error handling result:', errorResult);

    // Example 16: Custom Headers and Options
    console.log('\n16. Custom Headers and Options:');
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
    console.log('Custom headers result:', customResult);

    console.log('\n=== All Email Service Examples Completed ===');

  } catch (error) {
    console.error('Error in email service examples:', error);
  }
}

// Example of integrating with other services
async function integrationExamples() {
  console.log('\n=== Integration Examples ===\n');

  // Example: Integration with OTP service
  console.log('1. OTP Service Integration:');
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

    console.log('OTP integration result:', result);
  } catch (error) {
    console.error('OTP integration error:', error);
  }

  // Example: Integration with Invitation service
  console.log('\n2. Invitation Service Integration:');
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

    console.log('Invitation integration result:', result);
  } catch (error) {
    console.error('Invitation integration error:', error);
  }

  console.log('\n=== Integration Examples Completed ===');
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
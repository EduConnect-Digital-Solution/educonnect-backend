const fs = require('fs');

const out = 'docs/postman/EduConnect-Full-API.postman_collection.json';
const base = '{{baseUrl}}';

const AUTH_TOKENS = {
  user: '{{accessToken}}',
  teacher: '{{teacheraccessToken}}',
  student: '{{studentaccessToken}}',
  parent: '{{parentaccessToken}}',
  systemAdmin: '{{systemAdminToken}}'
};

const headers = (authType, hasBody) => {
  const values = [];
  if (hasBody) values.push({ key: 'Content-Type', value: 'application/json' });
  if (authType && authType !== 'none') {
    const token = AUTH_TOKENS[authType];
    if (token) values.push({ key: 'Authorization', value: `Bearer ${token}` });
  }
  return values;
};

const req = ({ name, method, url, authType = 'none', body }) => ({
  name,
  request: {
    method,
    header: headers(authType, !!body),
    body: body
      ? {
          mode: 'raw',
          raw: JSON.stringify(body, null, 2),
          options: { raw: { language: 'json' } }
        }
      : undefined,
    url: `${base}${url}`
  },
  response: []
});

const collection = {
  info: {
    name: 'EduConnect Backend - Full API',
    _postman_id: 'f6a2f6ea-dbd4-4b0b-b3a4-educonnect-full-api',
    description: 'Complete Postman collection for all mounted routes in src/app.js and src/routes/*.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    {
      name: '00 - Utility',
      item: [
        req({ name: 'Root', method: 'GET', url: '/' }),
        req({ name: 'Health Check', method: 'GET', url: '/health' }),
        req({ name: 'CORS Test', method: 'GET', url: '/cors-test' }),
        req({ name: 'Debug (non-production)', method: 'GET', url: '/debug' }),
        req({ name: 'Swagger UI', method: 'GET', url: '/api-docs' })
      ]
    },
    {
      name: '01 - School Auth',
      item: [
        req({ name: 'Register School', method: 'POST', url: '/api/school/auth/register', body: { schoolName: 'Sunrise Academy', email: 'admin@sunrise.edu', password: 'Password123!', adminFirstName: 'John', adminLastName: 'Doe', phone: '+2348012345678', address: 'Lagos, Nigeria' } }),
        req({ name: 'Verify School Email', method: 'POST', url: '/api/school/auth/verify-email', body: { email: 'admin@sunrise.edu', otp: '123456' } }),
        req({ name: 'School Admin Login', method: 'POST', url: '/api/school/auth/login', body: { schoolId: '{{schoolId}}', email: 'admin@sunrise.edu', password: 'Password123!' } }),
        req({ name: 'Refresh School Token', method: 'POST', url: '/api/school/auth/refresh-token', body: { refreshToken: '{{refreshToken}}' } }),
        req({ name: 'School Logout', method: 'POST', url: '/api/school/auth/logout' }),
        req({ name: 'Resend OTP', method: 'POST', url: '/api/school/auth/resend-otp', body: { email: 'admin@sunrise.edu' } }),
        req({ name: 'Forgot Password', method: 'POST', url: '/api/school/auth/forgot-password', body: { email: 'admin@sunrise.edu' } }),
        req({ name: 'Reset Password', method: 'POST', url: '/api/school/auth/reset-password', body: { email: 'admin@sunrise.edu', otp: '123456', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' } }),
        req({ name: 'Invite Teacher', method: 'POST', url: '/api/school/auth/invite-teacher', authType: 'user', body: { email: 'teacher1@sunrise.edu', firstName: 'Ada', lastName: 'Ife', subjects: ['Mathematics'], message: 'Welcome onboard' } }),
        req({ name: 'Invite Parent', method: 'POST', url: '/api/school/auth/invite-parent', authType: 'user', body: { email: 'parent1@example.com', firstName: 'Jane', lastName: 'Doe', studentIds: ['{{studentId}}'], message: 'Your child has been linked' } }),
        req({ name: 'Resend Invitation', method: 'POST', url: '/api/school/auth/resend-invitation', authType: 'user', body: { invitationId: '{{invitationId}}' } }),
        req({ name: 'List Invitations', method: 'GET', url: '/api/school/auth/invitations?status=pending&role=teacher&page=1&limit=20', authType: 'user' }),
        req({ name: 'Cancel Invitation', method: 'POST', url: '/api/school/auth/cancel-invitation', authType: 'user', body: { invitationId: '{{invitationId}}', reason: 'No longer needed' } }),
        req({ name: 'Delete Invitation', method: 'POST', url: '/api/school/auth/delete-invitation', authType: 'user', body: { invitationId: '{{invitationId}}' } })
      ]
    },
    {
      name: '02 - User Auth',
      item: [
        req({ name: 'Complete Registration', method: 'POST', url: '/api/user/auth/complete-registration', body: { email: 'teacher1@sunrise.edu', schoolId: '{{schoolId}}', currentPassword: 'TempPass123!', newPassword: 'Password123!', firstName: 'Ada', lastName: 'Ife' } }),
        req({ name: 'User Login', method: 'POST', url: '/api/user/auth/login', body: { email: 'teacher1@sunrise.edu', password: 'Password123!', schoolId: '{{schoolId}}' } }),
        req({ name: 'User Refresh Token', method: 'POST', url: '/api/user/auth/refresh-token' }),
        req({ name: 'User Logout', method: 'POST', url: '/api/user/auth/logout' }),
        req({ name: 'Get Current User', method: 'GET', url: '/api/user/auth/me' }),
        req({ name: 'Debug Cookies (non-production)', method: 'GET', url: '/api/user/auth/debug-cookies' })
      ]
    },
    {
      name: '03 - Admin Dashboard',
      item: [
        req({ name: 'Get Analytics', method: 'GET', url: '/api/admin/dashboard/analytics', authType: 'user' }),
        req({ name: 'Refresh Analytics', method: 'POST', url: '/api/admin/dashboard/analytics/refresh', authType: 'user' }),
        req({ name: 'Debug Invitations', method: 'GET', url: '/api/admin/dashboard/debug/invitations', authType: 'user' }),
        req({ name: 'Get Users', method: 'GET', url: '/api/admin/dashboard/users?role=all&status=active&page=1&limit=20&search=', authType: 'user' }),
        req({ name: 'Toggle User Status', method: 'POST', url: '/api/admin/dashboard/users/toggle-status', authType: 'user', body: { userId: '{{userId}}', action: 'deactivate', reason: 'Administrative update' } }),
        req({ name: 'Remove User', method: 'DELETE', url: '/api/admin/dashboard/users/remove', authType: 'user', body: { userId: '{{userId}}', reason: 'Removed by admin' } }),
        req({ name: 'List Dashboard Invitations', method: 'GET', url: '/api/admin/dashboard/invitations?status=pending&role=teacher&page=1&limit=10', authType: 'user' }),
        req({ name: 'Cancel Dashboard Invitation', method: 'DELETE', url: '/api/admin/dashboard/invitations/{{invitationId}}', authType: 'user', body: { reason: 'Cancelled by admin' } }),
        req({ name: 'Resend Dashboard Invitation', method: 'POST', url: '/api/admin/dashboard/invitations/{{invitationId}}/resend', authType: 'user', body: {} }),
        req({ name: 'Delete Dashboard Invitation Permanently', method: 'DELETE', url: '/api/admin/dashboard/invitations/{{invitationId}}/permanent', authType: 'user' })
      ]
    },
    {
      name: '03.5 - Class Management',
      item: [
        req({ name: 'Get All Classes', method: 'GET', url: '/api/academic/classes', authType: 'user' }),
        req({ name: 'Get Class by ID', method: 'GET', url: '/api/academic/classes/{{classId}}', authType: 'user' }),
        req({ name: 'Create Classes', method: 'POST', url: '/api/academic/classes', authType: 'user', body: { classes: [{ name: 'JSS 1 Science', level: 1, description: 'Junior Secondary School Year 1 Science Class' }, { name: 'JSS 1 Arts', level: 1, description: 'Junior Secondary School Year 1 Arts Class' }] } }),
        req({ name: 'Delete Class', method: 'DELETE', url: '/api/academic/classes/{{classId}}', authType: 'user' })
      ]
    },
    {
      name: '03.6 - Academic Structure',
      item: [
        req({ name: 'Create Subjects', method: 'POST', url: '/api/academic/subjects', authType: 'user', body: { subjects: [{ name: 'Mathematics', code: 'MTH', description: 'Core mathematics subject', category: 'core' }, { name: 'English Language', code: 'ENG', description: 'Core English subject', category: 'core' }, { name: 'Physics', code: 'PHY', description: 'Science subject', category: 'core' }] } }),
        req({ name: 'List Subjects', method: 'GET', url: '/api/academic/subjects', authType: 'user' }),
        req({ name: 'Get Subjects by Class', method: 'GET', url: '/api/academic/classes/{{classId}}/subjects', authType: 'user' }),
        req({ name: 'Update Subject', method: 'PUT', url: '/api/academic/subjects/{{subjectId}}', authType: 'user', body: { name: 'Mathematics Updated', category: 'elective' } }),
        req({ name: 'Delete Subjects', method: 'DELETE', url: '/api/academic/subjects', authType: 'user', body: { subjectIds: ['{{subjectId1}}', '{{subjectId2}}'] } }),
        req({ name: 'Create Arms', method: 'POST', url: '/api/academic/arms', authType: 'user', body: { arms: [{ classId: '{{classId}}', name: 'A' }, { classId: '{{classId}}', name: 'B' }] } }),
        req({ name: 'Get Arms by Class', method: 'GET', url: '/api/academic/classes/{{classId}}/arms', authType: 'user' }),
        req({ name: 'Update Arm', method: 'PUT', url: '/api/academic/arms/{{armId}}', authType: 'user', body: { name: 'Science Updated', classTeacherId: '{{teacherId}}' } }),
        req({ name: 'Delete Arms', method: 'DELETE', url: '/api/academic/arms', authType: 'user', body: { armIds: ['{{armId1}}', '{{armId2}}'] } }),
        req({ name: 'Get Arm Subjects', method: 'GET', url: '/api/academic/arms/{{armId}}/subjects', authType: 'user' }),
        req({ name: 'Add Subjects to Arm', method: 'POST', url: '/api/academic/arms/{{armId}}/subjects', authType: 'user', body: { subjectIds: ['{{subjectId1}}', '{{subjectId2}}'] } }),
        req({ name: 'Add Subjects to Class', method: 'POST', url: '/api/academic/classes/{{classId}}/subjects', authType: 'user', body: { subjectIds: ['{{subjectId1}}', '{{subjectId2}}'] } }),
        req({ name: 'Remove Subjects from Class', method: 'DELETE', url: '/api/academic/classes/{{classId}}/subjects', authType: 'user', body: { subjectIds: ['{{subjectId1}}', '{{subjectId2}}'] } }),
        req({ name: 'Remove Subjects from Arm', method: 'DELETE', url: '/api/academic/arms/{{armId}}/subjects', authType: 'user', body: { subjectIds: ['{{subjectId1}}', '{{subjectId2}}'] } }),
        req({ name: 'Replace Arm Subjects', method: 'PUT', url: '/api/academic/arms/{{armId}}/subjects/replace', authType: 'user', body: { subjectIds: ['{{subjectId1}}', '{{subjectId2}}'] } }),
        req({ name: 'Copy Arm Subjects', method: 'POST', url: '/api/academic/arms/{{sourceArmId}}/subjects/copy/{{targetArmId}}', authType: 'user', body: {} })
      ]
    },
    {
      name: '03.7 - Academic Calendar',
      item: [
        req({ name: 'Create Academic Years', method: 'POST', url: '/api/admin/academic/years', authType: 'user', body: { years: [{ year: '2023-2024', name: '2023/2024 Academic Year', startDate: '2023-09-01T00:00:00.000Z', endDate: '2024-07-31T23:59:59.999Z', isCurrent: true }] } }),
        req({ name: 'Get Academic Years', method: 'GET', url: '/api/academic/years', authType: 'user' }),
        req({ name: 'Set Current Academic Year', method: 'PUT', url: '/api/admin/academic/years/{{yearId}}/current', authType: 'user' }),
        req({ name: 'Create Academic Terms', method: 'POST', url: '/api/admin/academic/terms', authType: 'user', body: { terms: [{ academicYearId: '{{academicYearId}}', term: 'First_Term', name: 'First Term', startDate: '2023-09-01T00:00:00.000Z', endDate: '2023-12-15T23:59:59.999Z', isCurrent: true }] } }),
        req({ name: 'Get Academic Terms', method: 'GET', url: '/api/academic/terms?academicYearId={{academicYearId}}', authType: 'user' }),
        req({ name: 'Set Current Academic Term', method: 'PUT', url: '/api/admin/academic/terms/{{termId}}/current', authType: 'user' }),
        req({ name: 'Get Current Academic Period', method: 'GET', url: '/api/academic/current', authType: 'user' })
      ]
    },
    {
      name: '03.8 - Student Assignment',
      item: [
        req({ name: 'Bulk Assign Students to Classes', method: 'POST', url: '/api/academic/students/assign', authType: 'user', body: { assignments: [{ studentId: '{{studentId1}}', classId: '{{classId}}', armId: '{{armId}}' }, { studentId: '{{studentId2}}', classId: '{{classId}}', armId: '{{armId}}' }] } }),
        req({ name: 'Bulk Unassign Students from Classes', method: 'POST', url: '/api/academic/students/unassign', authType: 'user', body: { studentIds: ['{{studentId1}}', '{{studentId2}}'] } }),
        req({ name: 'Get Class Population Statistics', method: 'GET', url: '/api/academic/classes/population?classId={{classId}}', authType: 'user' }),
        req({ name: 'Get Unassigned Students', method: 'GET', url: '/api/academic/students/unassigned?page=1&limit=20', authType: 'user' })
      ]
    },
    {
      name: '03.9 - Timetable',
      item: [
        req({ name: 'Get Timetable Draft', method: 'GET', url: '/api/admin/timetable/draft?classId={{classId}}&termId={{termId}}&armId={{armId}}', authType: 'user' }),
        req({ name: 'Save Timetable Draft', method: 'POST', url: '/api/admin/timetable/draft', authType: 'user', body: { classId: '{{classId}}', termId: '{{termId}}', academicYearId: '{{academicYearId}}', armId: '{{armId}}', periods: [{ periodConfigId: 'pc_1', schoolStart: '08:00', periodDuration: 45, totalPeriods: 8, breaks: [{ breakAfter: 2, breakDuration: 15, label: 'Short Break' }, { breakAfter: 4, breakDuration: 30, label: 'Lunch' }] }], schedules: [] } }),
        req({ name: 'Delete Timetable Draft', method: 'DELETE', url: '/api/admin/timetable/draft?classId={{classId}}&termId={{termId}}&armId={{armId}}', authType: 'user' }),
        req({ name: 'Check Timetable Conflicts', method: 'POST', url: '/api/admin/timetable/check-conflicts', authType: 'user', body: { classId: '{{classId}}', termId: '{{termId}}', armId: '{{armId}}', schedules: [{ id: 'temp_1', classId: '{{classId}}', className: 'SS 3', armId: '{{armId}}', armName: 'A', dayOfWeek: 'Monday', periodId: 'p_1', periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectId: '{{subjectId}}', subjectName: 'Mathematics', teacherId: '{{teacherId}}', teacherName: 'John Doe', roomId: '{{roomId}}', roomName: 'Hall A' }] } }),
        req({ name: 'Publish Timetable', method: 'POST', url: '/api/admin/timetable/publish', authType: 'user', body: { academicYearId: '{{academicYearId}}', termId: '{{termId}}', classId: '{{classId}}', armId: '{{armId}}', periods: [{ periodConfigId: 'pc_1', schoolStart: '08:00', periodDuration: 45, totalPeriods: 8, breaks: [{ breakAfter: 2, breakDuration: 15, label: 'Short Break' }, { breakAfter: 4, breakDuration: 30, label: 'Lunch' }] }], schedules: [{ id: 'temp_1', classId: '{{classId}}', className: 'SS 3', armId: '{{armId}}', armName: 'A', dayOfWeek: 'Monday', periodId: 'p_1', periodNumber: 1, startTime: '08:00', endTime: '08:45', subjectId: '{{subjectId}}', subjectName: 'Mathematics', teacherId: '{{teacherId}}', teacherName: 'John Doe', roomId: '{{roomId}}', roomName: 'Hall A' }] } }),
        req({ name: 'Get Published Timetable', method: 'GET', url: '/api/admin/timetable/published?classId={{classId}}&termId={{termId}}&armId={{armId}}', authType: 'user' }),
        req({ name: 'Update Published Entry', method: 'PUT', url: '/api/admin/timetable/published/{{scheduleId}}', authType: 'user', body: { subjectId: '{{subjectId}}', teacherId: '{{teacherId}}', roomId: '{{roomId}}' } }),
        req({ name: 'Delete Published Entry', method: 'DELETE', url: '/api/admin/timetable/published/{{scheduleId}}', authType: 'user' }),
        req({ name: 'Teacher Today Schedule', method: 'GET', url: '/api/teacher/timetable/today?date=2025-01-27', authType: 'teacher' })
      ]
    },
    {
      name: '03.10 - Events & Notifications',
      item: [
        req({ name: 'Get Events', method: 'GET', url: '/api/admin/events?termId={{termId}}', authType: 'user' }),
        req({ name: 'Create Event', method: 'POST', url: '/api/admin/events', authType: 'user', body: { termId: '{{termId}}', name: 'Mid-Term Break', date: '2025-03-10T00:00:00.000Z', endDate: '2025-03-14T00:00:00.000Z', type: 'holiday', notifications: { enabled: true, targets: { roles: ['teacher', 'parent'], classIds: [], userIds: [] }, channels: ['push', 'sms'], schedule: { type: 'scheduled', sendAt: '2025-03-07T08:00:00.000Z' } } } }),
        req({ name: 'Update Event', method: 'PUT', url: '/api/admin/events/{{eventId}}', authType: 'user', body: { name: 'Mid-Term Break (Updated)', endDate: '2025-03-15T00:00:00.000Z' } }),
        req({ name: 'Delete Event', method: 'DELETE', url: '/api/admin/events/{{eventId}}', authType: 'user' }),
        req({ name: 'Update Event Notification Settings', method: 'PUT', url: '/api/admin/events/{{eventId}}/notifications', authType: 'user', body: { targets: { roles: ['teacher', 'parent', 'student'], classIds: ['{{classId}}'], userIds: [] }, channels: ['push', 'in_app'], schedule: { type: 'scheduled', sendAt: '2025-03-07T08:00:00.000Z' } } }),
        req({ name: 'Get Event Notification Config', method: 'GET', url: '/api/admin/events/{{eventId}}/notifications', authType: 'user' }),
        req({ name: 'Send Notification Override', method: 'POST', url: '/api/admin/events/{{eventId}}/notify', authType: 'user', body: { targets: { roles: ['parent', 'student'], classIds: [], userIds: [] }, channels: ['push', 'sms'], message: 'Reminder: Mid-Term Break starts Monday.' } }),
        req({ name: 'Get Notification Logs', method: 'GET', url: '/api/admin/notifications/logs?eventId={{eventId}}&status=failed', authType: 'user' })
      ]
    },
    {
      name: '03.11 - Grading Scales',
      item: [
        req({ name: 'Create Grading Scale', method: 'POST', url: '/api/admin/grading-scales', authType: 'user', body: { name: 'Standard', description: 'Standard grading scale', isDefault: true, bands: [{ label: 'A', minPercent: 70, maxPercent: 100, gradePoints: 4.0 }, { label: 'B', minPercent: 60, maxPercent: 69, gradePoints: 3.0 }, { label: 'C', minPercent: 50, maxPercent: 59, gradePoints: 2.0 }, { label: 'D', minPercent: 40, maxPercent: 49, gradePoints: 1.0 }, { label: 'F', minPercent: 0, maxPercent: 39, gradePoints: 0 }] } }),
        req({ name: 'Get All Grading Scales', method: 'GET', url: '/api/admin/grading-scales', authType: 'user' }),
        req({ name: 'Get Grading Scale By ID', method: 'GET', url: '/api/admin/grading-scales/{{gradingScaleId}}', authType: 'user' }),
        req({ name: 'Update Grading Scale', method: 'PUT', url: '/api/admin/grading-scales/{{gradingScaleId}}', authType: 'user', body: { name: 'Standard (Updated)', description: 'Updated description' } }),
        req({ name: 'Set Default Grading Scale', method: 'PUT', url: '/api/admin/grading-scales/{{gradingScaleId}}/default', authType: 'user' }),
        req({ name: 'Delete Grading Scale', method: 'DELETE', url: '/api/admin/grading-scales/{{gradingScaleId}}', authType: 'user' }),
        req({ name: 'Add Grade Band', method: 'POST', url: '/api/admin/grading-scales/{{gradingScaleId}}/bands', authType: 'user', body: { label: 'A+', minPercent: 90, maxPercent: 100, gradePoints: 4.5, description: 'Excellent' } }),
        req({ name: 'Update Grade Band', method: 'PUT', url: '/api/admin/grading-scales/{{gradingScaleId}}/bands/{{bandId}}', authType: 'user', body: { label: 'A+', minPercent: 85, maxPercent: 100, gradePoints: 4.5 } }),
        req({ name: 'Delete Grade Band', method: 'DELETE', url: '/api/admin/grading-scales/{{gradingScaleId}}/bands/{{bandId}}', authType: 'user' })
      ]
    },
    {
      name: '03.12 - Score Sheet Submissions (Admin)',
      item: [
        req({ name: 'Get Submission Matrix', method: 'GET', url: '/api/admin/submissions/matrix?termId={{termId}}', authType: 'user' }),
        req({ name: 'Approve Score Sheet [DEPRECATED]', method: 'POST', url: '/api/admin/submissions/{{sheetId}}/approve', authType: 'user', body: {} }),
        req({ name: 'Return Score Sheet [DEPRECATED]', method: 'POST', url: '/api/admin/submissions/{{sheetId}}/return', authType: 'user', body: { note: 'Please revise and resubmit' } }),
        req({ name: 'Force Return Score Sheet [DEPRECATED]', method: 'POST', url: '/api/admin/submissions/{{sheetId}}/force-return', authType: 'user', body: { note: 'Admin override - please revise' } })
      ]
    },
    {
      name: '03.13 - Assessment Policies (Admin)',
      item: [
        req({ name: 'List Assessment Policies', method: 'GET', url: '/api/admin/assessment-policies', authType: 'user' }),
        req({ name: 'Get Assessment Policy By ID', method: 'GET', url: '/api/admin/assessment-policies/{{policyId}}', authType: 'user' }),
        req({ name: 'Create Assessment Policy', method: 'POST', url: '/api/admin/assessment-policies', authType: 'user', body: { name: 'Standard CA/Exam Policy', description: 'Default CA/exam policy', caComponents: [{ name: '1st CA Test', maxScore: 15, sortOrder: 0 }, { name: '2nd CA Test', maxScore: 15, sortOrder: 1 }, { name: 'Project', maxScore: 10, sortOrder: 2 }], examMax: 60 } }),
        req({ name: 'Update Assessment Policy', method: 'PUT', url: '/api/admin/assessment-policies/{{policyId}}', authType: 'user', body: { name: 'Standard CA/Exam (Updated)', caComponents: [{ name: '1st CA Test', maxScore: 20, sortOrder: 0 }, { name: '2nd CA Test', maxScore: 20, sortOrder: 1 }], examMax: 60 } }),
        req({ name: 'Delete Assessment Policy', method: 'DELETE', url: '/api/admin/assessment-policies/{{policyId}}', authType: 'user' }),
        req({ name: 'Add Policy Assignment', method: 'POST', url: '/api/admin/assessment-policies/{{policyId}}/assignments', authType: 'user', body: { scope: 'arm', scopeId: '{{armId}}', scopeName: 'A' } }),
        req({ name: 'Remove Policy Assignment', method: 'DELETE', url: '/api/admin/assessment-policies/{{policyId}}/assignments/{{assignmentId}}', authType: 'user' })
      ]
    },
    {
      name: '03.14 - Policy Permissions (Admin)',
      item: [
        req({ name: 'List Policy Permissions', method: 'GET', url: '/api/admin/policy-permissions', authType: 'user' }),
        req({ name: 'Grant Policy Permission', method: 'POST', url: '/api/admin/policy-permissions', authType: 'user', body: { teacherId: '{{teacherId}}', classId: '{{classId}}' } }),
        req({ name: 'Revoke Policy Permission', method: 'DELETE', url: '/api/admin/policy-permissions/{{permissionId}}', authType: 'user' })
      ]
    },
    {
      name: '03.15 - Teacher Policies (Admin View)',
      item: [
        req({ name: 'List Teacher Policies', method: 'GET', url: '/api/admin/teacher-policies', authType: 'user' }),
        req({ name: 'List Teacher Policies by Class', method: 'GET', url: '/api/admin/teacher-policies?classId={{classId}}', authType: 'user' })
      ]
    },
    {
      name: '03.16 - Results & Report Cards (Admin)',
      item: [
        req({ name: 'Get Publish Status', method: 'GET', url: '/api/admin/results/publish-status?termId={{termId}}&classId={{classId}}', authType: 'user' }),
        req({ name: 'Publish Results', method: 'POST', url: '/api/admin/results/publish', authType: 'user', body: { termId: '{{termId}}', classId: '{{classId}}' } }),
        req({ name: 'Generate PDFs', method: 'POST', url: '/api/admin/results/generate-pdfs', authType: 'user', body: { termId: '{{termId}}', classId: '{{classId}}' } }),
        req({ name: 'Get PDF Job Status', method: 'GET', url: '/api/admin/results/pdf-jobs/{{jobId}}', authType: 'user' }),
        req({ name: 'Download PDF', method: 'GET', url: '/api/admin/results/pdf-jobs/{{jobId}}/download', authType: 'user' }),
        req({ name: 'Get Report Card Template', method: 'GET', url: '/api/admin/report-cards/template', authType: 'user' }),
        req({ name: 'Save Report Card Template', method: 'PUT', url: '/api/admin/report-cards/template', authType: 'user', body: { orientation: 'portrait', accent: 'blue', blocks: [{ id: 'blk_header', type: 'header', label: 'School Header & Crest', enabled: true }, { id: 'blk_results', type: 'results-table', label: 'Results Table', enabled: true }, { id: 'blk_comments', type: 'comments', label: 'Class Teacher\'s Comments', enabled: true }] } }),
        req({ name: 'Get Broadsheet', method: 'GET', url: '/api/admin/broadsheets?armId={{armId}}&termId={{termId}}', authType: 'user' }),
        req({ name: 'Get Grading Activity', method: 'GET', url: '/api/admin/grading-activity?className=SSS2&armName=A&subjectName=Mathematics&termId={{termId}}', authType: 'user' })
      ]
    },
    {
      name: '03.17 - Report Card Comments & Sign-off',
      item: [
        req({ name: 'Get Comment Worklist', method: 'GET', url: '/api/admin/report-cards/comments?armId={{armId}}&termId={{termId}}', authType: 'user' }),
        req({ name: 'Save Comment', method: 'PUT', url: '/api/admin/report-cards/comments/{{studentId}}', authType: 'user', body: { armId: '{{armId}}', termId: '{{termId}}', comment: 'Excellent performance this term. Keep it up!', traits: { Punctuality: 'Excellent', Conduct: 'Good', Neatness: 'Very Good', Participation: 'Excellent', Leadership: 'Good' } } }),
        req({ name: 'Generate Report Cards', method: 'POST', url: '/api/admin/report-cards/generate', authType: 'user', body: { armId: '{{armId}}', termId: '{{termId}}' } }),
        req({ name: 'Sign Off', method: 'POST', url: '/api/admin/report-cards/sign-off', authType: 'user', body: { armId: '{{armId}}', termId: '{{termId}}' } }),
        req({ name: 'Publish to Parents', method: 'POST', url: '/api/admin/report-cards/publish', authType: 'user', body: { armId: '{{armId}}', termId: '{{termId}}' } })
      ]
    },
    {
      name: '04 - Teacher Dashboard & Grades',
      item: [
        req({ name: 'Teacher Dashboard', method: 'GET', url: '/api/teacher/dashboard', authType: 'teacher' }),
        req({ name: 'Teacher Students', method: 'GET', url: '/api/teacher/students?page=1&limit=20', authType: 'teacher' }),
        req({ name: 'Teacher Profile', method: 'GET', url: '/api/teacher/profile', authType: 'teacher' }),
        req({ name: 'Update Teacher Profile', method: 'PUT', url: '/api/teacher/profile', authType: 'teacher', body: { phone: '+2348012340000', address: 'Ikeja, Lagos' } }),
        req({ name: 'Teacher Classes', method: 'GET', url: '/api/teacher/classes', authType: 'teacher' }),
        req({ name: 'Subjects By Class', method: 'GET', url: '/api/teacher/classes/{{className}}/subjects', authType: 'teacher' }),
        req({ name: 'Students By Class Subject', method: 'GET', url: '/api/teacher/classes/{{className}}/subjects/{{subject}}/students?page=1&limit=50', authType: 'teacher' }),
        req({ name: 'Assign Grade [DEPRECATED]', method: 'POST', url: '/api/teacher/grades', authType: 'teacher', body: { studentId: '{{studentId}}', className: '{{className}}', subject: '{{subject}}', test1: 18, test2: 17, exam: 55, term: 'first', session: '2025/2026' } }),
        req({ name: 'Student Grades [DEPRECATED]', method: 'GET', url: '/api/teacher/students/{{studentId}}/grades?page=1&limit=20', authType: 'teacher' }),
        req({ name: 'Grade Details [DEPRECATED]', method: 'GET', url: '/api/teacher/grades/{{gradeId}}', authType: 'teacher' }),
        req({ name: 'Update Grade [DEPRECATED]', method: 'PUT', url: '/api/teacher/grades/{{gradeId}}', authType: 'teacher', body: { test1: 19, test2: 18, exam: 56 } }),
        req({ name: 'Delete Grade [DEPRECATED]', method: 'DELETE', url: '/api/teacher/grades/{{gradeId}}', authType: 'teacher' }),
        req({ name: 'Publish Grades [DEPRECATED]', method: 'POST', url: '/api/teacher/grades/publish', authType: 'teacher', body: { className: '{{className}}', subject: '{{subject}}', term: 'first', session: '2025/2026' } }),
        req({ name: 'Class Subject Statistics [DEPRECATED]', method: 'GET', url: '/api/teacher/classes/{{className}}/subjects/{{subject}}/statistics?term=first&session=2025/2026', authType: 'teacher' }),
        req({ name: 'Clear Teacher Grade Cache', method: 'POST', url: '/api/teacher/grades/clear-cache', authType: 'teacher' })
      ]
    },
    {
      name: '04.1 - Teacher Score Sheets',
      item: [
        req({ name: 'List Score Sheets', method: 'GET', url: '/api/teacher/score-sheets?termId={{termId}}', authType: 'teacher' }),
        req({ name: 'Create Score Sheet', method: 'POST', url: '/api/teacher/score-sheets', authType: 'teacher', body: { className: 'SSS2', subjectName: 'Mathematics', termId: '{{termId}}', academicYearId: '{{academicYearId}}', entries: [{ studentId: '{{studentId}}', caScores: { test1: 15, test2: 14, project: 9 }, examScore: 50, remark: 'Good progress' }] } }),
        req({ name: 'Update Score Sheet', method: 'PUT', url: '/api/teacher/score-sheets/{{sheetId}}', authType: 'teacher', body: { entries: [{ studentId: '{{studentId}}', caScores: { test1: 18, test2: 16, project: 10 }, examScore: 55, remark: 'Improved' }] } }),
        req({ name: 'Submit Score Sheet', method: 'POST', url: '/api/teacher/score-sheets/{{sheetId}}/submit', authType: 'teacher' }),
        req({ name: 'Get Effective Policy', method: 'GET', url: '/api/teacher/effective-policy?className=SSS2&subjectName=Mathematics', authType: 'teacher' })
      ]
    },
    {
      name: '04.2 - Assessment Entries (New Grading)',
      item: [
        req({ name: 'List Assessment Entries', method: 'GET', url: '/api/teacher/assessment-entries?className=SSS2&subjectName=Mathematics&termId={{termId}}', authType: 'teacher' }),
        req({ name: 'Create Assessment Entry', method: 'POST', url: '/api/teacher/assessment-entries', authType: 'teacher', body: { className: 'SSS2', subjectName: 'Mathematics', termId: '{{termId}}', componentType: 'CA', name: '1st CA Test', maxScore: 15, contributionPoints: 15 } }),
        req({ name: 'Update Assessment Entry', method: 'PUT', url: '/api/teacher/assessment-entries/{{entryId}}', authType: 'teacher', body: { name: '1st CA Test (Updated)', maxScore: 20, contributionPoints: 20 } }),
        req({ name: 'Delete Assessment Entry', method: 'DELETE', url: '/api/teacher/assessment-entries/{{entryId}}', authType: 'teacher' }),
        req({ name: 'Save Scores', method: 'POST', url: '/api/teacher/assessment-entries/{{entryId}}/scores', authType: 'teacher', body: { scores: [{ studentId: '{{studentId}}', score: 14 }, { studentId: '{{studentId2}}', score: 12 }] } })
      ]
    },
    {
      name: '04.3 - Teacher Delegated Policies',
      item: [
        req({ name: 'Check My Policy Permission', method: 'GET', url: '/api/teacher/my-policy-permission', authType: 'teacher' }),
        req({ name: 'List My Policies', method: 'GET', url: '/api/teacher/my-policies', authType: 'teacher' }),
        req({ name: 'Create My Policy', method: 'POST', url: '/api/teacher/my-policies', authType: 'teacher', body: { name: 'SS 2 Custom (40 CA / 60 Exam)', description: 'Custom policy', caComponents: [{ name: '1st CA Test', maxScore: 15, sortOrder: 0 }, { name: '2nd CA Test', maxScore: 15, sortOrder: 1 }, { name: 'Project', maxScore: 10, sortOrder: 2 }], examMax: 60 } }),
        req({ name: 'Update My Policy', method: 'PUT', url: '/api/teacher/my-policies/{{policyId}}', authType: 'teacher', body: { name: 'SS 2 Custom (Updated)', caComponents: [{ name: '1st CA Test', maxScore: 15, sortOrder: 0 }, { name: '2nd CA Test', maxScore: 15, sortOrder: 1 }, { name: 'Project', maxScore: 10, sortOrder: 2 }], examMax: 60 } }),
        req({ name: 'Delete My Policy', method: 'DELETE', url: '/api/teacher/my-policies/{{policyId}}', authType: 'teacher' }),
        req({ name: 'Add Policy Assignment', method: 'POST', url: '/api/teacher/my-policies/{{policyId}}/assignments', authType: 'teacher', body: { scope: 'arm', scopeId: '{{armId}}', scopeName: 'A' } }),
        req({ name: 'Remove Policy Assignment', method: 'DELETE', url: '/api/teacher/my-policies/{{policyId}}/assignments/{{assignmentId}}', authType: 'teacher' })
      ]
    },
    {
      name: '04.4 - Teacher Attendance',
      item: [
        req({ name: 'Get Attendance Schedule', method: 'GET', url: '/api/teacher/attendance/schedule?date=2026-06-13', authType: 'teacher' }),
        req({ name: 'Get Session Students', method: 'GET', url: '/api/teacher/attendance/sessions/{{scheduleId}}/students?className=SSS2&subjectName=Mathematics', authType: 'teacher' }),
        req({ name: 'Save Attendance Draft', method: 'POST', url: '/api/teacher/attendance/draft', authType: 'teacher', body: { scheduleId: '{{scheduleId}}', sessions: [{ studentId: '{{studentId}}', status: 'present' }] } }),
        req({ name: 'Submit Attendance', method: 'POST', url: '/api/teacher/attendance/submit', authType: 'teacher', body: { scheduleId: '{{scheduleId}}', sessions: [{ studentId: '{{studentId}}', status: 'present' }] } }),
        req({ name: 'Update Attendance Record', method: 'PUT', url: '/api/teacher/attendance/{{attendanceId}}', authType: 'teacher', body: { status: 'absent', reason: 'Sick' } }),
        req({ name: 'Get Attendance History', method: 'GET', url: '/api/teacher/attendance/history?page=1&limit=20&status=submitted&startDate=2026-06-01&endDate=2026-06-30', authType: 'teacher' }),
        req({ name: 'Get Attendance By Date', method: 'GET', url: '/api/teacher/attendance/date/2026-06-13', authType: 'teacher' }),
        req({ name: 'Get Attendance Summary', method: 'GET', url: '/api/teacher/attendance/summary/{{scheduleId}}', authType: 'teacher' })
      ]
    },
    {
      name: '05 - Parent Dashboard',
      item: [
        req({ name: 'Parent Dashboard', method: 'GET', url: '/api/parent/dashboard', authType: 'parent' }),
        req({ name: 'Parent Children', method: 'GET', url: '/api/parent/children', authType: 'parent' }),
        req({ name: 'Specific Child', method: 'GET', url: '/api/parent/children/{{studentId}}', authType: 'parent' }),
        req({ name: 'Child Grades', method: 'GET', url: '/api/parent/children/{{studentId}}/grades?termId={{termId}}', authType: 'parent' }),
        req({ name: 'Child Attendance', method: 'GET', url: '/api/parent/children/{{studentId}}/attendance?termId={{termId}}', authType: 'parent' }),
        req({ name: 'Parent Profile', method: 'GET', url: '/api/parent/profile', authType: 'parent' }),
        req({ name: 'Update Parent Profile', method: 'PUT', url: '/api/parent/profile', authType: 'parent', body: { phone: '+2348012340000', address: 'Ikeja, Lagos', occupation: 'Engineer' } })
      ]
    },
    {
      name: '06 - School Profile',
      item: [
        req({ name: 'Get School Profile', method: 'GET', url: '/api/school/profile', authType: 'user' }),
        req({ name: 'Update School Profile', method: 'PUT', url: '/api/school/profile', authType: 'user', body: { schoolName: 'Sunrise Academy Updated', phone: '+2348012345678', address: 'Lagos', website: 'https://sunrise.edu' } }),
        req({ name: 'Update Admin Profile', method: 'PUT', url: '/api/school/profile/admin', authType: 'user', body: { firstName: 'John', lastName: 'Doe', phone: '+2348012345678' } }),
        req({ name: 'Change School Status', method: 'POST', url: '/api/school/profile/status', authType: 'user', body: { schoolId: '{{schoolId}}', isActive: true, reason: 'Reactivation' } })
      ]
    },
    {
      name: '07 - Student Management',
      item: [
        req({ name: 'Create Student', method: 'POST', url: '/api/students', authType: 'user', body: { firstName: 'Amaka', lastName: 'Nwosu', email: 'amaka.nwosu@school.edu', password: 'Password123!', classId: '{{classId}}', armId: '{{armId}}', studentId: 'STU2024-001', rollNumber: '12', dateOfBirth: '2013-05-15', gender: 'female', address: '12 Palm Avenue, Ikeja, Lagos', phone: '+2348023456789', parentIds: ['{{parentId}}'], teacherIds: ['{{teacherId}}'], guardian: { fullName: 'Mr. Emeka Nwosu', relationship: 'Father', phone: '+2348034567890', email: 'emeka.nwosu@gmail.com', address: '12 Palm Avenue, Ikeja, Lagos' } } }),
        req({ name: 'List Students', method: 'GET', url: '/api/students?classId={{classId}}&armId={{armId}}&page=1&limit=20&search=', authType: 'user' }),
        req({ name: 'Get Student Details', method: 'GET', url: '/api/students/{{studentId}}', authType: 'user' }),
        req({ name: 'Update Student', method: 'PUT', url: '/api/students/{{studentId}}', authType: 'user', body: { firstName: 'Amaka', lastName: 'Nwosu', classId: '{{classId}}', armId: '{{armId}}' } }),
        req({ name: 'Toggle Student Status', method: 'POST', url: '/api/students/toggle-status', authType: 'user', body: { studentId: '{{studentId}}', action: 'deactivate', reason: 'Transferred out' } }),
        req({ name: 'Remove Student', method: 'DELETE', url: '/api/students/remove', authType: 'user', body: { studentId: '{{studentId}}', reason: 'Removed by admin' } })
      ]
    },
    {
      name: '08 - Parent Management',
      item: [
        req({ name: 'Invite Parent', method: 'POST', url: '/api/parent-management/invite-parent', authType: 'user', body: { email: 'parent2@example.com', firstName: 'Grace', lastName: 'Ife', studentIds: ['{{studentId}}'], message: 'Kindly complete registration' } }),
        req({ name: 'List Parents', method: 'GET', url: '/api/parent-management/parents?page=1&limit=20&search=', authType: 'user' }),
        req({ name: 'Parent Details', method: 'GET', url: '/api/parent-management/parents/{{parentId}}', authType: 'user' }),
        req({ name: 'Link Parent To Students', method: 'POST', url: '/api/parent-management/parents/{{parentId}}/link-students', authType: 'user', body: { studentIds: ['{{studentId}}'] } }),
        req({ name: 'Unlink Parent From Students', method: 'POST', url: '/api/parent-management/parents/{{parentId}}/unlink-students', authType: 'user', body: { studentIds: ['{{studentId}}'] } }),
        req({ name: 'Remove Parent', method: 'DELETE', url: '/api/parent-management/parents/{{parentId}}', authType: 'user', body: { reason: 'No longer associated' } })
      ]
    },
    {
      name: '09 - Teacher Assignment',
      item: [
        req({ name: 'Assign Teacher', method: 'POST', url: '/api/admin/assign-teacher', authType: 'user', body: { teacherId: '{{teacherId}}', studentIds: ['{{studentId}}'] } }),
        req({ name: 'Assign Teachers Bulk', method: 'POST', url: '/api/admin/assign-teachers-bulk', authType: 'user', body: { assignments: [{ teacherId: '{{teacherId}}', studentIds: ['{{studentId}}'] }] } }),
        req({ name: 'Unassign Teacher', method: 'POST', url: '/api/admin/unassign-teacher', authType: 'user', body: { teacherId: '{{teacherId}}', studentIds: ['{{studentId}}'] } }),
        req({ name: 'Assign Teacher To Student', method: 'POST', url: '/api/admin/students/{{studentId}}/teachers/{{teacherId}}', authType: 'user' }),
        req({ name: 'Unassign Teacher From Student', method: 'DELETE', url: '/api/admin/students/{{studentId}}/teachers/{{teacherId}}', authType: 'user' }),
        req({ name: 'Get Teacher Students', method: 'GET', url: '/api/admin/teachers/{{teacherId}}/students?page=1&limit=20', authType: 'user' }),
        req({ name: 'Get Student Teachers', method: 'GET', url: '/api/admin/students/{{studentId}}/teachers', authType: 'user' })
      ]
    },
    {
      name: '10 - Teacher Class Assignment',
      item: [
        req({ name: 'Assign Classes To Teacher (Whole Class)', method: 'POST', url: '/api/admin/teachers/assign-classes', authType: 'user', body: { teacherId: '{{teacherId}}', classes: ['JSS1', 'JSS2'] } }),
        req({ name: 'Assign Classes To Teacher (By Arm)', method: 'POST', url: '/api/admin/teachers/assign-classes', authType: 'user', body: { teacherId: '{{teacherId}}', arms: ['{{armId}}'] } }),
        req({ name: 'Assign Subjects To Teacher', method: 'POST', url: '/api/admin/teachers/assign-subjects', authType: 'user', body: { teacherId: '{{teacherId}}', subjects: ['{{subjectId}}', '{{subjectId1}}'] } }),
        req({ name: 'Remove Classes From Teacher', method: 'DELETE', url: '/api/admin/teachers/remove-classes', authType: 'user', body: { teacherId: '{{teacherId}}', classes: ['JSS1'] } }),
        req({ name: 'Remove Arms From Teacher', method: 'DELETE', url: '/api/admin/teachers/remove-classes', authType: 'user', body: { teacherId: '{{teacherId}}', arms: ['{{armId}}'] } }),
        req({ name: 'Get Teacher Assignments', method: 'GET', url: '/api/admin/teachers/{{teacherId}}/assignments', authType: 'user' })
      ]
    },
    {
      name: '11 - System Admin Auth',
      item: [
        req({ name: 'System Admin Login', method: 'POST', url: '/api/system-admin/auth/login', body: { email: 'admin@yourdomain.com', password: 'YourPassword' } }),
        req({ name: 'System Admin Verify', method: 'GET', url: '/api/system-admin/auth/verify', authType: 'systemAdmin' }),
        req({ name: 'System Admin Refresh', method: 'POST', url: '/api/system-admin/auth/refresh', authType: 'systemAdmin', body: { token: '{{systemAdminToken}}' } }),
        req({ name: 'System Admin Logout', method: 'POST', url: '/api/system-admin/auth/logout', authType: 'systemAdmin' }),
        req({ name: 'System Admin Status', method: 'GET', url: '/api/system-admin/auth/status' }),
        req({ name: 'System Admin Me', method: 'GET', url: '/api/system-admin/auth/me', authType: 'systemAdmin' })
      ]
    },
    {
      name: '12 - System Admin Core',
      item: [
        req({ name: 'Platform Overview', method: 'GET', url: '/api/system-admin/platform/overview', authType: 'systemAdmin' }),
        req({ name: 'System Health', method: 'GET', url: '/api/system-admin/system/health', authType: 'systemAdmin' }),
        req({ name: 'Platform KPIs', method: 'GET', url: '/api/system-admin/platform/kpis?timeRange=30d', authType: 'systemAdmin' }),
        req({ name: 'Cross School Metrics', method: 'GET', url: '/api/system-admin/metrics/cross-school?metric=overview', authType: 'systemAdmin' }),
        req({ name: 'School Management', method: 'GET', url: '/api/system-admin/schools/management?page=1&limit=20', authType: 'systemAdmin' }),
        req({ name: 'Create School', method: 'POST', url: '/api/system-admin/schools', authType: 'systemAdmin', body: { schoolName: 'New Horizon College', email: 'admin@newhorizon.edu', adminFirstName: 'Musa', adminLastName: 'Ali', phone: '+2348000000000', address: 'Abuja' } }),
        req({ name: 'Update School Config', method: 'PUT', url: '/api/system-admin/schools/{{schoolId}}/config', authType: 'systemAdmin', body: { subscriptionTier: 'premium', limits: { maxUsers: 500, maxStudents: 2000 } } }),
        req({ name: 'Deactivate School', method: 'PUT', url: '/api/system-admin/schools/{{schoolId}}/deactivate', authType: 'systemAdmin', body: { reason: 'Policy breach' } }),
        req({ name: 'Reactivate School', method: 'PUT', url: '/api/system-admin/schools/{{schoolId}}/reactivate', authType: 'systemAdmin', body: { reason: 'Issue resolved' } }),
        req({ name: 'Cross School User Management', method: 'GET', url: '/api/system-admin/users/management?page=1&limit=20', authType: 'systemAdmin' }),
        req({ name: 'Manage User Access', method: 'PUT', url: '/api/system-admin/users/{{userId}}/access', authType: 'systemAdmin', body: { action: 'suspend', reason: 'Security review' } }),
        req({ name: 'Security Alerts', method: 'GET', url: '/api/system-admin/security/alerts', authType: 'systemAdmin' }),
        req({ name: 'System Admin API Health', method: 'GET', url: '/api/system-admin/health', authType: 'systemAdmin' })
      ]
    },
    {
      name: '13 - Config (Public)',
      item: [
        req({ name: 'Get Supported Locales', method: 'GET', url: '/api/config/locales' })
      ]
    },
    {
      name: '14 - Student Dashboard',
      description: 'Endpoints for student-facing dashboard. Requires user with role=student and linked Student profile.',
      item: [
        {
          name: '14.0 - Global / Identity',
          item: [
            req({ name: 'Get Student Identity (/me)', method: 'GET', url: '/api/student/me', authType: 'student' })
          ]
        },
        {
          name: '14.1 - Notifications',
          item: [
            req({ name: 'List Notifications', method: 'GET', url: '/api/student/notifications?page=1&limit=20', authType: 'student' }),
            req({ name: 'List Unread Only', method: 'GET', url: '/api/student/notifications?unread=true&page=1&limit=20', authType: 'student' }),
            req({ name: 'Mark All Read', method: 'PATCH', url: '/api/student/notifications/read-all', authType: 'student' }),
            req({ name: 'Mark Single Read', method: 'PATCH', url: '/api/student/notifications/{{notificationId}}/read', authType: 'student' })
          ]
        },
        {
          name: '14.2 - Dashboard Home',
          item: [
            req({ name: 'Get Dashboard Overview', method: 'GET', url: '/api/student/dashboard', authType: 'student' }),
            req({ name: 'Get Timetable (Current Week)', method: 'GET', url: '/api/student/timetable', authType: 'student' }),
            req({ name: 'Get Timetable (Specific Week)', method: 'GET', url: '/api/student/timetable?week=2025-W28', authType: 'student' })
          ]
        },
        {
          name: '14.3 - My Academics',
          item: [
            req({ name: 'Get Terms List', method: 'GET', url: '/api/student/terms', authType: 'student' }),
            req({ name: 'Get Academics (Current Term)', method: 'GET', url: '/api/student/academics?page=1&limit=20', authType: 'student' }),
            req({ name: 'Get Academics (Specific Term)', method: 'GET', url: '/api/student/academics?termId={{termId}}&page=1&limit=20', authType: 'student' })
          ]
        },
        {
          name: '14.4 - Assignments',
          item: [
            req({ name: 'List All Assignments', method: 'GET', url: '/api/student/assignments?page=1&limit=20', authType: 'student' }),
            req({ name: 'List Pending', method: 'GET', url: '/api/student/assignments?status=pending&page=1&limit=10', authType: 'student' }),
            req({ name: 'List Submitted', method: 'GET', url: '/api/student/assignments?status=submitted&page=1&limit=20', authType: 'student' }),
            req({ name: 'List Graded', method: 'GET', url: '/api/student/assignments?status=graded&page=1&limit=20', authType: 'student' }),
            req({ name: 'List Overdue', method: 'GET', url: '/api/student/assignments?status=overdue&page=1&limit=20', authType: 'student' }),
            req({ name: 'Get Single Assignment', method: 'GET', url: '/api/student/assignments/{{assignmentId}}', authType: 'student' }),
            req({ name: 'Submit Assignment (URLs only)', method: 'POST', url: '/api/student/assignments/{{assignmentId}}/submit', authType: 'student', body: { textResponse: 'My essay response here...', attachments: [{ fileId: 'uuid-1', fileName: 'essay.pdf', fileUrl: 'https://cloudinary.com/.../essay.pdf', mimeType: 'application/pdf' }] } })
          ]
        },
        {
          name: '14.5 - Teacher Directory',
          item: [
            req({ name: 'List Teachers', method: 'GET', url: '/api/student/teachers?page=1&limit=20', authType: 'student' }),
            req({ name: 'Search Teachers', method: 'GET', url: '/api/student/teachers?search=okonkwo&page=1&limit=20', authType: 'student' })
          ]
        },
        {
          name: '14.6 - Student Profile',
          item: [
            req({ name: 'Get Profile', method: 'GET', url: '/api/student/profile', authType: 'student' }),
            req({ name: 'Update Profile', method: 'PATCH', url: '/api/student/profile', authType: 'student', body: { phone: '+2348023456789', address: '14 Palm Avenue, Ikeja, Lagos', avatarUrl: 'https://cloudinary.com/.../avatar.jpg' } }),
            req({ name: 'Get Activity Feed', method: 'GET', url: '/api/student/activity?page=1&limit=20', authType: 'student' })
          ]
        },
        {
          name: '14.7 - Account Settings',
          item: [
            req({ name: 'Get Settings', method: 'GET', url: '/api/student/settings', authType: 'student' }),
            req({ name: 'Update Settings (Partial)', method: 'PATCH', url: '/api/student/settings', authType: 'student', body: { notifications: { smsEnabled: true, gradePublished: false }, preferences: { darkMode: true, language: 'yo' } } }),
            req({ name: 'Change Password', method: 'POST', url: '/api/student/auth/change-password', authType: 'student', body: { currentPassword: 'OldPass@123', newPassword: 'NewPass@456', confirmPassword: 'NewPass@456' } })
          ]
        }
      ]
    },
    {
      name: '15 - Fee Management',
      description: 'Complete Fee & Payment Management engine (A–H layers, 31 endpoints).',
      item: [
        {
          name: 'A - Fee Structures',
          item: [
            req({ name: 'List Fee Structures', method: 'GET', url: '/api/fees/structures?academicYearId={{academicYearId}}&termId={{termId}}&classId={{classId}}&status=published&page=1&limit=20', authType: 'user' }),
            req({ name: 'Get Fee Structure by ID', method: 'GET', url: '/api/fees/structures/{{feeStructureId}}', authType: 'user' }),
            req({ name: 'Create Fee Structure', method: 'POST', url: '/api/fees/structures', authType: 'user', body: { academicYearId: '{{academicYearId}}', termId: '{{termId}}', classId: '{{classId}}', name: '2025 Tuition Fee', items: [{ feeType: 'tuition', name: 'Tuition Fee', amount: 500000, optional: false }, { feeType: 'sports', name: 'Sports Levy', amount: 50000, optional: true }], totalAmount: 550000, dueDate: '2025-09-15T00:00:00.000Z', paymentType: 'one-time', installmentPlans: [] } }),
            req({ name: 'Update Fee Structure', method: 'PUT', url: '/api/fees/structures/{{feeStructureId}}', authType: 'user', body: { name: '2025 Tuition Fee (Revised)', totalAmount: 600000, dueDate: '2025-10-01T00:00:00.000Z' } }),
            req({ name: 'Delete Fee Structure', method: 'DELETE', url: '/api/fees/structures/{{feeStructureId}}', authType: 'user' }),
            req({ name: 'Clone Fee Structure', method: 'POST', url: '/api/fees/structures/{{feeStructureId}}/clone', authType: 'user', body: { targetAcademicYearId: '{{academicYearId}}', targetTermId: '{{termId}}', targetClassIds: ['{{classId}}'] } }),
            req({ name: 'Publish / Revert Fee Structure', method: 'POST', url: '/api/fees/structures/{{feeStructureId}}/transition', authType: 'user', body: { action: 'publish' } }),
            req({ name: 'Get Fee Structure Versions', method: 'GET', url: '/api/fees/structures/{{feeStructureId}}/versions', authType: 'user' })
          ]
        },
        {
          name: 'B - Invoices',
          item: [
            req({ name: 'List Invoices', method: 'GET', url: '/api/fees/invoices?academicYearId={{academicYearId}}&termId={{termId}}&classId={{classId}}&status=pending&page=1&limit=20', authType: 'user' }),
            req({ name: 'Get Invoice by ID', method: 'GET', url: '/api/fees/invoices/{{invoiceId}}', authType: 'user' }),
            req({ name: 'Create Invoices (Manual)', method: 'POST', url: '/api/fees/invoices', authType: 'user', body: { invoices: [{ feeStructureId: '{{feeStructureId}}', studentId: '{{studentId}}' }] } }),
            req({ name: 'Generate Invoices for Class', method: 'POST', url: '/api/fees/invoices/generate', authType: 'user', body: { feeStructureId: '{{feeStructureId}}', classId: '{{classId}}', armId: '{{armId}}', includeOptional: ['sports'] } }),
            req({ name: 'Void Invoice', method: 'PUT', url: '/api/fees/invoices/{{invoiceId}}/void', authType: 'user', body: { reason: 'Invoice issued in error' } }),
            req({ name: 'Get Student Fees', method: 'GET', url: '/api/fees/students/{{studentId}}/fees', authType: 'user' })
          ]
        },
        {
          name: 'C - Payments',
          item: [
            req({ name: 'Record Manual Payment', method: 'POST', url: '/api/fees/invoices/{{invoiceId}}/payments', authType: 'user', body: { amount: 250000, paymentMethod: 'bank_transfer', referenceNumber: 'TXN-001', receiptNumber: 'RCP-001', note: 'First installment', paidAt: '2025-06-01T10:00:00.000Z' } }),
            req({ name: 'Initialize Gateway Payment', method: 'POST', url: '/api/fees/invoices/{{invoiceId}}/initialize', authType: 'user', body: { gateway: 'paystack', amount: 250000, email: 'parent@example.com', callbackUrl: 'https://school.edu/payment/callback' } }),
            req({ name: 'Verify Payment', method: 'POST', url: '/api/fees/payments/verify', authType: 'user', body: { reference: 'paystack_ref_12345', gateway: 'paystack' } }),
            req({ name: 'Get Payment History (by Invoice)', method: 'GET', url: '/api/fees/invoices/{{invoiceId}}/payments', authType: 'user' }),
            req({ name: 'Get All Payments', method: 'GET', url: '/api/fees/payments?from=2025-01-01&to=2025-12-31&method=bank_transfer&status=confirmed&page=1&limit=20', authType: 'user' })
          ]
        },
        {
          name: 'D - Adjustments',
          item: [
            req({ name: 'Apply Adjustment', method: 'POST', url: '/api/fees/adjustments', authType: 'user', body: { studentId: '{{studentId}}', invoiceId: '{{invoiceId}}', type: 'discount', amount: 50000, reason: 'Sibling discount 10%' } }),
            req({ name: 'List Adjustments', method: 'GET', url: '/api/fees/adjustments?studentId={{studentId}}&type=discount&from=2025-01-01&to=2025-12-31', authType: 'user' })
          ]
        },
        {
          name: 'E - Ledger',
          item: [
            req({ name: 'Get Student Ledger', method: 'GET', url: '/api/fees/ledger/students/{{studentId}}?academicYearId={{academicYearId}}&termId={{termId}}', authType: 'user' }),
            req({ name: 'Get Ledger Summary', method: 'GET', url: '/api/fees/ledger/summary?academicYearId={{academicYearId}}&termId={{termId}}', authType: 'user' })
          ]
        },
        {
          name: 'F - Receipts',
          item: [
            req({ name: 'Get Receipt', method: 'GET', url: '/api/fees/receipts/{{paymentId}}', authType: 'user' }),
            req({ name: 'Send Receipt', method: 'POST', url: '/api/fees/receipts/{{paymentId}}/send', authType: 'user', body: { channel: 'email', to: 'parent@example.com' } })
          ]
        },
        {
          name: 'G - Reports',
          item: [
            req({ name: 'Get Fee Analytics', method: 'GET', url: '/api/fees/reports/analytics?academicYearId={{academicYearId}}&termId={{termId}}&classId={{classId}}', authType: 'user' }),
            req({ name: 'Get Outstanding Balances', method: 'GET', url: '/api/fees/reports/outstanding?academicYearId={{academicYearId}}&termId={{termId}}&classId={{classId}}&threshold=100000&page=1&limit=20', authType: 'user' }),
            req({ name: 'Get Aging Report', method: 'GET', url: '/api/fees/reports/aging?academicYearId={{academicYearId}}&termId={{termId}}&classId={{classId}}', authType: 'user' }),
            req({ name: 'Get Collection Report', method: 'GET', url: '/api/fees/reports/collections?from=2025-01-01&to=2025-12-31&academicYearId={{academicYearId}}&termId={{termId}}&classId={{classId}}', authType: 'user' })
          ]
        },
        {
          name: 'H - Reconciliation',
          item: [
            req({ name: 'Import Settlements', method: 'POST', url: '/api/fees/reconciliation/import', authType: 'user', body: { gateway: 'paystack', settlements: [{ settlementId: 'sttl_001', amount: 7500000, settledAt: '2026-01-16T00:00:00.000Z' }, { settlementId: 'sttl_002', amount: 5000000, settledAt: '2026-01-16T00:00:00.000Z' }] } }),
            req({ name: 'List Reconciliation Records', method: 'GET', url: '/api/fees/reconciliation?gateway=paystack&from=2025-01-01&to=2025-12-31&status=unmatched&page=1&limit=20', authType: 'user' }),
            req({ name: 'Match Transaction', method: 'POST', url: '/api/fees/reconciliation/match', authType: 'user', body: { settlementId: 'sttl_001', paymentId: '{{paymentId}}' } })
          ]
        }
      ]
    }
  ],
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000', type: 'string' },
    { key: 'accessToken', value: '', type: 'string' },
    { key: 'teacheraccessToken', value: '', type: 'string' },
    { key: 'studentaccessToken', value: '', type: 'string' },
    { key: 'parentaccessToken', value: '', type: 'string' },
    { key: 'systemAdminToken', value: '', type: 'string' },
    { key: 'refreshToken', value: '', type: 'string' },
    { key: 'schoolId', value: 'SCH1234', type: 'string' },
    { key: 'userId', value: '', type: 'string' },
    { key: 'teacherId', value: '', type: 'string' },
    { key: 'studentId', value: '', type: 'string' },
    { key: 'studentId2', value: '', type: 'string' },
    { key: 'parentId', value: '', type: 'string' },
    { key: 'invitationId', value: '', type: 'string' },
    { key: 'gradeId', value: '', type: 'string' },
    { key: 'entryId', value: '', type: 'string' },
    { key: 'jobId', value: '', type: 'string' },
    { key: 'scheduleId', value: '', type: 'string' },
    { key: 'attendanceId', value: '', type: 'string' },
    { key: 'className', value: 'JSS1', type: 'string' },
    { key: 'subject', value: 'Mathematics', type: 'string' },
    { key: 'classId', value: '', type: 'string' },
    { key: 'termId', value: '', type: 'string' },
    { key: 'academicYearId', value: '', type: 'string' },
    { key: 'armId', value: '', type: 'string' },
    { key: 'roomId', value: '', type: 'string' },
    { key: 'eventId', value: '', type: 'string' },
    { key: 'feeStructureId', value: '', type: 'string' },
    { key: 'invoiceId', value: '', type: 'string' },
    { key: 'paymentId', value: '', type: 'string' },
    { key: 'gradingScaleId', value: '', type: 'string' },
    { key: 'bandId', value: '', type: 'string' },
    { key: 'sheetId', value: '', type: 'string' },
    { key: 'permissionId', value: '', type: 'string' },
    { key: 'policyId', value: '', type: 'string' },
    { key: 'assignmentId', value: '', type: 'string' },
    { key: 'notificationId', value: '', type: 'string' },
    { key: 'assignmentId', value: '', type: 'string' },
    { key: 'studentId1', value: '', type: 'string' },
    { key: 'studentId2', value: '', type: 'string' },
    { key: 'subjectId', value: '', type: 'string' },
    { key: 'subjectId1', value: '', type: 'string' },
    { key: 'subjectId2', value: '', type: 'string' },
    { key: 'sourceArmId', value: '', type: 'string' },
    { key: 'targetArmId', value: '', type: 'string' },
    { key: 'yearId', value: '', type: 'string' }
  ]
};

fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log(`Generated ${out}`);

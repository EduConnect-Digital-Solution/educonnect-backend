const fs = require('fs');

const out = 'docs/postman/EduConnect-Full-API.postman_collection.json';
const base = '{{baseUrl}}';

const headers = (authType, hasBody) => {
  const values = [];
  if (hasBody) values.push({ key: 'Content-Type', value: 'application/json' });
  if (authType === 'user') values.push({ key: 'Authorization', value: 'Bearer {{accessToken}}' });
  if (authType === 'systemAdmin') values.push({ key: 'Authorization', value: 'Bearer {{systemAdminToken}}' });
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
      name: '04 - Teacher Dashboard & Grades',
      item: [
        req({ name: 'Teacher Dashboard', method: 'GET', url: '/api/teacher/dashboard', authType: 'user' }),
        req({ name: 'Teacher Students', method: 'GET', url: '/api/teacher/students?page=1&limit=20', authType: 'user' }),
        req({ name: 'Teacher Profile', method: 'GET', url: '/api/teacher/profile', authType: 'user' }),
        req({ name: 'Teacher Classes', method: 'GET', url: '/api/teacher/classes', authType: 'user' }),
        req({ name: 'Subjects By Class', method: 'GET', url: '/api/teacher/classes/{{className}}/subjects', authType: 'user' }),
        req({ name: 'Students By Class Subject', method: 'GET', url: '/api/teacher/classes/{{className}}/subjects/{{subject}}/students?page=1&limit=50', authType: 'user' }),
        req({ name: 'Assign Grade', method: 'POST', url: '/api/teacher/grades', authType: 'user', body: { studentId: '{{studentId}}', className: '{{className}}', subject: '{{subject}}', test1: 18, test2: 17, exam: 55, term: 'first', session: '2025/2026' } }),
        req({ name: 'Student Grades', method: 'GET', url: '/api/teacher/students/{{studentId}}/grades?page=1&limit=20', authType: 'user' }),
        req({ name: 'Grade Details', method: 'GET', url: '/api/teacher/grades/{{gradeId}}', authType: 'user' }),
        req({ name: 'Update Grade', method: 'PUT', url: '/api/teacher/grades/{{gradeId}}', authType: 'user', body: { test1: 19, test2: 18, exam: 56 } }),
        req({ name: 'Delete Grade', method: 'DELETE', url: '/api/teacher/grades/{{gradeId}}', authType: 'user' }),
        req({ name: 'Publish Grades', method: 'POST', url: '/api/teacher/grades/publish', authType: 'user', body: { className: '{{className}}', subject: '{{subject}}', term: 'first', session: '2025/2026' } }),
        req({ name: 'Class Subject Statistics', method: 'GET', url: '/api/teacher/classes/{{className}}/subjects/{{subject}}/statistics?term=first&session=2025/2026', authType: 'user' }),
        req({ name: 'Clear Teacher Grade Cache', method: 'POST', url: '/api/teacher/grades/clear-cache', authType: 'user' })
      ]
    },
    {
      name: '05 - Parent Dashboard',
      item: [
        req({ name: 'Parent Dashboard', method: 'GET', url: '/api/parent/dashboard', authType: 'user' }),
        req({ name: 'Parent Children', method: 'GET', url: '/api/parent/children', authType: 'user' }),
        req({ name: 'Specific Child', method: 'GET', url: '/api/parent/children/{{studentId}}', authType: 'user' }),
        req({ name: 'Parent Profile', method: 'GET', url: '/api/parent/profile', authType: 'user' }),
        req({ name: 'Update Parent Profile', method: 'PUT', url: '/api/parent/profile', authType: 'user', body: { phone: '+2348012340000', address: 'Ikeja, Lagos', occupation: 'Engineer' } })
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
        req({ name: 'Create Student', method: 'POST', url: '/api/students', authType: 'user', body: { firstName: 'Amaka', lastName: 'Nwosu', class: 'JSS1', section: 'A', rollNumber: '12', grade: 'JSS1', gender: 'female' } }),
        req({ name: 'List Students', method: 'GET', url: '/api/students?class=JSS1&section=A&page=1&limit=20&search=', authType: 'user' }),
        req({ name: 'Get Student Details', method: 'GET', url: '/api/students/{{studentId}}', authType: 'user' }),
        req({ name: 'Update Student', method: 'PUT', url: '/api/students/{{studentId}}', authType: 'user', body: { firstName: 'Amaka', lastName: 'Nwosu', class: 'JSS2', section: 'A' } }),
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
        req({ name: 'Assign Classes To Teacher', method: 'POST', url: '/api/admin/teachers/assign-classes', authType: 'user', body: { teacherId: '{{teacherId}}', classes: ['JSS1', 'JSS2'] } }),
        req({ name: 'Assign Subjects To Teacher', method: 'POST', url: '/api/admin/teachers/assign-subjects', authType: 'user', body: { teacherId: '{{teacherId}}', subjects: ['Mathematics', 'English'] } }),
        req({ name: 'Remove Classes From Teacher', method: 'DELETE', url: '/api/admin/teachers/remove-classes', authType: 'user', body: { teacherId: '{{teacherId}}', classes: ['JSS1'] } }),
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
        req({ name: 'System Admin Status', method: 'GET', url: '/api/system-admin/auth/status' })
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
    }
  ],
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000', type: 'string' },
    { key: 'accessToken', value: '', type: 'string' },
    { key: 'systemAdminToken', value: '', type: 'string' },
    { key: 'refreshToken', value: '', type: 'string' },
    { key: 'schoolId', value: 'SCH1234', type: 'string' },
    { key: 'userId', value: '', type: 'string' },
    { key: 'teacherId', value: '', type: 'string' },
    { key: 'studentId', value: '', type: 'string' },
    { key: 'parentId', value: '', type: 'string' },
    { key: 'invitationId', value: '', type: 'string' },
    { key: 'gradeId', value: '', type: 'string' },
    { key: 'className', value: 'JSS1', type: 'string' },
    { key: 'subject', value: 'Mathematics', type: 'string' }
  ]
};

fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log(`Generated ${out}`);

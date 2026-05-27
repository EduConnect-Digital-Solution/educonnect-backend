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
        req({ name: 'Bulk Assign Students to Classes', method: 'POST', url: '/api/academic/students/assign', authType: 'user', body: { assignments: [{ studentId: '{{studentId1}}', classId: '{{classId1}}', armId: '{{armId1}}' }, { studentId: '{{studentId2}}', classId: '{{classId2}}', armId: '{{armId2}}' }] } }),
        req({ name: 'Bulk Unassign Students from Classes', method: 'POST', url: '/api/academic/students/unassign', authType: 'user', body: { studentIds: ['{{studentId1}}', '{{studentId2}}'] } }),
        req({ name: 'Get Class Population Statistics', method: 'GET', url: '/api/academic/classes/population?classId={{classId}}', authType: 'user' }),
        req({ name: 'Get Unassigned Students', method: 'GET', url: '/api/academic/students/unassigned?page={{page}}&limit={{limit}}', authType: 'user' })
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
        req({ name: 'Teacher Today Schedule', method: 'GET', url: '/api/teacher/timetable/today?date=2025-01-27', authType: 'user' })
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
        req({ name: 'Create Student', method: 'POST', url: '/api/students', authType: 'user', body: { firstName: 'Amaka', lastName: 'Nwosu', email: 'amaka.nwosu@school.edu', password: 'Password123!', classId: '{{classId}}', armId: '{{armId}}', studentId: 'STU2024-001', rollNumber: '12', grade: 'JSS1', dateOfBirth: '2013-05-15', gender: 'female', address: '12 Palm Avenue, Ikeja, Lagos', phone: '+2348023456789', parentIds: ['{{parentId}}'], teacherIds: ['{{teacherId}}'], guardian: { fullName: 'Mr. Emeka Nwosu', relationship: 'Father', phone: '+2348034567890', email: 'emeka.nwosu@gmail.com', address: '12 Palm Avenue, Ikeja, Lagos' } } }),
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
             req({ name: 'Get Student Identity (/me)', method: 'GET', url: '/api/student/me', authType: 'user' }),
           ]
         },
         {
           name: '14.1 - Notifications',
           item: [
             req({ name: 'List Notifications', method: 'GET', url: '/api/student/notifications?page=1&limit=20', authType: 'user' }),
             req({ name: 'List Unread Only', method: 'GET', url: '/api/student/notifications?unread=true&page=1&limit=20', authType: 'user' }),
             req({ name: 'Mark All Read', method: 'PATCH', url: '/api/student/notifications/read-all', authType: 'user' }),
             req({ name: 'Mark Single Read', method: 'PATCH', url: '/api/student/notifications/{{notificationId}}/read', authType: 'user' })
           ]
         },
         {
           name: '14.2 - Dashboard Home',
           item: [
             req({ name: 'Get Dashboard Overview', method: 'GET', url: '/api/student/dashboard', authType: 'user' }),
             req({ name: 'Get Timetable (Current Week)', method: 'GET', url: '/api/student/timetable', authType: 'user' }),
             req({ name: 'Get Timetable (Specific Week)', method: 'GET', url: '/api/student/timetable?week=2025-W28', authType: 'user' })
           ]
         },
         {
           name: '14.3 - My Academics',
           item: [
             req({ name: 'Get Terms List', method: 'GET', url: '/api/student/terms', authType: 'user' }),
             req({ name: 'Get Academics (Current Term)', method: 'GET', url: '/api/student/academics?page=1&limit=20', authType: 'user' }),
             req({ name: 'Get Academics (Specific Term)', method: 'GET', url: '/api/student/academics?termId={{termId}}&page=1&limit=20', authType: 'user' })
           ]
         },
         {
           name: '14.4 - Assignments',
           item: [
             req({ name: 'List All Assignments', method: 'GET', url: '/api/student/assignments?page=1&limit=20', authType: 'user' }),
             req({ name: 'List Pending', method: 'GET', url: '/api/student/assignments?status=pending&page=1&limit=10', authType: 'user' }),
             req({ name: 'List Submitted', method: 'GET', url: '/api/student/assignments?status=submitted&page=1&limit=20', authType: 'user' }),
             req({ name: 'List Graded', method: 'GET', url: '/api/student/assignments?status=graded&page=1&limit=20', authType: 'user' }),
             req({ name: 'List Overdue', method: 'GET', url: '/api/student/assignments?status=overdue&page=1&limit=20', authType: 'user' }),
             req({ name: 'Get Single Assignment', method: 'GET', url: '/api/student/assignments/{{assignmentId}}', authType: 'user' }),
             req({ name: 'Submit Assignment (URLs only)', method: 'POST', url: '/api/student/assignments/{{assignmentId}}/submit', authType: 'user', body: { 
               textResponse: 'My essay response here...',
               attachments: [
                 { fileId: 'uuid-1', fileName: 'essay.pdf', fileUrl: 'https://res.cloudinary.com/.../essay.pdf', mimeType: 'application/pdf' }
               ]
             }})
           ]
         },
         {
           name: '14.5 - Teacher Directory',
           item: [
             req({ name: 'List Teachers', method: 'GET', url: '/api/student/teachers?page=1&limit=20', authType: 'user' }),
             req({ name: 'Search Teachers', method: 'GET', url: '/api/student/teachers?search=okonkwo&page=1&limit=20', authType: 'user' })
           ]
         },
         {
           name: '14.6 - Student Profile',
           item: [
             req({ name: 'Get Profile', method: 'GET', url: '/api/student/profile', authType: 'user' }),
             req({ name: 'Update Profile', method: 'PATCH', url: '/api/student/profile', authType: 'user', body: {
               phone: '+2348023456789',
               address: '14 Palm Avenue, Ikeja, Lagos',
               avatarUrl: 'https://res.cloudinary.com/.../avatar.jpg'
             }}),
             req({ name: 'Get Activity Feed', method: 'GET', url: '/api/student/activity?page=1&limit=20', authType: 'user' })
           ]
         },
         {
           name: '14.7 - Account Settings',
           item: [
             req({ name: 'Get Settings', method: 'GET', url: '/api/student/settings', authType: 'user' }),
             req({ name: 'Update Settings (Partial)', method: 'PATCH', url: '/api/student/settings', authType: 'user', body: {
               notifications: { smsEnabled: true, gradePublished: false },
               preferences: { darkMode: true, language: 'yo' }
             }}),
             req({ name: 'Change Password', method: 'POST', url: '/api/student/auth/change-password', authType: 'user', body: {
               currentPassword: 'OldPass@123',
               newPassword: 'NewPass@456',
               confirmPassword: 'NewPass@456'
             }})
           ]
         }
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
    { key: 'subject', value: 'Mathematics', type: 'string' },
    { key: 'classId', value: '', type: 'string' },
    { key: 'termId', value: '', type: 'string' },
    { key: 'academicYearId', value: '', type: 'string' },
    { key: 'armId', value: '', type: 'string' },
    { key: 'roomId', value: '', type: 'string' },
    { key: 'eventId', value: '', type: 'string' }
  ]
};

fs.writeFileSync(out, JSON.stringify(collection, null, 2));
console.log(`Generated ${out}`);

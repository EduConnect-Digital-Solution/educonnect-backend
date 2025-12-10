# EduConnect API Endpoints Reference
**For Frontend Developers & Designers**  
**Generated:** December 4, 2025

---

## 📋 Table of Contents
1. [Authentication Endpoints](#authentication-endpoints)
2. [Admin Endpoints](#admin-endpoints)
3. [Teacher Dashboard Endpoints](#teacher-dashboard-endpoints)
4. [Parent Dashboard Endpoints](#parent-dashboard-endpoints)
5. [Request/Response Format](#requestresponse-format)
6. [Authentication Headers](#authentication-headers)

---

## 🔐 Authentication Endpoints

### School Admin Authentication

#### 1. Register School
```http
POST /api/school/auth/register
```
**Access:** Public  
**Body:**
```json
{
  "schoolName": "string (required)",
  "email": "string (required)",
  "password": "string (required)",
  "adminFirstName": "string (required)",
  "adminLastName": "string (required)",
  "phone": "string (optional)",
  "address": "string (optional)",
  "website": "string (optional)",
  "description": "string (optional)"
}
```

#### 2. Verify School Email
```http
POST /api/school/auth/verify-email
```
**Access:** Public  
**Body:**
```json
{
  "email": "string (required)",
  "otp": "string (required)",
  "schoolId": "string (required)"
}
```

#### 3. School Admin Login
```http
POST /api/school/auth/login
```
**Access:** Public  
**Body:**
```json
{
  "schoolId": "string (required)",
  "email": "string (required)",
  "password": "string (required)"
}
```

#### 4. Refresh Token
```http
POST /api/school/auth/refresh-token
```
**Access:** Public  
**Body:**
```json
{
  "refreshToken": "string (required)"
}
```

#### 5. Logout
```http
POST /api/school/auth/logout
```
**Access:** Public

#### 6. Resend OTP
```http
POST /api/school/auth/resend-otp
```
**Access:** Public  
**Body:**
```json
{
  "email": "string (required)",
  "schoolId": "string (required)"
}
```

#### 7. Forgot Password
```http
POST /api/school/auth/forgot-password
```
**Access:** Public  
**Body:**
```json
{
  "email": "string (required)",
  "schoolId": "string (optional)"
}
```

#### 8. Reset Password
```http
POST /api/school/auth/reset-password
```
**Access:** Public  
**Body:**
```json
{
  "token": "string (required)",
  "newPassword": "string (required)",
  "confirmPassword": "string (required)"
}
```

---

### User Authentication (Teachers & Parents)

#### 9. User Login (Teacher/Parent)
```http
POST /api/user/auth/login
```
**Access:** Public  
**Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)",
  "schoolId": "string (required)"
}
```

#### 10. Complete Registration
```http
POST /api/user/auth/complete-registration
```
**Access:** Public  
**Description:** For users with temporary passwords to complete their registration  
**Body:**
```json
{
  "email": "string (required)",
  "schoolId": "string (required)",
  "currentPassword": "string (required - temporary password)",
  "newPassword": "string (required)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "phone": "string (optional)",
  
  // For Teachers:
  "subjects": "array (optional)",
  "qualifications": "string (optional)",
  "experience": "string (optional)",
  
  // For Parents:
  "address": "string (optional)",
  "occupation": "string (optional)",
  "emergencyContact": "string (optional)",
  "emergencyPhone": "string (optional)"
}
```

---

## 👨‍💼 Admin Endpoints

### Dashboard & Analytics

#### 1. Get Dashboard Analytics
```http
GET /api/admin/dashboard/analytics
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
schoolId (optional)
```
**Response:** School statistics including user counts, student counts, invitation stats

---

#### 2. Get User Management Data
```http
GET /api/admin/dashboard/users
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
schoolId (optional)
role (optional) - admin, teacher, parent
status (optional) - active, inactive
page (optional) - default: 1
limit (optional) - default: 20
search (optional) - search by name or email
```
**Response:** Paginated list of users with filtering

---

#### 3. Toggle User Status
```http
POST /api/admin/dashboard/users/toggle-status
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "userId": "string (required)",
  "action": "string (required - activate/deactivate)",
  "reason": "string (optional)",
  "schoolId": "string (optional)"
}
```

---

#### 4. Remove User
```http
DELETE /api/admin/dashboard/users/remove
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "userId": "string (required)",
  "reason": "string (optional)",
  "schoolId": "string (optional)"
}
```

---

### Student Management

#### 5. Create Student
```http
POST /api/students
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "schoolId": "string (optional)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (optional)",
  "class": "string (optional)",
  "section": "string (optional)",
  "rollNumber": "string (optional)",
  "grade": "string (optional)",
  "dateOfBirth": "date (optional)",
  "gender": "string (optional)",
  "address": "string (optional)",
  "phone": "string (optional)",
  "parentIds": "array (optional)",
  "teacherIds": "array (optional)"
}
```

---

#### 6. Get Students List
```http
GET /api/students
```
**Access:** Admin, Teacher  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
schoolId (optional)
class (optional)
section (optional)
status (optional) - active, inactive
page (optional) - default: 1
limit (optional) - default: 20
search (optional) - search by name or email
```

---

#### 7. Get Student Details
```http
GET /api/students/:studentId
```
**Access:** Admin, Teacher, Parent  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
schoolId (optional)
```

---

#### 8. Update Student
```http
PUT /api/students/:studentId
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "schoolId": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "email": "string (optional)",
  "class": "string (optional)",
  "section": "string (optional)",
  "rollNumber": "string (optional)",
  "grade": "string (optional)",
  "dateOfBirth": "date (optional)",
  "gender": "string (optional)",
  "address": "string (optional)",
  "phone": "string (optional)"
}
```

---

#### 9. Toggle Student Status
```http
POST /api/students/toggle-status
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "studentId": "string (required)",
  "action": "string (required - activate/deactivate/enroll/unenroll)",
  "reason": "string (optional)",
  "schoolId": "string (optional)"
}
```

---

#### 10. Remove Student
```http
DELETE /api/students/remove
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "studentId": "string (required)",
  "reason": "string (optional)",
  "schoolId": "string (optional)"
}
```

---

### Parent Management

#### 11. Invite Parent
```http
POST /api/parent-management/invite-parent
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "email": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "studentIds": "array (required - array of student IDs)",
  "message": "string (optional)"
}
```

---

#### 12. Get Parents List
```http
GET /api/parent-management/parents
```
**Access:** Admin, Teacher  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
page (optional) - default: 1
limit (optional) - default: 20
search (optional)
status (optional)
```

---

#### 13. Get Parent Details
```http
GET /api/parent-management/parents/:parentId
```
**Access:** Admin, Teacher  
**Headers:** `Authorization: Bearer {token}`

---

#### 14. Link Parent to Students
```http
POST /api/parent-management/parents/:parentId/link-students
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "studentIds": "array (required - array of student IDs to link)"
}
```

---

#### 15. Unlink Parent from Students
```http
POST /api/parent-management/parents/:parentId/unlink-students
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "studentIds": "array (required - array of student IDs to unlink)"
}
```

---

#### 16. Remove Parent
```http
DELETE /api/parent-management/parents/:parentId
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`

---

### School Profile Management

#### 17. Get School Profile
```http
GET /api/school/profile
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
schoolId (optional)
```

---

#### 18. Update School Profile
```http
PUT /api/school/profile
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "schoolId": "string (optional)",
  "schoolName": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)",
  "website": "string (optional)",
  "description": "string (optional)"
}
```

---

#### 19. Update Admin Profile
```http
PUT /api/school/profile/admin
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "schoolId": "string (optional)",
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "phone": "string (optional)"
}
```

---

#### 20. Change School Status
```http
POST /api/school/profile/status
```
**Access:** System Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "schoolId": "string (required)",
  "isActive": "boolean (required)",
  "reason": "string (optional)"
}
```

---

### Invitation Management

#### 21. Invite Teacher
```http
POST /api/school/auth/invite-teacher
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "email": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "subjects": "array (optional)",
  "message": "string (optional)"
}
```

---

#### 22. Invite Parent (Alternative)
```http
POST /api/school/auth/invite-parent
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "email": "string (required)",
  "firstName": "string (required)",
  "lastName": "string (required)",
  "studentIds": "array (required)",
  "message": "string (optional)"
}
```

---

#### 23. Resend Invitation
```http
POST /api/school/auth/resend-invitation
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "invitationId": "string (required)",
  "schoolId": "string (optional)"
}
```

---

#### 24. List Invitations
```http
GET /api/school/auth/invitations
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
schoolId (optional)
status (optional) - pending, accepted, expired, cancelled
role (optional) - teacher, parent
page (optional) - default: 1
limit (optional) - default: 20
```

---

#### 25. Cancel Invitation
```http
POST /api/school/auth/cancel-invitation
```
**Access:** Admin Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "invitationId": "string (required)",
  "reason": "string (optional)",
  "schoolId": "string (optional)"
}
```

---

## 👨‍🏫 Teacher Dashboard Endpoints

#### 1. Get Teacher Dashboard
```http
GET /api/teacher/dashboard
```
**Access:** Teacher Only  
**Headers:** `Authorization: Bearer {token}`  
**Response:** Teacher profile, statistics, and overview data

---

#### 2. Get Teacher's Students
```http
GET /api/teacher/students
```
**Access:** Teacher Only  
**Headers:** `Authorization: Bearer {token}`  
**Query Parameters:**
```
class (optional)
section (optional)
page (optional)
limit (optional)
```
**Response:** List of students assigned to the teacher

---

#### 3. Get Teacher Profile
```http
GET /api/teacher/profile
```
**Access:** Teacher Only  
**Headers:** `Authorization: Bearer {token}`  
**Response:** Teacher's profile information

---

## 👨‍👩‍👧 Parent Dashboard Endpoints

#### 1. Get Parent Dashboard
```http
GET /api/parent/dashboard
```
**Access:** Parent Only  
**Headers:** `Authorization: Bearer {token}`  
**Response:** Parent profile and children overview

---

#### 2. Get Parent's Children
```http
GET /api/parent/children
```
**Access:** Parent Only  
**Headers:** `Authorization: Bearer {token}`  
**Response:** List of all children linked to the parent

---

#### 3. Get Specific Child Details
```http
GET /api/parent/children/:childId
```
**Access:** Parent Only  
**Headers:** `Authorization: Bearer {token}`  
**Response:** Detailed information about a specific child

---

#### 4. Get Parent Profile
```http
GET /api/parent/profile
```
**Access:** Parent Only  
**Headers:** `Authorization: Bearer {token}`  
**Response:** Parent's profile information

---

#### 5. Update Parent Profile
```http
PUT /api/parent/profile
```
**Access:** Parent Only  
**Headers:** `Authorization: Bearer {token}`  
**Body:**
```json
{
  "firstName": "string (optional)",
  "lastName": "string (optional)",
  "phone": "string (optional)",
  "address": "string (optional)",
  "occupation": "string (optional)",
  "emergencyContact": "string (optional)",
  "emergencyPhone": "string (optional)"
}
```

---

## 📝 Request/Response Format

### Standard Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data here
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "fieldName",
      "message": "Validation error message",
      "value": "invalid value"
    }
  ]
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 200,
      "itemsPerPage": 20,
      "hasNextPage": true,
      "hasPreviousPage": false
    }
  }
}
```

---

## 🔑 Authentication Headers

### For Protected Endpoints
All protected endpoints require the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifecycle
- **Access Token:** Expires in 1 hour (configurable)
- **Refresh Token:** Expires in 7 days
- Use the refresh token endpoint to get a new access token when it expires

---

## 🎯 Role-Based Access Summary

| Endpoint Category | Admin | Teacher | Parent |
|------------------|-------|---------|--------|
| Dashboard Analytics | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ |
| Student CRUD | ✅ | ❌ | ❌ |
| Student View | ✅ | ✅ | ✅ (own children) |
| Parent Management | ✅ | View Only | ❌ |
| School Profile | ✅ | ❌ | ❌ |
| Teacher Dashboard | ❌ | ✅ | ❌ |
| Parent Dashboard | ❌ | ❌ | ✅ |
| Invitations | ✅ | ❌ | ❌ |

---

## 📊 Quick Reference: Endpoints by Role

### Admin Has Access To:
- All authentication endpoints
- All admin dashboard endpoints (4 endpoints)
- All student management endpoints (6 endpoints)
- All parent management endpoints (6 endpoints)
- All school profile endpoints (4 endpoints)
- All invitation endpoints (5 endpoints)
- **Total: ~25 admin-specific endpoints**

### Teacher Has Access To:
- User authentication endpoints
- Teacher dashboard (3 endpoints)
- View students (read-only)
- View parents (read-only)
- **Total: ~5 teacher-specific endpoints**

### Parent Has Access To:
- User authentication endpoints
- Parent dashboard (5 endpoints)
- View own children only
- **Total: ~5 parent-specific endpoints**

---

## 🌐 Base URL

**Development:** `http://localhost:3000/api`  
**Production:** `https://your-domain.com/api`

---

## 📞 Support

For API questions or issues:
- Interactive API Docs: `http://localhost:3000/api-docs`
- Full API Examples: See `docs/api-examples.md`
- Swagger Specification: See `docs/swagger.yaml`

---

**Last Updated:** December 4, 2025  
**API Version:** 1.0.0  
**Total Endpoints:** 35+

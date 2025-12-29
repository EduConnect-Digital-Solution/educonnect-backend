# EduConnect API Examples

This document provides practical examples of how to use the EduConnect API endpoints.

## Authentication Examples

### 1. School Registration

```bash
curl -X POST http://localhost:3000/api/school/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Springfield Elementary",
    "email": "admin@springfield.edu",
    "password": "SecurePass123!",
    "adminFirstName": "John",
    "adminLastName": "Doe",
    "phone": "+1234567890",
    "address": "123 Education Street",
    "website": "https://springfield.edu"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "School registered successfully. Please check your email for verification.",
  "data": {
    "school": {
      "schoolId": "SCH123456",
      "schoolName": "Springfield Elementary",
      "email": "admin@springfield.edu",
      "isActive": true,
      "isVerified": false
    },
    "admin": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@springfield.edu",
      "role": "admin"
    }
  }
}
```

### 2. Email Verification

```bash
curl -X POST http://localhost:3000/api/school/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@springfield.edu",
    "otp": "123456",
    "schoolId": "SCH123456"
  }'
```

### 3. School Admin Login

```bash
curl -X POST http://localhost:3000/api/school/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "schoolId": "SCH123456",
    "email": "admin@springfield.edu",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@springfield.edu",
      "role": "admin",
      "schoolId": "SCH123456"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "1h"
    }
  }
}
```

## Management Examples

### 4. Get Dashboard Analytics (Admin Only)

```bash
curl -X GET http://localhost:3000/api/admin/dashboard/analytics \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userStats": {
      "admin": { "total": 1, "active": 1, "verified": 1 },
      "teacher": { "total": 5, "active": 4, "verified": 5 },
      "parent": { "total": 25, "active": 23, "verified": 25 }
    },
    "studentStats": {
      "total": 150,
      "active": 145,
      "byClass": {
        "10A": 30,
        "10B": 28,
        "9A": 32
      }
    },
    "invitationStats": {
      "total": 10,
      "pending": 3,
      "accepted": 7
    }
  }
}
```

### 5. Create Student Record (Admin Only)

```bash
curl -X POST http://localhost:3000/api/students \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@student.edu",
    "class": "10A",
    "section": "A",
    "rollNumber": "001"
  }'
```

### 6. Invite Parent (Admin Only)

```bash
curl -X POST http://localhost:3000/api/parent-management/invite-parent \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "parent@example.com",
    "firstName": "Bob",
    "lastName": "Johnson",
    "studentIds": ["507f1f77bcf86cd799439011"]
  }'
```

### 7. Get Students List (Admin/Teacher)

```bash
# Get all students
curl -X GET http://localhost:3000/api/students \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get students with filters
curl -X GET "http://localhost:3000/api/students?class=10A&status=active&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## User Authentication Examples

### 8. Teacher/Parent Login

```bash
curl -X POST http://localhost:3000/api/user/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@springfield.edu",
    "password": "TeacherPass123!",
    "schoolId": "SCH123456"
  }'
```

### 9. Complete Registration (For invited users)

```bash
curl -X POST http://localhost:3000/api/user/auth/complete-registration \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@springfield.edu",
    "schoolId": "SCH123456",
    "currentPassword": "temppass123",
    "newPassword": "NewSecurePass123!",
    "firstName": "Jane",
    "lastName": "Smith",
    "phone": "+1234567890"
  }'
```

## 8. Teacher Class Assignment

### 8.1 Assign Classes to Teacher
```bash
# POST /api/admin/teachers/assign-classes
curl -X POST "https://educonnect-backend.onrender.com/api/admin/teachers/assign-classes" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacherId": "507f1f77bcf86cd799439011",
    "classes": ["JSS1", "JSS2", "JSS3"],
    "schoolId": "SCH0001"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher assigned to 3 new class(es) successfully",
  "data": {
    "teacher": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Smith",
      "email": "john.smith@school.edu",
      "employeeId": "EMP001",
      "classes": ["JSS1", "JSS2", "JSS3"],
      "subjects": ["Mathematics", "Physics"]
    },
    "assignedClasses": ["JSS1", "JSS2", "JSS3"],
    "totalClasses": 3
  }
}
```

### 8.2 Assign Subjects to Teacher
```bash
# POST /api/admin/teachers/assign-subjects
curl -X POST "https://educonnect-backend.onrender.com/api/admin/teachers/assign-subjects" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacherId": "507f1f77bcf86cd799439011",
    "subjects": ["Mathematics", "Physics", "Chemistry"],
    "schoolId": "SCH0001"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher assigned to 3 new subject(s) successfully",
  "data": {
    "teacher": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Smith",
      "email": "john.smith@school.edu",
      "employeeId": "EMP001",
      "classes": ["JSS1", "JSS2", "JSS3"],
      "subjects": ["Mathematics", "Physics", "Chemistry"]
    },
    "assignedSubjects": ["Mathematics", "Physics", "Chemistry"],
    "totalSubjects": 3
  }
}
```

### 8.3 Remove Classes from Teacher
```bash
# DELETE /api/admin/teachers/remove-classes
curl -X DELETE "https://educonnect-backend.onrender.com/api/admin/teachers/remove-classes" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "teacherId": "507f1f77bcf86cd799439011",
    "classes": ["JSS2"],
    "schoolId": "SCH0001"
  }'
```

### 8.4 Get Teacher's Current Assignments
```bash
# GET /api/admin/teachers/{teacherId}/assignments
curl -X GET "https://educonnect-backend.onrender.com/api/admin/teachers/507f1f77bcf86cd799439011/assignments?schoolId=SCH0001" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher assignments retrieved successfully",
  "data": {
    "teacher": {
      "id": "507f1f77bcf86cd799439011",
      "name": "John Smith",
      "email": "john.smith@school.edu",
      "employeeId": "EMP001",
      "phone": "+1234567890",
      "isActive": true
    },
    "assignments": {
      "classes": ["JSS1", "JSS3"],
      "subjects": ["Mathematics", "Physics", "Chemistry"],
      "classCount": 2,
      "subjectCount": 3
    }
  }
}
```

### 8.5 Invite Teacher with Classes and Subjects
```bash
# POST /api/admin/invite-teacher (Enhanced)
curl -X POST "https://educonnect-backend.onrender.com/api/admin/invite-teacher" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newteacher@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "subjects": ["English", "Literature"],
    "classes": ["JSS1", "JSS2"],
    "message": "Welcome to our school! You have been assigned to teach English and Literature."
  }'
```

## Dashboard Examples

### 9. Teacher Dashboard

```bash
curl -X GET http://localhost:3000/api/teacher/dashboard \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 10. Get Teacher's Students

```bash
curl -X GET http://localhost:3000/api/teacher/students \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 11. Parent Dashboard

```bash
curl -X GET http://localhost:3000/api/parent/dashboard \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 12. Get Parent's Children

```bash
curl -X GET http://localhost:3000/api/parent/children \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Error Handling Examples

### Validation Error Response

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "Email is required",
      "path": "email",
      "location": "body"
    }
  ]
}
```

### Authentication Error Response

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### Authorization Error Response

```json
{
  "success": false,
  "message": "Access denied. Admin role required."
}
```

### Rate Limiting Error Response

```json
{
  "success": false,
  "message": "Too many authentication attempts, please try again later.",
  "retryAfter": 900
}
```

## JavaScript/Node.js Examples

### Using Axios

```javascript
const axios = require('axios');

// School registration
const registerSchool = async () => {
  try {
    const response = await axios.post('http://localhost:3000/api/school/auth/register', {
      schoolName: 'Springfield Elementary',
      email: 'admin@springfield.edu',
      password: 'SecurePass123!',
      adminFirstName: 'John',
      adminLastName: 'Doe'
    });
    
    console.log('School registered:', response.data);
  } catch (error) {
    console.error('Registration failed:', error.response.data);
  }
};

// Authenticated request
const getDashboard = async (token) => {
  try {
    const response = await axios.get('http://localhost:3000/api/admin/dashboard/analytics', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Dashboard data:', response.data);
  } catch (error) {
    console.error('Request failed:', error.response.data);
  }
};
```

### Using Fetch API

```javascript
// Login and get token
const login = async () => {
  const response = await fetch('http://localhost:3000/api/school/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      schoolId: 'SCH123456',
      email: 'admin@springfield.edu',
      password: 'SecurePass123!'
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return data.data.tokens.accessToken;
  } else {
    throw new Error(data.message);
  }
};

// Use token for authenticated requests
const getStudents = async (token) => {
  const response = await fetch('http://localhost:3000/api/students', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return await response.json();
};
```

## Testing with Postman

### Environment Variables

Create a Postman environment with these variables:

- `baseUrl`: `http://localhost:3000/api`
- `accessToken`: (set after login)
- `schoolId`: (set after registration)

### Pre-request Script for Authentication

```javascript
// Auto-login script for Postman
if (!pm.environment.get("accessToken")) {
  pm.sendRequest({
    url: pm.environment.get("baseUrl") + "/school/auth/login",
    method: 'POST',
    header: {
      'Content-Type': 'application/json'
    },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        schoolId: pm.environment.get("schoolId"),
        email: "admin@springfield.edu",
        password: "SecurePass123!"
      })
    }
  }, function (err, response) {
    if (response.json().success) {
      pm.environment.set("accessToken", response.json().data.tokens.accessToken);
    }
  });
}
```

## Rate Limiting

The API implements rate limiting:

- **Authentication endpoints**: 20 requests per 15 minutes per IP
- **General endpoints**: 1000 requests per 15 minutes per IP

When rate limited, you'll receive a 429 status code with retry information.

## School Profile Management

### 13. Get School Profile (Admin Only)

```bash
curl -X GET http://localhost:3000/api/school/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "schoolId": "SCH123456",
    "schoolName": "Springfield Elementary",
    "email": "admin@springfield.edu",
    "phone": "+1234567890",
    "address": "123 Education Street",
    "website": "https://springfield.edu",
    "isActive": true,
    "isVerified": true,
    "createdAt": "2023-12-01T10:00:00.000Z"
  }
}
```

### 14. Update School Profile (Admin Only)

```bash
curl -X PUT http://localhost:3000/api/school/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Springfield Elementary School",
    "phone": "+1234567891",
    "address": "456 New Education Avenue",
    "website": "https://new-springfield.edu"
  }'
```

## Advanced Student Management

### 15. Update Student Information

```bash
curl -X PUT http://localhost:3000/api/students/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "class": "10B",
    "section": "B",
    "phone": "+1234567890"
  }'
```

### 16. Toggle Student Status

```bash
curl -X POST http://localhost:3000/api/students/toggle-status \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "507f1f77bcf86cd799439011",
    "action": "deactivate",
    "reason": "Student transferred to another school"
  }'
```

### 17. Bulk Student Operations

```bash
# Bulk update student class
curl -X POST http://localhost:3000/api/students/bulk-update \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "studentIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
    "updates": {
      "class": "11A",
      "section": "A"
    }
  }'
```

## Parent Management Advanced Examples

### 18. Get Parent Details with Children

```bash
curl -X GET http://localhost:3000/api/parent-management/parents/507f1f77bcf86cd799439013 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 20. Update Parent-Student Relationships

```bash
curl -X PUT http://localhost:3000/api/parent-management/parents/507f1f77bcf86cd799439013/students \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "studentIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439014"]
  }'
```

### 21. Remove Parent Access

```bash
curl -X POST http://localhost:3000/api/parent-management/parents/507f1f77bcf86cd799439013/revoke-access \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Parent requested account deletion"
  }'
```

## Password Management

### 22. Forgot Password (School Admin)

```bash
curl -X POST http://localhost:3000/api/school/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@springfield.edu",
    "schoolId": "SCH123456"
  }'
```

### 23. Reset Password with OTP

```bash
curl -X POST http://localhost:3000/api/school/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@springfield.edu",
    "otp": "123456",
    "newPassword": "NewSecurePass123!",
    "schoolId": "SCH123456"
  }'
```

### 24. Change Password (Authenticated User)

```bash
curl -X POST http://localhost:3000/api/user/auth/change-password \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword123!"
  }'
```

## Token Management

### 25. Refresh Access Token

```bash
curl -X POST http://localhost:3000/api/user/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### 26. Logout (Invalidate Tokens)

```bash
curl -X POST http://localhost:3000/api/user/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

## Complete Workflow Examples

### 27. Complete School Setup Workflow

```bash
# Step 1: Register school
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/school/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "schoolName": "Demo School",
    "email": "admin@demo.edu",
    "password": "DemoPass123!",
    "adminFirstName": "Admin",
    "adminLastName": "User"
  }')

# Extract school ID
SCHOOL_ID=$(echo $REGISTER_RESPONSE | jq -r '.data.school.schoolId')

# Step 2: Verify email (use OTP from email)
curl -X POST http://localhost:3000/api/school/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admin@demo.edu\",
    \"otp\": \"123456\",
    \"schoolId\": \"$SCHOOL_ID\"
  }"

# Step 3: Login and get token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/school/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"schoolId\": \"$SCHOOL_ID\",
    \"email\": \"admin@demo.edu\",
    \"password\": \"DemoPass123!\"
  }")

# Extract access token
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.tokens.accessToken')

# Step 4: Update school profile
curl -X PUT http://localhost:3000/api/school/profile \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+1234567890",
    "address": "123 Demo Street",
    "website": "https://demo.edu"
  }'
```

### 28. Teacher Onboarding Workflow

```bash
# Step 1: Admin invites teacher
curl -X POST http://localhost:3000/api/school/auth/invite-teacher \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@demo.edu",
    "firstName": "Jane",
    "lastName": "Teacher",
    "subjects": ["Mathematics", "Physics"]
  }'

# Step 2: Teacher completes registration
curl -X POST http://localhost:3000/api/user/auth/complete-registration \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@demo.edu",
    "schoolId": "'$SCHOOL_ID'",
    "currentPassword": "temp123abc",
    "newPassword": "TeacherPass123!",
    "firstName": "Jane",
    "lastName": "Teacher"
  }'

# Step 3: Teacher logs in
TEACHER_LOGIN=$(curl -s -X POST http://localhost:3000/api/user/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@demo.edu",
    "password": "TeacherPass123!",
    "schoolId": "'$SCHOOL_ID'"
  }')

TEACHER_TOKEN=$(echo $TEACHER_LOGIN | jq -r '.data.tokens.accessToken')

# Step 4: Teacher accesses dashboard
curl -X GET http://localhost:3000/api/teacher/dashboard \
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

## React/Frontend Integration Examples

### 29. React API Service Class

```javascript
// services/eduConnectAPI.js
class EduConnectAPI {
  constructor(baseURL = 'http://localhost:3000/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('accessToken');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(credentials) {
    const data = await this.request('/school/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    this.token = data.data.tokens.accessToken;
    localStorage.setItem('accessToken', this.token);
    localStorage.setItem('refreshToken', data.data.tokens.refreshToken);
    return data;
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token available');

    const data = await this.request('/user/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });

    this.token = data.data.accessToken;
    localStorage.setItem('accessToken', this.token);
    return data;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    try {
      await this.request('/user/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken })
      });
    } finally {
      this.token = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }

  // Dashboard methods
  async getDashboard() {
    return this.request('/admin/dashboard/analytics');
  }

  async getTeacherDashboard() {
    return this.request('/teacher/dashboard');
  }

  async getParentDashboard() {
    return this.request('/parent/dashboard');
  }

  // Student management
  async getStudents(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    return this.request(`/students?${queryString}`);
  }

  async createStudent(studentData) {
    return this.request('/students', {
      method: 'POST',
      body: JSON.stringify(studentData)
    });
  }

  async updateStudent(studentId, updates) {
    return this.request(`/students/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Parent management
  async inviteParent(parentData) {
    return this.request('/parent-management/invite-parent', {
      method: 'POST',
      body: JSON.stringify(parentData)
    });
  }

  async getParents(filters = {}) {
    const queryString = new URLSearchParams(filters).toString();
    return this.request(`/parent-management/parents?${queryString}`);
  }
}

export default EduConnectAPI;
```

### 30. React Hook for API Integration

```javascript
// hooks/useEduConnectAPI.js
import { useState, useEffect, useCallback } from 'react';
import EduConnectAPI from '../services/eduConnectAPI';

export const useEduConnectAPI = () => {
  const [api] = useState(() => new EduConnectAPI());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const makeRequest = useCallback(async (requestFn) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await requestFn();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    api,
    loading,
    error,
    makeRequest
  };
};

// Usage in component
const DashboardComponent = () => {
  const { api, loading, error, makeRequest } = useEduConnectAPI();
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await makeRequest(() => api.getDashboard());
        setDashboardData(data.data);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      }
    };

    loadDashboard();
  }, [api, makeRequest]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {dashboardData && (
        <div>
          <h2>Dashboard</h2>
          <p>Total Students: {dashboardData.studentStats.total}</p>
          <p>Active Teachers: {dashboardData.userStats.teacher.active}</p>
        </div>
      )}
    </div>
  );
};
```

## Error Handling Best Practices

### 31. Comprehensive Error Handling

```javascript
// utils/errorHandler.js
export const handleAPIError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return {
          type: 'validation',
          message: data.message || 'Invalid request data',
          errors: data.errors || []
        };
      case 401:
        return {
          type: 'authentication',
          message: 'Please log in to continue',
          action: 'redirect_to_login'
        };
      case 403:
        return {
          type: 'authorization',
          message: 'You do not have permission to perform this action'
        };
      case 404:
        return {
          type: 'not_found',
          message: 'The requested resource was not found'
        };
      case 429:
        return {
          type: 'rate_limit',
          message: 'Too many requests. Please try again later.',
          retryAfter: data.retryAfter
        };
      case 500:
        return {
          type: 'server_error',
          message: 'Internal server error. Please try again later.'
        };
      default:
        return {
          type: 'unknown',
          message: data.message || 'An unexpected error occurred'
        };
    }
  } else if (error.request) {
    // Network error
    return {
      type: 'network',
      message: 'Network error. Please check your connection.'
    };
  } else {
    // Other error
    return {
      type: 'unknown',
      message: error.message || 'An unexpected error occurred'
    };
  }
};

// Usage example
try {
  await api.createStudent(studentData);
} catch (error) {
  const errorInfo = handleAPIError(error);
  
  switch (errorInfo.type) {
    case 'validation':
      setValidationErrors(errorInfo.errors);
      break;
    case 'authentication':
      redirectToLogin();
      break;
    case 'rate_limit':
      showRateLimitMessage(errorInfo.retryAfter);
      break;
    default:
      showErrorMessage(errorInfo.message);
  }
}
```

## Testing Examples

### 32. Jest Test Examples

```javascript
// __tests__/api.test.js
import EduConnectAPI from '../services/eduConnectAPI';

// Mock fetch
global.fetch = jest.fn();

describe('EduConnectAPI', () => {
  let api;

  beforeEach(() => {
    api = new EduConnectAPI();
    fetch.mockClear();
  });

  test('should login successfully', async () => {
    const mockResponse = {
      success: true,
      data: {
        tokens: {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh-token'
        }
      }
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await api.login({
      schoolId: 'SCH123',
      email: 'test@test.com',
      password: 'password'
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/school/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          schoolId: 'SCH123',
          email: 'test@test.com',
          password: 'password'
        })
      })
    );

    expect(result).toEqual(mockResponse);
  });

  test('should handle API errors', async () => {
    const mockError = {
      success: false,
      message: 'Invalid credentials'
    };

    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => mockError
    });

    await expect(api.login({
      schoolId: 'SCH123',
      email: 'wrong@test.com',
      password: 'wrongpassword'
    })).rejects.toThrow('Invalid credentials');
  });
});
```

## Health Check

Always available endpoint to check API status:

```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "success": true,
  "message": "EduConnect API is running",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

## Common HTTP Status Codes

- `200 OK`: Successful GET, PUT requests
- `201 Created`: Successful POST requests
- `400 Bad Request`: Validation errors, malformed requests
- `401 Unauthorized`: Authentication required or failed
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting Headers

All responses include rate limiting information:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)

## Security Best Practices

1. **Always use HTTPS in production**
2. **Store JWT tokens securely** (httpOnly cookies recommended)
3. **Implement token refresh logic** to handle expired tokens
4. **Validate all input data** on both client and server
5. **Handle errors gracefully** without exposing sensitive information
6. **Implement proper logout** to invalidate tokens
7. **Use environment variables** for configuration
8. **Monitor API usage** and implement proper logging
#
# Grades Management

### 33. Get Teacher's Classes for Grading

```bash
curl -X GET http://localhost:3000/api/teacher/classes \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "message": "Teacher classes retrieved successfully",
  "data": {
    "classes": [
      {
        "name": "JSS1",
        "studentCount": 25
      },
      {
        "name": "JSS2",
        "studentCount": 30
      }
    ],
    "totalClasses": 2,
    "generatedAt": "2024-01-25T10:30:00.000Z"
  }
}
```

### 34. Get Subjects by Class

```bash
curl -X GET http://localhost:3000/api/teacher/classes/JSS1/subjects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "message": "Subjects retrieved successfully",
  "data": {
    "className": "JSS1",
    "subjects": [
      {
        "name": "Mathematics",
        "studentCount": 25,
        "gradedCount": 15,
        "gradingProgress": 60
      },
      {
        "name": "English",
        "studentCount": 25,
        "gradedCount": 8,
        "gradingProgress": 32
      }
    ],
    "totalSubjects": 2
  }
}
```

### 35. Get Students for Grading

```bash
curl -X GET "http://localhost:3000/api/teacher/classes/JSS1/subjects/Mathematics/students?term=First%20Term&page=1&limit=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "message": "Students retrieved successfully",
  "data": {
    "className": "JSS1",
    "subject": "Mathematics",
    "term": "First Term",
    "academicYear": "2024-2025",
    "students": [
      {
        "id": "674a927315ec8c579804387e",
        "studentId": "ST001",
        "firstName": "John",
        "lastName": "Doe",
        "fullName": "John Doe",
        "class": "JSS1",
        "section": "A",
        "grade": null,
        "hasGrade": false,
        "parents": []
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "pages": 3
    },
    "statistics": {
      "totalStudents": 25,
      "gradedStudents": 15,
      "ungradedStudents": 10,
      "gradingProgress": 60
    }
  }
}
```

### 36. Assign Grade to Student

```bash
curl -X POST http://localhost:3000/api/teacher/grades \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "674a927315ec8c579804387e",
    "subject": "Mathematics",
    "class": "JSS1",
    "section": "A",
    "term": "First Term",
    "academicYear": "2024-2025",
    "assessments": [
      {
        "type": "Test",
        "title": "Mid-term Mathematics Test",
        "score": 85,
        "maxScore": 100,
        "weight": 1,
        "date": "2024-01-15T00:00:00.000Z",
        "remarks": "Good performance in algebra"
      },
      {
        "type": "Assignment",
        "title": "Homework Assignment 1",
        "score": 90,
        "maxScore": 100,
        "weight": 1,
        "date": "2024-01-20T00:00:00.000Z",
        "remarks": "Excellent work"
      }
    ],
    "remarks": "Overall good performance. Needs improvement in geometry."
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Grade assigned successfully",
  "data": {
    "grade": {
      "id": "674b927315ec8c579804388f",
      "studentId": "674a927315ec8c579804387e",
      "subject": "Mathematics",
      "class": "JSS1",
      "term": "First Term",
      "academicYear": "2024-2025",
      "totalScore": 175,
      "totalMaxScore": 200,
      "percentage": 87.5,
      "letterGrade": "B+",
      "gradePoints": 3.3,
      "assessments": [
        {
          "type": "Test",
          "title": "Mid-term Mathematics Test",
          "score": 85,
          "maxScore": 100,
          "weight": 1
        },
        {
          "type": "Assignment",
          "title": "Homework Assignment 1",
          "score": 90,
          "maxScore": 100,
          "weight": 1
        }
      ],
      "remarks": "Overall good performance. Needs improvement in geometry.",
      "isPublished": false,
      "createdAt": "2024-01-25T10:30:00.000Z",
      "updatedAt": "2024-01-25T10:30:00.000Z"
    }
  }
}
```

### 37. Update Existing Grade

```bash
curl -X PUT http://localhost:3000/api/teacher/grades/674b927315ec8c579804388f \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "assessments": [
      {
        "type": "Test",
        "title": "Mid-term Mathematics Test",
        "score": 88,
        "maxScore": 100,
        "weight": 1,
        "date": "2024-01-15T00:00:00.000Z",
        "remarks": "Improved performance"
      },
      {
        "type": "Assignment",
        "title": "Homework Assignment 1",
        "score": 92,
        "maxScore": 100,
        "weight": 1,
        "date": "2024-01-20T00:00:00.000Z"
      },
      {
        "type": "Exam",
        "title": "Final Exam",
        "score": 85,
        "maxScore": 100,
        "weight": 2,
        "date": "2024-02-01T00:00:00.000Z",
        "remarks": "Good exam performance"
      }
    ],
    "remarks": "Excellent improvement shown throughout the term."
  }'
```

### 38. Get Grade Details

```bash
curl -X GET http://localhost:3000/api/teacher/grades/674b927315ec8c579804388f \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 39. Publish Grades

```bash
curl -X POST http://localhost:3000/api/teacher/grades/publish \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "class": "JSS1",
    "subject": "Mathematics",
    "term": "First Term",
    "academicYear": "2024-2025"
  }'
```

### 40. Get Class Statistics

```bash
curl -X GET "http://localhost:3000/api/teacher/classes/JSS1/subjects/Mathematics/statistics?term=First%20Term&academicYear=2024-2025" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 41. Delete Grade

```bash
curl -X DELETE http://localhost:3000/api/teacher/grades/674b927315ec8c579804388f \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 42. Complete Grading Workflow

```bash
# Step 1: Get teacher's classes
CLASSES_RESPONSE=$(curl -s -X GET http://localhost:3000/api/teacher/classes \
  -H "Authorization: Bearer $TEACHER_TOKEN")

# Step 2: Get subjects for a class
SUBJECTS_RESPONSE=$(curl -s -X GET http://localhost:3000/api/teacher/classes/JSS1/subjects \
  -H "Authorization: Bearer $TEACHER_TOKEN")

# Step 3: Get students for grading
STUDENTS_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/teacher/classes/JSS1/subjects/Mathematics/students?term=First%20Term" \
  -H "Authorization: Bearer $TEACHER_TOKEN")

# Extract first student ID
STUDENT_ID=$(echo $STUDENTS_RESPONSE | jq -r '.data.students[0].id')

# Step 4: Assign grade
GRADE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/teacher/grades \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STUDENT_ID\",
    \"subject\": \"Mathematics\",
    \"class\": \"JSS1\",
    \"section\": \"A\",
    \"term\": \"First Term\",
    \"academicYear\": \"2024-2025\",
    \"assessments\": [
      {
        \"type\": \"Test\",
        \"title\": \"Mid-term Test\",
        \"score\": 85,
        \"maxScore\": 100,
        \"weight\": 1
      }
    ],
    \"remarks\": \"Good performance\"
  }")

# Step 5: Publish grades
curl -X POST http://localhost:3000/api/teacher/grades/publish \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "class": "JSS1",
    "subject": "Mathematics",
    "term": "First Term",
    "academicYear": "2024-2025"
  }'
```
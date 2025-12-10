# EduConnect System Admin API Documentation

## Overview
This document provides complete API documentation for the EduConnect System Admin Dashboard. The System Admin API allows platform-wide management of schools, users, and system health monitoring.

### Latest Updates ⭐
- **User Management Endpoints**: Cross-school user management, role changes, and access control
- **Security Monitoring**: Security alerts and monitoring across all schools
- **Enhanced Role Management**: Business rule enforcement for role transitions

## Base URL
```
Development: http://localhost:3000
Production: https://api.educonnect.com
```

## Authentication
All System Admin endpoints require JWT authentication with system admin privileges.

### Authentication Flow
1. Login with system admin credentials
2. Receive JWT token in response
3. Include token in Authorization header for all subsequent requests
4. Token expires in 8 hours (configurable)

---

## API Endpoints

### 1. AUTHENTICATION ENDPOINTS

#### 1.1 System Admin Login
**POST** `/api/system-admin/auth/login`

**Purpose**: Authenticate system administrator and receive access token

**Request Body**:
```json
{
  "email": "admin@system.com",
  "password": "SystemAdmin123!"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "message": "System admin login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "admin@system.com",
      "role": "system_admin",
      "crossSchoolAccess": true,
      "systemAdminLevel": "super"
    },
    "expiresIn": "8h"
  }
}
```

**Error Response (401)**:
```json
{
  "success": false,
  "message": "Invalid system admin credentials",
  "code": "INVALID_CREDENTIALS"
}
```

#### 1.2 Verify Token
**GET** `/api/system-admin/auth/verify`

**Headers**: `Authorization: Bearer {token}`

**Purpose**: Verify if current token is valid

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "email": "admin@system.com",
      "role": "system_admin"
    },
    "valid": true
  }
}
```

#### 1.3 Refresh Token
**POST** `/api/system-admin/auth/refresh`

**Headers**: `Authorization: Bearer {token}`

**Purpose**: Get a new token before current one expires

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "email": "admin@system.com",
      "role": "system_admin"
    },
    "expiresIn": "8h"
  }
}
```

#### 1.4 Logout
**POST** `/api/system-admin/auth/logout`

**Headers**: `Authorization: Bearer {token}`

**Purpose**: Logout system admin (client-side token cleanup)

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Logout successful",
  "data": {
    "loggedOut": true,
    "timestamp": "2025-12-09T15:30:00.000Z"
  }
}
```

#### 1.5 Get Status
**GET** `/api/system-admin/auth/status`

**Purpose**: Check if system admin is configured (no auth required)

**Success Response (200)**:
```json
{
  "success": true,
  "message": "System admin status retrieved",
  "data": {
    "configured": true,
    "environment": "development",
    "timestamp": "2025-12-09T15:30:00.000Z"
  }
}
```

---

### 2. PLATFORM OVERVIEW ENDPOINTS

#### 2.1 Get Platform Overview
**GET** `/api/system-admin/platform/overview`

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `timeRange` (optional): "1h", "24h", "7d", "30d", "90d", "1y"
- `includeInactive` (optional): boolean

**Purpose**: Get comprehensive platform metrics and status

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Platform overview retrieved successfully",
  "data": {
    "kpis": {
      "totalSchools": 45,
      "activeSchools": 42,
      "totalUsers": 1250,
      "activeUsers": 1180,
      "totalStudents": 8500,
      "activeStudents": 8200
    },
    "recentActivity": {
      "totalOperations": 156,
      "recentOperations": [
        {
          "operation": "Create new school",
          "user": "System Admin",
          "school": "Test Academy",
          "timestamp": "2025-12-09T15:25:00.000Z",
          "severity": "high"
        }
      ]
    },
    "systemHealth": {
      "status": "healthy",
      "criticalAlerts": 0,
      "errorAlerts": 2,
      "recentErrors": 1,
      "cache": {
        "available": true,
        "hitRate": 85.5
      }
    },
    "criticalAlerts": [],
    "subscriptionOverview": {
      "byTier": {
        "basic": { "count": 25, "revenue": 2500 },
        "premium": { "count": 15, "revenue": 7500 },
        "enterprise": { "count": 5, "revenue": 15000 }
      },
      "byStatus": {
        "active": 40,
        "trial": 5,
        "suspended": 0
      }
    },
    "generatedAt": "2025-12-09T15:30:00.000Z",
    "cached": false
  }
}
```

#### 2.2 Get System Health
**GET** `/api/system-admin/system/health`

**Headers**: `Authorization: Bearer {token}`

**Purpose**: Get detailed system health metrics

**Success Response (200)**:
```json
{
  "success": true,
  "message": "System health retrieved successfully",
  "data": {
    "status": "healthy",
    "criticalAlerts": 0,
    "errorAlerts": 2,
    "recentErrors": 1,
    "cache": {
      "available": true,
      "hitRate": 85.5
    },
    "overallStatus": "healthy",
    "lastChecked": "2025-12-09T15:30:00.000Z"
  }
}
```

#### 2.3 Get Platform KPIs
**GET** `/api/system-admin/platform/kpis`

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `timeRange` (optional): "1h", "24h", "7d", "30d", "90d", "1y"

**Purpose**: Get key performance indicators for the platform

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Platform KPIs retrieved successfully",
  "data": {
    "totalSchools": 45,
    "activeSchools": 42,
    "totalUsers": 1250,
    "activeUsers": 1180,
    "totalStudents": 8500,
    "activeStudents": 8200,
    "growthMetrics": {
      "schoolGrowth": 12.5,
      "userGrowth": 8.3,
      "studentGrowth": 15.2
    },
    "engagementMetrics": {
      "dailyActiveUsers": 850,
      "weeklyActiveUsers": 1100,
      "monthlyActiveUsers": 1180
    }
  }
}
```

#### 2.4 Get Cross-School Metrics
**GET** `/api/system-admin/metrics/cross-school`

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `timeRange` (optional): "1h", "24h", "7d", "30d", "90d", "1y"
- `metrics` (optional): "overview", "performance", "engagement"

**Purpose**: Get aggregated metrics across all schools

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Cross-school metrics retrieved successfully",
  "data": {
    "aggregatedMetrics": {
      "totalRevenue": 25000,
      "averageUsersPerSchool": 27.8,
      "averageStudentsPerSchool": 188.9
    },
    "performanceMetrics": {
      "topPerformingSchools": [
        {
          "schoolId": "SCH001",
          "schoolName": "Excellence Academy",
          "score": 95.5
        }
      ]
    }
  }
}
```

---

### 3. SCHOOL MANAGEMENT ENDPOINTS

#### 3.1 Get School Management Dashboard
**GET** `/api/system-admin/schools/management`

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): "all", "active", "inactive"
- `tier` (optional): "all", "basic", "premium", "enterprise"
- `search` (optional): Search term for school name/email

**Purpose**: Get paginated list of schools with management information

**Success Response (200)**:
```json
{
  "success": true,
  "message": "School management data retrieved successfully",
  "data": {
    "schools": [
      {
        "_id": "674d1234567890abcdef1234",
        "schoolId": "SCH001",
        "schoolName": "Excellence Academy",
        "email": "admin@excellence.edu",
        "phone": "+1234567890",
        "address": "123 Education St, Learning City",
        "isActive": true,
        "systemConfig": {
          "subscriptionTier": "premium",
          "subscriptionStatus": "active",
          "subscriptionStartDate": "2025-01-01T00:00:00.000Z",
          "subscriptionEndDate": "2025-12-31T23:59:59.000Z"
        },
        "statistics": {
          "totalUsers": 45,
          "totalStudents": 320,
          "activeFlags": 0
        },
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-12-09T15:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### 3.2 Create New School
**POST** `/api/system-admin/schools`

**Headers**: `Authorization: Bearer {token}`

**Request Body**:
```json
{
  "schoolName": "Test Academy",
  "email": "admin@testacademy.com",
  "password": "TempPassword123!",
  "phone": "+1234567890",
  "address": "123 Education Street, Learning City, LC 12345",
  "principalName": "Dr. Jane Smith",
  "schoolType": "public",
  "subscriptionTier": "basic",
  "adminUserData": {
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

**Purpose**: Create a new school in the platform

**Success Response (201)**:
```json
{
  "success": true,
  "message": "School created successfully",
  "data": {
    "school": {
      "id": "674d1234567890abcdef1235",
      "schoolId": "SCH046",
      "schoolName": "Test Academy",
      "email": "admin@testacademy.com",
      "isActive": true,
      "subscriptionTier": "basic",
      "subscriptionStatus": "trial",
      "createdAt": "2025-12-09T15:30:00.000Z"
    },
    "adminUser": {
      "id": "674d1234567890abcdef1236",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@testacademy.com",
      "isTemporaryPassword": true
    }
  }
}
```

#### 3.3 Update School Configuration
**PUT** `/api/system-admin/schools/{schoolId}/config`

**Headers**: `Authorization: Bearer {token}`

**Path Parameters**:
- `schoolId`: School ID (e.g., "SCH001")

**Request Body**:
```json
{
  "subscriptionTier": "premium",
  "subscriptionStatus": "active",
  "features": [
    {
      "featureName": "advanced_analytics",
      "isEnabled": true
    }
  ],
  "limits": {
    "maxUsers": 200,
    "maxStudents": 1000
  },
  "systemNote": "Upgraded to premium tier"
}
```

**Purpose**: Update school configuration settings

**Success Response (200)**:
```json
{
  "success": true,
  "message": "School configuration updated successfully",
  "data": {
    "school": {
      "schoolId": "SCH001",
      "schoolName": "Excellence Academy",
      "subscriptionTier": "premium",
      "subscriptionStatus": "active",
      "updatedAt": "2025-12-09T15:30:00.000Z"
    }
  }
}
```

#### 3.4 Deactivate School
**PUT** `/api/system-admin/schools/{schoolId}/deactivate`

**Headers**: `Authorization: Bearer {token}`

**Path Parameters**:
- `schoolId`: School ID (e.g., "SCH001")

**Request Body**:
```json
{
  "reason": "School requested temporary suspension due to maintenance period"
}
```

**Purpose**: Deactivate a school (soft delete)

**Success Response (200)**:
```json
{
  "success": true,
  "message": "School deactivated successfully",
  "data": {
    "school": {
      "schoolId": "SCH001",
      "schoolName": "Excellence Academy",
      "isActive": false,
      "deactivatedAt": "2025-12-09T15:30:00.000Z",
      "reason": "School requested temporary suspension due to maintenance period"
    }
  }
}
```

#### 3.5 Reactivate School
**PUT** `/api/system-admin/schools/{schoolId}/reactivate`

**Headers**: `Authorization: Bearer {token}`

**Path Parameters**:
- `schoolId`: School ID (e.g., "SCH001")

**Request Body**:
```json
{
  "reason": "Maintenance completed, school ready to resume operations"
}
```

**Purpose**: Reactivate a previously deactivated school

**Success Response (200)**:
```json
{
  "success": true,
  "message": "School reactivated successfully",
  "data": {
    "school": {
      "schoolId": "SCH001",
      "schoolName": "Excellence Academy",
      "isActive": true,
      "reactivatedAt": "2025-12-09T15:30:00.000Z",
      "reason": "Maintenance completed, school ready to resume operations"
    }
  }
}
```

---

### 4. USER MANAGEMENT ENDPOINTS

#### 4.1 Get Cross-School User Management Data
**GET** `/api/system-admin/users/management`

**Purpose**: Retrieve user management data across all schools with filtering and pagination

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `role` (optional): Filter by user role ("admin", "teacher", "parent")
- `status` (optional): Filter by status ("active", "inactive")
- `schoolId` (optional): Filter by specific school ID
- `search` (optional): Search by name or email

**Success Response (200)**:
```json
{
  "success": true,
  "message": "User management data retrieved successfully",
  "data": {
    "users": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b3",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@school.com",
        "role": "teacher",
        "isActive": true,
        "schoolId": "SCH001",
        "schoolName": "Demo Elementary School",
        "subjects": ["Mathematics", "Science"],
        "lastLogin": "2025-12-09T10:30:00.000Z",
        "createdAt": "2025-11-01T08:00:00.000Z"
      }
    ],
    "total": 125,
    "summary": {
      "totalUsers": 125,
      "activeUsers": 118,
      "inactiveUsers": 7,
      "byRole": {
        "admin": 15,
        "teacher": 65,
        "parent": 45
      },
      "bySchool": {
        "SCH001": 45,
        "SCH002": 38,
        "SCH003": 42
      }
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "pages": 7
  }
}
```

**Error Response (400)**:
```json
{
  "success": false,
  "message": "Invalid query parameters",
  "code": "VALIDATION_ERROR"
}
```

#### 4.2 Manage User Access Permissions
**PUT** `/api/system-admin/users/:userId/access`

**Purpose**: Manage user access permissions across schools (activate, deactivate, change role, transfer)

**Headers**: `Authorization: Bearer <token>`

**Path Parameters**:
- `userId` (required): MongoDB ObjectId of the user

**Request Body**:
```json
{
  "action": "activate|deactivate|change_role|transfer_school",
  "reason": "Detailed reason for the action (required)",
  "newRole": "admin|teacher|parent",
  "schoolTransfer": {
    "targetSchoolId": "SCH002"
  }
}
```

**Action Types**:

**Activate User**:
```json
{
  "action": "activate",
  "reason": "Account review completed - reactivating user access"
}
```

**Deactivate User**:
```json
{
  "action": "deactivate",
  "reason": "Suspicious activity detected - temporary suspension"
}
```

**Change User Role** (with business rules):
```json
{
  "action": "change_role",
  "newRole": "admin",
  "reason": "Promoting teacher to admin role per school request"
}
```

**Transfer User to Different School**:
```json
{
  "action": "transfer_school",
  "schoolTransfer": {
    "targetSchoolId": "SCH002"
  },
  "reason": "User requested transfer to different school location"
}
```

**Role Transition Rules**:
- ✅ **Admin → Teacher** (Admin can step down to teacher)
- ✅ **Teacher → Admin** (Teacher can be promoted to admin)
- ✅ **Parent → Teacher** (Parent can become teacher)
- ❌ **Parent → Admin** (Security risk - parents cannot become admins directly)
- ❌ **Admin → Parent** (Not allowed)
- ❌ **Teacher → Parent** (Not allowed)

**Success Response (200)**:
```json
{
  "success": true,
  "message": "User access managed successfully",
  "data": {
    "user": {
      "id": "60f7b3b3b3b3b3b3b3b3b3b3",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@school.com",
      "role": "admin",
      "schoolId": "SCH001",
      "isActive": true,
      "subjects": [],
      "classes": [],
      "updatedAt": "2025-12-09T15:30:00.000Z"
    },
    "action": "Change user role from teacher to admin",
    "reason": "Promoting teacher to admin role per school request",
    "changes": {
      "before": {
        "role": "teacher",
        "subjects": ["Mathematics", "Science"],
        "classes": ["Grade 5A", "Grade 5B"]
      },
      "after": {
        "role": "admin",
        "subjects": [],
        "classes": []
      }
    }
  }
}
```

**Error Response (400)**:
```json
{
  "success": false,
  "message": "Role transition from parent to admin is not allowed. Allowed transitions: teacher",
  "code": "VALIDATION_ERROR"
}
```

**Error Response (404)**:
```json
{
  "success": false,
  "message": "User not found",
  "code": "RESOURCE_NOT_FOUND"
}
```

#### 4.3 Get Security Alerts and Monitoring
**GET** `/api/system-admin/security/alerts`

**Purpose**: Retrieve security alerts and monitoring information across the platform

**Headers**: `Authorization: Bearer <token>`

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `severity` (optional): Filter by severity ("info", "warning", "error", "critical")
- `alertType` (optional): Filter by type ("security", "performance", "error", "maintenance", "billing")
- `schoolId` (optional): Filter by specific school ID
- `isResolved` (optional): Filter by resolution status (true/false)

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Security alerts retrieved successfully",
  "data": {
    "alerts": [
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
        "alertType": "security",
        "severity": "critical",
        "title": "Multiple Failed Login Attempts",
        "description": "User attempted login 5 times with incorrect password within 5 minutes",
        "affectedSchools": ["SCH001"],
        "isResolved": false,
        "metadata": {
          "userId": "60f7b3b3b3b3b3b3b3b3b3b3",
          "userEmail": "suspicious@email.com",
          "ipAddress": "192.168.1.100",
          "attempts": 5,
          "timeWindow": "5 minutes",
          "lastAttempt": "2025-12-09T14:45:00.000Z"
        },
        "createdAt": "2025-12-09T14:45:00.000Z"
      },
      {
        "_id": "60f7b3b3b3b3b3b3b3b3b3b5",
        "alertType": "performance",
        "severity": "warning",
        "title": "High Database Response Time",
        "description": "Database queries taking longer than 2 seconds",
        "affectedSchools": [],
        "isResolved": true,
        "resolvedAt": "2025-12-09T15:00:00.000Z",
        "resolvedBy": "60f7b3b3b3b3b3b3b3b3b3b6",
        "resolutionNotes": "Database optimization completed",
        "metadata": {
          "averageResponseTime": "2.5s",
          "slowQueries": 15,
          "affectedTables": ["users", "schools", "students"]
        },
        "createdAt": "2025-12-09T14:30:00.000Z"
      }
    ],
    "total": 28,
    "summary": {
      "totalAlerts": 28,
      "bySeverity": {
        "critical": 3,
        "error": 5,
        "warning": 12,
        "info": 8
      },
      "byType": {
        "security": 15,
        "performance": 8,
        "error": 3,
        "maintenance": 2
      },
      "unresolved": 18,
      "resolved": 10
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 28,
    "pages": 2
  }
}
```

**Error Response (400)**:
```json
{
  "success": false,
  "message": "Invalid filter parameters",
  "code": "VALIDATION_ERROR"
}
```

---

### 5. HEALTH CHECK ENDPOINT

#### 4.1 System Admin API Health Check
**GET** `/api/system-admin/health`

**Headers**: `Authorization: Bearer {token}`

**Purpose**: Check if System Admin API is operational

**Success Response (200)**:
```json
{
  "success": true,
  "message": "System Admin API is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2025-12-09T15:30:00.000Z",
    "version": "1.0.0"
  }
}
```

---

## Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "operation": "operation_name",
  "error": "Detailed error message (development only)",
  "timestamp": "2025-12-09T15:30:00.000Z"
}
```

### Common Error Codes
- `INVALID_CREDENTIALS`: Authentication failed
- `MISSING_TOKEN`: Authorization header missing
- `EXPIRED_TOKEN`: JWT token has expired
- `INSUFFICIENT_PERMISSIONS`: User lacks required permissions
- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `PLATFORM_OVERVIEW_ERROR`: Platform overview generation failed
- `SYSTEM_HEALTH_ERROR`: System health check failed
- `CROSS_SCHOOL_ERROR`: Cross-school operation failed
- `USER_MANAGEMENT_ERROR`: User management operation failed
- `ROLE_TRANSITION_ERROR`: Invalid role transition attempted
- `SECURITY_ALERTS_ERROR`: Security alerts retrieval failed

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error
- `503`: Service Unavailable

---

## Rate Limiting

### General Rate Limits:
- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **Platform overview endpoints**: 30-60 requests per minute per authenticated user
- **School management endpoints**: 10-60 requests per minute per authenticated user
- **User management endpoints**: 20-60 requests per minute per authenticated user
- **Security alerts endpoints**: 60 requests per minute per authenticated user
- **Health check endpoints**: 60 requests per minute per authenticated user

### Specific Rate Limits:
- `POST /api/system-admin/schools`: 10 requests per 5 minutes (school creation)
- `PUT /api/system-admin/schools/:schoolId/deactivate`: 5 requests per 10 minutes
- `PUT /api/system-admin/users/:userId/access`: 20 requests per 5 minutes (user access management)
- All other endpoints: 60 requests per minute

### Rate Limit Headers:
Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit for the current window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit window resets

---

## Environment Configuration

### Development
```
Base URL: http://localhost:3000
CORS: Enabled for localhost
Debug: Enabled
```

### Production
```
Base URL: https://api.educonnect.com
CORS: Configured for production domains
Debug: Disabled
SSL: Required
```

---

## Testing Credentials

### Development Environment
```
Email: [CONFIGURED_IN_ENV]
Password: [CONFIGURED_IN_ENV]
```

**Note**: These are development credentials only. Production credentials will be provided separately.  ]
    },
    "systemHealth": {
      "status": "healthy",
      "criticalAlerts": 0,
      "errorAlerts": 2,
      "recentErrors": 1
    },
    "criticalAlerts": [],
    "subscriptionOverview": {
      "byTier": {
        "basic": { "count": 15, "revenue": 1500 },
        "premium": { "count": 8, "revenue": 4000 },
        "enterprise": { "count": 2, "revenue": 2000 }
      },
      "byStatus": {
        "active": 20,
        "trial": 3,
        "suspended": 2
      }
    },
    "generatedAt": "2025-12-09T15:30:00.000Z",
    "cached": false
  }
}
```

### 2. Get System Health
**GET** `/api/system-admin/system/health`

**Purpose**: Get detailed system health metrics

**Headers**: `Authorization: Bearer <token>`

**Success Response (200)**:
```json
{
  "success": true,
  "message": "System health retrieved successfully",
  "data": {
    "status": "healthy",
    "criticalAlerts": 0,
    "errorAlerts": 2,
    "recentErrors": 1,
    "cache": {
      "available": true,
      "hitRate": 85.5
    },
    "overallStatus": "healthy",
    "lastChecked": "2025-12-09T15:30:00.000Z"
  }
}
```

### 3. Get Platform KPIs
**GET** `/api/system-admin/platform/kpis`

**Purpose**: Get key performance indicators

**Query Parameters**:
- `timeRange` (optional): "1h", "24h", "7d", "30d", "90d", "1y"

**Headers**: `Authorization: Bearer <token>`

**Success Response (200)**:
```json
{
  "success": true,
  "mess
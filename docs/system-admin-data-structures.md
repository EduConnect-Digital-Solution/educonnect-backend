# EduConnect System Admin Data Structures

## Overview
This document provides detailed examples of all data structures used in the System Admin API. These examples show the exact format of request and response data that the frontend will work with.

---

## Authentication Data Structures

### Login Request
```json
{
  "email": "admin@yourdomain.com",
  "password": "YourSecurePassword123!"
}
```

### Login Response
```json
{
  "success": true,
  "message": "System admin login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_jwt_token_here.signature",
    "user": {
      "email": "admin@yourdomain.com",
      "role": "system_admin",
      "crossSchoolAccess": true,
      "systemAdminLevel": "super"
    },
    "expiresIn": "8h"
  }
}
```

### Token Verification Response
```json
{
  "success": true,
  "message": "Token is valid",
  "data": {
    "user": {
      "email": "admin@yourdomain.com",
      "role": "system_admin",
      "crossSchoolAccess": true,
      "systemAdminLevel": "super"
    },
    "systemAdmin": true,
    "valid": true
  }
}
```

---

## Platform Overview Data Structures

### Platform Overview Response
```json
{
  "success": true,
  "message": "Platform overview retrieved successfully",
  "data": {
    "kpis": {
      "totalSchools": 45,
      "activeSchools": 42,
      "inactiveSchools": 3,
      "totalUsers": 1250,
      "activeUsers": 1180,
      "inactiveUsers": 70,
      "totalStudents": 8500,
      "activeStudents": 8200,
      "inactiveStudents": 300,
      "totalRevenue": 125000,
      "monthlyRecurringRevenue": 25000,
      "averageRevenuePerSchool": 2777.78,
      "growthMetrics": {
        "schoolGrowth": 12.5,
        "userGrowth": 8.3,
        "studentGrowth": 15.2,
        "revenueGrowth": 22.1
      }
    },
    "recentActivity": {
      "totalOperations": 156,
      "recentOperations": [
        {
          "operation": "Create new school",
          "operationType": "create",
          "user": "System Admin",
          "school": "Test Academy",
          "timestamp": "2025-12-09T15:25:00.000Z",
          "severity": "high"
        },
        {
          "operation": "Update school configuration",
          "operationType": "update",
          "user": "System Admin",
          "school": "Excellence Academy",
          "timestamp": "2025-12-09T15:20:00.000Z",
          "severity": "medium"
        },
        {
          "operation": "Deactivate school",
          "operationType": "admin_action",
          "user": "System Admin",
          "school": "Old School",
          "timestamp": "2025-12-09T15:15:00.000Z",
          "severity": "critical"
        }
      ]
    },
    "systemHealth": {
      "status": "healthy",
      "criticalAlerts": 0,
      "errorAlerts": 2,
      "warningAlerts": 5,
      "recentErrors": 1,
      "cache": {
        "available": true,
        "hitRate": 85.5,
        "missRate": 14.5
      },
      "database": {
        "connected": true,
        "responseTime": 45,
        "activeConnections": 12
      },
      "lastChecked": "2025-12-09T15:30:00.000Z"
    },
    "criticalAlerts": [
      {
        "id": "674d1234567890abcdef1234",
        "title": "High Memory Usage",
        "description": "System memory usage is above 90%",
        "alertType": "system_resource",
        "affectedSchools": ["Excellence Academy", "Test Academy"],
        "createdAt": "2025-12-09T15:00:00.000Z",
        "ageInMinutes": 30
      }
    ],
    "subscriptionOverview": {
      "byTier": {
        "basic": {
          "count": 25,
          "revenue": 2500
        },
        "premium": {
          "count": 15,
          "revenue": 7500
        },
        "enterprise": {
          "count": 5,
          "revenue": 15000
        }
      },
      "byStatus": {
        "active": 40,
        "trial": 5,
        "suspended": 0,
        "expired": 0
      }
    },
    "generatedAt": "2025-12-09T15:30:00.000Z",
    "cached": false
  }
}
```

### System Health Response
```json
{
  "success": true,
  "message": "System health retrieved successfully",
  "data": {
    "status": "healthy",
    "criticalAlerts": 0,
    "errorAlerts": 2,
    "warningAlerts": 5,
    "recentErrors": 1,
    "cache": {
      "available": true,
      "hitRate": 85.5,
      "missRate": 14.5,
      "totalRequests": 10000,
      "hits": 8550,
      "misses": 1450
    },
    "database": {
      "connected": true,
      "responseTime": 45,
      "activeConnections": 12,
      "maxConnections": 100,
      "connectionPoolUsage": 12
    },
    "services": [
      {
        "name": "Authentication Service",
        "status": "healthy",
        "responseTime": 120,
        "lastChecked": "2025-12-09T15:30:00.000Z"
      },
      {
        "name": "Email Service",
        "status": "healthy",
        "responseTime": 250,
        "lastChecked": "2025-12-09T15:30:00.000Z"
      },
      {
        "name": "Cache Service",
        "status": "healthy",
        "responseTime": 15,
        "lastChecked": "2025-12-09T15:30:00.000Z"
      }
    ],
    "overallStatus": "healthy",
    "lastChecked": "2025-12-09T15:30:00.000Z"
  }
}
```

### Platform KPIs Response
```json
{
  "success": true,
  "message": "Platform KPIs retrieved successfully",
  "data": {
    "totalSchools": 45,
    "activeSchools": 42,
    "inactiveSchools": 3,
    "totalUsers": 1250,
    "activeUsers": 1180,
    "inactiveUsers": 70,
    "totalStudents": 8500,
    "activeStudents": 8200,
    "inactiveStudents": 300,
    "totalRevenue": 125000,
    "monthlyRecurringRevenue": 25000,
    "averageRevenuePerSchool": 2777.78,
    "growthMetrics": {
      "schoolGrowth": 12.5,
      "userGrowth": 8.3,
      "studentGrowth": 15.2,
      "revenueGrowth": 22.1
    },
    "engagementMetrics": {
      "dailyActiveUsers": 850,
      "weeklyActiveUsers": 1100,
      "monthlyActiveUsers": 1180,
      "averageSessionDuration": 45,
      "bounceRate": 15.2
    },
    "performanceMetrics": {
      "averageResponseTime": 120,
      "uptime": 99.9,
      "errorRate": 0.1
    },
    "timeRange": "30d",
    "generatedAt": "2025-12-09T15:30:00.000Z"
  }
}
```

---

## School Management Data Structures

### School List Response
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
        "address": "123 Education St, Learning City, LC 12345",
        "principalName": "Dr. John Smith",
        "schoolType": "private",
        "isActive": true,
        "systemConfig": {
          "subscriptionTier": "premium",
          "subscriptionStatus": "active",
          "subscriptionStartDate": "2025-01-01T00:00:00.000Z",
          "subscriptionEndDate": "2025-12-31T23:59:59.000Z",
          "features": [
            {
              "featureName": "basic_features",
              "isEnabled": true,
              "enabledAt": "2025-01-01T00:00:00.000Z"
            },
            {
              "featureName": "advanced_analytics",
              "isEnabled": true,
              "enabledAt": "2025-06-01T00:00:00.000Z"
            }
          ],
          "limits": {
            "maxUsers": 200,
            "maxStudents": 1000,
            "maxStorage": 10000
          },
          "billing": {
            "monthlyRevenue": 500,
            "lastPaymentDate": "2025-12-01T00:00:00.000Z",
            "nextBillingDate": "2026-01-01T00:00:00.000Z"
          }
        },
        "statistics": {
          "totalUsers": 45,
          "totalStudents": 320,
          "activeFlags": 0
        },
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-12-09T15:30:00.000Z"
      },
      {
        "_id": "674d1234567890abcdef1235",
        "schoolId": "SCH002",
        "schoolName": "Learning Center",
        "email": "admin@learningcenter.edu",
        "phone": "+1987654321",
        "address": "456 Knowledge Ave, Study Town, ST 67890",
        "principalName": "Dr. Jane Doe",
        "schoolType": "public",
        "isActive": true,
        "systemConfig": {
          "subscriptionTier": "basic",
          "subscriptionStatus": "trial",
          "subscriptionStartDate": "2025-12-01T00:00:00.000Z",
          "subscriptionEndDate": "2025-12-31T23:59:59.000Z",
          "features": [
            {
              "featureName": "basic_features",
              "isEnabled": true,
              "enabledAt": "2025-12-01T00:00:00.000Z"
            }
          ],
          "limits": {
            "maxUsers": 50,
            "maxStudents": 300,
            "maxStorage": 5000
          },
          "billing": {
            "monthlyRevenue": 0,
            "lastPaymentDate": null,
            "nextBillingDate": "2026-01-01T00:00:00.000Z"
          }
        },
        "statistics": {
          "totalUsers": 25,
          "totalStudents": 180,
          "activeFlags": 1
        },
        "createdAt": "2025-12-01T00:00:00.000Z",
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

### Create School Request
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

### Create School Response
```json
{
  "success": true,
  "message": "School created successfully",
  "data": {
    "school": {
      "id": "674d1234567890abcdef1236",
      "schoolId": "SCH046",
      "schoolName": "Test Academy",
      "email": "admin@testacademy.com",
      "isActive": true,
      "subscriptionTier": "basic",
      "subscriptionStatus": "trial",
      "createdAt": "2025-12-09T15:30:00.000Z"
    },
    "adminUser": {
      "id": "674d1234567890abcdef1237",
      "firstName": "Admin",
      "lastName": "User",
      "email": "admin@testacademy.com",
      "isTemporaryPassword": true
    }
  }
}
```

### Update School Config Request
```json
{
  "subscriptionTier": "premium",
  "subscriptionStatus": "active",
  "features": [
    {
      "featureName": "advanced_analytics",
      "isEnabled": true,
      "expiresAt": "2026-12-31T23:59:59.000Z"
    },
    {
      "featureName": "custom_branding",
      "isEnabled": true
    }
  ],
  "limits": {
    "maxUsers": 200,
    "maxStudents": 1000,
    "maxStorage": 15000
  },
  "billing": {
    "monthlyRevenue": 500,
    "billingCycle": "monthly",
    "paymentMethod": "credit_card"
  },
  "systemNote": "Upgraded to premium tier due to increased usage"
}
```

### Update School Config Response
```json
{
  "success": true,
  "message": "School configuration updated successfully",
  "data": {
    "school": {
      "schoolId": "SCH001",
      "schoolName": "Excellence Academy",
      "email": "admin@excellence.edu",
      "subscriptionTier": "premium",
      "subscriptionStatus": "active",
      "features": [
        {
          "featureName": "basic_features",
          "isEnabled": true,
          "enabledAt": "2025-01-01T00:00:00.000Z"
        },
        {
          "featureName": "advanced_analytics",
          "isEnabled": true,
          "enabledAt": "2025-12-09T15:30:00.000Z",
          "expiresAt": "2026-12-31T23:59:59.000Z"
        },
        {
          "featureName": "custom_branding",
          "isEnabled": true,
          "enabledAt": "2025-12-09T15:30:00.000Z"
        }
      ],
      "limits": {
        "maxUsers": 200,
        "maxStudents": 1000,
        "maxStorage": 15000
      },
      "updatedAt": "2025-12-09T15:30:00.000Z"
    }
  }
}
```

### Deactivate School Request
```json
{
  "reason": "School requested temporary suspension due to maintenance period"
}
```

### Deactivate School Response
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

### Reactivate School Request
```json
{
  "reason": "Maintenance completed, school ready to resume operations"
}
```

### Reactivate School Response
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

## Cross-School Metrics Data Structures

### Cross-School Metrics Response
```json
{
  "success": true,
  "message": "Cross-school metrics retrieved successfully",
  "data": {
    "aggregatedMetrics": {
      "totalRevenue": 125000,
      "averageUsersPerSchool": 27.8,
      "averageStudentsPerSchool": 188.9,
      "averageRevenuePerSchool": 2777.78,
      "totalActiveSchools": 42,
      "totalInactiveSchools": 3
    },
    "performanceMetrics": {
      "topPerformingSchools": [
        {
          "schoolId": "SCH001",
          "schoolName": "Excellence Academy",
          "score": 95.5,
          "metrics": {
            "userEngagement": 92.3,
            "studentActivity": 98.7,
            "systemUsage": 95.5
          }
        },
        {
          "schoolId": "SCH005",
          "schoolName": "Innovation High",
          "score": 93.2,
          "metrics": {
            "userEngagement": 89.1,
            "studentActivity": 97.3,
            "systemUsage": 93.2
          }
        }
      ],
      "averagePerformanceScore": 78.5
    },
    "engagementMetrics": {
      "averageDailyActiveUsers": 850,
      "averageWeeklyActiveUsers": 1100,
      "averageMonthlyActiveUsers": 1180,
      "averageSessionDuration": 45,
      "totalSessions": 25000
    },
    "subscriptionMetrics": {
      "byTier": {
        "basic": {
          "count": 25,
          "percentage": 55.6,
          "revenue": 2500
        },
        "premium": {
          "count": 15,
          "percentage": 33.3,
          "revenue": 7500
        },
        "enterprise": {
          "count": 5,
          "percentage": 11.1,
          "revenue": 15000
        }
      },
      "churnRate": 2.3,
      "retentionRate": 97.7
    },
    "timeRange": "30d",
    "generatedAt": "2025-12-09T15:30:00.000Z"
  }
}
```

---

## Error Response Data Structures

### Standard Error Response
```json
{
  "success": false,
  "message": "Invalid system admin credentials",
  "code": "INVALID_CREDENTIALS",
  "timestamp": "2025-12-09T15:30:00.000Z"
}
```

### Validation Error Response
```json
{
  "success": false,
  "message": "Invalid request parameters",
  "code": "VALIDATION_ERROR",
  "operation": "school_creation",
  "error": "Failed to create school: School validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    },
    {
      "field": "schoolName",
      "message": "School name must be at least 3 characters"
    }
  ],
  "timestamp": "2025-12-09T15:30:00.000Z"
}
```

### Resource Not Found Error
```json
{
  "success": false,
  "message": "Requested resource not found",
  "code": "RESOURCE_NOT_FOUND",
  "operation": "school_update",
  "error": "School with ID 'SCH999' not found",
  "timestamp": "2025-12-09T15:30:00.000Z"
}
```

### System Error Response
```json
{
  "success": false,
  "message": "Failed to retrieve platform overview",
  "code": "PLATFORM_OVERVIEW_ERROR",
  "operation": "platform_overview",
  "error": "Database connection timeout",
  "timestamp": "2025-12-09T15:30:00.000Z"
}
```

---

## Pagination Data Structure

### Pagination Object
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3,
    "hasNext": true,
    "hasPrev": false,
    "nextPage": 2,
    "prevPage": null
  }
}
```

---

## Filter and Query Parameters

### School Management Filters
```json
{
  "page": 1,
  "limit": 20,
  "status": "active",
  "tier": "premium",
  "search": "academy",
  "sortBy": "createdAt",
  "sortOrder": "desc"
}
```

### Time Range Parameters
```json
{
  "timeRange": "30d",
  "startDate": "2025-11-09T00:00:00.000Z",
  "endDate": "2025-12-09T23:59:59.000Z"
}
```

---

## Field Descriptions

### School Object Fields
- `_id`: MongoDB ObjectId (internal database ID)
- `schoolId`: Human-readable school identifier (e.g., "SCH001")
- `schoolName`: Display name of the school
- `email`: Primary contact email for the school
- `phone`: Contact phone number
- `address`: Physical address of the school
- `principalName`: Name of the school principal
- `schoolType`: Type of school ("public", "private", "charter")
- `isActive`: Boolean indicating if school is active
- `systemConfig`: Configuration settings for the school
- `statistics`: Calculated statistics about the school
- `createdAt`: ISO timestamp when school was created
- `updatedAt`: ISO timestamp when school was last modified

### User Object Fields
- `email`: User's email address
- `role`: User's role in the system
- `crossSchoolAccess`: Boolean indicating cross-school permissions
- `systemAdminLevel`: Level of system admin access
- `firstName`: User's first name
- `lastName`: User's last name
- `isTemporaryPassword`: Boolean indicating if password needs to be changed

### Subscription Config Fields
- `subscriptionTier`: Subscription level ("basic", "premium", "enterprise")
- `subscriptionStatus`: Current status ("active", "trial", "suspended", "expired")
- `subscriptionStartDate`: When subscription started
- `subscriptionEndDate`: When subscription expires
- `features`: Array of enabled features
- `limits`: Usage limits for the school
- `billing`: Billing information and revenue data
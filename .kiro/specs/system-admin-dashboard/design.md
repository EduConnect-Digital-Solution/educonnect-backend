# System Admin Dashboard Design Document

## Overview

The System Admin Dashboard is a comprehensive platform management interface that provides organization-level administrators with centralized control over all schools within the EduConnect ecosystem. This system extends the existing multi-tenant architecture to support cross-school analytics, management, and monitoring capabilities while maintaining data isolation and security.

## Architecture

### High-Level Architecture

The System Admin Dashboard follows a layered architecture pattern that integrates with the existing EduConnect platform:

```
┌─────────────────────────────────────────────────────────────┐
│                    System Admin Dashboard                    │
├─────────────────────────────────────────────────────────────┤
│  Controllers  │  Services  │  Middleware  │  Validation     │
├─────────────────────────────────────────────────────────────┤
│              Existing EduConnect Platform                   │
│  School-Level │  User Mgmt │  Analytics   │  Auth System   │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                               │
│  MongoDB      │  Redis     │  File System │  External APIs │
└─────────────────────────────────────────────────────────────┘
```

### Integration Strategy

The System Admin Dashboard will:
- **Extend existing RBAC** with new `SYSTEM_ADMIN` role
- **Leverage current caching** infrastructure for cross-school data
- **Reuse existing services** with enhanced aggregation capabilities
- **Maintain data isolation** while providing consolidated views

## Components and Interfaces

### 1. Authentication & Authorization

#### Pre-Configured Authentication Strategy
System Admin authentication uses **environment-based credentials** with no registration endpoints:

```javascript
// Environment variables for system admin credentials
SYSTEM_ADMIN_EMAIL=admin@educonnect.com
SYSTEM_ADMIN_PASSWORD_HASH=$2b$12$secure_bcrypt_hash_here
SYSTEM_ADMIN_JWT_SECRET=separate_jwt_secret_for_system_admin

// Authentication validation
const validateSystemAdminCredentials = (email, password) => {
  return email === process.env.SYSTEM_ADMIN_EMAIL && 
         bcrypt.compare(password, process.env.SYSTEM_ADMIN_PASSWORD_HASH);
};
```

#### Enhanced RBAC System
```javascript
// Extended role hierarchy
const ROLES = {
  SYSTEM_ADMIN: 'system_admin',  // NEW: Platform-wide access
  ADMIN: 'admin',                // School-level admin
  TEACHER: 'teacher',
  PARENT: 'parent'
};

const ROLE_HIERARCHY = {
  [ROLES.SYSTEM_ADMIN]: 4,       // NEW: Highest privilege level
  [ROLES.ADMIN]: 3,
  [ROLES.TEACHER]: 2,
  [ROLES.PARENT]: 1
};
```

#### System Admin Authentication Routes
```javascript
// Separate authentication endpoints (NO registration)
POST /api/system-admin/auth/login     // Login only
GET  /api/system-admin/auth/verify    // Token verification
POST /api/system-admin/auth/logout    // Logout (optional)

// NO registration, password reset, or user management endpoints
```

#### System Admin Middleware
- `requireSystemAdmin()` - Validates system admin role
- `validateCrossSchoolAccess()` - Allows cross-school data access
- `auditSystemOperation()` - Logs all system-level operations
- `authenticateSystemAdmin()` - Validates pre-configured credentials

### 2. Controllers

#### SystemAdminController
- `getPlatformOverview()` - Aggregate metrics across all schools
- `getSchoolManagement()` - CRUD operations for school instances
- `getUserManagement()` - Cross-school user management
- `getAnalytics()` - Platform-wide analytics and reporting
- `getSecurityDashboard()` - Security monitoring and compliance
- `getCommunications()` - Platform announcements and notifications
- `getSystemHealth()` - Technical monitoring and diagnostics
- `getTroubleshooting()` - Advanced debugging and support tools

### 3. Services

#### SystemAdminService
Aggregates data from existing services with cross-school capabilities:

```javascript
class SystemAdminService {
  // Platform Overview
  static async getPlatformMetrics()
  static async getSchoolComparisons()
  static async getSystemHealth()
  
  // School Management
  static async getAllSchools(filters, pagination)
  static async createSchool(schoolData)
  static async updateSchoolConfig(schoolId, config)
  static async deactivateSchool(schoolId, reason)
  
  // User Management
  static async getCrossSchoolUsers(filters)
  static async manageUserAccess(userId, permissions)
  static async getSecurityAlerts()
  
  // Analytics & Reporting
  static async generatePlatformReport(criteria)
  static async getUsageAnalytics(timeRange)
  static async exportData(format, filters)
}
```

#### Enhanced Existing Services
- **DashboardService**: Add cross-school aggregation methods
- **CacheService**: Implement platform-wide caching strategies
- **AuthService**: Support system admin authentication flows

### 4. Data Aggregation Layer

#### CrossSchoolAggregator
Handles data collection and aggregation across multiple school instances:

```javascript
class CrossSchoolAggregator {
  static async aggregateMetrics(schools, metric, timeRange)
  static async compareSchoolPerformance(schoolIds, criteria)
  static async generateTrends(metric, period)
  static async calculatePlatformKPIs()
}
```

## Data Models

### 1. Enhanced User Model

```javascript
// Extended User schema for system admin role
// NOTE: System admins do NOT use this User model - they use pre-configured credentials
const UserSchema = {
  // ... existing fields (school users only)
  role: {
    type: String,
    enum: ['admin', 'teacher', 'parent'], // system_admin NOT stored in database
    required: true
  },
  // ... rest of schema for school users only
};
```

### 2. System Admin Authentication Model

```javascript
// System admins are NOT stored in database
// Authentication handled via environment variables:
const SystemAdminAuth = {
  // Environment-based authentication
  email: process.env.SYSTEM_ADMIN_EMAIL,
  passwordHash: process.env.SYSTEM_ADMIN_PASSWORD_HASH,
  jwtSecret: process.env.SYSTEM_ADMIN_JWT_SECRET,
  
  // JWT payload for system admin
  tokenPayload: {
    email: "admin@educonnect.com",
    role: "system_admin",
    crossSchoolAccess: true,
    systemAdminLevel: "super"
  }
};
```

### 3. New Platform Models

#### SystemConfiguration
```javascript
const SystemConfigurationSchema = {
  configKey: { type: String, required: true, unique: true },
  configValue: { type: mongoose.Schema.Types.Mixed, required: true },
  category: { 
    type: String, 
    enum: ['platform', 'security', 'billing', 'features'],
    required: true 
  },
  description: String,
  isGlobal: { type: Boolean, default: true },
  schoolOverrides: [{
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    value: mongoose.Schema.Types.Mixed,
    updatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
};
```

#### PlatformAuditLog
```javascript
const PlatformAuditLogSchema = {
  operation: { type: String, required: true },
  operationType: {
    type: String,
    enum: ['create', 'read', 'update', 'delete', 'admin_action'],
    required: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetSchoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resourceType: String,
  resourceId: String,
  changes: mongoose.Schema.Types.Mixed,
  metadata: {
    ip: String,
    userAgent: String,
    sessionId: String,
    requestId: String
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  timestamp: { type: Date, default: Date.now }
};
```

#### SystemAlert
```javascript
const SystemAlertSchema = {
  alertType: {
    type: String,
    enum: ['security', 'performance', 'error', 'maintenance', 'billing'],
    required: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    required: true
  },
  title: { type: String, required: true },
  description: String,
  affectedSchools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }],
  isResolved: { type: Boolean, default: false },
  resolvedAt: Date,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNotes: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
};
```

### 4. Enhanced School Model

```javascript
// Extended School schema for system admin management
const SchoolSchema = {
  // ... existing fields
  systemConfig: {
    isActive: { type: Boolean, default: true },
    subscriptionTier: {
      type: String,
      enum: ['basic', 'standard', 'premium', 'enterprise'],
      default: 'basic'
    },
    features: [{
      featureName: String,
      isEnabled: Boolean,
      enabledAt: Date,
      enabledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    limits: {
      maxUsers: { type: Number, default: 1000 },
      maxStudents: { type: Number, default: 500 },
      maxStorage: { type: Number, default: 5000 }, // MB
      maxApiCalls: { type: Number, default: 10000 } // per month
    },
    billing: {
      subscriptionId: String,
      billingEmail: String,
      nextBillingDate: Date,
      isTrialAccount: { type: Boolean, default: false },
      trialEndsAt: Date
    }
  },
  // ... rest of schema
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified several areas where properties can be consolidated for more comprehensive testing:

**Consolidation Opportunities:**
- Properties 1.1-1.5 (Dashboard metrics) can be combined into comprehensive dashboard validation
- Properties 3.1-3.5 (User management) share common cross-school user operation patterns
- Properties 4.1-4.5 (Analytics) all test report generation with different data types
- Properties 5.1-5.5 (Security) can be consolidated into security policy enforcement testing
- Properties 7.1-7.5 (System management) share system configuration patterns

**Unique Value Properties:**
- School isolation testing (Property 2.2) - critical for multi-tenant security
- Data export functionality (Property 4.5) - essential for compliance
- Emergency communication (Property 6.5) - critical system capability
- Impersonation functionality (Property 8.3) - unique support feature

### Correctness Properties

Property 1: Platform dashboard completeness
*For any* system admin dashboard request, the response should contain real-time metrics for all active schools, including total counts of users, students, teachers, and schools, plus system health indicators
**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: School performance analytics accuracy
*For any* set of schools with performance data, comparative analytics should accurately reflect relative performance metrics and trends across all schools
**Validates: Requirements 1.4**

Property 3: Critical alert visibility
*For any* system alerts generated, critical severity alerts should always be visible in the system admin dashboard with proper prioritization
**Validates: Requirements 1.5**

Property 4: School creation completeness
*For any* new school creation request, the system should establish complete school profile, admin credentials, and initial configuration settings
**Validates: Requirements 2.1**

Property 5: School isolation integrity
*For any* school configuration changes, modifications should only affect the target school while leaving all other school instances completely unchanged
**Validates: Requirements 2.2**

Property 6: School deactivation data preservation
*For any* school deactivation operation, user access should be suspended while all school data remains intact and recoverable
**Validates: Requirements 2.3**

Property 7: School configuration visibility
*For any* school instance, the configuration view should display all school-specific settings, customizations, and feature toggles
**Validates: Requirements 2.4, 2.5**

Property 8: Cross-school user management
*For any* user management operation, system admins should be able to view, filter, and manage users across all schools with proper permission controls
**Validates: Requirements 3.1, 3.2**

Property 9: Security investigation access
*For any* security investigation, system admins should have access to comprehensive user activity logs, authentication history, and audit trails
**Validates: Requirements 3.3, 3.5**

Property 10: Administrative override capability
*For any* school-level restriction, system admins should be able to override limitations for legitimate administrative purposes while maintaining audit trails
**Validates: Requirements 3.4**

Property 11: Platform analytics generation
*For any* analytics request across multiple schools and time periods, the system should generate accurate custom reports with proper data aggregation
**Validates: Requirements 4.1, 4.2, 4.4**

Property 12: Financial data accuracy
*For any* financial analytics request, the system should provide accurate subscription status, billing information, and revenue calculations
**Validates: Requirements 4.3**

Property 13: Data export format consistency
*For any* data export request, reports should be generated correctly in all supported formats with consistent data representation
**Validates: Requirements 4.5**

Property 14: Security monitoring completeness
*For any* security monitoring dashboard, all failed login attempts, suspicious activities, and security alerts should be visible with proper categorization
**Validates: Requirements 5.1**

Property 15: Compliance policy enforcement
*For any* compliance configuration, data retention policies, privacy settings, and security policies should be enforced consistently across the platform
**Validates: Requirements 5.2, 5.5**

Property 16: GDPR request processing
*For any* GDPR or data export request, the system should process requests according to regulatory requirements with complete data retrieval
**Validates: Requirements 5.3**

Property 17: Audit log completeness
*For any* platform operation, comprehensive activity tracking should be maintained and accessible through audit log interfaces
**Validates: Requirements 5.4**

Property 18: Communication broadcasting accuracy
*For any* platform announcement, messages should be delivered to the correct recipient groups (all schools or specific school selections)
**Validates: Requirements 6.1**

Property 19: Notification configuration consistency
*For any* notification preference changes, system-wide settings and templates should be applied consistently across all affected schools
**Validates: Requirements 6.2**

Property 20: Support request handling
*For any* escalated support request, system admins should have access to request details and response capabilities with proper tracking
**Validates: Requirements 6.3**

Property 21: Maintenance coordination
*For any* scheduled maintenance, affected schools should receive proper notifications and maintenance windows should be coordinated correctly
**Validates: Requirements 6.4**

Property 22: Emergency communication immediacy
*For any* emergency alert, immediate notifications should be sent to all platform users with highest priority delivery
**Validates: Requirements 6.5**

Property 23: Integration management functionality
*For any* third-party integration, API keys, webhooks, and service connections should be manageable through the system admin interface
**Validates: Requirements 7.1**

Property 24: System performance monitoring
*For any* performance monitoring request, database performance, cache hit rates, and service health metrics should be accurately displayed
**Validates: Requirements 7.2**

Property 25: Platform configuration management
*For any* platform setting changes, global defaults, feature flags, and system parameters should be applied correctly across the platform
**Validates: Requirements 7.3**

Property 26: System maintenance operations
*For any* maintenance operation, database operations, cache management, and system updates should execute successfully with proper validation
**Validates: Requirements 7.4**

Property 27: Resource scaling coordination
*For any* resource usage monitoring, scaling requirements should be identified and infrastructure changes coordinated appropriately
**Validates: Requirements 7.5**

Property 28: Diagnostic information access
*For any* troubleshooting session, detailed error logs, stack traces, and diagnostic information should be accessible and comprehensive
**Validates: Requirements 8.1**

Property 29: Performance investigation tools
*For any* performance problem investigation, query performance data, slow endpoint identification, and bottleneck analysis should be available
**Validates: Requirements 8.2**

Property 30: Administrative impersonation
*For any* support impersonation request, system admins should be able to impersonate school administrators safely with proper audit logging
**Validates: Requirements 8.3**

Property 31: System resource monitoring accuracy
*For any* resource monitoring request, memory usage, CPU utilization, and storage capacity metrics should be accurately reported
**Validates: Requirements 8.4**

Property 32: Diagnostic data export
*For any* diagnostic export request, system state information and diagnostic data should be exported in formats suitable for technical analysis
**Validates: Requirements 8.5**

Property 33: Pre-configured credential validation
*For any* system admin login attempt, authentication should validate against environment-based credentials without requiring database lookups or registration processes
**Validates: Requirements 9.1, 9.2, 9.3**

## Error Handling

### System Admin Specific Error Handling

1. **Cross-School Data Access Errors**
   - Handle school data unavailability gracefully
   - Provide partial results when some schools are inaccessible
   - Clear error messages for data aggregation failures

2. **Permission Escalation Errors**
   - Validate system admin privileges before operations
   - Audit failed privilege escalation attempts
   - Graceful degradation for insufficient permissions

3. **Platform-Wide Operation Errors**
   - Transaction rollback for failed multi-school operations
   - Partial success handling with detailed error reporting
   - Automatic retry mechanisms for transient failures

4. **Data Aggregation Errors**
   - Handle large dataset timeouts gracefully
   - Provide sampling options for performance
   - Clear progress indicators for long-running operations

### Error Response Format

```javascript
{
  success: false,
  error: {
    code: 'SYSTEM_ADMIN_ERROR_CODE',
    message: 'Human-readable error message',
    details: {
      affectedSchools: ['school1', 'school2'],
      partialResults: {...},
      retryable: true,
      suggestedAction: 'Contact system administrator'
    },
    timestamp: '2024-01-01T00:00:00Z',
    requestId: 'req_123456789'
  }
}
```

## Testing Strategy

### Dual Testing Approach

The System Admin Dashboard requires both unit testing and property-based testing to ensure correctness across the complex multi-tenant environment.

#### Unit Testing Requirements

Unit tests will focus on:
- **Individual controller methods** with mocked cross-school data
- **Service layer functions** with controlled test data
- **Authentication and authorization** edge cases
- **Error handling scenarios** for specific failure modes
- **Data aggregation logic** with known datasets
- **Integration points** between system admin and existing services

#### Property-Based Testing Requirements

Property-based testing will use **fast-check** library for JavaScript to verify universal properties across randomized inputs:

- **Minimum 100 iterations** per property test for statistical confidence
- **Cross-school data consistency** across random school configurations
- **Permission enforcement** across random user and school combinations
- **Data aggregation accuracy** with randomly generated multi-school datasets
- **Security isolation** with random cross-school access attempts

Each property-based test will be tagged with the format: **Feature: system-admin-dashboard, Property {number}: {property_text}**

#### Test Data Management

- **Test school instances** with varied configurations
- **Mock multi-tenant data** for cross-school testing
- **Synthetic performance metrics** for analytics testing
- **Controlled security events** for monitoring tests
- **Isolated test environments** to prevent cross-contamination

#### Integration Testing

- **End-to-end workflows** for complete system admin operations
- **Cross-service integration** with existing EduConnect components
- **Performance testing** for large-scale data aggregation
- **Security testing** for privilege escalation and access control
- **Disaster recovery testing** for system admin emergency procedures

The testing strategy ensures that the System Admin Dashboard maintains data integrity, security, and performance while providing reliable cross-school management capabilities.
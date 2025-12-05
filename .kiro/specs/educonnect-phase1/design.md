# EduConnect Phase 1 Design Document

## Overview

EduConnect Phase 1 implements a robust foundation for an educational platform with comprehensive RBAC authentication. The system uses Node.js with Express.js, MongoDB for data persistence, JWT for authentication, and Resend for email services. The architecture prioritizes security, scalability, and role-based access control with multi-tenant school isolation.

**Key Design Decisions:**
- **Multi-tenant Architecture**: Each school operates as an isolated tenant with unique schoolId for data segregation
- **Invitation-based Registration**: Teachers and parents join through secure email invitations to maintain controlled access
- **Comprehensive RBAC**: Three-tier permission system (Admin > Teacher > Parent) with strict data access boundaries
- **Email-first Verification**: All critical workflows use email verification through Resend for security and user communication

## Architecture

### System Architecture
The system follows a layered architecture with clear separation of concerns:

- **Presentation Layer**: REST API endpoints with Express.js
- **Business Logic Layer**: Controllers and services handling core functionality  
- **Data Access Layer**: Mongoose ODM with MongoDB
- **External Services**: Resend for email, file storage for uploads

### Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Email Service**: Resend
- **Password Hashing**: bcrypt
- **Validation**: Joi
- **File Upload**: Multer
- **Environment**: dotenv

## Components and Interfaces

### 1. Authentication System

#### School Authentication Controller
Handles school registration, verification, and admin login with the following endpoints:
- POST /api/school/auth/signup - School registration with auto admin creation
- POST /api/school/auth/verify-email - Email verification with OTP
- POST /api/school/auth/login - School admin login
- POST /api/school/auth/forgot-password - Password reset request
- POST /api/school/auth/reset-password - Password reset completion
- POST /api/school/auth/refresh-token - JWT token refresh
- POST /api/school/auth/logout - Session termination

**Design Rationale**: Separate school authentication ensures proper tenant isolation and allows for school-specific admin privileges from the registration phase.

#### User Authentication Controller
Handles teacher and parent registration/login:
- POST /api/auth/signup/teacher - Teacher registration with invitation
- POST /api/auth/signup/parent - Parent registration with invitation
- POST /api/auth/login - Universal user login
- POST /api/auth/verify-invitation - Invitation token verification
- POST /api/auth/resend-invitation - Resend invitation email
- POST /api/auth/forgot-password - User password reset
- POST /api/auth/reset-password - Complete password reset
- POST /api/auth/logout - User session termination

**Design Rationale**: Universal login endpoint simplifies client implementation while maintaining role-based JWT tokens for proper authorization.

### 2. RBAC System

#### Permission Matrix
- **Admin**: Full access to all school data and user management
- **Teacher**: Access to assigned classes and students only
- **Parent**: Access to linked children's data only

#### RBAC Middleware Components
- Role verification middleware
- School access control
- Resource ownership validation
- Route-specific permission checks

### 3. Admin Management System

#### Admin Dashboard Controller
- GET /api/admin/dashboard - School analytics and statistics
- GET /api/admin/dashboard/users - User counts by role (teachers, parents, students)
- GET /api/admin/dashboard/activity - Recent activity summaries

#### School Profile Management
- GET /api/admin/school/profile - View school profile
- PUT /api/admin/school/profile - Update school information

#### Teacher Management Controller
- POST /api/admin/teachers/invite - Send teacher invitation emails
- GET /api/admin/teachers - List all teachers with filtering
- PUT /api/admin/teachers/:id/status - Activate/deactivate teacher accounts
- DELETE /api/admin/teachers/:id - Remove teacher (with data preservation)

#### Student Management Controller
- POST /api/admin/students - Create new student records
- GET /api/admin/students - List students with filtering
- PUT /api/admin/students/:id - Update student information
- PUT /api/admin/students/:id/status - Activate/deactivate students
- DELETE /api/admin/students/:id - Remove student (preserve historical data)

#### Parent Management Controller
- POST /api/admin/parents/invite - Send parent invitation with student linking
- GET /api/admin/parents - List parents with student relationships
- PUT /api/admin/parents/:id/students - Modify parent-student relationships
- DELETE /api/admin/parents/:id - Remove parent account

**Design Rationale**: Comprehensive admin management ensures full school control while maintaining data integrity and audit trails for all user management operations.

### 4. Email Service Integration

#### Email Service with Resend
The email service handles all automated communications with professional templates and retry mechanisms:

**Email Types:**
- School welcome and verification emails with OTP
- Teacher invitation emails with registration links and role information
- Parent invitation emails with student linking details
- Password reset notifications with secure tokens
- SchoolId delivery emails after successful verification
- Invitation resend functionality for expired tokens

**Email Templates:**
- Professional HTML templates for all communication types
- Consistent branding and clear call-to-action buttons
- Mobile-responsive design for accessibility
- Error handling with graceful fallbacks

**Design Rationale**: Centralized email service through Resend ensures reliable delivery, professional presentation, and consistent user experience across all platform communications.

### 5. Invitation Management System

#### Invitation Controller
- GET /api/admin/invitations - List all pending invitations with status
- POST /api/admin/invitations/:id/resend - Resend expired invitations
- DELETE /api/admin/invitations/:id - Cancel pending invitations
- PUT /api/admin/invitations/:id/status - Update invitation status

**Invitation Workflow:**
1. Admin creates invitation with role-specific information
2. System generates secure token with expiration
3. Email sent with registration link and instructions
4. User completes registration using valid token
5. System automatically updates invitation status
6. Expired invitations can be resent or cancelled

**Design Rationale**: Centralized invitation management provides admins with full visibility and control over the user onboarding process, ensuring security and proper access control while maintaining audit trails.

## Data Models

### School Model
```javascript
{
  _id: ObjectId,
  schoolId: String (unique, auto-generated),
  schoolName: String (required),
  email: String (unique, required),
  password: String (hashed, required),
  address: String,
  phone: String,
  principalName: String,
  adminUserId: ObjectId,
  isVerified: Boolean (default: false),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### User Model
```javascript
{
  _id: ObjectId,
  schoolId: String (required),
  email: String (unique, required),
  password: String (hashed, required),
  firstName: String (required),
  lastName: String (required),
  role: String (enum: ["admin", "teacher", "parent"]),
  phone: String,
  profileImage: String,
  isSchoolAdmin: Boolean,
  employeeId: String, // Teacher specific
  subjects: [String], // Teacher specific
  classes: [String], // Teacher specific
  children: [ObjectId], // Parent specific
  isActive: Boolean (default: true),
  isVerified: Boolean (default: false),
  invitationToken: String,
  invitationExpires: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Student Model
```javascript
{
  _id: ObjectId,
  schoolId: String (required),
  studentId: String (unique within school),
  firstName: String (required),
  lastName: String (required),
  email: String,
  class: String,
  section: String,
  rollNumber: String,
  dateOfBirth: Date,
  parents: [ObjectId],
  teachers: [ObjectId],
  profileImage: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### Invitation Model
```javascript
{
  _id: ObjectId,
  schoolId: String (required),
  email: String (required),
  role: String (enum: ["teacher", "parent"]),
  invitedBy: ObjectId (required),
  token: String (unique, required),
  studentIds: [ObjectId], // For parent invitations
  subjects: [String], // For teacher invitations
  classes: [String], // For teacher invitations
  status: String (enum: ["pending", "accepted", "expired"]),
  expiresAt: Date (required),
  createdAt: Date
}
```

### OTP Model
```javascript
{
  _id: ObjectId,
  email: String (required),
  otp: String (required),
  purpose: String (enum: ["school-signup", "password-reset"]),
  schoolId: String,
  expiresAt: Date (required),
  isUsed: Boolean (default: false),
  createdAt: Date
}
```

## Error Handling

### Error Response Format
All API errors follow a consistent format with success flag, error code, message, and timestamp for proper client handling and debugging.

### Error Categories
1. **Authentication Errors**: Invalid credentials, expired tokens
2. **Authorization Errors**: Insufficient permissions, role restrictions  
3. **Validation Errors**: Invalid input data, missing required fields
4. **Business Logic Errors**: Duplicate registrations, invalid operations
5. **System Errors**: Database connection, email service failures

## Testing Strategy

### Unit Testing
- Model validation and business logic
- Controller request/response handling
- Service layer functionality
- Middleware authentication and authorization
- Utility functions and helpers

### Integration Testing
- Complete authentication workflows
- RBAC system across all endpoints
- Email service integration with Resend
- Database operations and relationships

### API Testing
- All REST endpoints with various scenarios
- Security testing for authentication bypass
- Performance testing for critical paths
- Error handling validation

## Security Considerations

### Authentication Security
- JWT tokens with secure expiration and refresh mechanisms
- bcrypt password hashing with salt rounds for all user passwords
- Rate limiting on authentication endpoints to prevent brute force attacks
- Account lockout mechanisms after failed login attempts
- Strong password requirements enforced for all user roles
- Secure password reset tokens with time-based expiration

### Data Protection
- Comprehensive input validation and sanitization using Joi schemas
- MongoDB injection prevention through parameterized queries
- XSS protection through proper data encoding and validation
- CORS configuration for secure cross-origin requests
- Audit logging for all sensitive operations and data access
- Data encryption for sensitive fields in database storage

### Role-Based Security
- Strict role verification on every protected endpoint
- School-level data isolation preventing cross-tenant access
- Resource ownership validation for user-specific data
- Hierarchical permission system (Admin > Teacher > Parent)
- Token-based invitation system with secure expiration
- Session management with proper token invalidation

### Multi-Tenant Security
- SchoolId-based data segregation at database level
- Tenant isolation in all queries and operations
- Cross-school access prevention through middleware validation
- Secure school registration with email verification

**Design Rationale**: Layered security approach ensures data protection at multiple levels while maintaining usability. The multi-tenant architecture prevents data leakage between schools, and the RBAC system ensures users only access appropriate resources.
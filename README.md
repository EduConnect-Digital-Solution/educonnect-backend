# EduConnect Phase 1 🎓

A comprehensive educational platform backend with Role-Based Access Control (RBAC) authentication system, built with Node.js, Express, and MongoDB.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://mongodb.com/)
[![Jest](https://img.shields.io/badge/Jest-29+-red.svg)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

## 🚀 Features

### Core Functionality
- **🏫 Multi-tenant School Management**: Each school operates as an isolated tenant with unique school IDs
- **👥 Role-Based Access Control**: Comprehensive RBAC with Admin, Teacher, and Parent roles
- **📊 Grades & Assessment Management**: Complete grading system with multi-assessment support, automatic calculations, and analytics
- **📧 Invitation-based Registration**: Secure email invitations for teachers and parents with temporary passwords
- **🔐 JWT Authentication**: Secure token-based authentication with refresh token mechanism
- **📨 Email Integration**: Automated email notifications using Resend service
- **🛡️ Security Features**: Rate limiting, input validation, CORS, Helmet security headers

### User Management
- **School Admins**: Full school management capabilities
- **Teachers**: Student management, grades assignment, and dashboard access with class analytics
- **Parents**: Access to their children's information, grades, and progress reports
- **Students**: Managed by admins with comprehensive profile system and grade tracking

### Technical Features
- **📊 MongoDB Integration**: Robust data persistence with Mongoose ODM
- **🧪 Comprehensive Testing**: 54+ unit tests covering all components
- **📚 API Documentation**: Interactive Swagger/OpenAPI documentation
- **🔄 Hot Reload**: Development server with automatic restarts
- **⚡ Performance**: Optimized with caching and efficient queries

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Environment Configuration](#-environment-configuration)
- [Authentication & Authorization](#-authentication--authorization)
- [Testing](#-testing)
- [Development](#-development)
- [Deployment](#-deployment)
- [System Admin Dashboard](#-system-admin-dashboard)
- [Contributing](#-contributing)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 6.0+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd educonnect-phase1
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration (see [Environment Configuration](#-environment-configuration))

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - API: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - API Documentation: http://localhost:3000/api-docs

## 📚 API Documentation

### Interactive Documentation
- **Swagger UI**: http://localhost:3000/api-docs (when server is running)
- **Health Check**: http://localhost:3000/health

### Documentation Files

#### For Frontend Developers & Designers
- **[API Endpoints Reference](./docs/API_Endpoints_Reference.md)** ⭐ **START HERE** - Complete API reference organized by user roles (35+ endpoints)
- **[API Examples](./docs/api-examples.md)** - Practical usage examples with cURL, JavaScript, and React integration
- **[Swagger Specification](./docs/swagger.yaml)** - OpenAPI specification for import into API tools

#### For Project Management & Stakeholders  
- **[Project Status Report](./docs/Project_Status_Report.md)** - Comprehensive project overview with 457 passing tests
- **[Implementation Status](./docs/Implementation_Status.md)** - Detailed implementation checklist and metrics

### Key Endpoints

#### Authentication
- `POST /api/school/auth/register` - Register new school
- `POST /api/school/auth/login` - School admin login
- `POST /api/user/auth/login` - Teacher/Parent login
- `POST /api/user/auth/complete-registration` - Complete user registration

#### Management (Admin Only)
- `GET /api/admin/dashboard/analytics` - School analytics
- `GET /api/admin/dashboard/users` - User management
- `POST /api/students` - Create student
- `POST /api/parent-management/invite-parent` - Invite parent

#### Dashboards
- `GET /api/teacher/dashboard` - Teacher dashboard
- `GET /api/teacher/students` - Teacher's students
- `GET /api/teacher/classes` - Teacher's classes for grading
- `GET /api/teacher/classes/:className/subjects` - Subjects by class
- `GET /api/teacher/classes/:className/subjects/:subject/students` - Students for grading
- `GET /api/parent/dashboard` - Parent dashboard
- `GET /api/parent/children` - Parent's children

#### Grades Management (Teachers)
- `POST /api/teacher/grades` - Assign/update student grades
- `GET /api/teacher/grades/:gradeId` - Get grade details
- `PUT /api/teacher/grades/:gradeId` - Update existing grade
- `DELETE /api/teacher/grades/:gradeId` - Delete grade
- `POST /api/teacher/grades/publish` - Publish grades to parents
- `GET /api/teacher/classes/:className/subjects/:subject/statistics` - Class performance analytics

### Authentication Flow

#### For School Admin
1. Register school → `POST /api/school/auth/register`
2. Verify email with OTP → `POST /api/school/auth/verify-email`
3. Login → `POST /api/school/auth/login`
4. Receive JWT tokens (access + refresh)

#### For Teachers & Parents
1. Admin sends invitation → `POST /api/parent-management/invite-parent`
2. User receives email with temporary password
3. Complete registration → `POST /api/user/auth/complete-registration`
4. Login → `POST /api/user/auth/login`

Most endpoints require JWT authentication. Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
     http://localhost:3000/api/admin/dashboard/analytics
```

## 🏗️ Project Structure

```
educonnect-phase1/
├── docs/                    # Documentation
│   └── swagger.yaml        # API specification
├── src/
│   ├── config/             # Configuration files
│   │   ├── database.js     # MongoDB connection
│   │   ├── email.js        # Resend email service
│   │   ├── jwt.js          # JWT configuration
│   │   ├── swagger.js      # API documentation setup
│   │   └── index.js        # Main configuration
│   ├── controllers/        # API controllers
│   │   ├── schoolAuthController.js
│   │   ├── userAuthController.js
│   │   ├── adminDashboardController.js
│   │   └── ...
│   ├── middleware/         # Custom middleware
│   │   ├── auth.js         # JWT authentication
│   │   ├── rbac.js         # Role-based access control
│   │   ├── validation.js   # Input validation
│   │   └── ...
│   ├── models/             # Database models
│   │   ├── School.js       # School model
│   │   ├── User.js         # User model
│   │   ├── Student.js      # Student model
│   │   └── ...
│   ├── routes/             # API routes
│   │   ├── schoolAuth.js   # School authentication
│   │   ├── userAuth.js     # User authentication
│   │   └── ...
│   ├── __tests__/          # Test files
│   │   ├── controllers/    # Controller tests
│   │   ├── middleware/     # Middleware tests
│   │   ├── models/         # Model tests
│   │   └── routes/         # Route tests
│   ├── app.js              # Express application
│   └── server.js           # Server entry point
├── jest.config.js          # Jest configuration
├── jest.setup.js           # Jest setup
└── package.json            # Dependencies and scripts
```

## ⚙️ Environment Configuration

### Required Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/educonnect-phase1

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Email Service (Resend)
RESEND_API_KEY=your-resend-api-key-here
FROM_EMAIL=noreply@educonnect.com

# Security
BCRYPT_SALT_ROUNDS=12
OTP_EXPIRES_IN_MINUTES=10
INVITATION_EXPIRES_IN_HOURS=72

# Rate Limiting
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=20

# Frontend (Optional)
FRONTEND_URL=http://localhost:3000
```

### Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 3000 | No |
| `NODE_ENV` | Environment mode | development | No |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/educonnect-phase1 | No |
| `JWT_SECRET` | JWT signing secret | - | **Yes** |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | - | **Yes** |
| `JWT_EXPIRES_IN` | Access token expiration | 1h | No |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | 7d | No |
| `RESEND_API_KEY` | Resend email service API key | - | **Yes** |
| `FROM_EMAIL` | Sender email address | noreply@educonnect.com | No |
| `BCRYPT_SALT_ROUNDS` | Password hashing rounds | 12 | No |
| `OTP_EXPIRES_IN_MINUTES` | OTP expiration time | 10 | No |
| `INVITATION_EXPIRES_IN_HOURS` | Invitation token expiration | 72 | No |

## 🔐 Authentication & Authorization

### Authentication Flow

1. **School Registration**: Schools register with admin user creation
2. **Email Verification**: OTP-based email verification
3. **User Invitations**: Admins invite teachers and parents via email
4. **Registration Completion**: Users complete registration with temporary passwords
5. **JWT Authentication**: Secure token-based authentication

### Role-Based Access Control (RBAC)

#### Admin Role
- Full school management access
- User management (teachers, parents, students)
- Analytics and reporting
- School profile management

#### Teacher Role
- Access to assigned students
- Dashboard with student information
- Profile management

#### Parent Role
- Access to linked children only
- Dashboard with children's information
- Profile management

### Security Features

- **Password Security**: bcrypt hashing with configurable salt rounds
- **JWT Tokens**: Secure authentication with refresh mechanism
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive request validation with Joi
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers for protection

## 🧪 Testing

### Test Coverage

The project includes comprehensive testing with **54+ unit tests**:

- **Route Tests**: API endpoint testing with mocked dependencies
- **Controller Tests**: Business logic validation
- **Model Tests**: Database model validation
- **Middleware Tests**: Authentication, RBAC, validation testing
- **Service Tests**: Email service and configuration testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- src/routes/__tests__/userAuth.test.js
```

### Test Structure

```
src/
├── controllers/__tests__/
├── middleware/__tests__/
├── models/__tests__/
├── routes/__tests__/
└── config/__tests__/
```

## 💻 Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Install dependencies
npm install
```

### Development Workflow

1. **Start development server**: `npm run dev`
2. **Make changes**: Code changes trigger automatic restart
3. **Test changes**: Run relevant tests
4. **Check API docs**: Visit `/api-docs` for interactive testing
5. **Commit changes**: Follow conventional commit format

### Code Quality

- **ESLint**: Code linting and formatting
- **Jest**: Unit testing framework
- **Supertest**: HTTP assertion testing
- **Joi**: Input validation
- **Mongoose**: MongoDB object modeling

## 🚀 Deployment

### Production Setup

1. **Environment Variables**: Set production environment variables
2. **Database**: Configure production MongoDB instance
3. **Email Service**: Configure Resend API for production
4. **Security**: Update CORS origins and security settings

### Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Monitoring

- Health check endpoint: `GET /health`
- Returns server status, environment, and timestamp
- Use for load balancer health checks

## 🔧 System Admin Dashboard

EduConnect includes a comprehensive **System Admin Dashboard** for platform-wide management across multiple schools.

### Features
- **Cross-School Management**: Manage multiple schools from a single interface
- **Platform Analytics**: Real-time metrics and performance data across all schools
- **User Management**: Cross-school user access and security monitoring
- **School Operations**: Create, configure, and manage schools
- **Audit Logging**: Comprehensive tracking of all system admin operations
- **Alert System**: System-wide alert management and resolution

### Authentication
System Admin uses **pre-configured authentication** with environment-based credentials:
- No registration endpoints (security by design)
- Environment variable configuration
- Separate JWT tokens for system admin access
- Cross-school access permissions

### Key Endpoints
- `POST /api/system-admin/auth/login` - System admin login
- `GET /api/system-admin/platform/overview` - Platform metrics
- `GET /api/system-admin/schools` - School management
- `GET /api/system-admin/users` - Cross-school user management

### Documentation
- **[System Admin API Documentation](./docs/system-admin-api-documentation.md)** - Complete API reference
- **[System Admin Data Structures](./docs/system-admin-data-structures.md)** - Data models and schemas
- **[System Admin Business Context](./docs/system-admin-business-context.md)** - Business requirements
- **[System Admin User Flows](./docs/system-admin-user-flows.md)** - User interaction flows

### Implementation Status
✅ **MVP Complete** - Core system admin functionality implemented:
- Pre-configured authentication system
- Cross-school data aggregation services  
- Platform overview and metrics
- School management operations
- User management across schools
- Comprehensive audit logging

## 🤝 Contributing

### Development Guidelines

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Write tests**: Ensure new code has test coverage
4. **Run tests**: `npm test` should pass
5. **Update documentation**: Update README and API docs if needed
6. **Commit changes**: Use conventional commit format
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open Pull Request**

### Code Standards

- Follow existing code style and patterns
- Write comprehensive tests for new features
- Update API documentation for new endpoints
- Ensure all tests pass before submitting PR

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Email**: support@educonnect.com
- **Documentation**: Visit `/api-docs` when server is running
- **Issues**: Create an issue in the repository

---

**Built with ❤️ for educational institutions in Nigeria**
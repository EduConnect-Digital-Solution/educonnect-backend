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
- **[Paystack Integration API](./docs/postman/Paystack-Integration-API.md)** - Card checkout flow for frontend developers
- **[NexaPay Integration API](./docs/postman/NexaPay-Integration-API.md)** - Bank transfer collection flow for frontend developers
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

# Payment Gateway (Paystack)
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx

# Payment Gateway (NexaPay)
# 32 byte key, base64 encoded. Encrypts the per-school NexaPay API key and
# webhook secret at rest. Generate with: openssl rand -base64 32
SECRETS_ENC_KEY=your-base64-encoded-32-byte-key
# Optional. Defaults to https://api.nexapay.ng/api/v1/business
NEXAPAY_BASE_URL=https://api.nexapay.ng/api/v1/business
# Temporary debugging aid, off by default and force-disabled in production
NEXAPAY_DEBUG_WEBHOOKS=false
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
| `SECRETS_ENC_KEY` | 32 byte base64 key used to encrypt per-school gateway secrets at rest | - | **Yes** |
| `NEXAPAY_BASE_URL` | NexaPay merchant API base URL | https://api.nexapay.ng/api/v1/business | No |
| `NEXAPAY_DEBUG_WEBHOOKS` | Log the signature layout of incoming NexaPay webhooks (never in production) | false | No |

## 💳 NexaPay — Bank Transfer Collections

NexaPay is a second payment gateway, alongside Paystack. It collects by **bank
transfer**: instead of redirecting the payer to a checkout page, the API opens a
customer-facing virtual bank account for the invoice and the payer sends money
to that account. The deposit is detected by a signed webhook.

Every school is its own NexaPay merchant with its own `businessId`, API key and
webhook secret. Those secrets are encrypted at rest with `SECRETS_ENC_KEY`.

### Per-school onboarding (manual)

NexaPay's Merchant API has no programmatic onboarding endpoint, so a merchant
has to be created in the NexaPay dashboard:

1. Create the merchant in the NexaPay dashboard (test environment first).
2. Copy the **business ID**, the **API key** and the **webhook secret**.
3. Register the webhook URL in the dashboard:
   `https://<your-api-host>/api/fees/nexapay/webhook`
4. Store the credentials through the API (below). The API key and webhook
   secret are write-only — they are encrypted on the way in and never returned.

### Endpoints

| Method | Path | Who | Purpose |
|--------|------|-----|---------|
| `GET` | `/api/fees/gateway/nexapay/config` | admin, system_admin | Read the school's NexaPay configuration (no secrets) |
| `PUT` | `/api/fees/gateway/nexapay/config` | admin, system_admin | Create or replace the school's NexaPay configuration |
| `POST` | `/api/fees/invoices/:invoiceId/initialize` | admin, system_admin | Open a collection — body `{ "gateway": "nexapay" }` |
| `POST` | `/api/fees/payments/verify` | admin, system_admin | Manually verify a NexaPay reference (optional `transactionId`) |
| `GET` | `/api/fees/my/invoices` | parent, student | The caller's own (or their linked children's) invoices |
| `POST` | `/api/fees/my/invoices/:invoiceId/nexapay` | parent, student | Open a collection for one of those invoices |
| `POST` | `/api/fees/my/payments/nexapay/verify` | parent, student | Verify one of the caller's NexaPay payments |
| `POST` | `/api/fees/nexapay/webhook` | public (signature) | NexaPay deposit notifications |

Configure a school:

```http
PUT /api/fees/gateway/nexapay/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "businessId": "66f1234567890abcde123456",
  "environment": "test",
  "apiKey": "nexa-test-xxxxxxxx",
  "webhookSecret": "whsec_xxxxxxxx"
}
```

A school admin can only configure their own school. A system admin may target
another school by passing `schoolId`. NexaPay picks the mode from the key
prefix, so a `test` configuration must use a `nexa-test-` key and a `prod`
configuration a `nexa-prod-` key; anything else is rejected. Before saving, the
API key is checked against NexaPay with a read-only call, so a business ID can
only be linked by someone holding its real key. One NexaPay business ID can only
be linked to one school. (NexaPay offers no API to check the webhook secret; a
wrong secret shows up as `401`s on the webhook.)

Open a collection:

```http
POST /api/fees/invoices/:invoiceId/initialize
Authorization: Bearer <token>
Content-Type: application/json

{ "gateway": "nexapay" }
```

`amount` and `email` are optional for NexaPay — the amount defaults to the
outstanding balance. The response carries the virtual account to pay into:

```json
{
  "success": true,
  "data": {
    "gateway": "nexapay",
    "reference": "nxa_9f2c...",
    "accountNumber": "0123456789",
    "bankName": "Example Bank",
    "amount": 400000,
    "expiresAt": "2026-10-24T12:00:00.000Z",
    "paymentId": "c1f0..."
  }
}
```

### Webhook

`POST /api/fees/nexapay/webhook` is mounted **before** `express.json()` so the
exact raw bytes survive for the HMAC check.

| Header | Purpose |
|--------|---------|
| `x-nexapay-business-id` | Selects the tenant secret. Nothing from the payload is trusted before the HMAC passes. |
| `x-nexapay-signature` | HMAC SHA-256 over the raw body and the timestamp |
| `x-nexapay-timestamp` | Timestamp of the delivery |
| `x-nexapay-event-id` | Idempotency key |
| `x-nexapay-event` | Event type, e.g. `deposit.received` |

Responses:

| Status | Meaning |
|--------|---------|
| `200` | Accepted — processed, already processed, or ignored |
| `400` | The delivery could not be parsed |
| `401` | Bad signature **or** unknown business — the response is identical for both |
| `500` | Processing failed, NexaPay should retry |

Guarantees:

- The event row (`gateway_events`) and the business effect commit in **one**
  transaction. A failure rolls both back and returns `500`, so the provider's
  retry gets a clean attempt.
- A replayed `eventId` (taken from the signed body) settles nothing twice. The
  NexaPay transaction id is a second de-duplication key, shared with manual
  verification, so a deposit is credited **exactly once** whether it arrives by
  webhook, by `POST /payments/verify`, or both.
- Only `deposit.received` moves money. Events without a matching `environment`
  are ignored, so sandbox deposits never settle a live invoice.
- Every invoice and session lookup is scoped to the verified tenant, so a forged
  `merchantReference` cannot touch another school's invoice.
- A deposit that matches no invoice, targets a voided invoice, or disagrees with
  our own session is stored with `needsReview = true` and not applied. An
  overpayment is applied and flagged with `needsReview = true`.
- Every payment path (webhook, manual verify, Paystack, cash entry, adjustments)
  moves `amountPaid` / `amountDue` with one atomic UPDATE, so concurrent
  updates are never lost and earlier discounts are kept.

### Manual verification

`POST /api/fees/payments/verify` with `{ "gateway": "nexapay", "reference": "nxa_..." }`
returns `status` as one of:

| `status` | Meaning |
|----------|---------|
| `confirmed` | The money arrived and the invoice was credited (now or earlier) |
| `pending` | No matching transaction yet; the virtual account stays open |
| `failed` | NexaPay reports the transaction as failed |
| `review` | The money arrived but was held for manual reconciliation |

NexaPay's transaction-details endpoint is keyed by its own transaction id, not by
our reference. Pass `transactionId` (from the payer's receipt or the NexaPay
dashboard) for a direct lookup; without it the 200 most recent wallet
transactions (the documented maximum, with no filter or paging) are searched
for the reference. If all 200 are newer than the deposit, the call answers
`400` asking for the `transactionId` rather than wrongly reporting `pending`.

### Resolved from the NexaPay docs

- **Amount units:** naira. The withdrawal schema documents its minimum as
  "minimum ₦1,000" with `minimum: 1000`, and the `deposit.received` example
  pairs `amount: 50000` with `balanceAfter: 125000`. Kobo is converted only in
  `src/services/nexapayService.js` and the webhook.
- **Environments:** `test` / `prod`, chosen by the API key prefix
  (`nexa-test-` / `nexa-prod-`); every webhook body carries `environment`.
- **Onboarding:** manual. Merchants register in the dashboard to get keys; the
  webhook URL and secret are managed there with a dashboard login, not with an
  API key (see the onboarding steps above).

### Open items

These are unresolved because NexaPay does not publish the information. Each one
needs a real test-mode account to close.

1. **Signature layout and digest encoding.** The docs only say "HMAC SHA-256
   over the raw body plus timestamp". The implementation accepts four layouts
   (`timestamp.body`, `timestampbody`, `body.timestamp`, `bodytimestamp`) and
   three encodings (hex, base64, base64url). Set `NEXAPAY_DEBUG_WEBHOOKS=true`
   with `NODE_ENV=development` or `test` (the flag is ignored otherwise) and
   trigger one test-mode delivery. The log shows every header name, the safe
   header values and the signature's length and encoding (never its value);
   for a delivery that names a configured school it also shows the body (first
   8 KB) and the `layout` that matched. Then delete the candidates that did not
   match and turn the flag off.
2. **Create-virtual-account response shape.** The OpenAPI document declares the
   `200` response without a body schema. `src/services/nexapayStrategy.js`
   picks the account number from the documented-looking names
   (`accountNumber` / `account_number`) and falls back to a nested `data`
   object. Record one real response and replace the fallback with the real
   field names.
3. **`amountValidation`.** The accepted values and their casing are not
   documented, so the parameter is not sent at all.
4. **Deposit `reference`.** The docs do not say whether `data.reference` in
   `deposit.received` (and `reference` on a wallet transaction) is the
   `reference` we sent when creating the virtual account. Settlement prefers our
   own session matched by that reference and falls back to `merchantReference`
   (our invoice id); confirm the echo with one test-mode deposit.
5. **`x-nexapay-business-id` header.** The webhook docs list it among headers
   NexaPay sends "similar to". If it is absent, the `businessId` in the body is
   used to choose which school's secret to verify with; the signature still has
   to pass under that secret.


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
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const config = require('./config');
const logger = require('./utils/logger');
const { globalErrorHandler } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Enhanced request logging middleware (before other middleware)
app.use(requestLogger);

// Security middleware
app.use(helmet());

// CORS configuration for multiple frontend origins
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://192.168.3.170:5173',
  'http://192.168.56.1:5173', 
  'https://educonnect.com.ng',
  'http://localhost:5173', // Additional local dev support
  'http://127.0.0.1:5173'  // Additional local dev support
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
}));

// Rate limiting for authentication endpoints (disabled in development)
const authLimiter = rateLimit({
  windowMs: config.rateLimiting.authWindowMs,
  max: config.rateLimiting.authMaxRequests,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in development
  skip: (req) => process.env.NODE_ENV === 'development'
});

// Apply rate limiting to auth routes (only in production)
if (process.env.NODE_ENV !== 'development') {
  app.use('/api/auth', authLimiter);
  app.use('/api/school/auth', authLimiter);
  app.use('/api/user/auth', authLimiter);
  app.use('/api/system-admin/auth', authLimiter);
  console.log('🛡️ Rate limiting enabled for production');
} else {
  console.log('🚧 Rate limiting disabled for development');
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing middleware
app.use(cookieParser());

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EduConnect API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    documentation: '/api-docs'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EduConnect API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'No origin header',
    timestamp: new Date().toISOString(),
    allowedOrigins: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://192.168.3.170:5173',
      'http://192.168.56.1:5173', 
      'https://educonnect.com.ng',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ]
  });
});

// Debug endpoint for production troubleshooting
app.get('/debug', (req, res) => {
  const debugInfo = {
    success: true,
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid,
      version: process.version,
      platform: process.platform
    },
    database: {
      connected: require('mongoose').connection.readyState === 1,
      readyState: require('mongoose').connection.readyState,
      host: require('mongoose').connection.host || 'Not connected'
    },
    env: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
      jwtSecret: process.env.JWT_SECRET ? 'Set' : 'Not set',
      redisUrl: process.env.REDIS_URL ? 'Set' : 'Not set'
    }
  };

  console.log('🔍 DEBUG INFO REQUESTED:', JSON.stringify(debugInfo, null, 2));
  res.status(200).json(debugInfo);
});

// Import routes
const schoolAuthRoutes = require('./routes/schoolAuth');
const userAuthRoutes = require('./routes/userAuth');
const adminDashboardRoutes = require('./routes/adminDashboard');
const teacherDashboardRoutes = require('./routes/teacherDashboard');
const parentDashboardRoutes = require('./routes/parentDashboard');
const schoolProfileRoutes = require('./routes/schoolProfile');
const studentManagementRoutes = require('./routes/studentManagement');
const parentManagementRoutes = require('./routes/parentManagement');
const teacherAssignmentRoutes = require('./routes/teacherAssignment');
const teacherClassAssignmentRoutes = require('./routes/teacherClassAssignment');

// System Admin routes
const systemAdminAuthRoutes = require('./routes/systemAdminAuth');
const systemAdminRoutes = require('./routes/systemAdmin');

// Import Swagger documentation
const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// Mount API routes
app.use('/api/school/auth', schoolAuthRoutes);
app.use('/api/user/auth', userAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/teacher', teacherDashboardRoutes);
app.use('/api/parent', parentDashboardRoutes);
app.use('/api/school/profile', schoolProfileRoutes);
app.use('/api/students', studentManagementRoutes);
app.use('/api/parent-management', parentManagementRoutes);
app.use('/api/admin', teacherAssignmentRoutes);
app.use('/api/admin/teachers', teacherClassAssignmentRoutes);

// System Admin routes
app.use('/api/system-admin/auth', systemAdminAuthRoutes);
app.use('/api/system-admin', systemAdminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
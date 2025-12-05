const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const { globalErrorHandler } = require('./middleware/errorHandler');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });

  next();
};

const app = express();

// Request logging middleware (before other middleware)
app.use(requestLogger);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: config.rateLimiting.authWindowMs,
  max: config.rateLimiting.authMaxRequests,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter);
app.use('/api/school/auth', authLimiter);
app.use('/api/user/auth', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'EduConnect API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
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
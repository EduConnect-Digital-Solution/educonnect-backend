const app = require('./app');
const { connectDB, prisma } = require('./config/database');
const { initializeRedis, closeRedis } = require('./config/redis');
const config = require('./config');
const logger = require('./utils/logger');

// Process-level error handlers for debugging
process.on('uncaughtException', (error) => {
  const errorDetails = {
    type: 'UNCAUGHT_EXCEPTION',
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    process: {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  logger.error('💀 UNCAUGHT EXCEPTION:', JSON.stringify(errorDetails, null, 2));
  logger.error('Uncaught Exception', errorDetails);
  
  // Exit process after logging
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  const errorDetails = {
    type: 'UNHANDLED_REJECTION',
    timestamp: new Date().toISOString(),
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
      stack: reason.stack
    } : reason,
    promise: promise.toString(),
    process: {
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    }
  };

  logger.error('⚠️ UNHANDLED REJECTION:', JSON.stringify(errorDetails, null, 2));
  logger.error('Unhandled Rejection', errorDetails);
  
  // Don't exit process for unhandled rejections, just log them
});

process.on('warning', (warning) => {
  const warningDetails = {
    type: 'PROCESS_WARNING',
    timestamp: new Date().toISOString(),
    warning: {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    }
  };

  logger.warn('⚠️ PROCESS WARNING:', JSON.stringify(warningDetails, null, 2));
  logger.warn('Process Warning', warningDetails);
});

// Initialize services
const initializeServices = async () => {
  try {
    logger.info('🔄 Initializing services...');
    
    // Connect to database
    logger.info('📊 Connecting to database...');
    await connectDB();
    logger.info('✅ Database connected successfully');
    
    // Initialize Redis (with graceful fallback)
    logger.info('🔴 Initializing Redis...');
    await initializeRedis();
    logger.info('✅ Redis initialized successfully');
    
  } catch (error) {
    const initError = {
      type: 'SERVICE_INITIALIZATION_ERROR',
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };

    logger.error('💥 SERVICE INITIALIZATION FAILED:', JSON.stringify(initError, null, 2));
    logger.error('Service Initialization Failed', initError);
    process.exit(1);
  }
};

// Initialize all services
initializeServices();

// Start server
const server = app.listen(config.port, () => {
  logger.info(`
🚀 EduConnect Phase 1 API Server Started
📍 Environment: ${config.nodeEnv}
🌐 Port: ${config.port}
📊 Health Check: http://localhost:${config.port}/health
⏰ Started at: ${new Date().toISOString()}
🔍 Debug Mode: Enhanced logging enabled
  `);
});

// Enhanced server error handling
server.on('error', (error) => {
  const serverError = {
    type: 'SERVER_ERROR',
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    },
    port: config.port
  };

  logger.error('🚨 SERVER ERROR:', JSON.stringify(serverError, null, 2));
  logger.error('Server Error', serverError);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('🔄 Shutting down gracefully...');
  
  try {
    // Close Redis connection
    logger.info('🔴 Closing Redis connection...');
    await closeRedis();
    logger.info('✅ Redis connection closed');
    
    // Close Prisma connection
    logger.info('📊 Closing PostgreSQL connection...');
    await prisma.$disconnect();
    logger.info('✅ PostgreSQL connection closed');
    
    // Close server
    server.close(() => {
      logger.info('✅ Server closed successfully');
      logger.info('🛑 Process terminated');
      process.exit(0);
    });
  } catch (error) {
    logger.error('💥 Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = server;
const app = require('./app');
const connectDB = require('./config/database');
const { initializeRedis, closeRedis } = require('./config/redis');
const config = require('./config');

// Initialize services
const initializeServices = async () => {
  // Connect to database
  await connectDB();
  
  // Initialize Redis (with graceful fallback)
  await initializeRedis();
};

// Initialize all services
initializeServices();

// Start server
const server = app.listen(config.port, () => {
  console.log(`
🚀 EduConnect Phase 1 API Server Started
📍 Environment: ${config.nodeEnv}
🌐 Port: ${config.port}
📊 Health Check: http://localhost:${config.port}/health
⏰ Started at: ${new Date().toISOString()}
  `);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  
  // Close Redis connection
  await closeRedis();
  
  // Close server
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
module.exports = server;
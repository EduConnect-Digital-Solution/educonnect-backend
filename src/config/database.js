const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

const connectDB = async () => {
  try {
    logger.info('🔄 Attempting to connect to PostgreSQL...');
    
    await prisma.$connect();
    
    logger.info('✅ PostgreSQL connected successfully');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🔄 Disconnecting from PostgreSQL...');
      await prisma.$disconnect();
      logger.info('✅ PostgreSQL disconnected');
      process.exit(0);
    });
    
  } catch (error) {
    const connectionError = {
      type: 'DATABASE_CONNECTION_FAILED',
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    };
    
    logger.error('💥 DATABASE CONNECTION FAILED:', JSON.stringify(connectionError, null, 2));
    logger.error('Database Connection Failed', connectionError);
    
    logger.info('⚠️ Server will continue running without database connection');
  }
};

module.exports = { connectDB, prisma };

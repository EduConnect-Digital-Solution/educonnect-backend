const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('📍 MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    logger.info('Database Connected', {
      host: conn.connection.host,
      name: conn.connection.name,
      readyState: conn.connection.readyState
    });
    
    // Handle connection events with enhanced logging
    mongoose.connection.on('error', (err) => {
      const dbError = {
        type: 'DATABASE_ERROR',
        timestamp: new Date().toISOString(),
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack
        },
        connection: {
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host
        }
      };

      console.error('💥 MONGODB CONNECTION ERROR:', JSON.stringify(dbError, null, 2));
      logger.error('MongoDB Connection Error', dbError);
    });

    mongoose.connection.on('disconnected', () => {
      const disconnectInfo = {
        type: 'DATABASE_DISCONNECTED',
        timestamp: new Date().toISOString(),
        readyState: mongoose.connection.readyState
      };

      console.warn('⚠️ MONGODB DISCONNECTED:', JSON.stringify(disconnectInfo, null, 2));
      logger.warn('MongoDB Disconnected', disconnectInfo);
    });

    mongoose.connection.on('reconnected', () => {
      const reconnectInfo = {
        type: 'DATABASE_RECONNECTED',
        timestamp: new Date().toISOString(),
        host: mongoose.connection.host,
        readyState: mongoose.connection.readyState
      };

      console.log('🔄 MONGODB RECONNECTED:', JSON.stringify(reconnectInfo, null, 2));
      logger.info('MongoDB Reconnected', reconnectInfo);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('🔄 Closing MongoDB connection...');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed through app termination');
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
      },
      mongoUri: process.env.MONGODB_URI ? 'Set' : 'Not set',
      nodeEnv: process.env.NODE_ENV
    };

    console.error('💥 DATABASE CONNECTION FAILED:', JSON.stringify(connectionError, null, 2));
    logger.error('Database Connection Failed', connectionError);
    
    // Don't exit the process - let the server run without DB for now
    console.log('⚠️ Server will continue running without database connection');
  }
};

module.exports = connectDB;
require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/educonnect-phase1',
  
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'noreply@educonnect.com'
  },

  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12,
    otpExpiresInMinutes: parseInt(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
    invitationExpiresInHours: parseInt(process.env.INVITATION_EXPIRES_IN_HOURS) || 72
  },

  rateLimiting: {
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    authMaxRequests: process.env.NODE_ENV === 'development' 
      ? parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 1000 // High limit for dev
      : parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5    // Low limit for prod
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB) || 0,
    enabled: process.env.REDIS_ENABLED === 'true'
  },

  cache: {
    ttl: {
      dashboard: parseInt(process.env.CACHE_TTL_DASHBOARD) || 900,
      userSession: parseInt(process.env.CACHE_TTL_USER_SESSION) || 86400,
      schoolProfile: parseInt(process.env.CACHE_TTL_SCHOOL_PROFILE) || 3600,
      otp: parseInt(process.env.CACHE_TTL_OTP) || 600
    }
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RESEND_API_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

module.exports = config;
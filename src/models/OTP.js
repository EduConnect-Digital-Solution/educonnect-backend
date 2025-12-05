const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * OTP (One-Time Password) Model
 * Manages OTPs for email verification and password reset
 * Implements requirements for secure email verification workflows
 */

const otpSchema = new mongoose.Schema({
  // Email for OTP verification
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    index: true
  },
  
  // Hashed OTP (never store plain OTP)
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    select: false // Don't include in queries by default
  },
  
  // Purpose of the OTP
  purpose: {
    type: String,
    enum: {
      values: ['school-signup', 'password-reset', 'email-verification', 'account-activation'],
      message: 'Purpose must be school-signup, password-reset, email-verification, or account-activation'
    },
    required: [true, 'Purpose is required'],
    index: true
  },
  
  // School association (optional, for school-specific OTPs)
  schoolId: {
    type: String,
    index: true,
    required: function() {
      return this.purpose === 'school-signup';
    }
  },
  
  // User association (optional, for user-specific OTPs)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Expiration management
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: true
  },
  
  // Usage tracking
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  
  usedAt: {
    type: Date
  },
  
  // Attempt tracking (security feature)
  attemptCount: {
    type: Number,
    default: 0,
    min: [0, 'Attempt count cannot be negative']
  },
  
  maxAttempts: {
    type: Number,
    default: 3,
    min: [1, 'Max attempts must be at least 1']
  },
  
  // IP tracking for security
  createdFromIP: {
    type: String,
    trim: true
  },
  
  usedFromIP: {
    type: String,
    trim: true
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // Auto-delete after 1 hour (MongoDB TTL)
  }
}, {
  timestamps: false, // Using custom createdAt with TTL
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance and uniqueness
otpSchema.index({ email: 1, purpose: 1, isUsed: 1 });
otpSchema.index({ expiresAt: 1, isUsed: 1 });
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 }); // TTL index

/**
 * Pre-save middleware to hash OTP
 */
otpSchema.pre('save', function(next) {
  // Only hash OTP if it's modified and not already hashed
  if (!this.isModified('otp') || this.otp.length === 64) return next();
  
  try {
    // Hash the OTP using SHA-256
    this.otp = crypto.createHash('sha256').update(this.otp).digest('hex');
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Instance method to verify OTP
 */
otpSchema.methods.verifyOTP = function(candidateOTP) {
  // Check if OTP is already used
  if (this.isUsed) {
    return { success: false, message: 'OTP has already been used' };
  }
  
  // Check if OTP has expired
  if (Date.now() > this.expiresAt.getTime()) {
    return { success: false, message: 'OTP has expired' };
  }
  
  // Check if max attempts exceeded
  if (this.attemptCount >= this.maxAttempts) {
    return { success: false, message: 'Maximum verification attempts exceeded' };
  }
  
  // Increment attempt count
  this.attemptCount += 1;
  
  // Hash the candidate OTP and compare
  const hashedCandidate = crypto.createHash('sha256').update(candidateOTP).digest('hex');
  const isValid = hashedCandidate === this.otp;
  
  if (isValid) {
    this.isUsed = true;
    this.usedAt = new Date();
    return { success: true, message: 'OTP verified successfully' };
  } else {
    return { success: false, message: 'Invalid OTP' };
  }
};

/**
 * Instance method to mark OTP as used
 */
otpSchema.methods.markAsUsed = function(usedFromIP = null) {
  this.isUsed = true;
  this.usedAt = new Date();
  if (usedFromIP) {
    this.usedFromIP = usedFromIP;
  }
  return this.save();
};

/**
 * Instance method to check if OTP is expired
 */
otpSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt.getTime();
};

/**
 * Instance method to check if OTP is valid (not used, not expired, attempts not exceeded)
 */
otpSchema.methods.isValid = function() {
  return !this.isUsed && 
         !this.isExpired() && 
         this.attemptCount < this.maxAttempts;
};

/**
 * Static method to generate OTP
 */
otpSchema.statics.generateOTP = function(length = 6) {
  // Generate numeric OTP as string
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return (Math.floor(Math.random() * (max - min + 1)) + min).toString();
};

/**
 * Static method to create new OTP
 */
otpSchema.statics.createOTP = async function(data) {
  try {
    const {
      email,
      purpose,
      schoolId = null,
      userId = null,
      expirationMinutes = 10,
      maxAttempts = 3,
      createdFromIP = null,
      metadata = {}
    } = data;
    
    // Generate OTP
    const plainOTP = this.generateOTP(6);
    
    // Calculate expiration
    const expiresAt = new Date(Date.now() + (expirationMinutes * 60 * 1000));
    
    // Create OTP document
    const otp = new this({
      email,
      otp: plainOTP, // Will be hashed by pre-save middleware
      purpose,
      schoolId,
      userId,
      expiresAt,
      maxAttempts,
      createdFromIP,
      metadata
    });
    
    await otp.save();
    
    // Return the plain OTP for sending via email
    return {
      otpDocument: otp,
      plainOTP,
      expiresAt
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Static method to find valid OTP
 */
otpSchema.statics.findValidOTP = function(email, purpose, schoolId = null) {
  const query = {
    email: email.toLowerCase(),
    purpose,
    isUsed: false,
    expiresAt: { $gt: new Date() }
  };
  
  if (schoolId) {
    query.schoolId = schoolId;
  }
  
  return this.findOne(query).select('+otp');
};

/**
 * Static method to verify and consume OTP
 */
otpSchema.statics.verifyAndConsumeOTP = async function(email, candidateOTP, purpose, schoolId = null, usedFromIP = null) {
  try {
    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Looking for OTP: email=${email}, purpose=${purpose}, schoolId=${schoolId}`);
      
      // Check if any OTP exists for this email/purpose
      const anyOTP = await this.findOne({ 
        email: email.toLowerCase(), 
        purpose 
      }).select('+otp');
      
      if (anyOTP) {
        console.log(`📧 Found OTP for email: isUsed=${anyOTP.isUsed}, expired=${anyOTP.expiresAt < new Date()}, schoolId=${anyOTP.schoolId}`);
        console.log(`🔐 Development OTP: ${anyOTP.otp}`);
      } else {
        console.log(`❌ No OTP found for email=${email}, purpose=${purpose}`);
      }
    }
    
    const otp = await this.findValidOTP(email, purpose, schoolId);
    
    if (!otp) {
      return { success: false, message: 'No valid OTP found' };
    }
    
    const verificationResult = otp.verifyOTP(candidateOTP);
    
    // Save the OTP document to update attempt count or usage status
    if (usedFromIP && verificationResult.success) {
      otp.usedFromIP = usedFromIP;
    }
    
    await otp.save();
    
    return verificationResult;
  } catch (error) {
    throw error;
  }
};

/**
 * Static method to cleanup expired OTPs
 */
otpSchema.statics.cleanupExpired = async function() {
  try {
    const result = await this.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isUsed: true, usedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Used OTPs older than 24 hours
      ]
    });
    
    return result.deletedCount;
  } catch (error) {
    throw error;
  }
};

/**
 * Static method to get OTP statistics
 */
otpSchema.statics.getStatistics = async function(schoolId = null) {
  try {
    const matchStage = schoolId ? { schoolId } : {};
    
    const stats = await this.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$purpose',
          total: { $sum: 1 },
          used: { $sum: { $cond: ['$isUsed', 1, 0] } },
          expired: { 
            $sum: { 
              $cond: [
                { $and: [{ $lt: ['$expiresAt', new Date()] }, { $eq: ['$isUsed', false] }] }, 
                1, 
                0
              ] 
            } 
          }
        }
      }
    ]);
    
    const result = {};
    stats.forEach(stat => {
      result[stat._id] = {
        total: stat.total,
        used: stat.used,
        expired: stat.expired,
        pending: stat.total - stat.used - stat.expired
      };
    });
    
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Static method to invalidate all OTPs for an email and purpose
 */
otpSchema.statics.invalidateOTPs = async function(email, purpose, schoolId = null) {
  try {
    const query = {
      email: email.toLowerCase(),
      purpose,
      isUsed: false
    };
    
    if (schoolId) {
      query.schoolId = schoolId;
    }
    
    const result = await this.updateMany(query, {
      $set: { 
        isUsed: true,
        usedAt: new Date(),
        metadata: { invalidated: true, invalidatedAt: new Date() }
      }
    });
    
    return result.modifiedCount;
  } catch (error) {
    throw error;
  }
};

/**
 * Virtual for status display
 */
otpSchema.virtual('statusDisplay').get(function() {
  if (this.isUsed) return 'Used';
  if (this.isExpired()) return 'Expired';
  if (this.attemptCount >= this.maxAttempts) return 'Blocked';
  return 'Active';
});

/**
 * Virtual for time remaining
 */
otpSchema.virtual('timeRemaining').get(function() {
  if (this.isUsed) return 'Used';
  
  const now = Date.now();
  const expiry = this.expiresAt.getTime();
  
  if (now >= expiry) return 'Expired';
  
  const diff = expiry - now;
  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
});

/**
 * Transform function to remove sensitive data from JSON output
 */
otpSchema.methods.toJSON = function() {
  const otp = this.toObject();
  delete otp.otp; // Never expose OTP in JSON
  delete otp.__v;
  return otp;
};

module.exports = mongoose.model('OTP', otpSchema);
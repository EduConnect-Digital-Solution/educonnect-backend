const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * School Model
 * Represents educational institutions in the system
 * Implements requirements 1.1, 1.5, 9.1
 */

const schoolSchema = new mongoose.Schema({
  // Unique school identifier (auto-generated)
  schoolId: {
    type: String,
    unique: true,
    index: true
  },
  
  // Basic school information
  schoolName: {
    type: String,
    required: [true, 'School name is required'],
    trim: true,
    minlength: [2, 'School name must be at least 2 characters'],
    maxlength: [100, 'School name cannot exceed 100 characters']
  },
  
  // Contact information
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  // Hashed password for school admin
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Additional school details
  address: {
    type: String,
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
  },
  
  principalName: {
    type: String,
    trim: true,
    maxlength: [100, 'Principal name cannot exceed 100 characters']
  },
  
  schoolType: {
    type: String,
    enum: ['public', 'private', 'charter'],
    default: 'public'
  },
  
  // Reference to the admin user created during registration
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Verification status (requirement 1.5)
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Email verification OTP
  verificationOTP: {
    type: String,
    select: false
  },
  
  otpExpires: {
    type: Date,
    select: false
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // System Administration Configuration
  systemConfig: {
    subscriptionTier: {
      type: String,
      enum: {
        values: ['basic', 'standard', 'premium', 'enterprise', 'trial'],
        message: 'Subscription tier must be one of: basic, standard, premium, enterprise, trial'
      },
      default: 'basic',
      index: true
    },
    subscriptionStatus: {
      type: String,
      enum: {
        values: ['active', 'suspended', 'cancelled', 'expired', 'trial'],
        message: 'Subscription status must be one of: active, suspended, cancelled, expired, trial'
      },
      default: 'trial'
    },
    subscriptionStartDate: {
      type: Date,
      default: Date.now
    },
    subscriptionEndDate: {
      type: Date
    },
    features: [{
      featureName: {
        type: String,
        required: true,
        trim: true
      },
      isEnabled: {
        type: Boolean,
        default: true
      },
      enabledAt: {
        type: Date,
        default: Date.now
      },
      enabledBy: {
        type: String, // System admin ID
        required: true
      },
      expiresAt: Date, // For trial features
      metadata: mongoose.Schema.Types.Mixed
    }],
    limits: {
      maxUsers: {
        type: Number,
        default: 100,
        min: [1, 'Max users must be at least 1']
      },
      maxStudents: {
        type: Number,
        default: 500,
        min: [1, 'Max students must be at least 1']
      },
      maxTeachers: {
        type: Number,
        default: 50,
        min: [1, 'Max teachers must be at least 1']
      },
      maxStorage: {
        type: Number, // in MB
        default: 1000,
        min: [100, 'Max storage must be at least 100 MB']
      },
      maxApiCalls: {
        type: Number, // per day
        default: 10000,
        min: [100, 'Max API calls must be at least 100']
      }
    },
    billing: {
      billingEmail: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid billing email']
      },
      paymentMethod: {
        type: String,
        enum: ['credit_card', 'bank_transfer', 'invoice', 'free'],
        default: 'free'
      },
      lastPaymentDate: Date,
      nextBillingDate: Date,
      billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'],
        default: 'monthly'
      }
    },
    compliance: {
      dataRetentionDays: {
        type: Number,
        default: 365,
        min: [30, 'Data retention must be at least 30 days']
      },
      privacyPolicyAccepted: {
        type: Boolean,
        default: false
      },
      privacyPolicyAcceptedAt: Date,
      termsAccepted: {
        type: Boolean,
        default: false
      },
      termsAcceptedAt: Date,
      gdprCompliant: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // System Administration Metadata
  systemMetadata: {
    createdBy: {
      type: String, // System admin ID
      default: 'system'
    },
    lastModifiedBy: {
      type: String // System admin ID
    },
    lastSystemAccess: Date,
    systemNotes: [{
      note: {
        type: String,
        required: true,
        maxlength: [1000, 'System note cannot exceed 1000 characters']
      },
      createdBy: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      category: {
        type: String,
        enum: ['billing', 'support', 'compliance', 'technical', 'general'],
        default: 'general'
      }
    }],
    flags: [{
      flagType: {
        type: String,
        enum: ['warning', 'attention', 'review', 'escalation'],
        required: true
      },
      reason: {
        type: String,
        required: true,
        maxlength: [500, 'Flag reason cannot exceed 500 characters']
      },
      isActive: {
        type: Boolean,
        default: true
      },
      createdBy: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      resolvedAt: Date,
      resolvedBy: String
    }]
  },
  
  // Password reset functionality
  passwordResetToken: {
    type: String,
    select: false
  },
  
  passwordResetExpires: {
    type: Date,
    select: false
  },
  
  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
schoolSchema.index({ schoolId: 1 });
schoolSchema.index({ email: 1 });
schoolSchema.index({ isVerified: 1, isActive: 1 });

/**
 * Pre-save middleware to hash password and generate schoolId
 */
schoolSchema.pre('save', async function(next) {
  // Only hash password if it's modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Pre-save middleware to generate unique schoolId
 */
schoolSchema.pre('save', async function(next) {
  // Only generate schoolId for new documents that don't have one
  if (!this.isNew || this.schoolId) return next();
  
  try {
    let schoolId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      // Generate schoolId: 3 letters from school name + 4 random digits
      const namePrefix = this.schoolName
        .replace(/[^a-zA-Z]/g, '')
        .substring(0, 3)
        .toUpperCase()
        .padEnd(3, 'X');
      
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      schoolId = `${namePrefix}${randomSuffix}`;
      
      // Check if schoolId is unique
      const existingSchool = await this.constructor.findOne({ schoolId });
      if (!existingSchool) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return next(new Error('Unable to generate unique schoolId after multiple attempts'));
    }
    
    this.schoolId = schoolId;
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Pre-validate middleware to generate schoolId if not present
 */
schoolSchema.pre('validate', async function(next) {
  // Generate schoolId if it's a new document and doesn't have one
  if (this.isNew && !this.schoolId && this.schoolName) {
    const namePrefix = this.schoolName
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 3)
      .toUpperCase()
      .padEnd(3, 'X');
    
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.schoolId = `${namePrefix}${randomSuffix}`;
  }
  next();
});

/**
 * Pre-save middleware to update timestamps
 */
schoolSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

/**
 * Instance method to compare password
 */
schoolSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('Password not available for comparison');
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method to generate email verification OTP
 */
schoolSchema.methods.generateVerificationOTP = function() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Hash the OTP before storing
  this.verificationOTP = crypto.createHash('sha256').update(otp).digest('hex');
  
  // Set expiration time (10 minutes)
  this.otpExpires = Date.now() + 10 * 60 * 1000;
  
  return otp; // Return plain OTP for sending via email
};

/**
 * Instance method to verify OTP
 */
schoolSchema.methods.verifyOTP = function(candidateOTP) {
  if (!this.verificationOTP || !this.otpExpires) {
    return false;
  }
  
  // Check if OTP has expired
  if (Date.now() > this.otpExpires) {
    return false;
  }
  
  // Hash the candidate OTP and compare
  const hashedOTP = crypto.createHash('sha256').update(candidateOTP).digest('hex');
  return hashedOTP === this.verificationOTP;
};

/**
 * Instance method to complete email verification
 */
schoolSchema.methods.completeVerification = function() {
  this.isVerified = true;
  this.verificationOTP = undefined;
  this.otpExpires = undefined;
  return this.save();
};

/**
 * Instance method to generate password reset token
 */
schoolSchema.methods.generatePasswordResetToken = function() {
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash and store the token
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  // Set expiration time (1 hour)
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  
  return resetToken; // Return plain token for sending via email
};

/**
 * Instance method to verify password reset token
 */
schoolSchema.methods.verifyPasswordResetToken = function(candidateToken) {
  if (!this.passwordResetToken || !this.passwordResetExpires) {
    return false;
  }
  
  // Check if token has expired
  if (Date.now() > this.passwordResetExpires) {
    return false;
  }
  
  // Hash the candidate token and compare
  const hashedToken = crypto.createHash('sha256').update(candidateToken).digest('hex');
  return hashedToken === this.passwordResetToken;
};

/**
 * Instance method to reset password
 */
schoolSchema.methods.resetPassword = async function(newPassword) {
  this.password = newPassword; // Will be hashed by pre-save middleware
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
  return this.save();
};

/**
 * Instance method to activate/deactivate school
 */
schoolSchema.methods.setActiveStatus = function(isActive) {
  this.isActive = isActive;
  return this.save();
};

/**
 * Static method to find school by schoolId
 */
schoolSchema.statics.findBySchoolId = function(schoolId) {
  return this.findOne({ schoolId, isActive: true });
};

/**
 * Static method to find verified schools
 */
schoolSchema.statics.findVerified = function() {
  return this.find({ isVerified: true, isActive: true });
};

/**
 * Static method to find schools pending verification
 */
schoolSchema.statics.findPendingVerification = function() {
  return this.find({ isVerified: false, isActive: true });
};

/**
 * Static method to authenticate school with schoolId, email, and password (Requirement 2.1)
 */
schoolSchema.statics.authenticate = async function(schoolId, email, password) {
  try {
    // Find school by both schoolId and email, include password field
    const school = await this.findOne({ 
      schoolId, 
      email: email.toLowerCase() 
    }).select('+password');
    
    if (!school) {
      throw new Error('Invalid schoolId or email');
    }

    // Check if school is active
    if (!school.isActive) {
      throw new Error('School account is deactivated');
    }

    // Check if school is verified
    if (!school.isVerified) {
      throw new Error('School email not verified');
    }

    // Compare password
    const isPasswordValid = await school.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Return school without sensitive data
    return school.toJSON();
  } catch (error) {
    throw error;
  }
};

/**
 * Virtual for full school display name
 */
schoolSchema.virtual('displayName').get(function() {
  return `${this.schoolName} (${this.schoolId})`;
});

/**
 * Virtual for verification status text
 */
schoolSchema.virtual('verificationStatus').get(function() {
  if (this.isVerified) return 'verified';
  if (this.verificationOTP && this.otpExpires && Date.now() < this.otpExpires) return 'pending';
  return 'unverified';
});

/**
 * Transform function to remove sensitive data from JSON output
 */
schoolSchema.methods.toJSON = function() {
  const school = this.toObject();
  delete school.password;
  delete school.verificationOTP;
  delete school.otpExpires;
  delete school.passwordResetToken;
  delete school.passwordResetExpires;
  delete school.__v;
  return school;
};

// System Administration Methods

/**
 * Update subscription tier
 * @param {string} tier - New subscription tier
 * @param {string} adminId - System admin ID
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.updateSubscriptionTier = async function(tier, adminId) {
  this.systemConfig.subscriptionTier = tier;
  this.systemMetadata.lastModifiedBy = adminId;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Update subscription status
 * @param {string} status - New subscription status
 * @param {string} adminId - System admin ID
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.updateSubscriptionStatus = async function(status, adminId) {
  this.systemConfig.subscriptionStatus = status;
  this.systemMetadata.lastModifiedBy = adminId;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Enable/disable a feature for the school
 * @param {string} featureName - Feature name
 * @param {boolean} isEnabled - Enable or disable
 * @param {string} adminId - System admin ID
 * @param {Date} expiresAt - Optional expiration date
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.toggleFeature = async function(featureName, isEnabled, adminId, expiresAt = null) {
  const existingFeatureIndex = this.systemConfig.features.findIndex(
    f => f.featureName === featureName
  );
  
  if (existingFeatureIndex >= 0) {
    // Update existing feature
    this.systemConfig.features[existingFeatureIndex].isEnabled = isEnabled;
    this.systemConfig.features[existingFeatureIndex].enabledBy = adminId;
    this.systemConfig.features[existingFeatureIndex].enabledAt = new Date();
    if (expiresAt) {
      this.systemConfig.features[existingFeatureIndex].expiresAt = expiresAt;
    }
  } else {
    // Add new feature
    this.systemConfig.features.push({
      featureName,
      isEnabled,
      enabledBy: adminId,
      enabledAt: new Date(),
      expiresAt
    });
  }
  
  this.systemMetadata.lastModifiedBy = adminId;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Add a system note
 * @param {string} note - Note content
 * @param {string} adminId - System admin ID
 * @param {string} category - Note category
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.addSystemNote = async function(note, adminId, category = 'general') {
  this.systemMetadata.systemNotes.push({
    note,
    createdBy: adminId,
    category,
    createdAt: new Date()
  });
  
  this.systemMetadata.lastModifiedBy = adminId;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Add a system flag
 * @param {string} flagType - Flag type
 * @param {string} reason - Flag reason
 * @param {string} adminId - System admin ID
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.addSystemFlag = async function(flagType, reason, adminId) {
  this.systemMetadata.flags.push({
    flagType,
    reason,
    isActive: true,
    createdBy: adminId,
    createdAt: new Date()
  });
  
  this.systemMetadata.lastModifiedBy = adminId;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Resolve a system flag
 * @param {string} flagId - Flag ID
 * @param {string} adminId - System admin ID
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.resolveSystemFlag = async function(flagId, adminId) {
  const flag = this.systemMetadata.flags.id(flagId);
  if (flag) {
    flag.isActive = false;
    flag.resolvedAt = new Date();
    flag.resolvedBy = adminId;
    
    this.systemMetadata.lastModifiedBy = adminId;
    this.updatedAt = new Date();
    return await this.save();
  }
  throw new Error('Flag not found');
};

/**
 * Update usage limits
 * @param {Object} limits - New limits object
 * @param {string} adminId - System admin ID
 * @returns {Promise<School>} Updated school
 */
schoolSchema.methods.updateLimits = async function(limits, adminId) {
  Object.assign(this.systemConfig.limits, limits);
  this.systemMetadata.lastModifiedBy = adminId;
  this.updatedAt = new Date();
  return await this.save();
};

/**
 * Get active features for the school
 * @returns {Array} Array of active features
 */
schoolSchema.methods.getActiveFeatures = function() {
  const now = new Date();
  return this.systemConfig.features.filter(feature => 
    feature.isEnabled && 
    (!feature.expiresAt || feature.expiresAt > now)
  );
};

/**
 * Check if school has a specific feature enabled
 * @param {string} featureName - Feature name to check
 * @returns {boolean} True if feature is enabled and not expired
 */
schoolSchema.methods.hasFeature = function(featureName) {
  const feature = this.systemConfig.features.find(f => f.featureName === featureName);
  if (!feature || !feature.isEnabled) return false;
  
  if (feature.expiresAt && feature.expiresAt <= new Date()) {
    return false;
  }
  
  return true;
};

/**
 * Get system administration summary
 * @returns {Object} System admin summary
 */
schoolSchema.methods.getSystemSummary = function() {
  return {
    schoolId: this.schoolId,
    schoolName: this.schoolName,
    email: this.email,
    subscriptionTier: this.systemConfig.subscriptionTier,
    subscriptionStatus: this.systemConfig.subscriptionStatus,
    isActive: this.isActive,
    activeFeatures: this.getActiveFeatures().length,
    totalFeatures: this.systemConfig.features.length,
    activeFlags: this.systemMetadata.flags.filter(f => f.isActive).length,
    lastSystemAccess: this.systemMetadata.lastSystemAccess,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Static Methods for System Administration

/**
 * Get schools by subscription tier
 * @param {string} tier - Subscription tier
 * @returns {Promise<Array>} Array of schools
 */
schoolSchema.statics.getSchoolsByTier = async function(tier) {
  return await this.find({ 'systemConfig.subscriptionTier': tier })
    .select('schoolId schoolName email systemConfig.subscriptionStatus isActive createdAt')
    .sort({ createdAt: -1 });
};

/**
 * Get schools by subscription status
 * @param {string} status - Subscription status
 * @returns {Promise<Array>} Array of schools
 */
schoolSchema.statics.getSchoolsByStatus = async function(status) {
  return await this.find({ 'systemConfig.subscriptionStatus': status })
    .select('schoolId schoolName email systemConfig.subscriptionTier isActive createdAt')
    .sort({ createdAt: -1 });
};

/**
 * Get schools with active flags
 * @returns {Promise<Array>} Array of schools with active flags
 */
schoolSchema.statics.getSchoolsWithFlags = async function() {
  return await this.find({ 'systemMetadata.flags.isActive': true })
    .select('schoolId schoolName email systemMetadata.flags systemConfig.subscriptionTier')
    .sort({ createdAt: -1 });
};

/**
 * Get system statistics
 * @returns {Promise<Object>} System statistics
 */
schoolSchema.statics.getSystemStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalSchools: { $sum: 1 },
        activeSchools: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        schoolsByTier: {
          $push: '$systemConfig.subscriptionTier'
        },
        schoolsByStatus: {
          $push: '$systemConfig.subscriptionStatus'
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalSchools: 0,
      activeSchools: 0,
      inactiveSchools: 0,
      tierDistribution: {},
      statusDistribution: {}
    };
  }
  
  const result = stats[0];
  result.inactiveSchools = result.totalSchools - result.activeSchools;
  
  // Count by tier and status
  result.tierDistribution = result.schoolsByTier.reduce((acc, tier) => {
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});
  
  result.statusDistribution = result.schoolsByStatus.reduce((acc, status) => {
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  delete result.schoolsByTier;
  delete result.schoolsByStatus;
  
  return result;
};

/**
 * Validation for unique email across all schools
 */
schoolSchema.pre('validate', async function(next) {
  if (!this.isModified('email')) return next();
  
  try {
    const existingSchool = await this.constructor.findOne({ 
      email: this.email,
      _id: { $ne: this._id }
    });
    
    if (existingSchool) {
      const error = new Error('Email already exists');
      error.name = 'ValidationError';
      error.errors = {
        email: {
          message: 'Email already exists',
          kind: 'unique',
          path: 'email',
          value: this.email
        }
      };
      return next(error);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update system metadata
schoolSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('School', schoolSchema);
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

module.exports = mongoose.model('School', schoolSchema);
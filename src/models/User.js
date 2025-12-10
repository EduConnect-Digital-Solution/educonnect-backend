const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

/**
 * User Model
 * Represents SCHOOL USERS ONLY with multiple roles (admin, teacher, parent)
 * 
 * IMPORTANT: System admins are NOT stored in this model!
 * System admins use pre-configured environment-based authentication
 * and do not have database records in the User collection.
 * 
 * This model is for school-level users only:
 * - admin: School administrators (tied to specific school)
 * - teacher: Teachers (tied to specific school)
 * - parent: Parents (tied to specific school)
 * 
 * Implements requirements 2.1, 3.4, 4.2, 6.2, 6.3, 6.4
 */

const userSchema = new mongoose.Schema({
  // School association (required for all users)
  schoolId: {
    type: String,
    required: [true, 'School ID is required'],
    index: true
  },
  
  // Basic user information
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },

  isTemporaryPassword: {
    type: Boolean,
    default: false
  },
  
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  
  // Role-based access control (Requirement 6.2, 6.3, 6.4)
  role: {
    type: String,
    enum: {
      values: ['admin', 'teacher', 'parent'],
      message: 'Role must be admin, teacher, or parent'
    },
    required: [true, 'Role is required']
  },
  
  // Contact information
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,15}$/, 'Please enter a valid phone number']
  },
  
  profileImage: {
    type: String,
    trim: true
  },
  
  // Admin-specific fields
  isSchoolAdmin: {
    type: Boolean,
    default: function() {
      return this.role === 'admin';
    }
  },
  
  // Teacher-specific fields (Requirement 6.3)
  employeeId: {
    type: String,
    trim: true,
    validate: {
      validator: function(value) {
        // Only validate if role is teacher and value is provided
        if (this.role === 'teacher' && value) {
          return /^[A-Z0-9]{3,20}$/.test(value);
        }
        return true;
      },
      message: 'Employee ID must be 3-20 alphanumeric characters'
    }
  },
  
  subjects: {
    type: [String],
    validate: {
      validator: function(subjects) {
        // Subjects are required for teachers
        if (this.role === 'teacher') {
          return subjects && subjects.length > 0;
        }
        // Non-teachers should not have subjects
        return !subjects || subjects.length === 0;
      },
      message: 'Teachers must have at least one subject, non-teachers cannot have subjects'
    }
  },
  
  classes: {
    type: [String],
    validate: {
      validator: function(classes) {
        // Only teachers can have classes
        if (this.role !== 'teacher') {
          return !classes || classes.length === 0;
        }
        return true;
      },
      message: 'Only teachers can be assigned to classes'
    }
  },
  
  // Parent-specific fields (Requirement 6.4)
  studentIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Student',
    validate: {
      validator: function(studentIds) {
        // Only parents can have linked students
        if (this.role !== 'parent') {
          return !studentIds || studentIds.length === 0;
        }
        // Parents should have at least one student linked
        if (this.role === 'parent') {
          return studentIds && studentIds.length > 0;
        }
        return true;
      },
      message: 'Parents must have at least one linked student, non-parents cannot have linked students'
    }
  },

  // Legacy field for backward compatibility
  children: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Student',
    validate: {
      validator: function(children) {
        // Only parents can have children
        if (this.role !== 'parent') {
          return !children || children.length === 0;
        }
        return true;
      },
      message: 'Only parents can have linked children'
    }
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Invitation token management (Requirements 3.4, 4.2)
  invitationToken: {
    type: String,
    select: false
  },
  
  invitationExpires: {
    type: Date,
    select: false
  },
  
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  invitedAt: {
    type: Date
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
  lastLogin: {
    type: Date
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },

  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance and uniqueness
userSchema.index({ schoolId: 1, email: 1 }, { unique: true });
userSchema.index({ schoolId: 1, role: 1 });
userSchema.index({ invitationToken: 1 });
userSchema.index({ isActive: 1, isVerified: 1 });

/**
 * Pre-save middleware to hash password
 */
userSchema.pre('save', async function(next) {
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
 * Pre-save middleware to update timestamps and validate role-specific fields
 */
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Set isSchoolAdmin based on role
  if (this.role === 'admin') {
    this.isSchoolAdmin = true;
  } else {
    this.isSchoolAdmin = false;
  }
  
  next();
});

/**
 * Instance method to compare password
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('Password not available for comparison');
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method to generate invitation token (Requirements 3.4, 4.2)
 */
userSchema.methods.generateInvitationToken = function(expiresInHours = 72) {
  // Generate random token
  const invitationToken = crypto.randomBytes(32).toString('hex');
  
  // Hash and store the token
  this.invitationToken = crypto.createHash('sha256').update(invitationToken).digest('hex');
  
  // Set expiration time
  this.invitationExpires = Date.now() + (expiresInHours * 60 * 60 * 1000);
  
  return invitationToken; // Return plain token for sending via email
};

/**
 * Instance method to verify invitation token
 */
userSchema.methods.verifyInvitationToken = function(candidateToken) {
  if (!this.invitationToken || !this.invitationExpires) {
    return false;
  }
  
  // Check if token has expired
  if (Date.now() > this.invitationExpires) {
    return false;
  }
  
  // Hash the candidate token and compare
  const hashedToken = crypto.createHash('sha256').update(candidateToken).digest('hex');
  return hashedToken === this.invitationToken;
};

/**
 * Instance method to complete invitation acceptance
 */
userSchema.methods.acceptInvitation = function(userData) {
  // Update user data
  Object.assign(this, userData);
  
  // Clear invitation data
  this.invitationToken = undefined;
  this.invitationExpires = undefined;
  this.isVerified = true;
  
  return this.save();
};

/**
 * Instance method to generate password reset token
 */
userSchema.methods.generatePasswordResetToken = function() {
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
userSchema.methods.verifyPasswordResetToken = function(candidateToken) {
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
userSchema.methods.resetPassword = async function(newPassword) {
  this.password = newPassword; // Will be hashed by pre-save middleware
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;
  return this.save();
};

/**
 * Instance method to update last login
 */
userSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  return this.save();
};

/**
 * Instance method to activate/deactivate user
 */
userSchema.methods.setActiveStatus = function(isActive) {
  this.isActive = isActive;
  return this.save();
};

/**
 * Instance method to add child to parent (Requirement 4.2)
 */
userSchema.methods.addChild = function(studentId) {
  if (this.role !== 'parent') {
    throw new Error('Only parents can have children linked');
  }
  
  // Add to both studentIds and children arrays for compatibility
  if (!this.studentIds.some(id => id.equals(studentId))) {
    this.studentIds.push(studentId);
  }
  if (this.children && !this.children.some(child => child.equals(studentId))) {
    this.children.push(studentId);
  }
  
  return this.save();
};

/**
 * Instance method to remove child from parent
 */
userSchema.methods.removeChild = function(studentId) {
  if (this.role !== 'parent') {
    throw new Error('Only parents can have children unlinked');
  }
  
  // Remove from both studentIds and children arrays for compatibility
  this.studentIds = this.studentIds.filter(id => !id.equals(studentId));
  if (this.children) {
    this.children = this.children.filter(child => !child.equals(studentId));
  }
  return this.save();
};

/**
 * Instance method to add class to teacher (Requirement 6.3)
 */
userSchema.methods.addClass = function(className) {
  if (this.role !== 'teacher') {
    throw new Error('Only teachers can be assigned to classes');
  }
  
  if (!this.classes.includes(className)) {
    this.classes.push(className);
  }
  
  return this.save();
};

/**
 * Instance method to remove class from teacher
 */
userSchema.methods.removeClass = function(className) {
  if (this.role !== 'teacher') {
    throw new Error('Only teachers can be unassigned from classes');
  }
  
  this.classes = this.classes.filter(cls => cls !== className);
  return this.save();
};

/**
 * Static method to authenticate user (Requirement 2.1)
 */
userSchema.statics.authenticate = async function(schoolId, email, password) {
  try {
    // Find user by schoolId and email, include password field
    const user = await this.findOne({ 
      schoolId, 
      email: email.toLowerCase() 
    }).select('+password');
    
    if (!user) {
      throw new Error('Invalid schoolId or email');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Check if user is verified
    if (!user.isVerified) {
      throw new Error('User account not verified');
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error('Invalid password');
    }

    // Update last login
    await user.updateLastLogin();

    // Return user without sensitive data
    return user.toJSON();
  } catch (error) {
    throw error;
  }
};

/**
 * Static method to find users by school and role
 */
userSchema.statics.findBySchoolAndRole = function(schoolId, role) {
  return this.find({ schoolId, role, isActive: true });
};

/**
 * Static method to find teachers by school
 */
userSchema.statics.findTeachers = function(schoolId) {
  return this.find({ schoolId, role: 'teacher', isActive: true });
};

/**
 * Static method to find parents by school
 */
userSchema.statics.findParents = function(schoolId) {
  return this.find({ schoolId, role: 'parent', isActive: true });
};

/**
 * Static method to find admins by school
 */
userSchema.statics.findAdmins = function(schoolId) {
  return this.find({ schoolId, role: 'admin', isActive: true });
};

/**
 * Static method to find user by invitation token
 */
userSchema.statics.findByInvitationToken = async function(token) {
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  
  return this.findOne({
    invitationToken: hashedToken,
    invitationExpires: { $gt: Date.now() }
  });
};

/**
 * Virtual for full name
 */
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Virtual for display name with role
 */
userSchema.virtual('displayName').get(function() {
  return `${this.fullName} (${this.role})`;
});

/**
 * Virtual for invitation status
 */
userSchema.virtual('invitationStatus').get(function() {
  if (!this.invitationToken) return 'accepted';
  if (Date.now() > this.invitationExpires) return 'expired';
  return 'pending';
});

/**
 * Transform function to remove sensitive data from JSON output
 */
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.invitationToken;
  delete user.invitationExpires;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.__v;
  return user;
};

/**
 * Validation for unique email within school
 */
userSchema.pre('validate', async function(next) {
  if (!this.isModified('email') && !this.isNew) return next();
  
  try {
    const existingUser = await this.constructor.findOne({ 
      schoolId: this.schoolId,
      email: this.email,
      _id: { $ne: this._id }
    });
    
    if (existingUser) {
      const error = new Error('Email already exists in this school');
      error.name = 'ValidationError';
      error.errors = {
        email: {
          message: 'Email already exists in this school',
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

module.exports = mongoose.model('User', userSchema);
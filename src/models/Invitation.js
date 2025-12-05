const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Invitation Model
 * Manages teacher and parent invitations with token generation
 * Implements requirements 3.1, 3.2, 3.5, 8.1, 8.2, 8.3, 8.4, 8.5
 */

const invitationSchema = new mongoose.Schema({
  // School association (required for all invitations)
  schoolId: {
    type: String,
    required: [true, 'School ID is required'],
    index: true
  },
  
  // Invitee information
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  // Role for the invitation (Requirements 3.1, 3.2)
  role: {
    type: String,
    enum: {
      values: ['teacher', 'parent'],
      message: 'Role must be teacher or parent'
    },
    required: [true, 'Role is required']
  },
  
  // Invitation creator
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Invited by user is required']
  },
  
  // Unique invitation token (Requirement 3.1)
  token: {
    type: String,
    unique: true,
    index: true
  },
  
  // Parent-specific: Students to link (Requirement 3.2)
  studentIds: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }],
    validate: {
      validator: function(studentIds) {
        // Only parents should have studentIds
        if (this.role === 'parent') {
          return studentIds && studentIds.length > 0;
        }
        // Non-parents should not have studentIds
        return !studentIds || studentIds.length === 0;
      },
      message: 'Parent invitations must include student IDs, teacher invitations must not'
    }
  },
  
  // Teacher-specific: Subjects to assign (Requirement 3.1)
  subjects: {
    type: [String],
    validate: {
      validator: function(subjects) {
        // Teachers should have subjects
        if (this.role === 'teacher') {
          return subjects && subjects.length > 0;
        }
        // Non-teachers should not have subjects
        return !subjects || subjects.length === 0;
      },
      message: 'Teacher invitations must include subjects, parent invitations must not'
    }
  },
  
  // Teacher-specific: Classes to assign (optional)
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
      message: 'Only teacher invitations can include classes'
    }
  },
  
  // Additional invitation data
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  
  message: {
    type: String,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  
  // Status management (Requirements 8.1, 8.3, 8.4)
  status: {
    type: String,
    enum: {
      values: ['pending', 'accepted', 'expired', 'cancelled'],
      message: 'Status must be pending, accepted, expired, or cancelled'
    },
    default: 'pending',
    index: true
  },
  
  // Expiration management (Requirements 3.5, 8.4)
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: true
  },
  
  // Acceptance tracking
  acceptedAt: {
    type: Date
  },
  
  acceptedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Cancellation tracking (Requirement 8.5)
  cancelledAt: {
    type: Date
  },
  
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
  },
  
  // Resend tracking (Requirement 8.2)
  resendCount: {
    type: Number,
    default: 0,
    min: [0, 'Resend count cannot be negative']
  },
  
  lastResendAt: {
    type: Date
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

// Compound indexes for performance
invitationSchema.index({ schoolId: 1, status: 1 });
invitationSchema.index({ schoolId: 1, role: 1, status: 1 });
invitationSchema.index({ email: 1, schoolId: 1 });
invitationSchema.index({ expiresAt: 1, status: 1 });

/**
 * Pre-save middleware to generate unique token (Requirement 3.1)
 */
invitationSchema.pre('save', async function(next) {
  // Only generate token for new documents that don't have one
  if (!this.isNew || this.token) return next();
  
  try {
    let token;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      // Generate secure random token
      token = crypto.randomBytes(32).toString('hex');
      
      // Check if token is unique
      const existingInvitation = await this.constructor.findOne({ token });
      if (!existingInvitation) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return next(new Error('Unable to generate unique invitation token after multiple attempts'));
    }
    
    this.token = token;
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Pre-save middleware to update timestamps and handle status changes
 */
invitationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Handle status change to accepted
  if (this.isModified('status') && this.status === 'accepted' && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }
  
  // Handle status change to cancelled
  if (this.isModified('status') && this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }
  
  next();
});

/**
 * Instance method to check if invitation is expired (Requirement 8.4)
 */
invitationSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt.getTime();
};

/**
 * Instance method to check if invitation is valid
 */
invitationSchema.methods.isValid = function() {
  return this.status === 'pending' && !this.isExpired();
};

/**
 * Instance method to accept invitation (Requirement 8.3)
 */
invitationSchema.methods.accept = function(acceptedBy) {
  if (!this.isValid()) {
    throw new Error('Invitation is not valid or has expired');
  }
  
  this.status = 'accepted';
  this.acceptedAt = new Date();
  this.acceptedBy = acceptedBy;
  
  return this.save();
};

/**
 * Instance method to cancel invitation (Requirement 8.5)
 */
invitationSchema.methods.cancel = function(cancelledBy, reason) {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be cancelled');
  }
  
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  
  return this.save();
};

/**
 * Instance method to resend invitation (Requirement 8.2)
 */
invitationSchema.methods.resend = function(newExpirationHours = 72) {
  if (this.status !== 'pending' && this.status !== 'expired') {
    throw new Error('Only pending or expired invitations can be resent');
  }
  
  // Update expiration and reset status to pending
  this.expiresAt = new Date(Date.now() + (newExpirationHours * 60 * 60 * 1000));
  this.status = 'pending';
  this.resendCount += 1;
  this.lastResendAt = new Date();
  
  return this.save();
};

/**
 * Instance method to extend expiration
 */
invitationSchema.methods.extendExpiration = function(additionalHours = 24) {
  if (this.status !== 'pending') {
    throw new Error('Only pending invitations can be extended');
  }
  
  this.expiresAt = new Date(this.expiresAt.getTime() + (additionalHours * 60 * 60 * 1000));
  return this.save();
};

/**
 * Static method to find invitations by school and status (Requirement 8.1)
 */
invitationSchema.statics.findBySchoolAndStatus = function(schoolId, status = null) {
  const query = { schoolId };
  if (status) {
    query.status = status;
  }
  return this.find(query).populate('invitedBy', 'firstName lastName email');
};

/**
 * Static method to find pending invitations by school
 */
invitationSchema.statics.findPendingBySchool = function(schoolId) {
  return this.findBySchoolAndStatus(schoolId, 'pending');
};

/**
 * Static method to find expired invitations by school
 */
invitationSchema.statics.findExpiredBySchool = function(schoolId) {
  return this.find({
    schoolId,
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
};

/**
 * Static method to find invitation by token
 */
invitationSchema.statics.findByToken = function(token) {
  return this.findOne({ token });
};

/**
 * Static method to find invitations by email and school
 */
invitationSchema.statics.findByEmailAndSchool = function(email, schoolId) {
  return this.find({ 
    email: email.toLowerCase(), 
    schoolId 
  }).sort({ createdAt: -1 });
};

/**
 * Static method to expire old invitations (Requirement 8.4)
 */
invitationSchema.statics.expireOldInvitations = async function() {
  try {
    const result = await this.updateMany(
      {
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      {
        $set: { status: 'expired' }
      }
    );
    
    return result.modifiedCount;
  } catch (error) {
    throw error;
  }
};

/**
 * Static method to get invitation statistics for a school
 */
invitationSchema.statics.getSchoolStatistics = async function(schoolId) {
  try {
    const stats = await this.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const result = {
      total: 0,
      pending: 0,
      accepted: 0,
      expired: 0,
      cancelled: 0
    };
    
    stats.forEach(stat => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });
    
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Virtual for full name
 */
invitationSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.email;
});

/**
 * Virtual for display name with role
 */
invitationSchema.virtual('displayName').get(function() {
  return `${this.fullName} (${this.role})`;
});

/**
 * Virtual for status display
 */
invitationSchema.virtual('statusDisplay').get(function() {
  if (this.status === 'pending' && this.isExpired()) {
    return 'Expired';
  }
  return this.status.charAt(0).toUpperCase() + this.status.slice(1);
});

/**
 * Virtual for time remaining
 */
invitationSchema.virtual('timeRemaining').get(function() {
  if (this.status !== 'pending') return null;
  
  const now = Date.now();
  const expiry = this.expiresAt.getTime();
  
  if (now >= expiry) return 'Expired';
  
  const diff = expiry - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} remaining`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
  } else {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''} remaining`;
  }
});

/**
 * Transform function to remove sensitive data from JSON output
 */
invitationSchema.methods.toJSON = function() {
  const invitation = this.toObject();
  delete invitation.__v;
  return invitation;
};

/**
 * Validation for unique pending invitation per email per school
 */
invitationSchema.pre('validate', async function(next) {
  if (!this.isNew) return next();
  
  try {
    const existingInvitation = await this.constructor.findOne({
      email: this.email,
      schoolId: this.schoolId,
      status: 'pending'
    });
    
    if (existingInvitation) {
      const error = new Error('A pending invitation already exists for this email in this school');
      error.name = 'ValidationError';
      error.errors = {
        email: {
          message: 'A pending invitation already exists for this email in this school',
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

module.exports = mongoose.model('Invitation', invitationSchema);
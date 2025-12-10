/**
 * SystemAlert Model
 * Manages system-wide alerts and notifications for platform monitoring
 * Requirements: 1.5, 5.1
 */

const mongoose = require('mongoose');

const SystemAlertSchema = new mongoose.Schema({
  alertType: {
    type: String,
    required: [true, 'Alert type is required'],
    enum: {
      values: ['security', 'performance', 'error', 'maintenance', 'billing', 'compliance', 'system_health'],
      message: 'Alert type must be one of: security, performance, error, maintenance, billing, compliance, system_health'
    }
  },
  
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: {
      values: ['info', 'warning', 'error', 'critical'],
      message: 'Severity must be one of: info, warning, error, critical'
    }
  },
  
  title: {
    type: String,
    required: [true, 'Alert title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  source: {
    component: {
      type: String,
      required: [true, 'Source component is required'],
      trim: true
    },
    service: String,
    endpoint: String,
    function: String
  },
  
  affectedSchools: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School'
  }],
  
  affectedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  isResolved: {
    type: Boolean,
    default: false,
    index: true
  },
  
  resolvedAt: {
    type: Date,
    default: null
  },
  
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  resolutionNotes: {
    type: String,
    trim: true,
    maxlength: [500, 'Resolution notes cannot exceed 500 characters']
  },
  
  resolutionActions: [{
    action: {
      type: String,
      required: true,
      trim: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    performedAt: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  
  metadata: {
    errorCode: String,
    stackTrace: String,
    requestId: String,
    sessionId: String,
    userAgent: String,
    ip: String,
    url: String,
    method: String,
    responseTime: Number,
    memoryUsage: Number,
    cpuUsage: Number,
    diskUsage: Number,
    customData: mongoose.Schema.Types.Mixed
  },
  
  metrics: {
    occurrenceCount: {
      type: Number,
      default: 1
    },
    firstOccurrence: {
      type: Date,
      default: Date.now
    },
    lastOccurrence: {
      type: Date,
      default: Date.now
    },
    affectedUserCount: {
      type: Number,
      default: 0
    },
    affectedSchoolCount: {
      type: Number,
      default: 0
    }
  },
  
  notifications: {
    emailSent: {
      type: Boolean,
      default: false
    },
    emailSentAt: Date,
    slackSent: {
      type: Boolean,
      default: false
    },
    slackSentAt: Date,
    dashboardDisplayed: {
      type: Boolean,
      default: true
    }
  },
  
  escalation: {
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    },
    escalatedAt: Date,
    escalatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    escalationReason: String,
    autoEscalationEnabled: {
      type: Boolean,
      default: true
    },
    escalationThreshold: {
      type: Number,
      default: 3600000 // 1 hour in milliseconds
    }
  },
  
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  expiresAt: {
    type: Date,
    default: null
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
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
SystemAlertSchema.index({ alertType: 1, createdAt: -1 });
SystemAlertSchema.index({ severity: 1, createdAt: -1 });
SystemAlertSchema.index({ isResolved: 1, createdAt: -1 });
SystemAlertSchema.index({ isActive: 1, createdAt: -1 });
SystemAlertSchema.index({ affectedSchools: 1 });
SystemAlertSchema.index({ 'escalation.level': 1 });
SystemAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for common queries
SystemAlertSchema.index({ alertType: 1, severity: 1, isResolved: 1 });
SystemAlertSchema.index({ isActive: 1, isResolved: 1, createdAt: -1 });

// Virtual for alert age in minutes
SystemAlertSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for resolution time in minutes
SystemAlertSchema.virtual('resolutionTimeInMinutes').get(function() {
  if (!this.isResolved || !this.resolvedAt) {
    return null;
  }
  return Math.floor((this.resolvedAt.getTime() - this.createdAt.getTime()) / (1000 * 60));
});

// Virtual for alert status
SystemAlertSchema.virtual('status').get(function() {
  if (!this.isActive) return 'inactive';
  if (this.isResolved) return 'resolved';
  if (this.escalation.level > 1) return 'escalated';
  return 'active';
});

// Instance method to resolve alert
SystemAlertSchema.methods.resolve = function(resolvedBy, resolutionNotes, resolutionActions = []) {
  this.isResolved = true;
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  this.resolutionNotes = resolutionNotes;
  
  if (resolutionActions.length > 0) {
    this.resolutionActions.push(...resolutionActions);
  }
  
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to escalate alert
SystemAlertSchema.methods.escalate = function(escalatedBy, escalationReason) {
  this.escalation.level += 1;
  this.escalation.escalatedAt = new Date();
  this.escalation.escalatedBy = escalatedBy;
  this.escalation.escalationReason = escalationReason;
  this.updatedAt = new Date();
  
  return this.save();
};

// Instance method to add resolution action
SystemAlertSchema.methods.addResolutionAction = function(action, performedBy, notes = '') {
  this.resolutionActions.push({
    action,
    performedBy,
    performedAt: new Date(),
    notes
  });
  
  this.updatedAt = new Date();
  return this.save();
};

// Instance method to increment occurrence count
SystemAlertSchema.methods.incrementOccurrence = function() {
  this.metrics.occurrenceCount += 1;
  this.metrics.lastOccurrence = new Date();
  this.updatedAt = new Date();
  
  return this.save();
};

// Static method to create or update similar alert
SystemAlertSchema.statics.createOrUpdateAlert = async function(alertData) {
  const {
    alertType,
    severity,
    title,
    source,
    affectedSchools = [],
    affectedUsers = []
  } = alertData;
  
  // Look for similar unresolved alert
  const existingAlert = await this.findOne({
    alertType,
    title,
    'source.component': source.component,
    isResolved: false,
    isActive: true,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Within last 24 hours
  });
  
  if (existingAlert) {
    // Update existing alert
    existingAlert.metrics.occurrenceCount += 1;
    existingAlert.metrics.lastOccurrence = new Date();
    existingAlert.severity = severity; // Update severity if it changed
    
    // Merge affected schools and users
    const newSchools = affectedSchools.filter(
      schoolId => !existingAlert.affectedSchools.includes(schoolId)
    );
    const newUsers = affectedUsers.filter(
      userId => !existingAlert.affectedUsers.includes(userId)
    );
    
    existingAlert.affectedSchools.push(...newSchools);
    existingAlert.affectedUsers.push(...newUsers);
    existingAlert.metrics.affectedSchoolCount = existingAlert.affectedSchools.length;
    existingAlert.metrics.affectedUserCount = existingAlert.affectedUsers.length;
    
    // Update metadata if provided
    if (alertData.metadata) {
      existingAlert.metadata = { ...existingAlert.metadata, ...alertData.metadata };
    }
    
    existingAlert.updatedAt = new Date();
    await existingAlert.save();
    
    return existingAlert;
  } else {
    // Create new alert
    const newAlert = new this({
      ...alertData,
      metrics: {
        occurrenceCount: 1,
        firstOccurrence: new Date(),
        lastOccurrence: new Date(),
        affectedUserCount: affectedUsers.length,
        affectedSchoolCount: affectedSchools.length
      }
    });
    
    await newAlert.save();
    return newAlert;
  }
};

// Static method to get active alerts with filters
SystemAlertSchema.statics.getActiveAlerts = async function(filters = {}, options = {}) {
  const {
    alertType,
    severity,
    schoolId,
    isResolved = false,
    escalationLevel
  } = filters;
  
  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = options;
  
  // Build query
  const query = { isActive: true, isResolved };
  
  if (alertType) query.alertType = alertType;
  if (severity) query.severity = severity;
  if (schoolId) query.affectedSchools = schoolId;
  if (escalationLevel) query['escalation.level'] = escalationLevel;
  
  // Execute query with pagination
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
  const [alerts, total] = await Promise.all([
    this.find(query)
      .populate('affectedSchools', 'name')
      .populate('resolvedBy', 'firstName lastName email')
      .populate('escalation.escalatedBy', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    alerts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get alert statistics
SystemAlertSchema.statics.getAlertStats = async function(timeRange = '24h') {
  const timeRangeMs = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  const startTime = new Date(Date.now() - (timeRangeMs[timeRange] || timeRangeMs['24h']));
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startTime },
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalAlerts: { $sum: 1 },
        resolvedAlerts: {
          $sum: { $cond: [{ $eq: ['$isResolved', true] }, 1, 0] }
        },
        criticalAlerts: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        errorAlerts: {
          $sum: { $cond: [{ $eq: ['$severity', 'error'] }, 1, 0] }
        },
        warningAlerts: {
          $sum: { $cond: [{ $eq: ['$severity', 'warning'] }, 1, 0] }
        },
        infoAlerts: {
          $sum: { $cond: [{ $eq: ['$severity', 'info'] }, 1, 0] }
        },
        alertsByType: { $push: '$alertType' },
        escalatedAlerts: {
          $sum: { $cond: [{ $gt: ['$escalation.level', 1] }, 1, 0] }
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalAlerts: 0,
      resolvedAlerts: 0,
      activeAlerts: 0,
      resolutionRate: 0,
      severityBreakdown: {},
      typeBreakdown: {},
      escalatedAlerts: 0
    };
  }
  
  const result = stats[0];
  const activeAlerts = result.totalAlerts - result.resolvedAlerts;
  
  // Calculate type breakdown
  const typeBreakdown = {};
  result.alertsByType.forEach(type => {
    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
  });
  
  return {
    totalAlerts: result.totalAlerts,
    resolvedAlerts: result.resolvedAlerts,
    activeAlerts,
    resolutionRate: result.totalAlerts > 0 ? (result.resolvedAlerts / result.totalAlerts) * 100 : 0,
    severityBreakdown: {
      critical: result.criticalAlerts,
      error: result.errorAlerts,
      warning: result.warningAlerts,
      info: result.infoAlerts
    },
    typeBreakdown,
    escalatedAlerts: result.escalatedAlerts
  };
};

// Pre-save middleware to update metrics
SystemAlertSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update affected counts
  this.metrics.affectedSchoolCount = this.affectedSchools.length;
  this.metrics.affectedUserCount = this.affectedUsers.length;
  
  next();
});

// Pre-save middleware for auto-escalation
SystemAlertSchema.pre('save', function(next) {
  if (!this.isResolved && this.escalation.autoEscalationEnabled) {
    const ageMs = Date.now() - this.createdAt.getTime();
    const thresholdMs = this.escalation.escalationThreshold;
    
    if (ageMs > thresholdMs && this.escalation.level === 1) {
      this.escalation.level = 2;
      this.escalation.escalatedAt = new Date();
      this.escalation.escalationReason = 'Auto-escalated due to age threshold';
    }
  }
  
  next();
});

module.exports = mongoose.model('SystemAlert', SystemAlertSchema);
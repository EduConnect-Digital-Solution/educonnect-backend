/**
 * PlatformAuditLog Model
 * Comprehensive audit logging for system admin operations and cross-school activities
 * Requirements: 3.3, 5.4
 */

const mongoose = require('mongoose');

const PlatformAuditLogSchema = new mongoose.Schema({
  operation: {
    type: String,
    required: [true, 'Operation is required'],
    trim: true,
    maxlength: [200, 'Operation cannot exceed 200 characters']
  },
  
  operationType: {
    type: String,
    required: [true, 'Operation type is required'],
    enum: {
      values: ['create', 'read', 'update', 'delete', 'admin_action', 'system_config', 'cross_school_access', 'authentication', 'authorization'],
      message: 'Operation type must be one of: create, read, update, delete, admin_action, system_config, cross_school_access, authentication, authorization'
    }
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  
  userRole: {
    type: String,
    required: [true, 'User role is required'],
    enum: {
      values: ['system_admin', 'admin', 'teacher', 'parent'],
      message: 'User role must be one of: system_admin, admin, teacher, parent'
    }
  },
  
  userEmail: {
    type: String,
    required: [true, 'User email is required'],
    trim: true,
    lowercase: true
  },
  
  targetSchoolId: {
    type: mongoose.Schema.Types.Mixed, // Allow both ObjectId and String
    ref: 'School',
    default: null
  },
  
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  resourceType: {
    type: String,
    trim: true,
    maxlength: [100, 'Resource type cannot exceed 100 characters']
  },
  
  resourceId: {
    type: String,
    trim: true,
    maxlength: [100, 'Resource ID cannot exceed 100 characters']
  },
  
  changes: {
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    fields: [{ type: String }]
  },
  
  requestDetails: {
    method: {
      type: String,
      required: [true, 'HTTP method is required'],
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    path: {
      type: String,
      required: [true, 'Request path is required'],
      trim: true
    },
    query: { type: mongoose.Schema.Types.Mixed },
    params: { type: mongoose.Schema.Types.Mixed },
    body: { type: mongoose.Schema.Types.Mixed },
    headers: {
      userAgent: String,
      referer: String,
      contentType: String
    }
  },
  
  metadata: {
    ip: {
      type: String,
      required: [true, 'IP address is required']
    },
    userAgent: String,
    sessionId: String,
    requestId: String,
    duration: { type: Number }, // Request duration in milliseconds
    responseStatus: { type: Number },
    errorMessage: String,
    stackTrace: String
  },
  
  severity: {
    type: String,
    required: [true, 'Severity is required'],
    enum: {
      values: ['low', 'medium', 'high', 'critical'],
      message: 'Severity must be one of: low, medium, high, critical'
    },
    default: 'medium'
  },
  
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['security', 'data_access', 'configuration', 'user_management', 'system_health', 'compliance'],
      message: 'Category must be one of: security, data_access, configuration, user_management, system_health, compliance'
    }
  },
  
  isSuccessful: {
    type: Boolean,
    required: [true, 'Success status is required'],
    default: true
  },
  
  crossSchoolAccess: {
    isEnabled: { type: Boolean, default: false },
    accessedSchools: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }],
    reason: String
  },
  
  complianceFlags: {
    isGDPRRelevant: { type: Boolean, default: false },
    isFERPARelevant: { type: Boolean, default: false },
    dataCategories: [{ type: String }],
    retentionPeriod: { type: Number } // Days
  },
  
  tags: [{ 
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
}, {
  timestamps: false, // We use custom timestamp field
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and querying
PlatformAuditLogSchema.index({ timestamp: -1 });
PlatformAuditLogSchema.index({ userId: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ userRole: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ operationType: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ severity: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ category: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ targetSchoolId: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ isSuccessful: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ 'complianceFlags.isGDPRRelevant': 1 });
PlatformAuditLogSchema.index({ 'complianceFlags.isFERPARelevant': 1 });

// Compound indexes for common queries
PlatformAuditLogSchema.index({ userRole: 1, operationType: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ targetSchoolId: 1, operationType: 1, timestamp: -1 });
PlatformAuditLogSchema.index({ severity: 1, category: 1, timestamp: -1 });

// Virtual for formatted timestamp
PlatformAuditLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

// Virtual for operation summary
PlatformAuditLogSchema.virtual('summary').get(function() {
  return `${this.userRole} ${this.userEmail} performed ${this.operation} (${this.operationType})`;
});

// Static method to create audit log entry
PlatformAuditLogSchema.statics.createAuditLog = async function(auditData) {
  try {
    // Set default severity based on operation type and user role
    if (!auditData.severity) {
      auditData.severity = this.getDefaultSeverity(auditData.operationType, auditData.userRole);
    }
    
    // Set default category based on operation type
    if (!auditData.category) {
      auditData.category = this.getDefaultCategory(auditData.operationType);
    }
    
    // Create and save the audit log
    const auditLog = new this(auditData);
    await auditLog.save();
    
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

// Static method to get default severity
PlatformAuditLogSchema.statics.getDefaultSeverity = function(operationType, userRole) {
  if (userRole === 'system_admin') {
    return 'high'; // System admin operations are always high severity
  }
  
  switch (operationType) {
    case 'delete':
    case 'admin_action':
    case 'system_config':
      return 'high';
    case 'create':
    case 'update':
      return 'medium';
    case 'read':
      return 'low';
    default:
      return 'medium';
  }
};

// Static method to get default category
PlatformAuditLogSchema.statics.getDefaultCategory = function(operationType) {
  switch (operationType) {
    case 'authentication':
    case 'authorization':
      return 'security';
    case 'system_config':
      return 'configuration';
    case 'admin_action':
      return 'user_management';
    case 'cross_school_access':
      return 'security';
    default:
      return 'data_access';
  }
};

// Static method to get audit logs with filters
PlatformAuditLogSchema.statics.getAuditLogs = async function(filters = {}, options = {}) {
  const {
    userId,
    userRole,
    operationType,
    severity,
    category,
    targetSchoolId,
    startDate,
    endDate,
    isSuccessful,
    tags
  } = filters;
  
  const {
    page = 1,
    limit = 50,
    sortBy = 'timestamp',
    sortOrder = 'desc'
  } = options;
  
  // Build query
  const query = {};
  
  if (userId) query.userId = userId;
  if (userRole) query.userRole = userRole;
  if (operationType) query.operationType = operationType;
  if (severity) query.severity = severity;
  if (category) query.category = category;
  if (targetSchoolId) query.targetSchoolId = targetSchoolId;
  if (isSuccessful !== undefined) query.isSuccessful = isSuccessful;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  
  // Date range filter
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }
  
  // Execute query with pagination
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
  
  const [logs, total] = await Promise.all([
    this.find(query)
      .populate('userId', 'firstName lastName email')
      .populate('targetSchoolId', 'name')
      .populate('targetUserId', 'firstName lastName email')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query)
  ]);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

// Static method to get audit statistics
PlatformAuditLogSchema.statics.getAuditStats = async function(filters = {}) {
  const { startDate, endDate, targetSchoolId } = filters;
  
  // Build match stage
  const matchStage = {};
  if (targetSchoolId) {
    // Handle both ObjectId and string school IDs
    try {
      matchStage.targetSchoolId = new mongoose.Types.ObjectId(targetSchoolId);
    } catch (error) {
      // If it's not a valid ObjectId, treat it as a string
      matchStage.targetSchoolId = targetSchoolId;
    }
  }
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalOperations: { $sum: 1 },
        successfulOperations: {
          $sum: { $cond: [{ $eq: ['$isSuccessful', true] }, 1, 0] }
        },
        failedOperations: {
          $sum: { $cond: [{ $eq: ['$isSuccessful', false] }, 1, 0] }
        },
        operationsByType: {
          $push: '$operationType'
        },
        operationsBySeverity: {
          $push: '$severity'
        },
        operationsByCategory: {
          $push: '$category'
        },
        operationsByRole: {
          $push: '$userRole'
        }
      }
    }
  ]);
  
  if (stats.length === 0) {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      successRate: 0,
      breakdowns: {}
    };
  }
  
  const result = stats[0];
  
  // Calculate breakdowns
  const breakdowns = {
    byType: this.calculateBreakdown(result.operationsByType),
    bySeverity: this.calculateBreakdown(result.operationsBySeverity),
    byCategory: this.calculateBreakdown(result.operationsByCategory),
    byRole: this.calculateBreakdown(result.operationsByRole)
  };
  
  return {
    totalOperations: result.totalOperations,
    successfulOperations: result.successfulOperations,
    failedOperations: result.failedOperations,
    successRate: result.totalOperations > 0 ? (result.successfulOperations / result.totalOperations) * 100 : 0,
    breakdowns
  };
};

// Helper method to calculate breakdown percentages
PlatformAuditLogSchema.statics.calculateBreakdown = function(items) {
  const counts = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  
  const total = items.length;
  const breakdown = {};
  
  Object.keys(counts).forEach(key => {
    breakdown[key] = {
      count: counts[key],
      percentage: total > 0 ? (counts[key] / total) * 100 : 0
    };
  });
  
  return breakdown;
};

// Pre-save middleware to ensure required fields
PlatformAuditLogSchema.pre('save', function(next) {
  // Ensure timestamp is set
  if (!this.timestamp) {
    this.timestamp = new Date();
  }
  
  // Set compliance flags based on operation type and data
  if (this.operationType === 'read' || this.operationType === 'update' || this.operationType === 'delete') {
    if (this.resourceType === 'user' || this.resourceType === 'student') {
      this.complianceFlags.isGDPRRelevant = true;
      this.complianceFlags.isFERPARelevant = true;
    }
  }
  
  next();
});

module.exports = mongoose.model('PlatformAuditLog', PlatformAuditLogSchema);
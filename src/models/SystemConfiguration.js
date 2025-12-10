/**
 * SystemConfiguration Model
 * Manages platform-wide configuration settings with school-specific overrides
 * Requirements: 2.2, 7.3
 */

const mongoose = require('mongoose');

const SystemConfigurationSchema = new mongoose.Schema({
  configKey: {
    type: String,
    required: [true, 'Configuration key is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Configuration key cannot exceed 100 characters'],
    match: [/^[a-zA-Z0-9_.-]+$/, 'Configuration key can only contain letters, numbers, underscores, dots, and hyphens']
  },
  
  configValue: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Configuration value is required']
  },
  
  category: {
    type: String,
    required: [true, 'Configuration category is required'],
    enum: {
      values: ['platform', 'security', 'billing', 'features', 'performance', 'notifications'],
      message: 'Category must be one of: platform, security, billing, features, performance, notifications'
    }
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    trim: true
  },
  
  isGlobal: {
    type: Boolean,
    default: true,
    required: true
  },
  
  dataType: {
    type: String,
    enum: {
      values: ['string', 'number', 'boolean', 'object', 'array'],
      message: 'Data type must be one of: string, number, boolean, object, array'
    },
    required: [true, 'Data type is required']
  },
  
  isRequired: {
    type: Boolean,
    default: false
  },
  
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  
  validationRules: {
    min: { type: Number },
    max: { type: Number },
    pattern: { type: String },
    allowedValues: [{ type: mongoose.Schema.Types.Mixed }]
  },
  
  schoolOverrides: [{
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      maxlength: [200, 'Reason cannot exceed 200 characters']
    }
  }],
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
SystemConfigurationSchema.index({ configKey: 1 });
SystemConfigurationSchema.index({ category: 1 });
SystemConfigurationSchema.index({ isActive: 1 });
SystemConfigurationSchema.index({ 'schoolOverrides.schoolId': 1 });

// Virtual for getting effective value for a specific school
SystemConfigurationSchema.virtual('effectiveValue').get(function() {
  return this.configValue;
});

// Instance method to get configuration value for a specific school
SystemConfigurationSchema.methods.getValueForSchool = function(schoolId) {
  if (!schoolId) {
    return this.configValue;
  }
  
  // Check if there's a school-specific override
  const override = this.schoolOverrides.find(
    override => override.schoolId.toString() === schoolId.toString()
  );
  
  return override ? override.value : this.configValue;
};

// Instance method to set school-specific override
SystemConfigurationSchema.methods.setSchoolOverride = function(schoolId, value, updatedBy, reason = '') {
  const existingOverrideIndex = this.schoolOverrides.findIndex(
    override => override.schoolId.toString() === schoolId.toString()
  );
  
  const overrideData = {
    schoolId,
    value,
    updatedAt: new Date(),
    updatedBy,
    reason
  };
  
  if (existingOverrideIndex >= 0) {
    // Update existing override
    this.schoolOverrides[existingOverrideIndex] = overrideData;
  } else {
    // Add new override
    this.schoolOverrides.push(overrideData);
  }
  
  this.updatedAt = new Date();
  this.updatedBy = updatedBy;
};

// Instance method to remove school-specific override
SystemConfigurationSchema.methods.removeSchoolOverride = function(schoolId, updatedBy) {
  this.schoolOverrides = this.schoolOverrides.filter(
    override => override.schoolId.toString() !== schoolId.toString()
  );
  
  this.updatedAt = new Date();
  this.updatedBy = updatedBy;
};

// Static method to get configuration value for a school
SystemConfigurationSchema.statics.getConfigForSchool = async function(configKey, schoolId) {
  const config = await this.findOne({ 
    configKey, 
    isActive: true 
  });
  
  if (!config) {
    return null;
  }
  
  return config.getValueForSchool(schoolId);
};

// Static method to get all configurations for a school
SystemConfigurationSchema.statics.getAllConfigsForSchool = async function(schoolId, category = null) {
  const query = { isActive: true };
  if (category) {
    query.category = category;
  }
  
  const configs = await this.find(query);
  
  const result = {};
  configs.forEach(config => {
    result[config.configKey] = config.getValueForSchool(schoolId);
  });
  
  return result;
};

// Static method to validate configuration value
SystemConfigurationSchema.statics.validateConfigValue = function(config, value) {
  const errors = [];
  
  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== config.dataType) {
    errors.push(`Expected ${config.dataType}, got ${actualType}`);
  }
  
  // Validation rules
  if (config.validationRules) {
    const rules = config.validationRules;
    
    if (rules.min !== undefined && typeof value === 'number' && value < rules.min) {
      errors.push(`Value must be at least ${rules.min}`);
    }
    
    if (rules.max !== undefined && typeof value === 'number' && value > rules.max) {
      errors.push(`Value must be at most ${rules.max}`);
    }
    
    if (rules.pattern && typeof value === 'string' && !new RegExp(rules.pattern).test(value)) {
      errors.push(`Value must match pattern: ${rules.pattern}`);
    }
    
    if (rules.allowedValues && rules.allowedValues.length > 0 && !rules.allowedValues.includes(value)) {
      errors.push(`Value must be one of: ${rules.allowedValues.join(', ')}`);
    }
  }
  
  return errors;
};

// Pre-save middleware to update timestamps
SystemConfigurationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-save validation
SystemConfigurationSchema.pre('save', function(next) {
  // Validate the main configuration value
  const errors = this.constructor.validateConfigValue(this, this.configValue);
  
  if (errors.length > 0) {
    return next(new Error(`Configuration validation failed: ${errors.join(', ')}`));
  }
  
  // Validate school override values
  for (const override of this.schoolOverrides) {
    const overrideErrors = this.constructor.validateConfigValue(this, override.value);
    if (overrideErrors.length > 0) {
      return next(new Error(`School override validation failed: ${overrideErrors.join(', ')}`));
    }
  }
  
  next();
});

module.exports = mongoose.model('SystemConfiguration', SystemConfigurationSchema);
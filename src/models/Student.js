const mongoose = require('mongoose');

/**
 * Student Model
 * Represents students in the system with relationship management
 * Implements requirements 5.1, 5.3, 5.4, 5.5
 */

const studentSchema = new mongoose.Schema({
  // School association (required for all students)
  schoolId: {
    type: String,
    required: [true, 'School ID is required'],
    index: true
  },
  
  // Unique student identifier within school (Requirement 5.1)
  studentId: {
    type: String,
    trim: true,
    index: true
  },
  
  // Basic student information
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
  
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    sparse: true // Allow null/undefined but enforce uniqueness when present
  },
  
  // Academic information
  class: {
    type: String,
    trim: true,
    maxlength: [20, 'Class cannot exceed 20 characters']
  },
  
  section: {
    type: String,
    trim: true,
    maxlength: [10, 'Section cannot exceed 10 characters']
  },
  
  rollNumber: {
    type: String,
    trim: true,
    maxlength: [20, 'Roll number cannot exceed 20 characters']
  },
  
  grade: {
    type: String,
    trim: true,
    maxlength: [10, 'Grade cannot exceed 10 characters']
  },
  
  // Personal information
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        // Date of birth should be in the past and reasonable (not more than 25 years ago for school students)
        if (!value) return true; // Optional field
        const now = new Date();
        const twentyFiveYearsAgo = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());
        return value <= now && value >= twentyFiveYearsAgo;
      },
      message: 'Date of birth must be in the past and within reasonable range'
    }
  },
  
  gender: {
    type: String,
    enum: {
      values: ['male', 'female', 'other'],
      message: 'Gender must be male, female, or other'
    }
  },
  
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
  
  profileImage: {
    type: String,
    trim: true
  },
  
  // Relationship management (Requirements 5.3, 5.4)
  parentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: async function(parentId) {
        // Validate that the referenced user is actually a parent
        if (!parentId) return true;
        const User = mongoose.model('User');
        const parent = await User.findById(parentId);
        return parent && parent.role === 'parent';
      },
      message: 'Referenced user must be a parent'
    }
  }],

  // Legacy field for backward compatibility
  parents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: async function(parentId) {
        // Validate that the referenced user is actually a parent
        const User = mongoose.model('User');
        const parent = await User.findById(parentId);
        return parent && parent.role === 'parent' && parent.schoolId === this.schoolId;
      },
      message: 'Referenced user must be a parent in the same school'
    }
  }],
  
  teachers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: async function(teacherId) {
        // Validate that the referenced user is actually a teacher
        const User = mongoose.model('User');
        const teacher = await User.findById(teacherId);
        return teacher && teacher.role === 'teacher' && teacher.schoolId === this.schoolId;
      },
      message: 'Referenced user must be a teacher in the same school'
    }
  }],
  
  // Academic tracking
  currentClass: {
    type: String,
    trim: true
  },
  
  academicYear: {
    type: String,
    trim: true,
    default: function() {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    }
  },
  
  // Status management (Requirement 5.5)
  isActive: {
    type: Boolean,
    default: true
  },
  
  isEnrolled: {
    type: Boolean,
    default: true
  },
  
  // Deactivation tracking
  deactivatedAt: {
    type: Date
  },
  
  deactivatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  deactivationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Deactivation reason cannot exceed 500 characters']
  },
  
  // Additional metadata
  admissionDate: {
    type: Date,
    default: Date.now
  },
  
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
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

// Compound indexes for performance and uniqueness
studentSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });
studentSchema.index({ schoolId: 1, email: 1 }, { unique: true, sparse: true });
studentSchema.index({ schoolId: 1, class: 1, section: 1 });
studentSchema.index({ schoolId: 1, isActive: 1, isEnrolled: 1 });
studentSchema.index({ parents: 1 });
studentSchema.index({ teachers: 1 });

/**
 * Pre-validate middleware to generate studentId if not present
 */
studentSchema.pre('validate', async function(next) {
  // Generate studentId if it's a new document and doesn't have one
  if (this.isNew && !this.studentId) {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.studentId = `${currentYear}${randomSuffix}`;
  }
  next();
});

/**
 * Pre-save middleware to generate unique studentId within school (Requirement 5.1)
 */
studentSchema.pre('save', async function(next) {
  // Only generate studentId for new documents that don't have one
  if (!this.isNew || this.studentId) return next();
  
  try {
    let studentId;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
      // Generate studentId: Current year + 4 random digits
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      studentId = `${currentYear}${randomSuffix}`;
      
      // Check if studentId is unique within the school
      const existingStudent = await this.constructor.findOne({ 
        schoolId: this.schoolId, 
        studentId 
      });
      
      if (!existingStudent) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      return next(new Error('Unable to generate unique studentId after multiple attempts'));
    }
    
    this.studentId = studentId;
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Pre-save middleware to update timestamps and handle deactivation
 */
studentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Handle deactivation tracking
  if (this.isModified('isActive') && !this.isActive && !this.deactivatedAt) {
    this.deactivatedAt = new Date();
  }
  
  // Clear deactivation data if reactivated
  if (this.isModified('isActive') && this.isActive && this.deactivatedAt) {
    this.deactivatedAt = undefined;
    this.deactivatedBy = undefined;
    this.deactivationReason = undefined;
  }
  
  next();
});

/**
 * Instance method to add parent relationship (Requirement 5.3)
 */
studentSchema.methods.addParent = async function(parentId) {
  try {
    // Validate parent exists and is in same school
    const User = mongoose.model('User');
    const parent = await User.findById(parentId);
    
    if (!parent) {
      throw new Error('Parent not found');
    }
    
    if (parent.role !== 'parent') {
      throw new Error('User is not a parent');
    }
    
    if (parent.schoolId !== this.schoolId) {
      throw new Error('Parent must be from the same school');
    }
    
    // Add parent if not already linked
    if (!this.parents.includes(parentId)) {
      this.parents.push(parentId);
      
      // Also add this student to parent's children array
      if (!parent.children.includes(this._id)) {
        parent.children.push(this._id);
        await parent.save();
      }
    }
    
    return this.save();
  } catch (error) {
    throw error;
  }
};

/**
 * Instance method to remove parent relationship
 */
studentSchema.methods.removeParent = async function(parentId) {
  try {
    // Remove parent from student
    this.parents = this.parents.filter(parent => !parent.equals(parentId));
    
    // Also remove student from parent's children array
    const User = mongoose.model('User');
    const parent = await User.findById(parentId);
    if (parent) {
      parent.children = parent.children.filter(child => !child.equals(this._id));
      await parent.save();
    }
    
    return this.save();
  } catch (error) {
    throw error;
  }
};

/**
 * Instance method to add teacher relationship (Requirement 5.4)
 */
studentSchema.methods.addTeacher = async function(teacherId) {
  try {
    // Validate teacher exists and is in same school
    const User = mongoose.model('User');
    const teacher = await User.findById(teacherId);
    
    if (!teacher) {
      throw new Error('Teacher not found');
    }
    
    if (teacher.role !== 'teacher') {
      throw new Error('User is not a teacher');
    }
    
    if (teacher.schoolId !== this.schoolId) {
      throw new Error('Teacher must be from the same school');
    }
    
    // Add teacher if not already linked
    if (!this.teachers.includes(teacherId)) {
      this.teachers.push(teacherId);
    }
    
    return this.save();
  } catch (error) {
    throw error;
  }
};

/**
 * Instance method to remove teacher relationship
 */
studentSchema.methods.removeTeacher = function(teacherId) {
  this.teachers = this.teachers.filter(teacher => !teacher.equals(teacherId));
  return this.save();
};

/**
 * Instance method to deactivate student (Requirement 5.5)
 */
studentSchema.methods.deactivate = function(deactivatedBy, reason) {
  this.isActive = false;
  this.deactivatedAt = new Date();
  this.deactivatedBy = deactivatedBy;
  this.deactivationReason = reason;
  return this.save();
};

/**
 * Instance method to reactivate student
 */
studentSchema.methods.reactivate = function() {
  this.isActive = true;
  this.deactivatedAt = undefined;
  this.deactivatedBy = undefined;
  this.deactivationReason = undefined;
  return this.save();
};

/**
 * Instance method to update class information
 */
studentSchema.methods.updateClassInfo = function(classInfo) {
  if (classInfo.class) this.class = classInfo.class;
  if (classInfo.section) this.section = classInfo.section;
  if (classInfo.rollNumber) this.rollNumber = classInfo.rollNumber;
  if (classInfo.grade) this.grade = classInfo.grade;
  if (classInfo.currentClass) this.currentClass = classInfo.currentClass;
  
  return this.save();
};

/**
 * Static method to find students by school
 */
studentSchema.statics.findBySchool = function(schoolId, options = {}) {
  const query = { schoolId };
  
  if (options.activeOnly !== false) {
    query.isActive = true;
  }
  
  if (options.enrolledOnly !== false) {
    query.isEnrolled = true;
  }
  
  return this.find(query);
};

/**
 * Static method to find students by class
 */
studentSchema.statics.findByClass = function(schoolId, className, section = null) {
  const query = { 
    schoolId, 
    class: className,
    isActive: true,
    isEnrolled: true
  };
  
  if (section) {
    query.section = section;
  }
  
  return this.find(query);
};

/**
 * Static method to find students by parent
 */
studentSchema.statics.findByParent = function(parentId) {
  return this.find({ 
    parents: parentId,
    isActive: true,
    isEnrolled: true
  });
};

/**
 * Static method to find students by teacher
 */
studentSchema.statics.findByTeacher = function(teacherId) {
  return this.find({ 
    teachers: teacherId,
    isActive: true,
    isEnrolled: true
  });
};

/**
 * Static method to find student by studentId within school
 */
studentSchema.statics.findByStudentId = function(schoolId, studentId) {
  return this.findOne({ schoolId, studentId });
};

/**
 * Static method to get student statistics for a school
 */
studentSchema.statics.getSchoolStatistics = async function(schoolId) {
  try {
    const stats = await this.aggregate([
      { $match: { schoolId } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: { 
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
          },
          enrolledStudents: { 
            $sum: { $cond: [{ $eq: ['$isEnrolled', true] }, 1, 0] } 
          },
          deactivatedStudents: { 
            $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } 
          }
        }
      }
    ]);
    
    return stats[0] || {
      totalStudents: 0,
      activeStudents: 0,
      enrolledStudents: 0,
      deactivatedStudents: 0
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Virtual for full name
 */
studentSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * Virtual for display name with student ID
 */
studentSchema.virtual('displayName').get(function() {
  return `${this.fullName} (${this.studentId})`;
});

/**
 * Virtual for class display
 */
studentSchema.virtual('classDisplay').get(function() {
  if (this.class && this.section) {
    return `${this.class}-${this.section}`;
  }
  return this.class || 'Not Assigned';
});

/**
 * Virtual for age calculation
 */
studentSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

/**
 * Virtual for status display
 */
studentSchema.virtual('statusDisplay').get(function() {
  if (!this.isActive) return 'Deactivated';
  if (!this.isEnrolled) return 'Not Enrolled';
  return 'Active';
});

/**
 * Transform function to include populated relationships in JSON output
 */
studentSchema.methods.toJSON = function() {
  const student = this.toObject();
  delete student.__v;
  return student;
};

/**
 * Validation for unique email within school (if provided)
 */
studentSchema.pre('validate', async function(next) {
  if (!this.email || (!this.isModified('email') && !this.isNew)) return next();
  
  try {
    const existingStudent = await this.constructor.findOne({ 
      schoolId: this.schoolId,
      email: this.email,
      _id: { $ne: this._id }
    });
    
    if (existingStudent) {
      const error = new Error('Email already exists for another student in this school');
      error.name = 'ValidationError';
      error.errors = {
        email: {
          message: 'Email already exists for another student in this school',
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

module.exports = mongoose.model('Student', studentSchema);
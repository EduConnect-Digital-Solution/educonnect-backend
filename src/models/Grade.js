const mongoose = require('mongoose');

/**
 * Grade Model
 * Represents student grades and assessments in the system
 * Supports the teacher grading workflow: Classes → Subjects → Students → Grades
 */

const gradeSchema = new mongoose.Schema({
  // School association (required for all grades)
  schoolId: {
    type: String,
    required: [true, 'School ID is required'],
    index: true
  },
  
  // Core relationships
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Teacher ID is required'],
    validate: {
      validator: async function(teacherId) {
        const User = mongoose.model('User');
        const teacher = await User.findById(teacherId);
        return teacher && teacher.role === 'teacher' && teacher.schoolId === this.schoolId;
      },
      message: 'Referenced user must be a teacher in the same school'
    }
  },
  
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Student ID is required'],
    validate: {
      validator: async function(studentId) {
        const Student = mongoose.model('Student');
        const student = await Student.findById(studentId);
        return student && student.schoolId === this.schoolId;
      },
      message: 'Referenced student must be in the same school'
    }
  },
  
  // Academic context
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [100, 'Subject name cannot exceed 100 characters']
  },
  
  class: {
    type: String,
    required: [true, 'Class is required'],
    trim: true,
    maxlength: [20, 'Class name cannot exceed 20 characters']
  },
  
  section: {
    type: String,
    trim: true,
    maxlength: [10, 'Section cannot exceed 10 characters']
  },
  
  // Academic period
  term: {
    type: String,
    required: [true, 'Term is required'],
    enum: {
      values: ['First Term', 'Second Term', 'Third Term'],
      message: 'Term must be First Term, Second Term, or Third Term'
    },
    default: 'First Term'
  },
  
  academicYear: {
    type: String,
    required: [true, 'Academic year is required'],
    trim: true,
    default: function() {
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${currentYear + 1}`;
    }
  },
  
  // Assessment components
  assessments: [{
    type: {
      type: String,
      required: [true, 'Assessment type is required'],
      enum: {
        values: ['Test', 'Assignment', 'Quiz', 'Project', 'Exam', 'Practical', 'Homework'],
        message: 'Assessment type must be one of: Test, Assignment, Quiz, Project, Exam, Practical, Homework'
      }
    },
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      maxlength: [200, 'Assessment title cannot exceed 200 characters']
    },
    score: {
      type: Number,
      required: [true, 'Score is required'],
      min: [0, 'Score cannot be negative'],
      validate: {
        validator: function(score) {
          return score <= this.maxScore;
        },
        message: 'Score cannot exceed maximum score'
      }
    },
    maxScore: {
      type: Number,
      required: [true, 'Maximum score is required'],
      min: [1, 'Maximum score must be at least 1']
    },
    weight: {
      type: Number,
      default: 1,
      min: [0, 'Weight cannot be negative'],
      max: [100, 'Weight cannot exceed 100']
    },
    date: {
      type: Date,
      default: Date.now
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Assessment remarks cannot exceed 500 characters']
    }
  }],
  
  // Calculated totals
  totalScore: {
    type: Number,
    min: [0, 'Total score cannot be negative']
  },
  
  totalMaxScore: {
    type: Number,
    min: [0, 'Total maximum score cannot be negative']
  },
  
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100']
  },
  
  // Letter grade
  letterGrade: {
    type: String,
    enum: {
      values: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'],
      message: 'Letter grade must be one of: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F'
    }
  },
  
  // Grade points (for GPA calculation)
  gradePoints: {
    type: Number,
    min: [0, 'Grade points cannot be negative'],
    max: [4, 'Grade points cannot exceed 4.0']
  },
  
  // Teacher feedback
  remarks: {
    type: String,
    trim: true,
    maxlength: [1000, 'Remarks cannot exceed 1000 characters']
  },
  
  // Status tracking
  isPublished: {
    type: Boolean,
    default: false
  },
  
  publishedAt: {
    type: Date
  },
  
  publishedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
gradeSchema.index({ schoolId: 1, teacherId: 1, studentId: 1, subject: 1, term: 1, academicYear: 1 }, { unique: true });
gradeSchema.index({ schoolId: 1, class: 1, subject: 1, term: 1 });
gradeSchema.index({ teacherId: 1, subject: 1, class: 1 });
gradeSchema.index({ studentId: 1, academicYear: 1, term: 1 });
gradeSchema.index({ isPublished: 1 });

/**
 * Pre-save middleware to calculate totals and grades
 */
gradeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate totals from assessments
  if (this.assessments && this.assessments.length > 0) {
    let totalScore = 0;
    let totalMaxScore = 0;
    let totalWeight = 0;
    
    this.assessments.forEach(assessment => {
      const weight = assessment.weight || 1;
      totalScore += (assessment.score * weight);
      totalMaxScore += (assessment.maxScore * weight);
      totalWeight += weight;
    });
    
    this.totalScore = totalScore;
    this.totalMaxScore = totalMaxScore;
    
    // Calculate percentage
    if (totalMaxScore > 0) {
      this.percentage = Math.round((totalScore / totalMaxScore) * 100 * 100) / 100; // Round to 2 decimal places
    }
    
    // Calculate letter grade based on percentage
    this.letterGrade = this.calculateLetterGrade(this.percentage);
    
    // Calculate grade points
    this.gradePoints = this.calculateGradePoints(this.letterGrade);
  }
  
  next();
});

/**
 * Instance method to calculate letter grade from percentage
 */
gradeSchema.methods.calculateLetterGrade = function(percentage) {
  if (percentage >= 97) return 'A+';
  if (percentage >= 93) return 'A';
  if (percentage >= 90) return 'A-';
  if (percentage >= 87) return 'B+';
  if (percentage >= 83) return 'B';
  if (percentage >= 80) return 'B-';
  if (percentage >= 77) return 'C+';
  if (percentage >= 73) return 'C';
  if (percentage >= 70) return 'C-';
  if (percentage >= 67) return 'D+';
  if (percentage >= 60) return 'D';
  return 'F';
};

/**
 * Instance method to calculate grade points from letter grade
 */
gradeSchema.methods.calculateGradePoints = function(letterGrade) {
  const gradePointMap = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'F': 0.0
  };
  return gradePointMap[letterGrade] || 0.0;
};

/**
 * Instance method to add assessment
 */
gradeSchema.methods.addAssessment = function(assessmentData) {
  this.assessments.push(assessmentData);
  return this.save();
};

/**
 * Instance method to update assessment
 */
gradeSchema.methods.updateAssessment = function(assessmentId, updateData) {
  const assessment = this.assessments.id(assessmentId);
  if (!assessment) {
    throw new Error('Assessment not found');
  }
  
  Object.assign(assessment, updateData);
  return this.save();
};

/**
 * Instance method to remove assessment
 */
gradeSchema.methods.removeAssessment = function(assessmentId) {
  this.assessments.pull(assessmentId);
  return this.save();
};

/**
 * Instance method to publish grades
 */
gradeSchema.methods.publish = function(publishedBy) {
  this.isPublished = true;
  this.publishedAt = new Date();
  this.publishedBy = publishedBy;
  return this.save();
};

/**
 * Instance method to unpublish grades
 */
gradeSchema.methods.unpublish = function() {
  this.isPublished = false;
  this.publishedAt = undefined;
  this.publishedBy = undefined;
  return this.save();
};

/**
 * Static method to find grades by teacher and class
 */
gradeSchema.statics.findByTeacherAndClass = function(teacherId, className, options = {}) {
  const query = { teacherId, class: className };
  
  if (options.subject) query.subject = options.subject;
  if (options.term) query.term = options.term;
  if (options.academicYear) query.academicYear = options.academicYear;
  if (options.publishedOnly) query.isPublished = true;
  
  return this.find(query)
    .populate('studentId', 'firstName lastName studentId')
    .sort({ 'studentId.firstName': 1 });
};

/**
 * Static method to find grades by student
 */
gradeSchema.statics.findByStudent = function(studentId, options = {}) {
  const query = { studentId };
  
  if (options.subject) query.subject = options.subject;
  if (options.term) query.term = options.term;
  if (options.academicYear) query.academicYear = options.academicYear;
  if (options.publishedOnly) query.isPublished = true;
  
  return this.find(query)
    .populate('teacherId', 'firstName lastName')
    .sort({ subject: 1, createdAt: -1 });
};

/**
 * Static method to get class statistics
 */
gradeSchema.statics.getClassStatistics = async function(teacherId, className, subject, term, academicYear) {
  try {
    const stats = await this.aggregate([
      {
        $match: {
          teacherId: new mongoose.Types.ObjectId(teacherId),
          class: className,
          subject: subject,
          term: term,
          academicYear: academicYear
        }
      },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          averagePercentage: { $avg: '$percentage' },
          highestScore: { $max: '$percentage' },
          lowestScore: { $min: '$percentage' },
          gradeDistribution: {
            $push: '$letterGrade'
          }
        }
      }
    ]);
    
    if (stats.length === 0) {
      return {
        totalStudents: 0,
        averagePercentage: 0,
        highestScore: 0,
        lowestScore: 0,
        gradeDistribution: {}
      };
    }
    
    const result = stats[0];
    
    // Count grade distribution
    const gradeCount = {};
    result.gradeDistribution.forEach(grade => {
      gradeCount[grade] = (gradeCount[grade] || 0) + 1;
    });
    
    return {
      totalStudents: result.totalStudents,
      averagePercentage: Math.round(result.averagePercentage * 100) / 100,
      highestScore: result.highestScore,
      lowestScore: result.lowestScore,
      gradeDistribution: gradeCount
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Virtual for display name
 */
gradeSchema.virtual('displayName').get(function() {
  return `${this.subject} - ${this.class} (${this.term})`;
});

/**
 * Virtual for status display
 */
gradeSchema.virtual('statusDisplay').get(function() {
  return this.isPublished ? 'Published' : 'Draft';
});

/**
 * Transform function to remove sensitive data from JSON output
 */
gradeSchema.methods.toJSON = function() {
  const grade = this.toObject();
  delete grade.__v;
  return grade;
};

module.exports = mongoose.model('Grade', gradeSchema);
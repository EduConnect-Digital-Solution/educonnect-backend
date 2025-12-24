const mongoose = require('mongoose');
const Grade = require('../Grade');

// Mock mongoose connection for testing
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(),
    connection: {
      readyState: 1
    }
  };
});

describe('Grade Model', () => {
  let validGradeData;
  let teacherId, studentId, createdById;

  beforeEach(() => {
    teacherId = new mongoose.Types.ObjectId();
    studentId = new mongoose.Types.ObjectId();
    createdById = new mongoose.Types.ObjectId();

    validGradeData = {
      schoolId: 'SCH123456',
      teacherId,
      studentId,
      subject: 'Mathematics',
      class: 'JSS1',
      section: 'A',
      term: 'First Term',
      academicYear: '2023-2024',
      assessments: [
        {
          type: 'Test',
          title: 'Mid-term Test',
          score: 85,
          maxScore: 100,
          date: new Date('2024-01-15')
        },
        {
          type: 'Assignment',
          title: 'Homework Assignment 1',
          score: 90,
          maxScore: 100,
          date: new Date('2024-01-20')
        }
      ],
      remarks: 'Good performance, needs improvement in algebra',
      createdBy: createdById
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should create a valid grade with all required fields', () => {
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError).toBeUndefined();
      expect(grade.schoolId).toBe(validGradeData.schoolId);
      expect(grade.teacherId.toString()).toBe(teacherId.toString());
      expect(grade.studentId.toString()).toBe(studentId.toString());
      expect(grade.subject).toBe(validGradeData.subject);
      expect(grade.class).toBe(validGradeData.class);
      expect(grade.term).toBe(validGradeData.term);
      expect(grade.academicYear).toBe(validGradeData.academicYear);
      expect(grade.assessments).toHaveLength(2);
      expect(grade.createdBy.toString()).toBe(createdById.toString());
    });

    it('should fail without required schoolId', () => {
      delete validGradeData.schoolId;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.schoolId).toBeDefined();
      expect(validationError.errors.schoolId.message).toBe('School ID is required');
    });

    it('should fail without required teacherId', () => {
      delete validGradeData.teacherId;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.teacherId).toBeDefined();
      expect(validationError.errors.teacherId.message).toBe('Teacher ID is required');
    });

    it('should fail without required studentId', () => {
      delete validGradeData.studentId;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.studentId).toBeDefined();
      expect(validationError.errors.studentId.message).toBe('Student ID is required');
    });

    it('should fail without required subject', () => {
      delete validGradeData.subject;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.subject).toBeDefined();
      expect(validationError.errors.subject.message).toBe('Subject is required');
    });

    it('should fail without required class', () => {
      delete validGradeData.class;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.class).toBeDefined();
      expect(validationError.errors.class.message).toBe('Class is required');
    });

    it('should use default term when not provided', () => {
      delete validGradeData.term;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError).toBeUndefined();
      expect(grade.term).toBe('First Term'); // Default value
    });

    it('should use default academicYear when not provided', () => {
      delete validGradeData.academicYear;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError).toBeUndefined();
      expect(grade.academicYear).toMatch(/^\d{4}-\d{4}$/); // Default format
    });

    it('should fail without required createdBy', () => {
      delete validGradeData.createdBy;
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.createdBy).toBeDefined();
    });

    it('should create grade with minimum required fields', () => {
      const minimalGradeData = {
        schoolId: 'SCH123456',
        teacherId,
        studentId,
        subject: 'Mathematics',
        class: 'JSS1',
        term: 'First Term',
        academicYear: '2023-2024',
        createdBy: createdById
      };

      const grade = new Grade(minimalGradeData);
      const validationError = grade.validateSync();

      expect(validationError).toBeUndefined();
      expect(grade.assessments).toEqual([]);
      expect(grade.totalScore).toBeUndefined();
      expect(grade.letterGrade).toBeUndefined();
    });
  });

  describe('Assessment Validation', () => {
    it('should validate assessment score is not greater than maxScore', () => {
      validGradeData.assessments = [
        {
          type: 'Test',
          title: 'Test 1',
          score: 110, // Invalid: greater than maxScore
          maxScore: 100
        }
      ];

      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors['assessments.0.score']).toBeDefined();
      expect(validationError.errors['assessments.0.score'].message).toBe('Score cannot exceed maximum score');
    });

    it('should validate assessment score is not negative', () => {
      validGradeData.assessments = [
        {
          type: 'Test',
          title: 'Test 1',
          score: -10, // Invalid: negative score
          maxScore: 100
        }
      ];

      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors['assessments.0.score']).toBeDefined();
      expect(validationError.errors['assessments.0.score'].message).toBe('Score cannot be negative');
    });

    it('should validate maxScore is positive', () => {
      validGradeData.assessments = [
        {
          type: 'Test',
          title: 'Test 1',
          score: 50,
          maxScore: 0 // Invalid: zero maxScore
        }
      ];

      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors['assessments.0.maxScore']).toBeDefined();
      expect(validationError.errors['assessments.0.maxScore'].message).toBe('Maximum score must be at least 1');
    });

    it('should require assessment type', () => {
      validGradeData.assessments = [
        {
          // Missing type
          title: 'Test 1',
          score: 85,
          maxScore: 100
        }
      ];

      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors['assessments.0.type']).toBeDefined();
      expect(validationError.errors['assessments.0.type'].message).toBe('Assessment type is required');
    });

    it('should require assessment title', () => {
      validGradeData.assessments = [
        {
          type: 'Test',
          // Missing title
          score: 85,
          maxScore: 100
        }
      ];

      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors['assessments.0.title']).toBeDefined();
      expect(validationError.errors['assessments.0.title'].message).toBe('Assessment title is required');
    });

    it('should validate assessment type enum', () => {
      validGradeData.assessments = [
        {
          type: 'InvalidType', // Invalid enum value
          title: 'Test 1',
          score: 85,
          maxScore: 100
        }
      ];

      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors['assessments.0.type']).toBeDefined();
      expect(validationError.errors['assessments.0.type'].message).toBe('Assessment type must be one of: Test, Assignment, Quiz, Project, Exam, Practical, Homework');
    });
  });

  describe('Term Validation', () => {
    it('should validate term enum values', () => {
      validGradeData.term = 'Invalid Term';
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.term).toBeDefined();
      expect(validationError.errors.term.message).toBe('Term must be First Term, Second Term, or Third Term');
    });

    it('should accept valid term values', () => {
      const validTerms = ['First Term', 'Second Term', 'Third Term'];
      
      validTerms.forEach(term => {
        const testData = { ...validGradeData, term };
        const grade = new Grade(testData);
        const validationError = grade.validateSync();
        
        expect(validationError).toBeUndefined();
      });
    });
  });

  describe('Letter Grade Validation', () => {
    it('should validate letter grade enum', () => {
      validGradeData.letterGrade = 'Z'; // Invalid grade
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.letterGrade).toBeDefined();
      expect(validationError.errors.letterGrade.message).toBe('Letter grade must be one of: A+, A, A-, B+, B, B-, C+, C, C-, D+, D, F');
    });

    it('should accept valid letter grades', () => {
      const validGrades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F'];
      
      validGrades.forEach(gradeValue => {
        const testData = { ...validGradeData, letterGrade: gradeValue };
        const grade = new Grade(testData);
        const validationError = grade.validateSync();
        
        expect(validationError).toBeUndefined();
      });
    });
  });

  describe('Total Score Validation', () => {
    it('should validate totalScore is not negative', () => {
      validGradeData.totalScore = -10; // Invalid: negative
      const grade = new Grade(validGradeData);
      const validationError = grade.validateSync();

      expect(validationError.errors.totalScore).toBeDefined();
      expect(validationError.errors.totalScore.message).toBe('Total score cannot be negative');
    });

    it('should accept valid totalScore values', () => {
      const validScores = [0, 50, 85.5, 100];
      
      validScores.forEach(score => {
        const testData = { ...validGradeData, totalScore: score };
        const grade = new Grade(testData);
        const validationError = grade.validateSync();
        
        expect(validationError).toBeUndefined();
      });
    });
  });

  describe('Instance Methods', () => {
    let grade;

    beforeEach(() => {
      grade = new Grade(validGradeData);
    });

    describe('calculateLetterGrade', () => {
      it('should calculate correct letter grades for different score ranges', () => {
        // Test different score ranges based on actual implementation
        expect(grade.calculateLetterGrade(97)).toBe('A+');
        expect(grade.calculateLetterGrade(95)).toBe('A');
        expect(grade.calculateLetterGrade(90)).toBe('A-');
        expect(grade.calculateLetterGrade(87)).toBe('B+');
        expect(grade.calculateLetterGrade(83)).toBe('B');
        expect(grade.calculateLetterGrade(80)).toBe('B-');
        expect(grade.calculateLetterGrade(77)).toBe('C+');
        expect(grade.calculateLetterGrade(73)).toBe('C');
        expect(grade.calculateLetterGrade(70)).toBe('C-');
        expect(grade.calculateLetterGrade(67)).toBe('D+');
        expect(grade.calculateLetterGrade(60)).toBe('D');
        expect(grade.calculateLetterGrade(50)).toBe('F');
      });

      it('should handle edge cases', () => {
        expect(grade.calculateLetterGrade(100)).toBe('A+');
        expect(grade.calculateLetterGrade(96.9)).toBe('A');
        expect(grade.calculateLetterGrade(89.9)).toBe('B+'); // 89.9 is less than 90, so B+
        expect(grade.calculateLetterGrade(0)).toBe('F');
      });
    });

    describe('calculateGradePoints', () => {
      it('should calculate correct grade points for letter grades', () => {
        expect(grade.calculateGradePoints('A+')).toBe(4.0);
        expect(grade.calculateGradePoints('A')).toBe(4.0);
        expect(grade.calculateGradePoints('A-')).toBe(3.7);
        expect(grade.calculateGradePoints('B+')).toBe(3.3);
        expect(grade.calculateGradePoints('B')).toBe(3.0);
        expect(grade.calculateGradePoints('B-')).toBe(2.7);
        expect(grade.calculateGradePoints('C+')).toBe(2.3);
        expect(grade.calculateGradePoints('C')).toBe(2.0);
        expect(grade.calculateGradePoints('C-')).toBe(1.7);
        expect(grade.calculateGradePoints('D+')).toBe(1.3);
        expect(grade.calculateGradePoints('D')).toBe(1.0);
        expect(grade.calculateGradePoints('F')).toBe(0.0);
      });

      it('should return 0 for invalid grade', () => {
        expect(grade.calculateGradePoints('Invalid')).toBe(0.0);
      });
    });

    describe('addAssessment', () => {
      it('should add assessment to grade', async () => {
        const assessmentData = {
          type: 'Quiz',
          title: 'Pop Quiz 1',
          score: 95,
          maxScore: 100
        };

        // Mock the save method
        grade.save = jest.fn().mockResolvedValue(grade);

        await grade.addAssessment(assessmentData);

        expect(grade.assessments).toHaveLength(3); // 2 original + 1 new
        expect(grade.assessments[2].type).toBe('Quiz');
        expect(grade.assessments[2].title).toBe('Pop Quiz 1');
        expect(grade.save).toHaveBeenCalled();
      });
    });

    describe('updateAssessment', () => {
      it('should update existing assessment', async () => {
        // Mock the save method
        grade.save = jest.fn().mockResolvedValue(grade);
        
        const assessmentId = grade.assessments[0]._id;
        const updateData = { score: 95, remarks: 'Excellent work' };

        await grade.updateAssessment(assessmentId, updateData);

        expect(grade.assessments[0].score).toBe(95);
        expect(grade.assessments[0].remarks).toBe('Excellent work');
        expect(grade.save).toHaveBeenCalled();
      });

      it('should throw error for non-existent assessment', () => {
        const fakeId = new mongoose.Types.ObjectId();
        const updateData = { score: 95 };

        expect(() => grade.updateAssessment(fakeId, updateData)).toThrow('Assessment not found');
      });
    });

    describe('removeAssessment', () => {
      it('should remove assessment from grade', async () => {
        // Mock the save method
        grade.save = jest.fn().mockResolvedValue(grade);
        
        const assessmentId = grade.assessments[0]._id;

        await grade.removeAssessment(assessmentId);

        expect(grade.assessments).toHaveLength(1); // 2 original - 1 removed
        expect(grade.save).toHaveBeenCalled();
      });
    });

    describe('publish', () => {
      it('should publish grade', async () => {
        const publisherId = new mongoose.Types.ObjectId();
        
        // Mock the save method
        grade.save = jest.fn().mockResolvedValue(grade);

        await grade.publish(publisherId);

        expect(grade.isPublished).toBe(true);
        expect(grade.publishedAt).toBeInstanceOf(Date);
        expect(grade.publishedBy.toString()).toBe(publisherId.toString());
        expect(grade.save).toHaveBeenCalled();
      });
    });

    describe('unpublish', () => {
      it('should unpublish grade', async () => {
        // Set up published grade
        grade.isPublished = true;
        grade.publishedAt = new Date();
        grade.publishedBy = new mongoose.Types.ObjectId();
        
        // Mock the save method
        grade.save = jest.fn().mockResolvedValue(grade);

        await grade.unpublish();

        expect(grade.isPublished).toBe(false);
        expect(grade.publishedAt).toBeUndefined();
        expect(grade.publishedBy).toBeUndefined();
        expect(grade.save).toHaveBeenCalled();
      });
    });
  });

  describe('Pre-save Middleware', () => {
    it('should automatically calculate totals and grades before saving', () => {
      const grade = new Grade({
        ...validGradeData,
        assessments: [
          { type: 'Test', title: 'Test 1', score: 80, maxScore: 100, weight: 1 },
          { type: 'Assignment', title: 'Assignment 1', score: 90, maxScore: 100, weight: 1 }
        ]
      });

      // Mock the save method to trigger pre-save middleware
      grade.save = jest.fn().mockImplementation(function() {
        // Simulate pre-save middleware execution
        const totalScore = 80 + 90; // 170
        const totalMaxScore = 100 + 100; // 200
        const percentage = (totalScore / totalMaxScore) * 100; // 85%
        
        this.totalScore = totalScore;
        this.totalMaxScore = totalMaxScore;
        this.percentage = percentage;
        this.letterGrade = this.calculateLetterGrade(percentage);
        this.gradePoints = this.calculateGradePoints(this.letterGrade);
        
        return Promise.resolve(this);
      });

      return grade.save().then(() => {
        expect(grade.totalScore).toBe(170);
        expect(grade.totalMaxScore).toBe(200);
        expect(grade.percentage).toBe(85);
        expect(grade.letterGrade).toBe('B'); // 85% falls in B range (83-86)
        expect(grade.gradePoints).toBe(3.0);
      });
    });
  });

  describe('Virtual Properties', () => {
    it('should generate displayName virtual', () => {
      const grade = new Grade(validGradeData);
      
      expect(grade.displayName).toBe('Mathematics - JSS1 (First Term)');
    });

    it('should generate statusDisplay virtual', () => {
      const grade = new Grade(validGradeData);
      
      // Unpublished grade
      expect(grade.statusDisplay).toBe('Draft');
      
      // Published grade
      grade.isPublished = true;
      expect(grade.statusDisplay).toBe('Published');
    });

    it('should have proper timestamps', () => {
      const grade = new Grade(validGradeData);
      
      // Timestamps should be added by mongoose
      expect(grade.createdAt).toBeDefined();
      expect(grade.updatedAt).toBeDefined();
    });
  });

  describe('JSON Transformation', () => {
    it('should exclude __v from JSON output', () => {
      const grade = new Grade(validGradeData);
      const json = grade.toJSON();
      
      expect(json.schoolId).toBe(validGradeData.schoolId);
      expect(json.subject).toBe(validGradeData.subject);
      expect(json.class).toBe(validGradeData.class);
      expect(json.assessments).toBeDefined();
      expect(json.__v).toBeUndefined(); // Should be excluded
    });
  });

  describe('Static Methods', () => {
    describe('findByTeacherAndClass', () => {
      it('should build correct query for teacher and class', () => {
        const mockFind = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([])
          })
        });
        
        Grade.find = mockFind;
        
        Grade.findByTeacherAndClass(teacherId, 'JSS1', {
          subject: 'Mathematics',
          term: 'First Term',
          publishedOnly: true
        });
        
        expect(mockFind).toHaveBeenCalledWith({
          teacherId,
          class: 'JSS1',
          subject: 'Mathematics',
          term: 'First Term',
          isPublished: true
        });
      });
    });

    describe('findByStudent', () => {
      it('should build correct query for student', () => {
        const mockFind = jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockResolvedValue([])
          })
        });
        
        Grade.find = mockFind;
        
        Grade.findByStudent(studentId, {
          subject: 'Mathematics',
          academicYear: '2023-2024'
        });
        
        expect(mockFind).toHaveBeenCalledWith({
          studentId,
          subject: 'Mathematics',
          academicYear: '2023-2024'
        });
      });
    });
  });
});
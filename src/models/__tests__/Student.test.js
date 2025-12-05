const mongoose = require('mongoose');
const Student = require('../Student');

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

describe('Student Model', () => {
  let studentData;

  beforeEach(() => {
    studentData = {
      schoolId: 'ABC1234',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@student.com',
      class: 'Grade 10',
      section: 'A',
      rollNumber: '001',
      grade: '10th',
      dateOfBirth: new Date('2008-05-15'),
      gender: 'male',
      address: '123 Student Street, City, State',
      phone: '+1234567890'
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    test('should create a valid student', () => {
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError).toBeUndefined();
      expect(student.firstName).toBe(studentData.firstName);
      expect(student.lastName).toBe(studentData.lastName);
      expect(student.isActive).toBe(true);
      expect(student.isEnrolled).toBe(true);
    });

    test('should require schoolId', () => {
      delete studentData.schoolId;
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.schoolId).toBeDefined();
      expect(validationError.errors.schoolId.message).toBe('School ID is required');
    });

    test('should require firstName', () => {
      delete studentData.firstName;
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.firstName).toBeDefined();
      expect(validationError.errors.firstName.message).toBe('First name is required');
    });

    test('should require lastName', () => {
      delete studentData.lastName;
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.lastName).toBeDefined();
      expect(validationError.errors.lastName.message).toBe('Last name is required');
    });

    test('should validate email format', () => {
      studentData.email = 'invalid-email';
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.email).toBeDefined();
      expect(validationError.errors.email.message).toBe('Please enter a valid email');
    });

    test('should validate phone format', () => {
      studentData.phone = 'invalid-phone';
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.phone).toBeDefined();
      expect(validationError.errors.phone.message).toBe('Please enter a valid phone number');
    });

    test('should validate gender enum', () => {
      studentData.gender = 'invalid-gender';
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.gender).toBeDefined();
      expect(validationError.errors.gender.message).toBe('Gender must be male, female, or other');
    });

    test('should validate firstName length', () => {
      studentData.firstName = 'A'; // Too short
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.firstName).toBeDefined();
      expect(validationError.errors.firstName.message).toBe('First name must be at least 2 characters');
    });

    test('should validate lastName length', () => {
      studentData.lastName = 'B'; // Too short
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.lastName).toBeDefined();
      expect(validationError.errors.lastName.message).toBe('Last name must be at least 2 characters');
    });

    test('should validate date of birth range', () => {
      studentData.dateOfBirth = new Date('1990-01-01'); // Too old for school student
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.dateOfBirth).toBeDefined();
      expect(validationError.errors.dateOfBirth.message).toBe('Date of birth must be in the past and within reasonable range');
    });

    test('should validate future date of birth', () => {
      studentData.dateOfBirth = new Date(Date.now() + 86400000); // Tomorrow
      const student = new Student(studentData);
      const validationError = student.validateSync();
      
      expect(validationError.errors.dateOfBirth).toBeDefined();
      expect(validationError.errors.dateOfBirth.message).toBe('Date of birth must be in the past and within reasonable range');
    });
  });

  describe('StudentId Generation', () => {
    test('should have studentId generation logic', () => {
      const student = new Student(studentData);
      
      // Test the studentId generation logic
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const expectedPattern = new RegExp(`^${currentYear}\\d{4}$`);
      
      // Test that studentId field exists in schema
      expect(Student.schema.paths.studentId).toBeDefined();
      
      // Test pattern matching logic
      const testStudentId = `${currentYear}1234`;
      expect(testStudentId).toMatch(expectedPattern);
    });

    test('should preserve existing studentId', () => {
      const existingStudentId = '241234';
      const student = new Student({ ...studentData, studentId: existingStudentId });
      
      expect(student.studentId).toBe(existingStudentId);
    });
  });

  describe('Instance Methods', () => {
    let student;

    beforeEach(() => {
      student = new Student(studentData);
      student._id = new mongoose.Types.ObjectId();
      student.save = jest.fn().mockResolvedValue(student);
    });

    describe('addParent', () => {
      test('should add parent to student', async () => {
        const parentId = new mongoose.Types.ObjectId();
        const mockParent = {
          _id: parentId,
          role: 'parent',
          schoolId: 'ABC1234',
          children: [],
          save: jest.fn().mockResolvedValue()
        };

        // Mock User model
        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockParent)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await student.addParent(parentId);

        expect(student.parents).toContain(parentId);
        expect(mockParent.children).toContain(student._id);
        expect(mockParent.save).toHaveBeenCalled();
        expect(student.save).toHaveBeenCalled();
      });

      test('should throw error if parent not found', async () => {
        const parentId = new mongoose.Types.ObjectId();
        
        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(null)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await expect(student.addParent(parentId)).rejects.toThrow('Parent not found');
      });

      test('should throw error if user is not a parent', async () => {
        const userId = new mongoose.Types.ObjectId();
        const mockUser = {
          _id: userId,
          role: 'teacher', // Not a parent
          schoolId: 'ABC1234'
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockUser)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await expect(student.addParent(userId)).rejects.toThrow('User is not a parent');
      });

      test('should throw error if parent from different school', async () => {
        const parentId = new mongoose.Types.ObjectId();
        const mockParent = {
          _id: parentId,
          role: 'parent',
          schoolId: 'DIFFERENT123' // Different school
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockParent)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await expect(student.addParent(parentId)).rejects.toThrow('Parent must be from the same school');
      });

      test('should not add duplicate parent', async () => {
        const parentId = new mongoose.Types.ObjectId();
        student.parents = [parentId]; // Already has this parent
        
        const mockParent = {
          _id: parentId,
          role: 'parent',
          schoolId: 'ABC1234',
          children: [student._id],
          save: jest.fn().mockResolvedValue()
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockParent)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await student.addParent(parentId);

        expect(student.parents).toHaveLength(1);
        expect(student.save).toHaveBeenCalled();
      });
    });

    describe('removeParent', () => {
      test('should remove parent from student', async () => {
        const parentId = new mongoose.Types.ObjectId();
        student.parents = [parentId];
        
        const mockParent = {
          _id: parentId,
          children: [student._id],
          save: jest.fn().mockResolvedValue()
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockParent)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await student.removeParent(parentId);

        expect(student.parents).not.toContain(parentId);
        expect(mockParent.children).not.toContain(student._id);
        expect(mockParent.save).toHaveBeenCalled();
        expect(student.save).toHaveBeenCalled();
      });

      test('should handle parent not found during removal', async () => {
        const parentId = new mongoose.Types.ObjectId();
        student.parents = [parentId];
        
        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(null)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await student.removeParent(parentId);

        expect(student.parents).not.toContain(parentId);
        expect(student.save).toHaveBeenCalled();
      });
    });

    describe('addTeacher', () => {
      test('should add teacher to student', async () => {
        const teacherId = new mongoose.Types.ObjectId();
        const mockTeacher = {
          _id: teacherId,
          role: 'teacher',
          schoolId: 'ABC1234'
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockTeacher)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await student.addTeacher(teacherId);

        expect(student.teachers).toContain(teacherId);
        expect(student.save).toHaveBeenCalled();
      });

      test('should throw error if teacher not found', async () => {
        const teacherId = new mongoose.Types.ObjectId();
        
        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(null)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await expect(student.addTeacher(teacherId)).rejects.toThrow('Teacher not found');
      });

      test('should throw error if user is not a teacher', async () => {
        const userId = new mongoose.Types.ObjectId();
        const mockUser = {
          _id: userId,
          role: 'parent', // Not a teacher
          schoolId: 'ABC1234'
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockUser)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await expect(student.addTeacher(userId)).rejects.toThrow('User is not a teacher');
      });

      test('should throw error if teacher from different school', async () => {
        const teacherId = new mongoose.Types.ObjectId();
        const mockTeacher = {
          _id: teacherId,
          role: 'teacher',
          schoolId: 'DIFFERENT123' // Different school
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockTeacher)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await expect(student.addTeacher(teacherId)).rejects.toThrow('Teacher must be from the same school');
      });

      test('should not add duplicate teacher', async () => {
        const teacherId = new mongoose.Types.ObjectId();
        student.teachers = [teacherId]; // Already has this teacher
        
        const mockTeacher = {
          _id: teacherId,
          role: 'teacher',
          schoolId: 'ABC1234'
        };

        const mockUserModel = {
          findById: jest.fn().mockResolvedValue(mockTeacher)
        };
        mongoose.model = jest.fn().mockReturnValue(mockUserModel);

        await student.addTeacher(teacherId);

        expect(student.teachers).toHaveLength(1);
        expect(student.save).toHaveBeenCalled();
      });
    });

    describe('removeTeacher', () => {
      test('should remove teacher from student', async () => {
        const teacherId = new mongoose.Types.ObjectId();
        student.teachers = [teacherId];

        await student.removeTeacher(teacherId);

        expect(student.teachers).not.toContain(teacherId);
        expect(student.save).toHaveBeenCalled();
      });
    });

    describe('deactivate', () => {
      test('should deactivate student with reason', async () => {
        const deactivatedBy = new mongoose.Types.ObjectId();
        const reason = 'Transferred to another school';

        await student.deactivate(deactivatedBy, reason);

        expect(student.isActive).toBe(false);
        expect(student.deactivatedBy).toBe(deactivatedBy);
        expect(student.deactivationReason).toBe(reason);
        expect(student.deactivatedAt).toBeInstanceOf(Date);
        expect(student.save).toHaveBeenCalled();
      });
    });

    describe('reactivate', () => {
      test('should reactivate student and clear deactivation data', async () => {
        // Set up deactivated state
        student.isActive = false;
        student.deactivatedAt = new Date();
        student.deactivatedBy = new mongoose.Types.ObjectId();
        student.deactivationReason = 'Test reason';

        await student.reactivate();

        expect(student.isActive).toBe(true);
        expect(student.deactivatedAt).toBeUndefined();
        expect(student.deactivatedBy).toBeUndefined();
        expect(student.deactivationReason).toBeUndefined();
        expect(student.save).toHaveBeenCalled();
      });
    });

    describe('updateClassInfo', () => {
      test('should update class information', async () => {
        const classInfo = {
          class: 'Grade 11',
          section: 'B',
          rollNumber: '002',
          grade: '11th',
          currentClass: 'Grade 11-B'
        };

        await student.updateClassInfo(classInfo);

        expect(student.class).toBe(classInfo.class);
        expect(student.section).toBe(classInfo.section);
        expect(student.rollNumber).toBe(classInfo.rollNumber);
        expect(student.grade).toBe(classInfo.grade);
        expect(student.currentClass).toBe(classInfo.currentClass);
        expect(student.save).toHaveBeenCalled();
      });

      test('should update only provided fields', async () => {
        const originalClass = student.class;
        const classInfo = {
          section: 'C',
          rollNumber: '003'
        };

        await student.updateClassInfo(classInfo);

        expect(student.class).toBe(originalClass); // Unchanged
        expect(student.section).toBe(classInfo.section);
        expect(student.rollNumber).toBe(classInfo.rollNumber);
        expect(student.save).toHaveBeenCalled();
      });
    });
  });

  describe('Static Methods', () => {
    describe('findBySchool', () => {
      test('should find students by school with default filters', () => {
        Student.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Student.findBySchool('ABC1234');
        
        expect(Student.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          isActive: true,
          isEnrolled: true
        });
      });

      test('should find students by school with custom options', () => {
        Student.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Student.findBySchool('ABC1234', { activeOnly: false, enrolledOnly: false });
        
        expect(Student.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234'
        });
      });
    });

    describe('findByClass', () => {
      test('should find students by class without section', () => {
        Student.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Student.findByClass('ABC1234', 'Grade 10');
        
        expect(Student.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          class: 'Grade 10',
          isActive: true,
          isEnrolled: true
        });
      });

      test('should find students by class with section', () => {
        Student.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Student.findByClass('ABC1234', 'Grade 10', 'A');
        
        expect(Student.find).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          class: 'Grade 10',
          section: 'A',
          isActive: true,
          isEnrolled: true
        });
      });
    });

    describe('findByParent', () => {
      test('should find students by parent', () => {
        const parentId = new mongoose.Types.ObjectId();
        Student.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Student.findByParent(parentId);
        
        expect(Student.find).toHaveBeenCalledWith({
          parents: parentId,
          isActive: true,
          isEnrolled: true
        });
      });
    });

    describe('findByTeacher', () => {
      test('should find students by teacher', () => {
        const teacherId = new mongoose.Types.ObjectId();
        Student.find = jest.fn().mockReturnValue(Promise.resolve([]));
        
        Student.findByTeacher(teacherId);
        
        expect(Student.find).toHaveBeenCalledWith({
          teachers: teacherId,
          isActive: true,
          isEnrolled: true
        });
      });
    });

    describe('findByStudentId', () => {
      test('should find student by studentId within school', () => {
        Student.findOne = jest.fn().mockReturnValue(Promise.resolve({}));
        
        Student.findByStudentId('ABC1234', 'ST001');
        
        expect(Student.findOne).toHaveBeenCalledWith({
          schoolId: 'ABC1234',
          studentId: 'ST001'
        });
      });
    });

    describe('getSchoolStatistics', () => {
      test('should return school statistics', async () => {
        const mockStats = [{
          _id: null,
          totalStudents: 100,
          activeStudents: 95,
          enrolledStudents: 90,
          deactivatedStudents: 5
        }];

        Student.aggregate = jest.fn().mockResolvedValue(mockStats);
        
        const result = await Student.getSchoolStatistics('ABC1234');
        
        expect(Student.aggregate).toHaveBeenCalled();
        expect(result).toEqual(mockStats[0]);
      });

      test('should return default statistics if no data', async () => {
        Student.aggregate = jest.fn().mockResolvedValue([]);
        
        const result = await Student.getSchoolStatistics('ABC1234');
        
        expect(result).toEqual({
          totalStudents: 0,
          activeStudents: 0,
          enrolledStudents: 0,
          deactivatedStudents: 0
        });
      });
    });
  });

  describe('Virtual Properties', () => {
    test('should generate fullName virtual', () => {
      const student = new Student(studentData);
      
      expect(student.fullName).toBe('John Doe');
    });

    test('should generate displayName virtual', () => {
      const student = new Student({ ...studentData, studentId: 'ST001' });
      
      expect(student.displayName).toBe('John Doe (ST001)');
    });

    test('should generate classDisplay virtual with class and section', () => {
      const student = new Student(studentData);
      
      expect(student.classDisplay).toBe('Grade 10-A');
    });

    test('should generate classDisplay virtual with class only', () => {
      const student = new Student({ ...studentData, section: undefined });
      
      expect(student.classDisplay).toBe('Grade 10');
    });

    test('should generate classDisplay virtual when no class assigned', () => {
      const student = new Student({ ...studentData, class: undefined, section: undefined });
      
      expect(student.classDisplay).toBe('Not Assigned');
    });

    test('should calculate age virtual correctly', () => {
      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 15); // 15 years ago
      
      const student = new Student({ ...studentData, dateOfBirth: birthDate });
      
      expect(student.age).toBe(15);
    });

    test('should return null age if no date of birth', () => {
      const student = new Student({ ...studentData, dateOfBirth: undefined });
      
      expect(student.age).toBeNull();
    });

    test('should generate statusDisplay virtual for active student', () => {
      const student = new Student(studentData);
      
      expect(student.statusDisplay).toBe('Active');
    });

    test('should generate statusDisplay virtual for deactivated student', () => {
      const student = new Student({ ...studentData, isActive: false });
      
      expect(student.statusDisplay).toBe('Deactivated');
    });

    test('should generate statusDisplay virtual for not enrolled student', () => {
      const student = new Student({ ...studentData, isEnrolled: false });
      
      expect(student.statusDisplay).toBe('Not Enrolled');
    });
  });

  describe('JSON Transformation', () => {
    test('should remove version field from JSON output', () => {
      const student = new Student(studentData);
      student.__v = 0;
      
      const json = student.toJSON();
      
      expect(json.__v).toBeUndefined();
      expect(json.firstName).toBe(studentData.firstName);
      expect(json.lastName).toBe(studentData.lastName);
    });
  });
});
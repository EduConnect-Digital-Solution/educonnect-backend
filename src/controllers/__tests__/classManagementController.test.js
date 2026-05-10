/**
 * Class Management Controller Tests
 */

const request = require('supertest');
const app = require('../../app');
const { prisma } = require('../../config/database');

// Mock data
const mockSchoolId = 'test-school-id';
const mockAdminUser = {
  id: 'admin-user-id',
  schoolId: mockSchoolId,
  email: 'admin@test.com',
  role: 'admin'
};

const mockClasses = [
  {
    id: 'class-1',
    schoolId: mockSchoolId,
    name: 'SS 1 Science',
    baseLevel: 'SS 1',
    arm: 'Science',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'class-2',
    schoolId: mockSchoolId,
    name: 'SS 1 Arts',
    baseLevel: 'SS 1',
    arm: 'Arts',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

describe('Class Management Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/classes', () => {
    it('should return all classes for authenticated admin', async () => {
      // Mock authentication middleware
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      // Mock RBAC middleware
      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      // Mock Prisma query
      prisma.class.findMany = jest.fn().mockResolvedValue(mockClasses);

      const response = await request(app)
        .get('/api/admin/classes')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.classes).toHaveLength(2);
      expect(response.body.data.classes[0]).toEqual({
        id: 'class-1',
        name: 'SS 1 Science',
        baseLevel: 'SS 1',
        arm: 'Science'
      });
    });

    it('should handle database errors', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      prisma.class.findMany = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/classes')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to fetch classes');
    });
  });

  describe('POST /api/admin/classes/bulk', () => {
    const bulkCreateData = {
      classes: [
        {
          baseLevel: 'SS 2',
          arm: 'Science',
          name: 'SS 2 Science'
        },
        {
          baseLevel: 'SS 2',
          arm: 'Arts',
          name: 'SS 2 Arts'
        }
      ]
    };

    it('should bulk create classes successfully', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      // Mock validation middleware
      jest.spyOn(require('../../middleware/classValidation'), 'validateBulkClassCreation')
        .mockImplementation((req, res, next) => next());

      prisma.class.findMany = jest.fn().mockResolvedValue([]); // No existing classes
      prisma.class.createMany = jest.fn().mockResolvedValue({ count: 2 });
      prisma.class.findMany = jest.fn().mockResolvedValue(bulkCreateData.classes.map((cls, index) => ({
        ...cls,
        id: `new-class-${index + 1}`,
        schoolId: mockSchoolId
      })));

      const response = await request(app)
        .post('/api/admin/classes/bulk')
        .send(bulkCreateData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Successfully created 2 classes');
    });

    it('should validate required fields', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      const invalidData = {
        classes: [
          {
            baseLevel: '', // Invalid: empty
            arm: 'Science',
            name: 'SS 2 Science'
          }
        ]
      };

      const response = await request(app)
        .post('/api/admin/classes/bulk')
        .send(invalidData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/admin/classes/:id', () => {
    const classId = 'class-1';

    it('should delete class successfully', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/classValidation'), 'validateClassId')
        .mockImplementation((req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue(mockClasses[0]);
      prisma.student.count = jest.fn().mockResolvedValue(0); // No students
      prisma.grade.count = jest.fn().mockResolvedValue(0); // No grades
      prisma.class.update = jest.fn().mockResolvedValue({
        ...mockClasses[0],
        isActive: false
      });

      const response = await request(app)
        .delete(`/api/admin/classes/${classId}`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Class deleted successfully');
    });

    it('should not delete class with students', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/classValidation'), 'validateClassId')
        .mockImplementation((req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue(mockClasses[0]);
      prisma.student.count = jest.fn().mockResolvedValue(5); // Has students

      const response = await request(app)
        .delete(`/api/admin/classes/${classId}`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Cannot delete class with enrolled students');
    });

    it('should return 404 for non-existent class', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/classValidation'), 'validateClassId')
        .mockImplementation((req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/admin/classes/${classId}`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Class not found');
    });
  });

  describe('GET /api/admin/classes/:id', () => {
    const classId = 'class-1';

    it('should return class details', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/classValidation'), 'validateClassId')
        .mockImplementation((req, res, next) => next());

      const mockClassWithDetails = {
        ...mockClasses[0],
        students: [
          {
            id: 'student-1',
            firstName: 'John',
            lastName: 'Doe',
            studentId: 'STU001',
            isActive: true
          }
        ],
        _count: {
          students: 1,
          grades: 5
        }
      };

      prisma.class.findFirst = jest.fn().mockResolvedValue(mockClassWithDetails);

      const response = await request(app)
        .get(`/api/admin/classes/${classId}`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.class.id).toBe(classId);
      expect(response.body.data.class.studentCount).toBe(1);
      expect(response.body.data.class.gradeCount).toBe(5);
    });

    it('should return 404 for non-existent class', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/classValidation'), 'validateClassId')
        .mockImplementation((req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/admin/classes/${classId}`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Class not found');
    });
  });
});

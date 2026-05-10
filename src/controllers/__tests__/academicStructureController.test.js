/**
 * Academic Structure Controller Tests
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

const mockClassId = 'test-class-id';
const mockSubjects = [
  {
    id: 'subject-1',
    schoolId: mockSchoolId,
    name: 'Mathematics',
    code: 'MTH',
    description: 'Core mathematics subject',
    category: 'core',
    isActive: true,
    createdAt: new Date()
  },
  {
    id: 'subject-2',
    schoolId: mockSchoolId,
    name: 'English Language',
    code: 'ENG',
    description: 'Core English subject',
    category: 'core',
    isActive: true,
    createdAt: new Date()
  }
];

const mockArms = [
  {
    id: 'arm-1',
    schoolId: mockSchoolId,
    classId: mockClassId,
    name: 'A',
    classTeacherId: null,
    isActive: true,
    createdAt: new Date()
  },
  {
    id: 'arm-2',
    schoolId: mockSchoolId,
    classId: mockClassId,
    name: 'B',
    classTeacherId: null,
    isActive: true,
    createdAt: new Date()
  }
];

describe('Academic Structure Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =============== SUBJECT MANAGEMENT TESTS ===============

  describe('POST /api/academic/subjects', () => {
    it('should create subjects successfully', async () => {
      // Mock authentication and RBAC middleware
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      // Mock validation middleware
      jest.spyOn(require('../../middleware/academicValidation'), 'validateSubjectCreation')
        .mockImplementation((req, res, next) => next());

      const subjectData = {
        subjects: [
          {
            name: 'Mathematics',
            code: 'MTH',
            description: 'Core mathematics subject',
            category: 'core'
          },
          {
            name: 'Physics',
            code: 'PHY',
            description: 'Science subject',
            category: 'core'
          }
        ]
      };

      prisma.subject.findMany = jest.fn().mockResolvedValue([]); // No existing subjects
      prisma.subject.createMany = jest.fn().mockResolvedValue({ count: 2 });
      prisma.subject.findMany = jest.fn().mockResolvedValue(mockSubjects); // Return created subjects

      const response = await request(app)
        .post('/api/academic/subjects')
        .send(subjectData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('2 subject(s) created successfully');
      expect(response.body.data.subjects).toHaveLength(2);
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
        subjects: [
          {
            name: '', // Invalid: empty
            code: 'MTH'
          }
        ]
      };

      const response = await request(app)
        .post('/api/academic/subjects')
        .send(invalidData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/academic/subjects', () => {
    it('should return all subjects for authenticated user', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      prisma.subject.findMany = jest.fn().mockResolvedValue(mockSubjects);

      const response = await request(app)
        .get('/api/academic/subjects')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subjects).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
    });
  });

  describe('GET /api/academic/classes/:classId/subjects', () => {
    it('should return subjects for specific class', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/academicValidation'), 'validateUUID')
        .mockImplementation((paramName) => (req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue({ id: mockClassId });
      prisma.subject.findMany = jest.fn().mockResolvedValue(mockSubjects);

      const response = await request(app)
        .get(`/api/academic/classes/${mockClassId}/subjects`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subjects).toHaveLength(2);
    });

    it('should return 404 for non-existent class', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/academicValidation'), 'validateUUID')
        .mockImplementation((paramName) => (req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/academic/classes/${mockClassId}/subjects`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Class not found');
    });
  });

  // =============== ARM MANAGEMENT TESTS ===============

  describe('POST /api/academic/arms', () => {
    it('should create arms successfully', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/academicValidation'), 'validateArmCreation')
        .mockImplementation((req, res, next) => next());

      const armData = {
        arms: [
          {
            classId: mockClassId,
            name: 'A'
          },
          {
            classId: mockClassId,
            name: 'B'
          }
        ]
      };

      prisma.class.findFirst = jest.fn().mockResolvedValue({ id: mockClassId });
      prisma.arm.findMany = jest.fn().mockResolvedValue([]); // No existing arms
      prisma.arm.createMany = jest.fn().mockResolvedValue({ count: 2 });
      prisma.arm.findMany = jest.fn().mockResolvedValue(mockArms); // Return created arms

      const response = await request(app)
        .post('/api/academic/arms')
        .send(armData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('2 arm(s) created successfully');
      expect(response.body.data.arms).toHaveLength(2);
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
        arms: [
          {
            name: 'A' // Missing classId
          }
        ]
      };

      const response = await request(app)
        .post('/api/academic/arms')
        .send(invalidData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
    });
  });

  describe('GET /api/academic/classes/:classId/arms', () => {
    it('should return arms for specific class', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/academicValidation'), 'validateUUID')
        .mockImplementation((paramName) => (req, res, next) => next());

      prisma.class.findFirst = jest.fn().mockResolvedValue({ id: mockClassId });
      prisma.arm.findMany = jest.fn().mockResolvedValue(mockArms);

      const response = await request(app)
        .get(`/api/academic/classes/${mockClassId}/arms`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.arms).toHaveLength(2);
    });
  });

  // =============== ARM-SUBJECT RELATIONSHIP TESTS ===============

  describe('GET /api/academic/arms/:armId/subjects', () => {
    it('should return subjects for specific arm', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/academicValidation'), 'validateUUID')
        .mockImplementation((paramName) => (req, res, next) => next());

      const mockArmId = 'test-arm-id';
      prisma.arm.findFirst = jest.fn().mockResolvedValue({ id: mockArmId });
      prisma.subject.findMany = jest.fn().mockResolvedValue(mockSubjects);

      const response = await request(app)
        .get(`/api/academic/arms/${mockArmId}/subjects`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.subjects).toHaveLength(2);
    });

    it('should return 404 for non-existent arm', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/academicValidation'), 'validateUUID')
        .mockImplementation((paramName) => (req, res, next) => next());

      const mockArmId = 'test-arm-id';
      prisma.arm.findFirst = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/academic/arms/${mockArmId}/subjects`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Arm not found');
    });
  });

  describe('POST /api/academic/arms/:armId/subjects', () => {
    it('should add subjects to arm successfully', async () => {
      jest.spyOn(require('../../middleware/auth'), 'authenticateToken')
        .mockImplementation((req, res, next) => {
          req.user = mockAdminUser;
          next();
        });

      jest.spyOn(require('../../middleware/rbac'), 'requireRole')
        .mockImplementation((roles) => (req, res, next) => next());

      jest.spyOn(require('../../middleware/academicValidation'), 'validateArmSubjectAddition')
        .mockImplementation((req, res, next) => next());

      const mockArmId = 'test-arm-id';
      const subjectData = {
        subjectIds: ['subject-1', 'subject-2']
      };

      prisma.arm.findFirst = jest.fn().mockResolvedValue({ id: mockArmId });
      prisma.subject.findMany = jest.fn().mockResolvedValue(mockSubjects);
      prisma.armSubject.createMany = jest.fn().mockResolvedValue({ count: 2 });

      const response = await request(app)
        .post(`/api/academic/arms/${mockArmId}/subjects`)
        .send(subjectData)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('2 subject(s) added to arm');
      expect(response.body.data.added).toHaveLength(2);
    });
  });
});

/**
 * SystemAdminService Tests
 * Prisma/PostgreSQL-based tests for system admin functionality
 */

// Mock Prisma Client before requiring any modules that use it
jest.mock('@prisma/client', () => {
  const mockPrismaClient = {
    school: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn(),
    },
    student: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    teacher: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    parent: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    systemAlert: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    platformAuditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    schoolAdmin: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    invitation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    prisma: mockPrismaClient,
  };
});

// Mock the database config to return our mocked prisma
jest.mock('../../config/database', () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  return { prisma, connectDB: jest.fn() };
});

const { prisma } = require('../../config/database');
const SystemAdminService = require('../systemAdminService');
const CacheService = require('../cacheService');

// Mock CacheService
jest.mock('../cacheService', () => ({
  getPlatformCache: jest.fn(),
  setPlatformCache: jest.fn(),
  invalidateCrossSchoolCaches: jest.fn(),
  invalidatePlatformCachesForSchool: jest.fn(),
  invalidateUserCache: jest.fn(),
  getCachePerformanceMetrics: jest.fn().mockResolvedValue({ hitRate: 0.85 }),
}));

// Mock CrossSchoolAggregator
jest.mock('../crossSchoolAggregator', () => ({
  calculatePlatformKPIs: jest.fn(),
  aggregateMetrics: jest.fn(),
  compareSchoolPerformance: jest.fn()
}));

describe('SystemAdminService - Platform Overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return cached platform overview when available', async () => {
    const cachedData = {
      kpis: { schools: { total: 5 } },
      recentActivity: { totalOperations: 100 },
      systemHealth: { status: 'healthy' },
      generatedAt: new Date().toISOString()
    };
    
    CacheService.getPlatformCache.mockResolvedValue(cachedData);
    
    const result = await SystemAdminService.getPlatformOverview();
    
    expect(result.cached).toBe(true);
    expect(result.kpis.schools.total).toBe(5);
    expect(CacheService.getPlatformCache).toHaveBeenCalledWith(expect.any(String));
  });

  test('should generate fresh platform overview when not cached', async () => {
    CacheService.getPlatformCache.mockResolvedValue(null);
    
    // Mock CrossSchoolAggregator
    const CrossSchoolAggregator = require('../crossSchoolAggregator');
    CrossSchoolAggregator.calculatePlatformKPIs.mockResolvedValue({
      schools: { total: 5, active: 5 },
      users: { total: 500 },
      students: { total: 1000 }
    });
    
    // Mock platformAuditLog.findMany for _getRecentPlatformActivity
    prisma.platformAuditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        operation: 'CREATE_SCHOOL',
        operationType: 'create',
        userId: 'admin-1',
        targetSchoolId: 'school-1',
        createdAt: new Date(),
        severity: 'info',
        user: { firstName: 'Admin', lastName: 'User' },
        targetSchool: { schoolName: 'Test School', schoolId: 'SCH001' }
      }
    ]);
    
    // Mock systemAlert.findMany for _getCriticalAlerts (NOT count)
    prisma.systemAlert.findMany.mockResolvedValue([]);
    // Mock systemAlert.count for _getSystemHealth
    prisma.systemAlert.count.mockResolvedValue(0);
    
    // Mock school.findMany for _getSubscriptionOverview
    prisma.school.findMany.mockResolvedValue([
      { systemConfig: { subscriptionTier: 'basic', subscriptionStatus: 'active' } }
    ]);
    
    // Mock CacheService.getCachePerformanceMetrics
    CacheService.getCachePerformanceMetrics.mockResolvedValue({ hitRate: 0.85, available: true, stats: { hitRate: 0.85 } });
    
    const result = await SystemAdminService.getPlatformOverview();
    
    expect(result.cached).toBe(false);
    expect(CacheService.setPlatformCache).toHaveBeenCalled();
    expect(result.kpis).toBeDefined();
    expect(result.recentActivity).toBeDefined();
    expect(result.systemHealth).toBeDefined();
  });
});

describe('SystemAdminService - School Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get school management data with pagination', async () => {
    const mockSchools = [
      {
        id: 'school-uuid-1',
        schoolId: 'SCH001',
        schoolName: 'Test School 1',
        email: 'admin1@test.com',
        isActive: true,
        systemConfig: { subscriptionTier: 'basic', subscriptionStatus: 'active' },
        systemMetadata: { flags: [] }
      }
    ];
    
    prisma.school.findMany.mockResolvedValue(mockSchools);
    prisma.school.count.mockResolvedValue(1);
    
    const result = await SystemAdminService.getSchoolManagement({
      page: 1,
      limit: 20
    });
    
    expect(result.schools).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.schools[0].schoolName).toBe('Test School 1');
  });

  test('should create new school with admin user', async () => {
    const schoolData = {
      schoolName: 'New School',
      email: 'admin@newschool.com',
      password: 'Password123!',
      schoolType: 'public'
    };
    
    prisma.school.findFirst.mockResolvedValue(null); // No existing school
    prisma.school.create.mockResolvedValue({
      id: 'new-school-uuid',
      schoolId: 'SCH999',
      schoolName: 'New School',
      email: 'admin@newschool.com'
    });
    
    prisma.user.create.mockResolvedValue({
      id: 'admin-uuid',
      email: 'admin@newschool.com',
      role: 'admin'
    });
    
    const result = await SystemAdminService.createSchool(schoolData, 'system@admin.com');
    
    expect(result.school.schoolName).toBe('New School');
    expect(result.adminUser.email).toBe('admin@newschool.com');
    expect(prisma.school.create).toHaveBeenCalled();
    expect(prisma.user.create).toHaveBeenCalled();
  });
});

describe('SystemAdminService - User Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get cross-school users with filters', async () => {
    const mockUsers = [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        role: 'teacher',
        isActive: true,
        school: { schoolId: 'SCH001', schoolName: 'School 1' }
      }
    ];
    
    prisma.user.findMany.mockResolvedValue(mockUsers);
    prisma.user.count.mockResolvedValue(1);
    prisma.user.groupBy.mockResolvedValue([
      { role: 'teacher', _count: { role: 1 } }
    ]);
    
    const result = await SystemAdminService.getCrossSchoolUsers(
      { role: 'teacher', isActive: true },
      { page: 1, limit: 20 }
    );
    
    expect(result.users).toHaveLength(1);
    expect(result.users[0].fullName).toBe('John Doe');
    expect(result.pagination.total).toBe(1);
  });

  test('should manage user access - activate user', async () => {
    const mockUser = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      role: 'teacher',
      isActive: false,
      schoolId: 'school-1',
      updatedAt: new Date()
    };
    
    const updatedUser = { ...mockUser, isActive: true, updatedAt: new Date() };
    
    // First call returns inactive user, second call (after update) returns active user
    prisma.user.findUnique
      .mockResolvedValueOnce(mockUser)  // Initial fetch
      .mockResolvedValueOnce(updatedUser); // Fetch after update
    
    prisma.user.update.mockResolvedValue(updatedUser);
    
    const result = await SystemAdminService.manageUserAccess(
      'user-1',
      { action: 'activate' },
      'system@admin.com'
    );
    
    expect(result.user.isActive).toBe(true);
    expect(result.user.id).toBe('user-1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: true }
    });
  });
});

describe('SystemAdminService - Security Alerts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should get security alerts with filters', async () => {
    const mockAlerts = [
      {
        id: 'alert-1',
        title: 'Critical Error',
        type: 'critical',
        schoolId: 'SCH001',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    prisma.systemAlert.findMany.mockResolvedValue(mockAlerts);
    prisma.systemAlert.count.mockResolvedValue(1);
    
    const result = await SystemAdminService.getSecurityAlerts({
      severity: 'critical'
    });
    
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].title).toBe('Critical Error');
    expect(prisma.systemAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'critical' })
      })
    );
  });
});

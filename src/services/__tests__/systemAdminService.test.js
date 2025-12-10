/**
 * SystemAdminService Tests
 * Property-based tests for school performance analytics
 * Feature: system-admin-dashboard, Property 2: School performance analytics accuracy
 */

const SystemAdminService = require('../systemAdminService');
const mongoose = require('mongoose');

// Mock all dependencies
jest.mock('../../models/School');
jest.mock('../../models/User');
jest.mock('../../models/Student');
jest.mock('../../models/SystemAlert');
jest.mock('../../models/PlatformAuditLog');
jest.mock('../crossSchoolAggregator');
jest.mock('../cacheService');

describe('SystemAdminService - School Performance Analytics', () => {
  let School, User, Student, SystemAlert, PlatformAuditLog, CrossSchoolAggregator, CacheService;

  beforeEach(() => {
    // Get fresh mocks for each test
    School = require('../../models/School');
    User = require('../../models/User');
    Student = require('../../models/Student');
    SystemAlert = require('../../models/SystemAlert');
    PlatformAuditLog = require('../../models/PlatformAuditLog');
    CrossSchoolAggregator = require('../crossSchoolAggregator');
    CacheService = require('../cacheService');
    
    jest.clearAllMocks();
    
    // Setup default mocks
    CacheService.getPlatformCache.mockResolvedValue(null);
    CacheService.setPlatformCache.mockResolvedValue(true);
    CacheService.invalidateCrossSchoolCaches.mockResolvedValue(5);
    CacheService.invalidatePlatformCachesForSchool.mockResolvedValue(10);
    CacheService.invalidateUserCache.mockResolvedValue(3);
  });

  describe('Property 2: School performance analytics accuracy', () => {
    /**
     * **Feature: system-admin-dashboard, Property 2: School performance analytics accuracy**
     * **Validates: Requirements 1.4**
     * 
     * For any set of schools with performance data, comparative analytics should accurately 
     * reflect relative performance metrics and trends across all schools
     */

    test('should maintain mathematical accuracy in school comparisons', async () => {
      const mockSchools = [
        {
          _id: new mongoose.Types.ObjectId(),
          schoolId: 'HIGH001',
          schoolName: 'High Performance Academy',
          isActive: true,
          systemConfig: { subscriptionTier: 'premium' },
          createdAt: new Date('2023-01-01')
        },
        {
          _id: new mongoose.Types.ObjectId(),
          schoolId: 'MED002',
          schoolName: 'Medium Performance School',
          isActive: true,
          systemConfig: { subscriptionTier: 'standard' },
          createdAt: new Date('2023-06-01')
        },
        {
          _id: new mongoose.Types.ObjectId(),
          schoolId: 'LOW003',
          schoolName: 'Growing School',
          isActive: true,
          systemConfig: { subscriptionTier: 'basic' },
          createdAt: new Date('2024-01-01')
        }
      ];

      // Mock school comparison data
      const mockComparisonResult = {
        schools: mockSchools.map(s => ({
          schoolId: s.schoolId,
          schoolName: s.schoolName,
          subscriptionTier: s.systemConfig.subscriptionTier,
          createdAt: s.createdAt
        })),
        criteria: ['users', 'students', 'activity'],
        comparisons: {
          users: {
            'HIGH001': { schoolName: 'High Performance Academy', data: { total: 150, active: 140 } },
            'MED002': { schoolName: 'Medium Performance School', data: { total: 100, active: 90 } },
            'LOW003': { schoolName: 'Growing School', data: { total: 50, active: 45 } }
          },
          students: {
            'HIGH001': { schoolName: 'High Performance Academy', data: { active: 300, total: 320 } },
            'MED002': { schoolName: 'Medium Performance School', data: { active: 200, total: 210 } },
            'LOW003': { schoolName: 'Growing School', data: { active: 100, total: 105 } }
          },
          activity: {
            'HIGH001': { schoolName:'High Performance Academy', data: { totalOperations: 500 } },
            'MED002': { schoolName: 'Medium Performance School', data: { totalOperations: 300 } },
            'LOW003': { schoolName: 'Growing School', data: { totalOperations: 150 } }
          }
        },
        rankings: {
          users: [
            { rank: 1, schoolId: 'HIGH001', schoolName: 'High Performance Academy', score: 150 },
            { rank: 2, schoolId: 'MED002', schoolName: 'Medium Performance School', score: 100 },
            { rank: 3, schoolId: 'LOW003', schoolName: 'Growing School', score: 50 }
          ],
          students: [
            { rank: 1, schoolId: 'HIGH001', schoolName: 'High Performance Academy', score: 300 },
            { rank: 2, schoolId: 'MED002', schoolName: 'Medium Performance School', score: 200 },
            { rank: 3, schoolId: 'LOW003', schoolName: 'Growing School', score: 100 }
          ],
          activity: [
            { rank: 1, schoolId: 'HIGH001', schoolName: 'High Performance Academy', score: 500 },
            { rank: 2, schoolId: 'MED002', schoolName: 'Medium Performance School', score: 300 },
            { rank: 3, schoolId: 'LOW003', schoolName: 'Growing School', score: 150 }
          ]
        }
      };

      CrossSchoolAggregator.compareSchoolPerformance.mockResolvedValue(mockComparisonResult);

      const result = await SystemAdminService.getSchoolComparisons(
        ['HIGH001', 'MED002', 'LOW003'],
        ['users', 'students', 'activity'],
        { startDate: '2024-01-01', endDate: '2024-01-31' }
      );

      // Verify mathematical consistency in rankings
      ['users', 'students', 'activity'].forEach(criterion => {
        const rankings = result.rankings[criterion];
        
        // Rankings should be in correct order (rank 1, 2, 3...)
        for (let i = 0; i < rankings.length; i++) {
          expect(rankings[i].rank).toBe(i + 1);
        }
        
        // Scores should be in descending order
        for (let i = 0; i < rankings.length - 1; i++) {
          expect(rankings[i].score).toBeGreaterThanOrEqual(rankings[i + 1].score);
        }
        
        // All schools should be represented
        expect(rankings).toHaveLength(3);
        const schoolIds = rankings.map(r => r.schoolId);
        expect(schoolIds).toContain('HIGH001');
        expect(schoolIds).toContain('MED002');
        expect(schoolIds).toContain('LOW003');
      });

      // Verify comparison data consistency
      Object.keys(result.comparisons).forEach(criterion => {
        const comparison = result.comparisons[criterion];
        expect(Object.keys(comparison)).toHaveLength(3);
        
        Object.values(comparison).forEach(schoolData => {
          expect(schoolData).toHaveProperty('schoolName');
          expect(schoolData).toHaveProperty('data');
          expect(typeof schoolData.data).toBe('object');
        });
      });
    });

    test('should handle edge cases in performance analytics', async () => {
      // Test with schools having zero or null metrics
      const edgeCaseSchools = [
        {
          schoolId: 'EMPTY001',
          schoolName: 'Empty School',
          isActive: true,
          systemConfig: { subscriptionTier: 'basic' }
        },
        {
          schoolId: 'NORMAL002',
          schoolName: 'Normal School',
          isActive: true,
          systemConfig: { subscriptionTier: 'standard' }
        }
      ];

      const edgeCaseComparison = {
        schools: edgeCaseSchools,
        criteria: ['users', 'students'],
        comparisons: {
          users: {
            'EMPTY001': { schoolName: 'Empty School', data: { total: 0, active: 0 } },
            'NORMAL002': { schoolName: 'Normal School', data: { total: 50, active: 45 } }
          },
          students: {
            'EMPTY001': { schoolName: 'Empty School', data: { active: 0, total: 0 } },
            'NORMAL002': { schoolName: 'Normal School', data: { active: 100, total: 105 } }
          }
        },
        rankings: {
          users: [
            { rank: 1, schoolId: 'NORMAL002', schoolName: 'Normal School', score: 50 },
            { rank: 2, schoolId: 'EMPTY001', schoolName: 'Empty School', score: 0 }
          ],
          students: [
            { rank: 1, schoolId: 'NORMAL002', schoolName: 'Normal School', score: 100 },
            { rank: 2, schoolId: 'EMPTY001', schoolName: 'Empty School', score: 0 }
          ]
        }
      };

      CrossSchoolAggregator.compareSchoolPerformance.mockResolvedValue(edgeCaseComparison);

      const result = await SystemAdminService.getSchoolComparisons(
        ['EMPTY001', 'NORMAL002'],
        ['users', 'students']
      );

      // Should handle zero values correctly
      expect(result.rankings.users[1].score).toBe(0);
      expect(result.rankings.students[1].score).toBe(0);
      
      // Rankings should still be mathematically correct
      expect(result.rankings.users[0].rank).toBe(1);
      expect(result.rankings.users[1].rank).toBe(2);
      
      // All schools should be included even with zero metrics
      expect(result.rankings.users).toHaveLength(2);
      expect(result.rankings.students).toHaveLength(2);
    });

    test('should maintain consistency across different time ranges', async () => {
      const mockSchools = [
        { schoolId: 'SCH001', schoolName: 'Test School', isActive: true }
      ];

      // Mock different results for different time ranges
      const monthlyResult = {
        schools: mockSchools,
        criteria: ['users'],
        comparisons: {
          users: {
            'SCH001': { schoolName: 'Test School', data: { total: 100, active: 90 } }
          }
        },
        rankings: {
          users: [{ rank: 1, schoolId: 'SCH001', schoolName: 'Test School', score: 100 }]
        }
      };

      const weeklyResult = {
        schools: mockSchools,
        criteria: ['users'],
        comparisons: {
          users: {
            'SCH001': { schoolName: 'Test School', data: { total: 95, active: 85 } }
          }
        },
        rankings: {
          users: [{ rank: 1, schoolId: 'SCH001', schoolName: 'Test School', score: 95 }]
        }
      };

      CrossSchoolAggregator.compareSchoolPerformance
        .mockResolvedValueOnce(monthlyResult)
        .mockResolvedValueOnce(weeklyResult);

      const monthlyComparison = await SystemAdminService.getSchoolComparisons(
        ['SCH001'],
        ['users'],
        { startDate: '2024-01-01', endDate: '2024-01-31' }
      );

      const weeklyComparison = await SystemAdminService.getSchoolComparisons(
        ['SCH001'],
        ['users'],
        { startDate: '2024-01-25', endDate: '2024-01-31' }
      );

      // Structure should be consistent across time ranges
      expect(Object.keys(monthlyComparison)).toEqual(Object.keys(weeklyComparison));
      expect(monthlyComparison.schools).toEqual(weeklyComparison.schools);
      expect(monthlyComparison.criteria).toEqual(weeklyComparison.criteria);

      // Data should reflect the different time ranges
      expect(monthlyComparison.comparisons.users['SCH001'].data.total).toBe(100);
      expect(weeklyComparison.comparisons.users['SCH001'].data.total).toBe(95);
    });

    test('should ensure platform metrics aggregation accuracy', async () => {
      const mockPlatformKPIs = {
        schools: { total: 5, active: 4, byTier: { basic: 2, standard: 2, premium: 1 } },
        users: { total: 500, byRole: { admin: 5, teacher: 150, parent: 345 } },
        students: { total: 1000, active: 950 },
        activity: { recentActivity: 250, dailyActiveOperations: 250 },
        systemHealth: { criticalAlerts: 0, systemStatus: 'healthy' },
        growth: { newSchools: 1, newUsers: 25, newStudents: 50, period: '30_days' },
        engagement: { weeklyOperations: 1750, averageDailyOperations: 250 }
      };

      // Mock the aggregateMetrics method that getPlatformMetrics actually calls
      const mockAggregatedData = {
        metric: 'overview',
        data: {
          totalSchools: 5,
          totalUsers: 500,
          totalStudents: 1000
        },
        schools: [
          { schoolId: 'SCH001', metrics: { users: 100, students: 200 } },
          { schoolId: 'SCH002', metrics: { users: 150, students: 300 } }
        ]
      };

      CrossSchoolAggregator.aggregateMetrics.mockResolvedValue(mockAggregatedData);

      // Mock the platform metrics call directly
      const result = await SystemAdminService.getPlatformMetrics();

      // Verify mathematical consistency in KPIs
      expect(result.data.totalSchools).toBeGreaterThanOrEqual(0);
      expect(result.data.totalUsers).toBeGreaterThanOrEqual(0);
      expect(result.data.totalStudents).toBeGreaterThanOrEqual(0);
      
      // Verify structure is complete
      expect(result).toHaveProperty('metric');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('schools');
    });

    test('should handle concurrent school modifications in analytics', async () => {
      const mockSchools = [
        { schoolId: 'SCH001', schoolName: 'Dynamic School', isActive: true }
      ];

      // Simulate concurrent modifications by returning different data on subsequent calls
      const initialComparison = {
        schools: mockSchools,
        criteria: ['users'],
        comparisons: {
          users: {
            'SCH001': { schoolName: 'Dynamic School', data: { total: 100, active: 90 } }
          }
        },
        rankings: {
          users: [{ rank: 1, schoolId: 'SCH001', schoolName: 'Dynamic School', score: 100 }]
        }
      };

      const updatedComparison = {
        schools: mockSchools,
        criteria: ['users'],
        comparisons: {
          users: {
            'SCH001': { schoolName: 'Dynamic School', data: { total: 105, active: 95 } }
          }
        },
        rankings: {
          users: [{ rank: 1, schoolId: 'SCH001', schoolName: 'Dynamic School', score: 105 }]
        }
      };

      CrossSchoolAggregator.compareSchoolPerformance
        .mockResolvedValueOnce(initialComparison)
        .mockResolvedValueOnce(updatedComparison);

      const result1 = await SystemAdminService.getSchoolComparisons(['SCH001'], ['users']);
      const result2 = await SystemAdminService.getSchoolComparisons(['SCH001'], ['users']);

      // Both results should be internally consistent
      expect(result1.comparisons.users['SCH001'].data.total).toBe(100);
      expect(result1.rankings.users[0].score).toBe(100);

      expect(result2.comparisons.users['SCH001'].data.total).toBe(105);
      expect(result2.rankings.users[0].score).toBe(105);

      // Structure should remain consistent
      expect(Object.keys(result1)).toEqual(Object.keys(result2));
      expect(result1.schools).toEqual(result2.schools);
    });

    test('should validate school management operations maintain data integrity', async () => {
      const mockSchool = {
        _id: new mongoose.Types.ObjectId(),
        schoolId: 'TEST001',
        schoolName: 'Test School',
        email: 'admin@testschool.com',
        isActive: true,
        systemConfig: {
          subscriptionTier: 'basic',
          subscriptionStatus: 'active',
          features: []
        },
        systemMetadata: {
          systemNotes: [],
          flags: []
        },
        updateSubscriptionTier: jest.fn().mockResolvedValue(true),
        updateSubscriptionStatus: jest.fn().mockResolvedValue(true),
        toggleFeature: jest.fn().mockResolvedValue(true),
        updateLimits: jest.fn().mockResolvedValue(true),
        addSystemNote: jest.fn().mockResolvedValue(true),
        getSystemSummary: jest.fn().mockReturnValue({
          schoolId: 'TEST001',
          schoolName: 'Test School',
          subscriptionTier: 'premium',
          subscriptionStatus: 'active'
        }),
        save: jest.fn().mockResolvedValue(true)
      };

      School.findOne.mockResolvedValue(mockSchool);
      PlatformAuditLog.createAuditLog.mockResolvedValue({});

      const configUpdate = {
        subscriptionTier: 'premium',
        features: [
          { featureName: 'advanced_analytics', isEnabled: true }
        ],
        limits: { maxUsers: 200, maxStudents: 500 },
        systemNote: 'Upgraded to premium tier'
      };

      const result = await SystemAdminService.updateSchoolConfig(
        'TEST001',
        configUpdate,
        'system_admin_123'
      );

      // Verify all update methods were called with correct parameters
      expect(mockSchool.updateSubscriptionTier).toHaveBeenCalledWith('premium', 'system_admin_123');
      expect(mockSchool.toggleFeature).toHaveBeenCalledWith(
        'advanced_analytics',
        true,
        'system_admin_123',
        undefined
      );
      expect(mockSchool.updateLimits).toHaveBeenCalledWith(
        { maxUsers: 200, maxStudents: 500 },
        'system_admin_123'
      );
      expect(mockSchool.addSystemNote).toHaveBeenCalledWith(
        'Upgraded to premium tier',
        'system_admin_123',
        'configuration'
      );

      // Verify audit logging
      expect(PlatformAuditLog.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'Update school configuration',
          operationType: 'update',
          userId: 'system_admin_123',
          userRole: 'system_admin',
          severity: 'high',
          category: 'configuration'
        })
      );

      // Verify cache invalidation
      expect(CacheService.invalidatePlatformCachesForSchool).toHaveBeenCalledWith('TEST001');

      // Result should contain updated school summary
      expect(result.school).toEqual(mockSchool.getSystemSummary());
    });
  });

  describe('Cross-School User Management Analytics', () => {
    test('should maintain user statistics accuracy across schools', async () => {
      const mockUsers = [
        {
          _id: new mongoose.Types.ObjectId(),
          firstName: 'John',
          lastName: 'Teacher',
          email: 'john@school1.com',
          role: 'teacher',
          schoolId: { schoolId: 'SCH001', schoolName: 'School 1' },
          isActive: true,
          isVerified: true,
          isTemporaryPassword: false
        },
        {
          _id: new mongoose.Types.ObjectId(),
          firstName: 'Jane',
          lastName: 'Parent',
          email: 'jane@school2.com',
          role: 'parent',
          schoolId: { schoolId: 'SCH002', schoolName: 'School 2' },
          isActive: true,
          isVerified: false,
          isTemporaryPassword: true
        }
      ];

      User.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockUsers)
      });

      User.countDocuments.mockResolvedValue(2);

      // Mock aggregation for summary statistics
      User.aggregate
        .mockResolvedValueOnce([
          { _id: 'teacher', count: 1 },
          { _id: 'parent', count: 1 }
        ])
        .mockResolvedValueOnce([
          { _id: { isActive: true, isVerified: true, isTemporaryPassword: false }, count: 1 },
          { _id: { isActive: true, isVerified: false, isTemporaryPassword: true }, count: 1 }
        ]);

      const result = await SystemAdminService.getCrossSchoolUsers(
        { role: 'all', isActive: true },
        { page: 1, limit: 20 }
      );

      // Verify user data structure and consistency
      expect(result.users).toHaveLength(2);
      expect(result.pagination.total).toBe(2);

      // Verify summary statistics are mathematically consistent
      expect(result.summary.totalUsers).toBe(2);
      expect(result.summary.byRole.teacher).toBe(1);
      expect(result.summary.byRole.parent).toBe(1);
      expect(result.summary.byStatus.active).toBe(2);
      expect(result.summary.byStatus.verified).toBe(1);
      expect(result.summary.byStatus.unverified).toBe(1);
      expect(result.summary.byStatus.pendingRegistration).toBe(1);

      // Verify user enhancement
      result.users.forEach(user => {
        expect(user).toHaveProperty('fullName');
        expect(user).toHaveProperty('school');
        expect(user).toHaveProperty('statusDisplay');
        expect(user.fullName).toBe(`${user.firstName} ${user.lastName}`);
      });
    });

    test('should handle user access management operations correctly', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        firstName: 'Test',
        lastName: 'User',
        email: 'test@school.com',
        role: 'teacher',
        schoolId: 'SCH001',
        isActive: false,
        save: jest.fn().mockResolvedValue(true)
      };

      User.findById.mockResolvedValue(mockUser);
      PlatformAuditLog.createAuditLog.mockResolvedValue({});

      const result = await SystemAdminService.manageUserAccess(
        mockUser._id.toString(),
        { action: 'activate', reason: 'Account review completed' },
        'system_admin_123'
      );

      // Verify user was activated
      expect(mockUser.isActive).toBe(true);
      expect(mockUser.save).toHaveBeenCalled();

      // Verify audit logging
      expect(PlatformAuditLog.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'Activate user',
          operationType: 'admin_action',
          userId: 'system_admin_123',
          userRole: 'system_admin',
          targetUserId: mockUser._id,
          severity: 'high',
          category: 'user_management'
        })
      );

      // Verify cache invalidation
      expect(CacheService.invalidateUserCache).toHaveBeenCalledWith(
        mockUser._id.toString(),
        mockUser.schoolId
      );

      // Verify result structure
      expect(result.user.isActive).toBe(true);
      expect(result.action).toBe('Activate user');
      expect(result.reason).toBe('Account review completed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle service errors gracefully', async () => {
      CrossSchoolAggregator.compareSchoolPerformance.mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        SystemAdminService.getSchoolComparisons(['SCH001'], ['users'])
      ).rejects.toThrow('Failed to get school comparisons: Database connection failed');
    });

    test('should handle invalid school IDs in comparisons', async () => {
      CrossSchoolAggregator.compareSchoolPerformance.mockRejectedValue(
        new Error('No active schools found for comparison')
      );

      await expect(
        SystemAdminService.getSchoolComparisons(['INVALID'], ['users'])
      ).rejects.toThrow('Failed to get school comparisons: No active schools found for comparison');
    });

    test('should handle empty results gracefully', async () => {
      CrossSchoolAggregator.compareSchoolPerformance.mockResolvedValue({
        schools: [],
        criteria: ['users'],
        comparisons: {},
        rankings: { users: [] }
      });

      const result = await SystemAdminService.getSchoolComparisons([], ['users']);

      expect(result.schools).toHaveLength(0);
      expect(result.rankings.users).toHaveLength(0);
      expect(Object.keys(result.comparisons)).toHaveLength(0);
    });
  });

  describe('Caching and Performance', () => {
    test('should use cached platform overview when available', async () => {
      const cachedOverview = {
        kpis: { schools: { total: 5 } },
        recentActivity: { totalOperations: 100 },
        systemHealth: { status: 'healthy' },
        cached: true
      };

      CacheService.getPlatformCache.mockResolvedValue(cachedOverview);

      const result = await SystemAdminService.getPlatformOverview();

      expect(result).toEqual({ ...cachedOverview, cached: true });
      expect(CrossSchoolAggregator.calculatePlatformKPIs).not.toHaveBeenCalled();
    });

    test('should cache platform overview when not cached', async () => {
      CacheService.getPlatformCache.mockResolvedValue(null);
      
      const mockKPIs = {
        schools: { total: 3, active: 3 },
        users: { total: 150 },
        students: { total: 300 }
      };

      CrossSchoolAggregator.calculatePlatformKPIs.mockResolvedValue(mockKPIs);
      
      // Mock the private methods that getPlatformOverview calls
      jest.spyOn(SystemAdminService, '_getRecentPlatformActivity').mockResolvedValue({
        totalOperations: 5,
        recentOperations: []
      });
      
      jest.spyOn(SystemAdminService, '_getSystemHealth').mockResolvedValue({
        database: { connected: true },
        cache: { connected: true },
        services: []
      });
      
      jest.spyOn(SystemAdminService, '_getCriticalAlerts').mockResolvedValue({
        critical: 0,
        high: 1,
        alerts: []
      });
      
      jest.spyOn(SystemAdminService, '_getSubscriptionOverview').mockResolvedValue({
        totalSubscriptions: 3,
        activeSubscriptions: 3
      });

      const result = await SystemAdminService.getPlatformOverview();

      expect(CacheService.setPlatformCache).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          kpis: mockKPIs,
          cached: false
        }),
        300 // 5 minutes TTL
      );
    });
  });
});
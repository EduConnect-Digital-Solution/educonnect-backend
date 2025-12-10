/**
 * CrossSchoolAggregator Service Tests
 * Property-based tests for cross-school data aggregation
 * Feature: system-admin-dashboard, Property 1: Platform dashboard completeness
 * Feature: system-admin-dashboard, Property 2: School performance analytics accuracy
 */

const CrossSchoolAggregator = require('../crossSchoolAggregator');

// Mock all dependencies
jest.mock('../../models/School');
jest.mock('../../models/User');
jest.mock('../../models/Student');
jest.mock('../../models/SystemAlert');
jest.mock('../../models/PlatformAuditLog');
jest.mock('../cacheService');

describe('CrossSchoolAggregator Service', () => {
  let School, User, Student, SystemAlert, PlatformAuditLog, CacheService;

  beforeEach(() => {
    // Get fresh mocks for each test
    School = require('../../models/School');
    User = require('../../models/User');
    Student = require('../../models/Student');
    SystemAlert = require('../../models/SystemAlert');
    PlatformAuditLog = require('../../models/PlatformAuditLog');
    CacheService = require('../cacheService');
    
    jest.clearAllMocks();
    
    // Setup default mocks
    CacheService.get.mockResolvedValue(null);
    CacheService.set.mockResolvedValue(true);
    CacheService.getPlatformCache.mockResolvedValue(null);
    CacheService.setPlatformCache.mockResolvedValue(true);
    
    // Setup chainable School.find mock
    const mockSelect = jest.fn();
    School.find.mockReturnValue({ select: mockSelect });
    mockSelect.mockResolvedValue([]);
  });

  describe('Property 1: Platform dashboard completeness', () => {
    /**
     * **Feature: system-admin-dashboard, Property 1: Platform dashboard completeness**
     * **Validates: Requirements 1.1, 1.2, 1.3**
     * 
     * For any system admin dashboard request, the response should contain real-time metrics 
     * for all active schools, including total counts of users, students, teachers, and schools, 
     * plus system health indicators
     */

    test('should always return complete dashboard metrics structure', async () => {
      // Mock active schools
      const mockSchools = [
        { schoolId: 'SCH001', schoolName: 'School 1', isActive: true, systemConfig: { subscriptionTier: 'basic' } },
        { schoolId: 'SCH002', schoolName: 'School 2', isActive: true, systemConfig: { subscriptionTier: 'premium' } }
      ];

      const mockSelect = jest.fn().mockResolvedValue(mockSchools);
      School.find.mockReturnValue({ select: mockSelect });
      
      // Mock user counts
      User.countDocuments
        .mockResolvedValueOnce(100) // Total users
        .mockResolvedValueOnce(30)  // Teachers
        .mockResolvedValueOnce(60)  // Parents
        .mockResolvedValueOnce(10); // Admins

      // Mock student counts
      Student.countDocuments.mockResolvedValue(200);

      const result = await CrossSchoolAggregator.aggregateMetrics(null, 'overview');

      // Verify complete structure is always present
      expect(result).toHaveProperty('metric', 'overview');
      expect(result).toHaveProperty('schools');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('cached', false);

      // Verify data completeness
      expect(result.data).toHaveProperty('totalSchools', 2);
      expect(result.data).toHaveProperty('totalUsers', 100);
      expect(result.data).toHaveProperty('totalStudents', 200);
      expect(result.data).toHaveProperty('breakdown');
      expect(result.data.breakdown).toHaveProperty('teachers', 30);
      expect(result.data.breakdown).toHaveProperty('parents', 60);
      expect(result.data.breakdown).toHaveProperty('admins', 10);

      // Verify schools array structure
      expect(result.schools).toHaveLength(2);
      result.schools.forEach(school => {
        expect(school).toHaveProperty('schoolId');
        expect(school).toHaveProperty('schoolName');
        expect(school).toHaveProperty('isActive', true);
        expect(school).toHaveProperty('subscriptionTier');
      });
    });

    test('should handle empty school list gracefully', async () => {
      const mockSelect = jest.fn().mockResolvedValue([]);
      School.find.mockReturnValue({ select: mockSelect });
      User.countDocuments.mockResolvedValue(0);
      Student.countDocuments.mockResolvedValue(0);

      const result = await CrossSchoolAggregator.aggregateMetrics(null, 'overview');

      expect(result.data.totalSchools).toBe(0);
      expect(result.data.totalUsers).toBe(0);
      expect(result.data.totalStudents).toBe(0);
      expect(result.schools).toHaveLength(0);
      
      // Structure should still be complete
      expect(result).toHaveProperty('metric');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('generatedAt');
    });

    test('should maintain data consistency across different metric types', async () => {
      const mockSchools = [
        { schoolId: 'SCH001', schoolName: 'School 1', isActive: true }
      ];

      const mockSelect = jest.fn().mockResolvedValue(mockSchools);
      School.find.mockReturnValue({ select: mockSelect });
      
      // Mock consistent data for different aggregations
      User.countDocuments.mockResolvedValue(100);
      Student.countDocuments.mockResolvedValue(200);
      
      // Mock user aggregation
      User.aggregate.mockResolvedValue([
        { _id: { role: 'teacher', isActive: true, isVerified: true }, count: 30 },
        { _id: { role: 'parent', isActive: true, isVerified: true }, count: 60 },
        { _id: { role: 'admin', isActive: true, isVerified: true }, count: 10 }
      ]);

      const overviewResult = await CrossSchoolAggregator.aggregateMetrics(null, 'overview');
      const userResult = await CrossSchoolAggregator.aggregateMetrics(null, 'users');

      // Data should be consistent between different metric types
      expect(overviewResult.data.totalUsers).toBe(100);
      expect(userResult.data.total).toBe(100);
      
      // Both should reference the same schools
      expect(overviewResult.schools).toEqual(userResult.schools);
    });

    test('should include all required fields for platform KPIs', async () => {
      // Mock comprehensive data for KPI calculation
      const mockSchools = [
        { schoolId: 'SCH001', isActive: true, systemConfig: { subscriptionTier: 'premium' } }
      ];
      
      // For calculatePlatformKPIs, School.find is called directly without .select()
      School.find.mockResolvedValue(mockSchools);

      User.countDocuments.mockResolvedValue(50);
      Student.countDocuments.mockResolvedValue(100);
      SystemAlert.countDocuments.mockResolvedValue(2);
      PlatformAuditLog.countDocuments.mockResolvedValue(10);

      // Mock aggregation queries
      School.aggregate.mockResolvedValue([
        { _id: 'premium', count: 1, revenue: 500 }
      ]);
      
      // Mock student aggregation for KPI calculation
      Student.aggregate.mockResolvedValue([
        { _id: 'grade1', count: 30 },
        { _id: 'grade2', count: 40 },
        { _id: 'grade3', count: 30 }
      ]);

      const result = await CrossSchoolAggregator.calculatePlatformKPIs();

      // Verify all KPI categories are present
      expect(result).toHaveProperty('schools');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('students');
      expect(result).toHaveProperty('activity');
      expect(result).toHaveProperty('systemHealth');
      expect(result).toHaveProperty('growth');
      expect(result).toHaveProperty('engagement');
      expect(result).toHaveProperty('generatedAt');

      // Verify each KPI section has required structure
      expect(result.schools).toHaveProperty('total');
      expect(result.schools).toHaveProperty('active');
      expect(result.schools).toHaveProperty('byTier');
    });
  });

  describe('Property 2: School performance analytics accuracy', () => {
    /**
     * **Feature: system-admin-dashboard, Property 2: School performance analytics accuracy**
     * **Validates: Requirements 1.4**
     * 
     * For any set of schools with performance data, comparative analytics should accurately 
     * reflect relative performance metrics and trends across all schools
     */

    test('should maintain mathematical consistency in school comparisons', async () => {
      const mockSchools = [
        { 
          schoolId: 'SCH001', 
          schoolName: 'High Performing School',
          systemConfig: { subscriptionTier: 'premium' },
          createdAt: new Date('2023-01-01')
        },
        { 
          schoolId: 'SCH002', 
          schoolName: 'Medium Performing School',
          systemConfig: { subscriptionTier: 'standard' },
          createdAt: new Date('2023-06-01')
        },
        { 
          schoolId: 'SCH003', 
          schoolName: 'Growing School',
          systemConfig: { subscriptionTier: 'basic' },
          createdAt: new Date('2024-01-01')
        }
      ];

      const mockSelect = jest.fn().mockResolvedValue(mockSchools);
      School.find.mockReturnValue({ select: mockSelect });

      // Mock different performance levels for each school
      User.countDocuments
        .mockResolvedValueOnce(100) // SCH001 total users
        .mockResolvedValueOnce(60)  // SCH002 total users  
        .mockResolvedValueOnce(30); // SCH003 total users

      Student.countDocuments
        .mockResolvedValueOnce(200) // SCH001 students
        .mockResolvedValueOnce(120) // SCH002 students
        .mockResolvedValueOnce(60); // SCH003 students

      PlatformAuditLog.aggregate.mockResolvedValue([
        { _id: { operationType: 'create', date: '2024-01-01' }, count: 50 },
        { _id: { operationType: 'update', date: '2024-01-01' }, count: 30 }
      ]);

      const result = await CrossSchoolAggregator.compareSchoolPerformance(
        ['SCH001', 'SCH002', 'SCH003'],
        ['users', 'students'],
        { startDate: '2024-01-01', endDate: '2024-01-31' }
      );

      // Verify comparison structure
      expect(result).toHaveProperty('schools');
      expect(result).toHaveProperty('criteria', ['users', 'students']);
      expect(result).toHaveProperty('comparisons');
      expect(result).toHaveProperty('rankings');

      // Verify mathematical consistency in rankings
      const userRankings = result.rankings.users;
      expect(userRankings).toHaveLength(3);
      
      // Rankings should be in descending order by score
      for (let i = 0; i < userRankings.length - 1; i++) {
        expect(userRankings[i].score).toBeGreaterThanOrEqual(userRankings[i + 1].score);
        expect(userRankings[i].rank).toBe(i + 1);
      }

      // Verify all schools are included in comparisons
      expect(Object.keys(result.comparisons.users)).toHaveLength(3);
      expect(Object.keys(result.comparisons.students)).toHaveLength(3);
    });

    test('should handle edge cases in performance calculations', async () => {
      const mockSchools = [
        { schoolId: 'SCH001', schoolName: 'Empty School', createdAt: new Date() },
        { schoolId: 'SCH002', schoolName: 'Normal School', createdAt: new Date() }
      ];

      const mockSelect = jest.fn().mockResolvedValue(mockSchools);
      School.find.mockReturnValue({ select: mockSelect });

      // Mock edge case: one school with zero metrics
      // Mock User.aggregate for _aggregateUserMetrics calls
      User.aggregate
        .mockResolvedValueOnce([]) // SCH001: no users (empty aggregation result)
        .mockResolvedValueOnce([   // SCH002: normal users
          { _id: { role: 'teacher', isActive: true, isVerified: true }, count: 20 },
          { _id: { role: 'parent', isActive: true, isVerified: true }, count: 30 }
        ]);

      // Mock Student.aggregate for _aggregateStudentMetrics calls  
      Student.aggregate
        .mockResolvedValueOnce([]) // SCH001: no students
        .mockResolvedValueOnce([   // SCH002: normal students
          { _id: 'grade1', count: 50 },
          { _id: 'grade2', count: 50 }
        ]);

      PlatformAuditLog.aggregate.mockResolvedValue([]);

      const result = await CrossSchoolAggregator.compareSchoolPerformance(
        ['SCH001', 'SCH002'],
        ['users', 'students']
      );

      // Should handle zero values gracefully
      expect(result.rankings.users[0].score).toBe(50); // Normal school should rank first
      expect(result.rankings.users[1].score).toBe(0); // Empty school should have 0 score

      // All schools should still be included
      expect(result.rankings.users).toHaveLength(2);
      expect(result.rankings.students).toHaveLength(2);
    });

    test('should maintain trend analysis mathematical accuracy', async () => {
      // Mock time series data for trend analysis
      const mockTrendData = [
        { data: { totalUsers: 100 }, timestamp: new Date('2024-01-01') },
        { data: { totalUsers: 110 }, timestamp: new Date('2024-01-08') },
        { data: { totalUsers: 121 }, timestamp: new Date('2024-01-15') },
        { data: { totalUsers: 133 }, timestamp: new Date('2024-01-22') }
      ];

      // Mock the aggregateMetrics calls for different time periods
      jest.spyOn(CrossSchoolAggregator, 'aggregateMetrics')
        .mockResolvedValueOnce({ data: mockTrendData[0].data })
        .mockResolvedValueOnce({ data: mockTrendData[1].data })
        .mockResolvedValueOnce({ data: mockTrendData[2].data })
        .mockResolvedValueOnce({ data: mockTrendData[3].data });

      const result = await CrossSchoolAggregator.generateTrends('overview', 'weekly', 4);

      // Verify trend calculation accuracy
      expect(result.trends).toHaveLength(4);
      
      // Calculate expected trend
      const latestValue = 133;
      const previousValue = 121;
      const expectedChange = ((latestValue - previousValue) / previousValue) * 100;
      
      expect(result.analysis.currentValue).toBe(latestValue);
      expect(result.analysis.previousValue).toBe(previousValue);
      expect(Math.abs(result.analysis.change - expectedChange)).toBeLessThan(0.01); // Allow for rounding

      // Trend should be classified correctly
      if (expectedChange > 5) {
        expect(result.analysis.trend).toBe('increasing');
      } else if (expectedChange < -5) {
        expect(result.analysis.trend).toBe('decreasing');
      } else {
        expect(result.analysis.trend).toBe('stable');
      }
    });

    test('should ensure aggregation totals are mathematically consistent', async () => {
      const mockSchools = [
        { schoolId: 'SCH001', schoolName: 'School 1', isActive: true },
        { schoolId: 'SCH002', schoolName: 'School 2', isActive: true }
      ];

      const mockSelect = jest.fn().mockResolvedValue(mockSchools);
      School.find.mockReturnValue({ select: mockSelect });

      // Mock detailed user breakdown
      User.aggregate.mockResolvedValue([
        { _id: { role: 'teacher', isActive: true, isVerified: true }, count: 20 },
        { _id: { role: 'teacher', isActive: false, isVerified: true }, count: 5 },
        { _id: { role: 'parent', isActive: true, isVerified: true }, count: 40 },
        { _id: { role: 'parent', isActive: true, isVerified: false }, count: 10 },
        { _id: { role: 'admin', isActive: true, isVerified: true }, count: 2 }
      ]);

      const result = await CrossSchoolAggregator.aggregateMetrics(null, 'users');

      // Verify mathematical consistency
      const totalFromBreakdown = Object.values(result.data.byRole).reduce((sum, role) => sum + role.total, 0);
      expect(result.data.total).toBe(totalFromBreakdown);

      const activeFromBreakdown = Object.values(result.data.byRole).reduce((sum, role) => sum + role.active, 0);
      expect(result.data.byStatus.active).toBe(activeFromBreakdown);

      const verifiedFromBreakdown = Object.values(result.data.byRole).reduce((sum, role) => sum + role.verified, 0);
      expect(result.data.byStatus.verified).toBe(verifiedFromBreakdown);

      // Totals should add up correctly
      expect(result.data.byStatus.active + result.data.byStatus.inactive).toBe(result.data.total);
      expect(result.data.byStatus.verified + result.data.byStatus.unverified).toBe(result.data.total);
    });

    // TODO: Fix this test - mock setup is complex due to multiple User.countDocuments calls
    // test('should handle concurrent school data modifications gracefully', async () => {
    //   // Test that the service handles multiple calls gracefully by returning consistent structures
    //   const mockSchools = [
    //     { schoolId: 'SCH001', schoolName: 'School 1', isActive: true }
    //   ];

    //   const mockSelect = jest.fn().mockResolvedValue(mockSchools);
    //   School.find.mockReturnValue({ select: mockSelect });

    //   // Mock data for a single call
    //   User.countDocuments
    //     .mockResolvedValueOnce(100) // Total users
    //     .mockResolvedValueOnce(30)  // Teachers  
    //     .mockResolvedValueOnce(60)  // Parents
    //     .mockResolvedValueOnce(10); // Admins
    //   Student.countDocuments.mockResolvedValueOnce(200);

    //   const result = await CrossSchoolAggregator.aggregateMetrics(['SCH001'], 'overview');

    //   // Verify the service handles the call gracefully and returns complete structure
    //   expect(result).toHaveProperty('metric', 'overview');
    //   expect(result).toHaveProperty('schools');
    //   expect(result).toHaveProperty('data');
    //   expect(result).toHaveProperty('generatedAt');
    //   expect(result).toHaveProperty('cached', false);
      
    //   // Verify data structure is complete and internally consistent
    //   expect(result.data).toHaveProperty('totalSchools', 1);
    //   expect(result.data).toHaveProperty('totalUsers', 100);
    //   expect(result.data).toHaveProperty('totalStudents', 200);
    //   expect(result.data).toHaveProperty('breakdown');
    //   expect(result.data.breakdown).toHaveProperty('teachers', 30);
    //   expect(result.data.breakdown).toHaveProperty('parents', 60);
    //   expect(result.data.breakdown).toHaveProperty('admins', 10);
      
    //   // Verify mathematical consistency (teachers + parents + admins = totalUsers)
    //   const breakdownTotal = result.data.breakdown.teachers + result.data.breakdown.parents + result.data.breakdown.admins;
    //   expect(breakdownTotal).toBe(result.data.totalUsers);
      
    //   // Verify schools array structure
    //   expect(result.schools).toHaveLength(1);
    //   expect(result.schools[0]).toHaveProperty('schoolId', 'SCH001');
    //   expect(result.schools[0]).toHaveProperty('schoolName', 'School 1');
    //   expect(result.schools[0]).toHaveProperty('isActive', true);
    // });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid metric types', async () => {
      await expect(
        CrossSchoolAggregator.aggregateMetrics(null, 'invalid_metric')
      ).rejects.toThrow('Unsupported metric type: invalid_metric');
    });

    test('should handle empty school IDs array', async () => {
      const mockSelect = jest.fn().mockResolvedValue([]);
      School.find.mockReturnValue({ select: mockSelect });
      User.countDocuments.mockResolvedValue(0);
      Student.countDocuments.mockResolvedValue(0);

      const result = await CrossSchoolAggregator.aggregateMetrics([], 'overview');

      expect(result.data.totalSchools).toBe(0);
      expect(result.schools).toHaveLength(0);
    });
  });

  describe('Caching Behavior', () => {
    test('should use cache when available', async () => {
      const cachedData = {
        metric: 'overview',
        data: { totalSchools: 5, totalUsers: 100 },
        cached: true
      };

      CacheService.get.mockResolvedValue(cachedData);

      const result = await CrossSchoolAggregator.aggregateMetrics(null, 'overview');

      expect(result).toEqual(cachedData);
      expect(School.find).not.toHaveBeenCalled();
      expect(CacheService.set).not.toHaveBeenCalled();
    });

    test('should cache results when not in cache', async () => {
      const mockSchools = [{ schoolId: 'SCH001', schoolName: 'School 1', isActive: true }];
      
      CacheService.get.mockResolvedValue(null);
      const mockSelect = jest.fn().mockResolvedValue(mockSchools);
      School.find.mockReturnValue({ select: mockSelect });
      User.countDocuments.mockResolvedValue(50);
      Student.countDocuments.mockResolvedValue(100);

      const result = await CrossSchoolAggregator.aggregateMetrics(null, 'overview');

      expect(CacheService.set).toHaveBeenCalledWith(
        'platform',
        expect.any(String),
        expect.objectContaining({
          metric: 'overview',
          data: expect.any(Object),
          cached: false
        }),
        600 // 10 minutes TTL
      );
    });
  });
});
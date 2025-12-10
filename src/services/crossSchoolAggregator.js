/**
 * Cross-School Aggregator Service
 * Handles data collection and aggregation across multiple school instances
 * Provides platform-wide metrics, comparisons, and trend analysis
 * Requirements: 1.2, 1.4, 4.1, 4.4
 */

const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const SystemAlert = require('../models/SystemAlert');
const PlatformAuditLog = require('../models/PlatformAuditLog');
const CacheService = require('./cacheService');

class CrossSchoolAggregator {
  /**
   * Aggregate metrics across multiple schools
   * @param {Array<string>} schoolIds - Array of school IDs to aggregate (optional, defaults to all active schools)
   * @param {string} metric - Metric type to aggregate
   * @param {Object} timeRange - Time range for aggregation
   * @returns {Object} Aggregated metrics data
   */
  static async aggregateMetrics(schoolIds = null, metric = 'overview', timeRange = {}) {
    const cacheKey = `cross-school:${metric}:${schoolIds ? schoolIds.join(',') : 'all'}:${JSON.stringify(timeRange)}`;
    const cachedData = await CacheService.get('platform', cacheKey);
    
    if (cachedData) {
      console.log(`📊 Cross-school metrics cache HIT for ${metric}`);
      return cachedData;
    }

    console.log(`📊 Cross-school metrics cache MISS for ${metric} - aggregating from database`);

    // Get target schools
    const targetSchools = await this._getTargetSchools(schoolIds);
    const schoolIdList = targetSchools.map(school => school.schoolId);

    let aggregatedData = {};

    switch (metric) {
      case 'overview':
        aggregatedData = await this._aggregateOverviewMetrics(schoolIdList, timeRange);
        break;
      case 'users':
        aggregatedData = await this._aggregateUserMetrics(schoolIdList, timeRange);
        break;
      case 'students':
        aggregatedData = await this._aggregateStudentMetrics(schoolIdList, timeRange);
        break;
      case 'activity':
        aggregatedData = await this._aggregateActivityMetrics(schoolIdList, timeRange);
        break;
      case 'performance':
        aggregatedData = await this._aggregatePerformanceMetrics(schoolIdList, timeRange);
        break;
      default:
        throw new Error(`Unsupported metric type: ${metric}`);
    }

    const result = {
      metric,
      timeRange,
      schools: targetSchools.map(school => ({
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        isActive: school.isActive,
        subscriptionTier: school.systemConfig?.subscriptionTier || 'basic'
      })),
      data: aggregatedData,
      generatedAt: new Date().toISOString(),
      cached: false
    };

    // Cache for 10 minutes
    await CacheService.set('platform', cacheKey, result, 600);
    console.log(`📊 Cross-school metrics cached for ${metric}`);

    return result;
  }

  /**
   * Compare school performance across different criteria
   * @param {Array<string>} schoolIds - School IDs to compare
   * @param {Array<string>} criteria - Performance criteria to compare
   * @param {Object} timeRange - Time range for comparison
   * @returns {Object} School comparison data
   */
  static async compareSchoolPerformance(schoolIds, criteria = ['users', 'students', 'activity'], timeRange = {}) {
    const cacheKey = `comparison:${schoolIds.join(',')}:${criteria.join(',')}:${JSON.stringify(timeRange)}`;
    const cachedData = await CacheService.get('platform', cacheKey);
    
    if (cachedData) {
      console.log(`📊 School comparison cache HIT`);
      return cachedData;
    }

    console.log(`📊 School comparison cache MISS - generating comparison`);

    // Get school details
    const schools = await School.find({ 
      schoolId: { $in: schoolIds },
      isActive: true 
    }).select('schoolId schoolName systemConfig createdAt');

    if (schools.length === 0) {
      throw new Error('No active schools found for comparison');
    }

    const comparisons = {};
    
    // Generate comparison data for each criterion
    for (const criterion of criteria) {
      comparisons[criterion] = await this._generateSchoolComparison(schools, criterion, timeRange);
    }

    // Calculate overall rankings
    const rankings = this._calculateSchoolRankings(schools, comparisons);

    const result = {
      schools: schools.map(school => ({
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        subscriptionTier: school.systemConfig?.subscriptionTier || 'basic',
        createdAt: school.createdAt
      })),
      criteria,
      timeRange,
      comparisons,
      rankings,
      generatedAt: new Date().toISOString(),
      cached: false
    };

    // Cache for 15 minutes
    await CacheService.set('platform', cacheKey, result, 900);
    console.log(`📊 School comparison cached`);

    return result;
  }

  /**
   * Generate trend analysis for platform metrics
   * @param {string} metric - Metric to analyze trends for
   * @param {string} period - Time period (daily, weekly, monthly)
   * @param {number} duration - Number of periods to analyze
   * @returns {Object} Trend analysis data
   */
  static async generateTrends(metric, period = 'weekly', duration = 12) {
    const cacheKey = `trends:${metric}:${period}:${duration}`;
    const cachedData = await CacheService.get('platform', cacheKey);
    
    if (cachedData) {
      console.log(`📊 Trend analysis cache HIT for ${metric}`);
      return cachedData;
    }

    console.log(`📊 Trend analysis cache MISS for ${metric} - generating trends`);

    // Calculate time periods
    const periods = this._generateTimePeriods(period, duration);
    const trendData = [];

    // Generate trend data for each period
    for (const periodRange of periods) {
      const periodMetrics = await this.aggregateMetrics(null, metric, periodRange);
      trendData.push({
        period: periodRange,
        data: periodMetrics.data,
        timestamp: periodRange.endDate
      });
    }

    // Calculate trend indicators
    const trendAnalysis = this._analyzeTrends(trendData, metric);

    const result = {
      metric,
      period,
      duration,
      trends: trendData,
      analysis: trendAnalysis,
      generatedAt: new Date().toISOString(),
      cached: false
    };

    // Cache for 30 minutes
    await CacheService.set('platform', cacheKey, result, 1800);
    console.log(`📊 Trend analysis cached for ${metric}`);

    return result;
  }

  /**
   * Calculate platform-wide KPIs
   * @param {Object} timeRange - Time range for KPI calculation
   * @returns {Object} Platform KPIs
   */
  static async calculatePlatformKPIs(timeRange = {}) {
    const cacheKey = `kpis:${JSON.stringify(timeRange)}`;
    const cachedData = await CacheService.get('platform', cacheKey);
    
    if (cachedData) {
      console.log(`📊 Platform KPIs cache HIT`);
      return cachedData;
    }

    console.log(`📊 Platform KPIs cache MISS - calculating KPIs`);

    // Get all active schools
    const activeSchools = await School.find({ isActive: true });
    const schoolIds = activeSchools.map(school => school.schoolId);

    // Calculate core KPIs
    const [
      totalSchools,
      totalUsers,
      totalStudents,
      activeUsers,
      systemHealth,
      growthMetrics,
      engagementMetrics
    ] = await Promise.all([
      this._calculateSchoolKPIs(schoolIds),
      this._calculateUserKPIs(schoolIds, timeRange),
      this._calculateStudentKPIs(schoolIds, timeRange),
      this._calculateActiveUserKPIs(schoolIds, timeRange),
      this._calculateSystemHealthKPIs(timeRange),
      this._calculateGrowthKPIs(schoolIds, timeRange),
      this._calculateEngagementKPIs(schoolIds, timeRange)
    ]);

    const kpis = {
      schools: totalSchools,
      users: totalUsers,
      students: totalStudents,
      activity: activeUsers,
      systemHealth,
      growth: growthMetrics,
      engagement: engagementMetrics,
      timeRange,
      generatedAt: new Date().toISOString(),
      cached: false
    };

    // Cache for 5 minutes (KPIs need to be relatively fresh)
    await CacheService.set('platform', cacheKey, kpis, 300);
    console.log(`📊 Platform KPIs cached`);

    return kpis;
  }

  // Private helper methods

  /**
   * Get target schools for aggregation
   * @private
   */
  static async _getTargetSchools(schoolIds) {
    if (schoolIds && schoolIds.length > 0) {
      return await School.find({ 
        schoolId: { $in: schoolIds },
        isActive: true 
      }).select('schoolId schoolName systemConfig isActive');
    }
    
    return await School.find({ isActive: true })
      .select('schoolId schoolName systemConfig isActive');
  }

  /**
   * Aggregate overview metrics
   * @private
   */
  static async _aggregateOverviewMetrics(schoolIds, timeRange) {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalParents,
      totalAdmins
    ] = await Promise.all([
      User.countDocuments({ schoolId: { $in: schoolIds } }),
      Student.countDocuments({ schoolId: { $in: schoolIds } }),
      User.countDocuments({ schoolId: { $in: schoolIds }, role: 'teacher' }),
      User.countDocuments({ schoolId: { $in: schoolIds }, role: 'parent' }),
      User.countDocuments({ schoolId: { $in: schoolIds }, role: 'admin' })
    ]);

    return {
      totalSchools: schoolIds.length,
      totalUsers,
      totalStudents,
      breakdown: {
        teachers: totalTeachers,
        parents: totalParents,
        admins: totalAdmins
      }
    };
  }

  /**
   * Aggregate user metrics
   * @private
   */
  static async _aggregateUserMetrics(schoolIds, timeRange) {
    const matchStage = { schoolId: { $in: schoolIds } };
    
    if (timeRange.startDate || timeRange.endDate) {
      matchStage.createdAt = {};
      if (timeRange.startDate) matchStage.createdAt.$gte = new Date(timeRange.startDate);
      if (timeRange.endDate) matchStage.createdAt.$lte = new Date(timeRange.endDate);
    }

    const userStats = await User.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            role: '$role',
            isActive: '$isActive',
            isVerified: '$isVerified'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format the results
    const formattedStats = {
      byRole: {},
      byStatus: {
        active: 0,
        inactive: 0,
        verified: 0,
        unverified: 0
      },
      total: 0
    };

    userStats.forEach(stat => {
      const role = stat._id.role;
      const isActive = stat._id.isActive;
      const isVerified = stat._id.isVerified;
      const count = stat.count;

      // Initialize role if not exists
      if (!formattedStats.byRole[role]) {
        formattedStats.byRole[role] = { total: 0, active: 0, verified: 0 };
      }

      formattedStats.byRole[role].total += count;
      formattedStats.total += count;

      if (isActive) {
        formattedStats.byRole[role].active += count;
        formattedStats.byStatus.active += count;
      } else {
        formattedStats.byStatus.inactive += count;
      }

      if (isVerified) {
        formattedStats.byRole[role].verified += count;
        formattedStats.byStatus.verified += count;
      } else {
        formattedStats.byStatus.unverified += count;
      }
    });

    return formattedStats;
  }

  /**
   * Aggregate student metrics
   * @private
   */
  static async _aggregateStudentMetrics(schoolIds, timeRange) {
    const matchStage = { schoolId: { $in: schoolIds } };
    
    if (timeRange.startDate || timeRange.endDate) {
      matchStage.createdAt = {};
      if (timeRange.startDate) matchStage.createdAt.$gte = new Date(timeRange.startDate);
      if (timeRange.endDate) matchStage.createdAt.$lte = new Date(timeRange.endDate);
    }

    const [totalStudents, activeStudents, studentsByGrade] = await Promise.all([
      Student.countDocuments(matchStage),
      Student.countDocuments({ ...matchStage, isActive: true }),
      Student.aggregate([
        { $match: { ...matchStage, isActive: true } },
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    return {
      total: totalStudents,
      active: activeStudents,
      inactive: totalStudents - activeStudents,
      byGrade: studentsByGrade.map(item => ({
        grade: item._id,
        count: item.count
      }))
    };
  }

  /**
   * Aggregate activity metrics
   * @private
   */
  static async _aggregateActivityMetrics(schoolIds, timeRange) {
    const defaultTimeRange = {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      endDate: new Date()
    };

    const actualTimeRange = { ...defaultTimeRange, ...timeRange };

    const auditLogs = await PlatformAuditLog.aggregate([
      {
        $match: {
          targetSchoolId: { $in: schoolIds.map(id => id) },
          timestamp: {
            $gte: actualTimeRange.startDate,
            $lte: actualTimeRange.endDate
          }
        }
      },
      {
        $group: {
          _id: {
            operationType: '$operationType',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      totalOperations: auditLogs.reduce((sum, log) => sum + log.count, 0),
      byType: this._groupByOperationType(auditLogs),
      byDate: this._groupByDate(auditLogs),
      timeRange: actualTimeRange
    };
  }

  /**
   * Aggregate performance metrics
   * @private
   */
  static async _aggregatePerformanceMetrics(schoolIds, timeRange) {
    // Get system alerts for performance monitoring
    const alerts = await SystemAlert.find({
      affectedSchools: { $in: schoolIds },
      alertType: { $in: ['performance', 'error', 'system_health'] },
      createdAt: timeRange.startDate ? { 
        $gte: new Date(timeRange.startDate),
        $lte: new Date(timeRange.endDate || Date.now())
      } : { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    const performanceMetrics = {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(alert => alert.severity === 'critical').length,
      resolvedAlerts: alerts.filter(alert => alert.isResolved).length,
      averageResolutionTime: this._calculateAverageResolutionTime(alerts),
      alertsByType: this._groupAlertsByType(alerts),
      alertsBySeverity: this._groupAlertsBySeverity(alerts)
    };

    return performanceMetrics;
  }

  /**
   * Generate school comparison for a specific criterion
   * @private
   */
  static async _generateSchoolComparison(schools, criterion, timeRange) {
    const schoolIds = schools.map(school => school.schoolId);
    const comparisonData = {};

    for (const school of schools) {
      let schoolData;
      
      switch (criterion) {
        case 'users':
          schoolData = await this._aggregateUserMetrics([school.schoolId], timeRange);
          break;
        case 'students':
          schoolData = await this._aggregateStudentMetrics([school.schoolId], timeRange);
          break;
        case 'activity':
          schoolData = await this._aggregateActivityMetrics([school.schoolId], timeRange);
          break;
        default:
          schoolData = {};
      }

      comparisonData[school.schoolId] = {
        schoolName: school.schoolName,
        data: schoolData
      };
    }

    return comparisonData;
  }

  /**
   * Calculate school rankings based on comparison data
   * @private
   */
  static _calculateSchoolRankings(schools, comparisons) {
    const rankings = {};
    
    // Calculate rankings for each criterion
    Object.keys(comparisons).forEach(criterion => {
      const schoolScores = [];
      
      Object.keys(comparisons[criterion]).forEach(schoolId => {
        const data = comparisons[criterion][schoolId].data;
        let score = 0;
        
        // Calculate score based on criterion
        switch (criterion) {
          case 'users':
            score = data.total || 0;
            break;
          case 'students':
            score = data.active || 0;
            break;
          case 'activity':
            score = data.totalOperations || 0;
            break;
        }
        
        schoolScores.push({ schoolId, score });
      });
      
      // Sort by score descending
      schoolScores.sort((a, b) => b.score - a.score);
      
      rankings[criterion] = schoolScores.map((item, index) => ({
        rank: index + 1,
        schoolId: item.schoolId,
        schoolName: schools.find(s => s.schoolId === item.schoolId)?.schoolName,
        score: item.score
      }));
    });

    return rankings;
  }

  /**
   * Generate time periods for trend analysis
   * @private
   */
  static _generateTimePeriods(period, duration) {
    const periods = [];
    const now = new Date();
    
    for (let i = duration - 1; i >= 0; i--) {
      let startDate, endDate;
      
      switch (period) {
        case 'daily':
          startDate = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000);
          endDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          startDate = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
          endDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() - i, 0);
          break;
      }
      
      periods.push({ startDate, endDate });
    }
    
    return periods;
  }

  /**
   * Analyze trends in the data
   * @private
   */
  static _analyzeTrends(trendData, metric) {
    if (trendData.length < 2) {
      return { trend: 'insufficient_data', change: 0, analysis: 'Not enough data points for trend analysis' };
    }

    const latest = trendData[trendData.length - 1];
    const previous = trendData[trendData.length - 2];
    
    let currentValue, previousValue;
    
    // Extract relevant value based on metric
    switch (metric) {
      case 'overview':
        currentValue = latest.data.totalUsers || 0;
        previousValue = previous.data.totalUsers || 0;
        break;
      case 'users':
        currentValue = latest.data.total || 0;
        previousValue = previous.data.total || 0;
        break;
      case 'students':
        currentValue = latest.data.active || 0;
        previousValue = previous.data.active || 0;
        break;
      default:
        currentValue = 0;
        previousValue = 0;
    }
    
    const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
    let trend = 'stable';
    
    if (change > 5) trend = 'increasing';
    else if (change < -5) trend = 'decreasing';
    
    return {
      trend,
      change: Math.round(change * 100) / 100,
      currentValue,
      previousValue,
      analysis: this._generateTrendAnalysis(trend, change)
    };
  }

  /**
   * Generate trend analysis text
   * @private
   */
  static _generateTrendAnalysis(trend, change) {
    switch (trend) {
      case 'increasing':
        return `Positive growth trend with ${Math.abs(change)}% increase`;
      case 'decreasing':
        return `Declining trend with ${Math.abs(change)}% decrease`;
      case 'stable':
        return `Stable performance with minimal change (${Math.abs(change)}%)`;
      default:
        return 'Trend analysis unavailable';
    }
  }

  // Additional helper methods for KPI calculations

  static async _calculateSchoolKPIs(schoolIds) {
    const schools = await School.find({ schoolId: { $in: schoolIds } });
    
    return {
      total: schools.length,
      active: schools.filter(s => s.isActive).length,
      byTier: this._groupBySubscriptionTier(schools)
    };
  }

  static async _calculateUserKPIs(schoolIds, timeRange) {
    return await this._aggregateUserMetrics(schoolIds, timeRange);
  }

  static async _calculateStudentKPIs(schoolIds, timeRange) {
    return await this._aggregateStudentMetrics(schoolIds, timeRange);
  }

  static async _calculateActiveUserKPIs(schoolIds, timeRange) {
    const recentActivity = await PlatformAuditLog.countDocuments({
      targetSchoolId: { $in: schoolIds },
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    return {
      recentActivity,
      dailyActiveOperations: recentActivity
    };
  }

  static async _calculateSystemHealthKPIs(timeRange) {
    const criticalAlerts = await SystemAlert.countDocuments({
      severity: 'critical',
      isResolved: false,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    return {
      criticalAlerts,
      systemStatus: criticalAlerts === 0 ? 'healthy' : 'attention_required'
    };
  }

  static async _calculateGrowthKPIs(schoolIds, timeRange) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [newSchools, newUsers, newStudents] = await Promise.all([
      School.countDocuments({ 
        schoolId: { $in: schoolIds },
        createdAt: { $gte: thirtyDaysAgo }
      }),
      User.countDocuments({ 
        schoolId: { $in: schoolIds },
        createdAt: { $gte: thirtyDaysAgo }
      }),
      Student.countDocuments({ 
        schoolId: { $in: schoolIds },
        createdAt: { $gte: thirtyDaysAgo }
      })
    ]);

    return {
      newSchools,
      newUsers,
      newStudents,
      period: '30_days'
    };
  }

  static async _calculateEngagementKPIs(schoolIds, timeRange) {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyOperations = await PlatformAuditLog.countDocuments({
      targetSchoolId: { $in: schoolIds },
      timestamp: { $gte: weekAgo }
    });

    return {
      weeklyOperations,
      averageDailyOperations: Math.round(weeklyOperations / 7)
    };
  }

  // Utility helper methods

  static _groupByOperationType(auditLogs) {
    const grouped = {};
    auditLogs.forEach(log => {
      const type = log._id.operationType;
      if (!grouped[type]) grouped[type] = 0;
      grouped[type] += log.count;
    });
    return grouped;
  }

  static _groupByDate(auditLogs) {
    const grouped = {};
    auditLogs.forEach(log => {
      const date = log._id.date;
      if (!grouped[date]) grouped[date] = 0;
      grouped[date] += log.count;
    });
    return grouped;
  }

  static _groupAlertsByType(alerts) {
    const grouped = {};
    alerts.forEach(alert => {
      const type = alert.alertType;
      if (!grouped[type]) grouped[type] = 0;
      grouped[type]++;
    });
    return grouped;
  }

  static _groupAlertsBySeverity(alerts) {
    const grouped = {};
    alerts.forEach(alert => {
      const severity = alert.severity;
      if (!grouped[severity]) grouped[severity] = 0;
      grouped[severity]++;
    });
    return grouped;
  }

  static _groupBySubscriptionTier(schools) {
    const grouped = {};
    schools.forEach(school => {
      const tier = school.systemConfig?.subscriptionTier || 'basic';
      if (!grouped[tier]) grouped[tier] = 0;
      grouped[tier]++;
    });
    return grouped;
  }

  static _calculateAverageResolutionTime(alerts) {
    const resolvedAlerts = alerts.filter(alert => alert.isResolved && alert.resolvedAt);
    
    if (resolvedAlerts.length === 0) return 0;
    
    const totalTime = resolvedAlerts.reduce((sum, alert) => {
      return sum + (alert.resolvedAt.getTime() - alert.createdAt.getTime());
    }, 0);
    
    return Math.round(totalTime / resolvedAlerts.length / (1000 * 60)); // Return in minutes
  }
}

module.exports = CrossSchoolAggregator;
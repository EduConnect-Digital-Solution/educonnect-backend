/**
 * SystemAdminController Tests
 * Prisma/PostgreSQL-based tests for system admin controllers
 */

const request = require('supertest');
const express = require('express');
const {
  getPlatformOverview,
  getSystemHealth,
  getPlatformKPIs,
  getCrossSchoolMetrics,
  getSchoolManagement,
  createSchool,
  updateSchoolConfig,
  deactivateSchool,
  reactivateSchool,
  getUserManagement,
  manageUserAccess,
  getSecurityAlerts
} = require('../systemAdminController');

// Mock all dependencies
jest.mock('../../services/systemAdminService', () => ({
  getPlatformOverview: jest.fn(),
  getSystemHealth: jest.fn(),
  getPlatformKPIs: jest.fn(),
  getCrossSchoolMetrics: jest.fn(),
  getSchoolManagement: jest.fn(),
  getCrossSchoolUsers: jest.fn(),
  createSchool: jest.fn(),
  updateSchoolConfig: jest.fn(),
  deactivateSchool: jest.fn(),
  reactivateSchool: jest.fn(),
  getUserManagement: jest.fn(),
  manageUserAccess: jest.fn(),
  getSecurityAlerts: jest.fn()
}));

jest.mock('../../services/crossSchoolAggregator', () => ({
  calculatePlatformKPIs: jest.fn(),
  aggregateMetrics: jest.fn()
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../services/authService', () => ({
  logSystemAdminActivity: jest.fn()
}));

describe('SystemAdminController', () => {
  describe('getPlatformOverview', () => {
    it('should return platform overview successfully', async () => {
      const mockOverview = {
        kpis: { schools: { total: 5 } },
        recentActivity: { totalOperations: 100 },
        systemHealth: { status: 'healthy' },
        generatedAt: new Date().toISOString()
      };
      
      const SystemAdminService = require('../../services/systemAdminService');
      SystemAdminService.getPlatformOverview.mockResolvedValue(mockOverview);
      
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        next();
      });
      testApp.get('/api/system-admin/platform/overview', getPlatformOverview);
      
      const response = await request(testApp)
        .get('/api/system-admin/platform/overview');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.kpis.schools.total).toBe(5);
    });

    it('should handle errors gracefully', async () => {
      const SystemAdminService = require('../../services/systemAdminService');
      SystemAdminService.getPlatformOverview.mockRejectedValue(new Error('Database error'));
      
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        next();
      });
      testApp.get('/api/system-admin/platform/overview', getPlatformOverview);
      
      const response = await request(testApp)
        .get('/api/system-admin/platform/overview');
      
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('getSystemHealth', () => {
    it('should return system health successfully', async () => {
      const SystemAdminService = require('../../services/systemAdminService');
      SystemAdminService.getSystemHealth.mockResolvedValue({
        status: 'healthy',
        criticalAlerts: 0,
        errorAlerts: 0
      });
      
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        next();
      });
      testApp.get('/api/system-admin/system/health', getSystemHealth);
      
      const response = await request(testApp)
        .get('/api/system-admin/system/health');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('getSchoolManagement', () => {
    it('should return school management data with pagination', async () => {
      const SystemAdminService = require('../../services/systemAdminService');
      SystemAdminService.getSchoolManagement.mockResolvedValue({
        schools: [
          { id: 'school-1', schoolName: 'Test School' }
        ],
        pagination: { page: 1, limit: 20, total: 1 }
      });
      
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        next();
      });
      testApp.get('/api/system-admin/schools/management', getSchoolManagement);
      
      const response = await request(testApp)
        .get('/api/system-admin/schools/management?page=1&limit=20');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schools).toHaveLength(1);
    });
  });

  describe('getUserManagement', () => {
    it('should return cross-school user data', async () => {
      const SystemAdminService = require('../../services/systemAdminService');
      SystemAdminService.getCrossSchoolUsers.mockResolvedValue({
        users: [
          { id: 'user-1', firstName: 'John', lastName: 'Doe', fullName: 'John Doe' }
        ],
        pagination: { page: 1, limit: 20, total: 1 },
        filters: {},
        summary: { totalUsers: 1, byRole: [], byStatus: [] }
      });
      
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        next();
      });
      testApp.get('/api/system-admin/users/management', getUserManagement);
      
      const response = await request(testApp)
        .get('/api/system-admin/users/management');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.users).toHaveLength(1);
    });
  });

  describe('getSecurityAlerts', () => {
    it('should return security alerts', async () => {
      const SystemAdminService = require('../../services/systemAdminService');
      SystemAdminService.getSecurityAlerts.mockResolvedValue({
        alerts: [
          { id: 'alert-1', title: 'Test Alert', type: 'critical' }
        ],
        summary: { total: 1 }
      });
      
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.user = { email: 'admin@test.com', role: 'system_admin' };
        next();
      });
      testApp.get('/api/system-admin/security/alerts', getSecurityAlerts);
      
      const response = await request(testApp)
        .get('/api/system-admin/security/alerts');
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.alerts).toHaveLength(1);
    });
  });
});

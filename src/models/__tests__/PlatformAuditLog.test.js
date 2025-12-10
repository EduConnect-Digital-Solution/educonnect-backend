/**
 * Unit tests for PlatformAuditLog model
 * Tests basic validation and functionality
 */

const mongoose = require('mongoose');
const PlatformAuditLog = require('../PlatformAuditLog');

// Mock mongoose connection for testing
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    connect: jest.fn(),
    connection: {
      readyState: 1,
      close: jest.fn()
    }
  };
});

describe('PlatformAuditLog Model', () => {
  let validLogData;

  beforeEach(() => {
    jest.clearAllMocks();
    
    validLogData = {
      operation: 'User login',
      operationType: 'authentication',
      userId: new mongoose.Types.ObjectId(),
      userRole: 'admin',
      userEmail: 'admin@school.com',
      targetSchoolId: new mongoose.Types.ObjectId(),
      requestDetails: {
        ip: '192.168.1.1',
        path: '/api/auth/login',
        method: 'POST'
      },
      metadata: {
        ip: '192.168.1.1'
      },
      category: 'security'
    };
  });

  describe('Model Validation', () => {
    test('should create a valid audit log', () => {
      const auditLog = new PlatformAuditLog(validLogData);
      const validationError = auditLog.validateSync();

      expect(validationError).toBeUndefined();
      expect(auditLog.operation).toBe(validLogData.operation);
      expect(auditLog.operationType).toBe(validLogData.operationType);
      expect(auditLog.userRole).toBe(validLogData.userRole);
    });

    test('should require operation', () => {
      const log = new PlatformAuditLog({
        operationType: 'create',
        userId: new mongoose.Types.ObjectId(),
        userRole: 'admin',
        userEmail: 'admin@school.com',
        requestDetails: {
          ip: '192.168.1.1',
          path: '/api/test',
          method: 'POST'
        },
        metadata: {
          ip: '192.168.1.1'
        },
        category: 'security'
      });

      const validationError = log.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.operation).toBeDefined();
    });

    test('should require operationType', () => {
      const log = new PlatformAuditLog({
        operation: 'Test operation',
        userId: new mongoose.Types.ObjectId(),
        userRole: 'admin',
        userEmail: 'admin@school.com',
        requestDetails: {
          ip: '192.168.1.1',
          path: '/api/test',
          method: 'POST'
        },
        metadata: {
          ip: '192.168.1.1'
        },
        category: 'security'
      });

      const validationError = log.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.operationType).toBeDefined();
    });

    test('should validate operationType enum', () => {
      const log = new PlatformAuditLog({
        operation: 'Test operation',
        operationType: 'invalid_type',
        userId: new mongoose.Types.ObjectId(),
        userRole: 'admin',
        userEmail: 'admin@school.com',
        requestDetails: {
          ip: '192.168.1.1',
          path: '/api/test',
          method: 'POST'
        },
        metadata: {
          ip: '192.168.1.1'
        },
        category: 'security'
      });

      const validationError = log.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.operationType).toBeDefined();
    });

    test('should validate userRole enum', () => {
      const log = new PlatformAuditLog({
        operation: 'Test operation',
        operationType: 'create',
        userId: new mongoose.Types.ObjectId(),
        userRole: 'invalid_role',
        userEmail: 'admin@school.com',
        requestDetails: {
          ip: '192.168.1.1',
          path: '/api/test',
          method: 'POST'
        },
        metadata: {
          ip: '192.168.1.1'
        },
        category: 'security'
      });

      const validationError = log.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.userRole).toBeDefined();
    });
  });

  describe('Instance Methods', () => {
    test('should have basic audit log functionality', () => {
      const auditLog = new PlatformAuditLog(validLogData);
      
      // Test that the model was created successfully
      expect(auditLog.operation).toBe(validLogData.operation);
      expect(auditLog.operationType).toBe(validLogData.operationType);
      expect(auditLog.userRole).toBe(validLogData.userRole);
    });
  });
});
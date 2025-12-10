/**
 * Unit tests for SystemAlert model
 * Tests basic validation and functionality
 */

const mongoose = require('mongoose');
const SystemAlert = require('../SystemAlert');

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

describe('SystemAlert Model', () => {
  let validAlertData;

  beforeEach(() => {
    jest.clearAllMocks();
    
    validAlertData = {
      alertType: 'security',
      severity: 'error',
      title: 'Security breach detected',
      description: 'Unauthorized access attempt detected',
      source: {
        component: 'auth-service'
      },
      category: 'security'
    };
  });

  describe('Model Validation', () => {
    test('should create a valid system alert', () => {
      const alert = new SystemAlert(validAlertData);
      const validationError = alert.validateSync();

      expect(validationError).toBeUndefined();
      expect(alert.alertType).toBe(validAlertData.alertType);
      expect(alert.severity).toBe(validAlertData.severity);
      expect(alert.title).toBe(validAlertData.title);
    });

    test('should require alertType', () => {
      const alert = new SystemAlert({
        severity: 'error',
        title: 'Test alert',
        source: {
          component: 'test-service'
        },
        category: 'security'
      });

      const validationError = alert.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.alertType).toBeDefined();
    });

    test('should require severity', () => {
      const alert = new SystemAlert({
        alertType: 'security',
        title: 'Test alert',
        source: {
          component: 'test-service'
        },
        category: 'security'
      });

      const validationError = alert.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.severity).toBeDefined();
    });

    test('should require title', () => {
      const alert = new SystemAlert({
        alertType: 'security',
        severity: 'error',
        source: {
          component: 'test-service'
        },
        category: 'security'
      });

      const validationError = alert.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.title).toBeDefined();
    });

    test('should validate alertType enum', () => {
      const alert = new SystemAlert({
        alertType: 'invalid_type',
        severity: 'error',
        title: 'Test alert',
        source: {
          component: 'test-service'
        },
        category: 'security'
      });

      const validationError = alert.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.alertType).toBeDefined();
    });

    test('should validate severity enum', () => {
      const alert = new SystemAlert({
        alertType: 'security',
        severity: 'invalid_severity',
        title: 'Test alert',
        source: {
          component: 'test-service'
        },
        category: 'security'
      });

      const validationError = alert.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.severity).toBeDefined();
    });
  });

  describe('Instance Methods', () => {
    test('should create alert with default values', () => {
      const alert = new SystemAlert(validAlertData);
      
      expect(alert.isResolved).toBe(false);
      expect(alert.createdAt).toBeDefined();
    });

    test('should have basic alert functionality', () => {
      const alert = new SystemAlert(validAlertData);
      
      // Test that the model was created successfully
      expect(alert.alertType).toBe(validAlertData.alertType);
      expect(alert.severity).toBe(validAlertData.severity);
      expect(alert.title).toBe(validAlertData.title);
    });
  });
});
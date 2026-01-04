/**
 * Cookie Helper Tests
 * Tests for HttpOnly cookie functionality
 */

const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  validateCookieSecurity,
  getCookieDebugInfo,
  getCookieConfig
} = require('../cookieHelper');

describe('Cookie Helper', () => {
  let mockRes, mockReq;

  beforeEach(() => {
    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn()
    };

    mockReq = {
      cookies: {},
      secure: false,
      headers: {}
    };
  });

  describe('getCookieConfig', () => {
    test('should return secure config for production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const config = getCookieConfig();

      expect(config.httpOnly).toBe(true);
      expect(config.secure).toBe(true);
      expect(config.sameSite).toBe('strict');
      expect(config.maxAge).toBe(7 * 24 * 60 * 60 * 1000);

      process.env.NODE_ENV = originalEnv;
    });

    test('should return less secure config for development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const config = getCookieConfig();

      expect(config.httpOnly).toBe(true);
      expect(config.secure).toBe(false);
      expect(config.sameSite).toBe('lax');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('setRefreshTokenCookie', () => {
    test('should set refresh token cookie with correct config', () => {
      const refreshToken = 'test-refresh-token';

      setRefreshTokenCookie(mockRes, refreshToken);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        refreshToken,
        expect.objectContaining({
          httpOnly: true,
          path: '/'
        })
      );
    });
  });

  describe('clearRefreshTokenCookie', () => {
    test('should clear refresh token cookie', () => {
      clearRefreshTokenCookie(mockRes);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        '',
        expect.objectContaining({
          httpOnly: true,
          maxAge: 0
        })
      );
    });
  });

  describe('getRefreshTokenFromCookie', () => {
    test('should return refresh token from cookies', () => {
      mockReq.cookies.refreshToken = 'test-refresh-token';

      const token = getRefreshTokenFromCookie(mockReq);

      expect(token).toBe('test-refresh-token');
    });

    test('should return null if no refresh token in cookies', () => {
      const token = getRefreshTokenFromCookie(mockReq);

      expect(token).toBeNull();
    });

    test('should return null if cookies object is undefined', () => {
      mockReq.cookies = undefined;

      const token = getRefreshTokenFromCookie(mockReq);

      expect(token).toBeNull();
    });
  });

  describe('validateCookieSecurity', () => {
    test('should validate secure connection in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockReq.secure = true;

      const validation = validateCookieSecurity(mockReq);

      expect(validation.isSecure).toBe(true);
      expect(validation.isProduction).toBe(true);
      expect(validation.warnings).toHaveLength(0);

      process.env.NODE_ENV = originalEnv;
    });

    test('should warn about insecure connection in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockReq.secure = false;

      const validation = validateCookieSecurity(mockReq);

      expect(validation.isSecure).toBe(false);
      expect(validation.warnings).toContain('Production environment should use HTTPS for secure cookies');

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle x-forwarded-proto header', () => {
      mockReq.headers['x-forwarded-proto'] = 'https';

      const validation = validateCookieSecurity(mockReq);

      expect(validation.isSecure).toBe(true);
    });
  });

  describe('getCookieDebugInfo', () => {
    test('should return debug info in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockReq.cookies = { refreshToken: 'test-token' };
      mockReq.headers['user-agent'] = 'test-agent';

      const debugInfo = getCookieDebugInfo(mockReq);

      expect(debugInfo.cookies).toBeDefined();
      expect(debugInfo.cookieConfig).toBeDefined();
      expect(debugInfo.security).toBeDefined();
      expect(debugInfo.headers).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should not return debug info in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const debugInfo = getCookieDebugInfo(mockReq);

      expect(debugInfo.message).toBe('Debug info not available in production');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
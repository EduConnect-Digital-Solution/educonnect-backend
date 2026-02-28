const jwt = require('jsonwebtoken');

class JWTService {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (!this.secret || !this.refreshSecret) {
      throw new Error('JWT secrets are required');
    }
  }

  generateTokens(payload) {
    const accessToken = jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn
    });

    const refreshToken = jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  generatePasswordResetToken(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: '1h' });
  }

  verifyPasswordResetToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }
  }
}

module.exports = new JWTService();
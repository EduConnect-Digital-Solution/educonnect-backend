const logger = require('../utils/logger');

/**
 * Request logging middleware for debugging production issues
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to request object for tracking
  req.requestId = requestId;
  
  // Log incoming request
  const requestInfo = {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.headers.authorization ? 'Bearer [REDACTED]' : 'None',
      'content-type': req.headers['content-type'] || 'None',
      'x-forwarded-for': req.headers['x-forwarded-for'] || 'None'
    },
    body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : 'No body',
    query: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : 'No query'
  };

  console.log(`📥 INCOMING REQUEST [${requestId}]:`, JSON.stringify(requestInfo, null, 2));
  logger.info('Incoming Request', requestInfo);

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    const responseInfo = {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      responseSize: JSON.stringify(data).length,
      success: data.success !== undefined ? data.success : res.statusCode < 400
    };

    if (res.statusCode >= 400) {
      console.error(`📤 ERROR RESPONSE [${requestId}]:`, JSON.stringify({
        ...responseInfo,
        response: data
      }, null, 2));
      logger.error('Error Response', { ...responseInfo, response: data });
    } else {
      console.log(`📤 SUCCESS RESPONSE [${requestId}]:`, JSON.stringify(responseInfo, null, 2));
      logger.info('Success Response', responseInfo);
    }

    return originalJson.call(this, data);
  };

  next();
};

module.exports = requestLogger;
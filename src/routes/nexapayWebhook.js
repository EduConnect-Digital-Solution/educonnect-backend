const express = require('express');
const router = express.Router();
const nexapayWebhookService = require('../services/nexapayWebhookService');
const { WebhookAuthError, WebhookPayloadError } = nexapayWebhookService;
const logger = require('../utils/logger');

/**
 * NexaPay webhook endpoint.
 *
 * Mounted BEFORE express.json() in src/app.js so the raw body survives for
 * HMAC verification. There is no authentication middleware here on purpose -
 * the provider calls this endpoint, and the HMAC over the raw body is what
 * authenticates the delivery.
 *
 * Responses:
 *   200 - accepted, processed, duplicate, or ignored (environment mismatch)
 *   401 - bad signature or unknown business (identical body for both)
 *   400 - the delivery could not be parsed at all
 *   500 - processing failed, NexaPay should retry
 */
// Any content type is read as raw bytes: the HMAC, not the header, decides
// whether the delivery is trusted, and a surprising content type must not
// silently turn the body into {}.
router.post('/', express.raw({ type: () => true, limit: '1mb' }), async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  try {
    const result = await nexapayWebhookService.handleWebhook({
      rawBody,
      headers: req.headers
    });
    return res.status(200).json({ status: 'success', ...result });
  } catch (error) {
    if (error instanceof WebhookAuthError) {
      // Unknown business and invalid signature are indistinguishable here.
      logger.warn('NexaPay webhook rejected', { reason: error.reason });
      return res.status(401).end();
    }
    if (error instanceof WebhookPayloadError) {
      logger.warn('NexaPay webhook rejected: malformed delivery', { reason: error.reason });
      return res.status(400).json({ status: 'error', message: 'Malformed webhook payload' });
    }
    logger.error('NexaPay webhook processing failed', error);
    return res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
});

module.exports = router;

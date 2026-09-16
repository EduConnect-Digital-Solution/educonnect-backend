const express = require('express');
const router = express.Router();
const paystackService = require('../services/paystackService');
const feeService = require('../services/feeService');
const logger = require('../utils/logger');

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    return res.status(400).json({ status: 'error', message: 'Missing Paystack signature header' });
  }

  const valid = paystackService.verifyWebhookSignature(req.body, signature);
  if (!valid) {
    logger.warn('Paystack webhook rejected: invalid signature');
    return res.status(401).json({ status: 'error', message: 'Invalid Paystack signature' });
  }

  try {
    const event = JSON.parse(req.body.toString('utf8'));
    await feeService.handlePaystackWebhook(event);
    res.json({ status: 'success' });
  } catch (error) {
    logger.error('Paystack webhook handler error:', error);
    res.status(500).json({ status: 'error', message: 'Webhook processing failed' });
  }
});

module.exports = router;
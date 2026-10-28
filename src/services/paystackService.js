const crypto = require('crypto');
const config = require('../config');
const logger = require('../utils/logger');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getSecretKey = () => config.paystack && config.paystack.secretKey;

const authHeaders = () => ({
  Authorization: `Bearer ${getSecretKey()}`,
  'Content-Type': 'application/json'
});

const ensureConfigured = () => {
  if (!getSecretKey()) {
    throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY in your environment.');
  }
};

const paystackFetch = async (path, options = {}) => {
  ensureConfigured();
  let res;
  try {
    res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
  } catch (error) {
    logger.error('Paystack request failed', { path, message: error.message });
    const networkError = new Error('Payment provider is unreachable');
    networkError.statusCode = 502;
    throw networkError;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    const message = body.message || `Paystack request failed with status ${res.status}`;
    logger.error('Paystack API error', { path, status: res.status, message });
    const error = new Error(message);
    // A provider failure is a bad gateway for our caller; never pass a
    // Paystack 401 through as if our own session had expired.
    error.statusCode = 502;
    error.providerStatus = res.status;
    throw error;
  }
  return body;
};

const initializeTransaction = async ({ email, amount, reference, callbackUrl, metadata = {} }) => {
  const result = await paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount,
      reference,
      callback_url: callbackUrl,
      metadata
    })
  });
  return result.data;
};

const verifyTransaction = async (reference) => {
  const result = await paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, { method: 'GET' });
  return result.data;
};

const verifyWebhookSignature = (rawBody, signatureHeader) => {
  const secret = getSecretKey();
  if (!secret || !signatureHeader) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest();
  const provided = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (typeof provided !== 'string' || !/^[0-9a-f]{128}$/i.test(provided)) return false;
  // Constant-time comparison so a mismatch does not leak how much matched.
  return crypto.timingSafeEqual(expected, Buffer.from(provided, 'hex'));
};

const listBanks = async ({ currency = 'NGN' } = {}) => {
  const result = await paystackFetch(`/bank?currency=${currency}&perPage=100`, { method: 'GET' });
  return result.data;
};

const resolveAccountNumber = async ({ accountNumber, bankCode }) => {
  const result = await paystackFetch(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    { method: 'GET' }
  );
  return result.data;
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
  listBanks,
  resolveAccountNumber
};
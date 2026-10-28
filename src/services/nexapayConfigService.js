const { prisma } = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { SecretBox } = require('../utils/secretBox');
const nexapayService = require('./nexapayService');

/**
 * Per-school NexaPay merchant configuration.
 *
 * Every school is its own NexaPay merchant: it has its own businessId, its own
 * API key and its own webhook secret. Those secrets are encrypted at rest with
 * SECRETS_ENC_KEY so a database leak does not hand over live merchant
 * credentials.
 */

let secretBoxInstance = null;

const getSecretBox = () => {
  if (!secretBoxInstance) {
    if (!config.secrets.encKey) {
      throw new Error('SECRETS_ENC_KEY is not configured');
    }
    secretBoxInstance = new SecretBox(config.secrets.encKey);
  }
  return secretBoxInstance;
};

const toCreds = (row) => ({
  schoolId: row.schoolId,
  businessId: row.businessId,
  environment: row.environment,
  apiKey: getSecretBox().decrypt(row.apiKeyEnc),
  webhookSecret: getSecretBox().decrypt(row.webhookSecretEnc)
});

/** Full credentials (including secrets) for a school. Internal use only. */
const getBySchoolId = async (schoolId) => {
  if (!schoolId) return null;
  const row = await prisma.nexaPayConfig.findUnique({ where: { schoolId } });
  return row ? toCreds(row) : null;
};

/** Full credentials (including secrets) for a NexaPay businessId. Internal use only. */
const getByBusinessId = async (businessId) => {
  if (!businessId) return null;
  const row = await prisma.nexaPayConfig.findUnique({ where: { businessId } });
  return row ? toCreds(row) : null;
};

/** Non-secret view of a school's configuration, safe to return from an API. */
const getPublicConfig = async (schoolId) => {
  if (!schoolId) return null;
  const row = await prisma.nexaPayConfig.findUnique({
    where: { schoolId },
    select: { schoolId: true, businessId: true, environment: true, createdAt: true, updatedAt: true }
  });
  if (!row) return null;
  return { ...row, configured: true };
};

// NexaPay picks the mode from the key itself (docs, "Environment Behavior"):
// nexa-prod-... is live, nexa-test-... is the sandbox.
const API_KEY_PREFIXES = { test: 'nexa-test-', prod: 'nexa-prod-' };

/**
 * Create or replace a school's NexaPay configuration.
 * Secrets are never logged and never returned to the caller.
 */
const upsert = async (schoolId, { businessId, environment, apiKey, webhookSecret }) => {
  if (!schoolId) throw new Error('A school is required to configure NexaPay');
  if (!businessId) throw new Error('NexaPay businessId is required');
  if (!['test', 'prod'].includes(environment)) throw new Error('Invalid NexaPay environment');
  if (!apiKey) throw new Error('NexaPay API key is required');
  if (!webhookSecret) throw new Error('NexaPay webhook secret is required');
  // A live key saved as "test" would let sandbox-labelled traffic move real
  // money, and the webhook environment check would then compare the wrong side.
  if (!apiKey.startsWith(API_KEY_PREFIXES[environment])) {
    throw new Error(`Invalid NexaPay API key: a ${environment} key must start with ${API_KEY_PREFIXES[environment]}`);
  }

  // Prove the key really belongs to this business before linking it, so
  // nobody can claim another merchant's business ID with a made-up key. A
  // read-only call; NexaPay offers no way to check the webhook secret.
  try {
    await nexapayService.listTransactions({ businessId, environment, apiKey }, { limit: 1 });
  } catch (error) {
    if (error && [400, 401, 403, 404].includes(error.providerStatus)) {
      throw new Error('Invalid NexaPay credentials: NexaPay rejected this API key for this business ID');
    }
    throw error;
  }

  const box = getSecretBox();
  const data = {
    businessId,
    environment,
    apiKeyEnc: box.encrypt(apiKey),
    webhookSecretEnc: box.encrypt(webhookSecret)
  };

  try {
    await prisma.nexaPayConfig.upsert({
      where: { schoolId },
      create: { schoolId, ...data },
      update: data
    });
  } catch (error) {
    // businessId is unique: one NexaPay merchant can only settle one school.
    if (error && error.code === 'P2002') {
      throw new Error('This NexaPay business ID is already linked to another school');
    }
    throw error;
  }

  logger.info('NexaPay configuration updated', { schoolId, businessId, environment });

  return { schoolId, businessId, environment, configured: true };
};

module.exports = {
  getBySchoolId,
  getByBusinessId,
  getPublicConfig,
  upsert
};

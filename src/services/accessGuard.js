const { prisma } = require('../config/database');

/**
 * Is this account still allowed in?
 *
 * Deactivating a school or a user only means something if it stops people who
 * are already logged in, so authenticateToken asks this guard on every
 * request. The answer is cached for a short time to keep that to roughly one
 * query per active user per CACHE_TTL_MS.
 *
 * The cache lives in this process. Changes made by a system admin clear it
 * here immediately; other server instances pick the change up when their copy
 * expires, so a lockout takes effect within CACHE_TTL_MS everywhere.
 */

const CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_ENTRIES = 10000;

const cache = new Map();

/**
 * A user is blocked once a system admin deactivated them (deactivatedAt is
 * set). Accounts that are inactive without that stamp and still on a
 * temporary password are tolerated: that is how a freshly invited account
 * waits for its first login.
 */
const isUserBlocked = (user) =>
  Boolean(user.isDeleted) || Boolean(user.deactivatedAt) || (!user.isActive && !user.isTemporaryPassword);

const isSchoolBlocked = (school) => !school || !school.isActive || Boolean(school.archivedAt) || Boolean(school.isDeleted);

const evaluate = (user) => {
  if (!user) {
    return { allowed: false, status: 401, code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' };
  }
  if (isUserBlocked(user)) {
    return {
      allowed: false,
      status: 403,
      code: 'ACCOUNT_DEACTIVATED',
      message: 'Your account has been deactivated. Please contact your school administration.'
    };
  }
  if (isSchoolBlocked(user.school)) {
    return {
      allowed: false,
      status: 403,
      code: 'SCHOOL_DEACTIVATED',
      message: 'This school account has been deactivated. Please contact support.'
    };
  }
  return { allowed: true };
};

const remember = (userId, result) => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value); // oldest entry
  }
  cache.set(userId, { result, expiresAt: Date.now() + CACHE_TTL_MS });
};

/**
 * @param {string} userId
 * @returns {Promise<{allowed: boolean, status?: number, code?: string, message?: string}>}
 */
const check = async (userId) => {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > Date.now()) return hit.result;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      isTemporaryPassword: true,
      deactivatedAt: true,
      isDeleted: true,
      school: { select: { isActive: true, archivedAt: true, isDeleted: true } }
    }
  });

  const result = evaluate(user);
  remember(userId, result);
  return result;
};

const invalidateUser = (userId) => {
  cache.delete(userId);
};

/** Drop every cached answer. Used when a whole school changes state. */
const invalidateAll = () => {
  cache.clear();
};

module.exports = {
  CACHE_TTL_MS,
  isUserBlocked,
  isSchoolBlocked,
  check,
  invalidateUser,
  invalidateAll
};

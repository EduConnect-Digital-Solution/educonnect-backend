const { prisma } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Durable audit trail for system admin actions, stored in PlatformAuditLog.
 *
 * (The "activity log" in authService.logSystemAdminActivity only keeps the
 * last 100 entries in a 24 hour cache, so it is not an audit trail.)
 *
 * Two ways to write:
 *  - record(): best effort. A failed audit write is logged loudly but never
 *    undoes the action it describes. Use for low-risk actions.
 *  - recordInTransaction(): throws on failure, so the surrounding transaction
 *    rolls back. Use for destructive actions: no audit row, no action.
 */

const USER_AGENT_LIMIT = 255;

const buildRow = ({ action, entityType, entityId, schoolId, actor, context = {}, details = {} }) => ({
  action,
  entityType,
  entityId: entityId === undefined ? null : entityId,
  schoolId: schoolId || null,
  userId: actor || null,
  ipAddress: context.ip || null,
  userAgent: context.userAgent ? String(context.userAgent).slice(0, USER_AGENT_LIMIT) : null,
  details
});

const recordInTransaction = (tx, entry) => tx.platformAuditLog.create({ data: buildRow(entry) });

const record = async (entry) => {
  try {
    await prisma.platformAuditLog.create({ data: buildRow(entry) });
  } catch (error) {
    logger.error('Audit log write failed', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      message: error.message
    });
  }
};

/** Request metadata worth keeping with an audit row. */
const contextFromRequest = (req) => ({
  ip: req.ip,
  userAgent: typeof req.get === 'function' ? req.get('User-Agent') : undefined
});

/**
 * Read the trail. `schoolId` is the human-readable school code; rows of a
 * purged school are kept with their school link removed, so they are found by
 * the code stored in `details.schoolCode`.
 */
const list = async ({ schoolId, action, actor, page = 1, limit = 50 } = {}) => {
  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);

  const where = {};
  if (action) where.action = action;
  if (actor) where.userId = actor;
  if (schoolId) {
    const school = await prisma.school.findFirst({ where: { schoolId }, select: { id: true } });
    where.OR = [
      ...(school ? [{ schoolId: school.id }] : []),
      { details: { path: ['schoolCode'], equals: schoolId } }
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (currentPage - 1) * take,
      take
    }),
    prisma.platformAuditLog.count({ where })
  ]);

  return {
    logs,
    pagination: { page: currentPage, limit: take, total, pages: Math.ceil(total / take) }
  };
};

module.exports = {
  record,
  recordInTransaction,
  contextFromRequest,
  list
};

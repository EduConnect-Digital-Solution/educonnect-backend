/**
 * Audit writer tests: rows use the real PlatformAuditLog columns, a failed
 * best-effort write never throws, and a transactional write always does.
 */

jest.mock('../../config/database', () => ({
  prisma: {
    school: { findFirst: jest.fn() },
    platformAuditLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() }
  },
  connectDB: jest.fn()
}));

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { prisma } = require('../../config/database');
const logger = require('../../utils/logger');
const audit = require('../platformAuditService');

describe('platformAuditService', () => {
  beforeEach(() => {
    prisma.school.findFirst.mockReset();
    prisma.platformAuditLog.create.mockReset().mockResolvedValue({});
    prisma.platformAuditLog.findMany.mockReset().mockResolvedValue([]);
    prisma.platformAuditLog.count.mockReset().mockResolvedValue(0);
  });

  describe('record', () => {
    it('should write a row with the real columns', async () => {
      await audit.record({
        action: 'school.archive',
        entityType: 'school',
        entityId: 'ABC1234',
        schoolId: 'school-uuid',
        actor: 'root@educonnect.test',
        context: { ip: '10.0.0.1', userAgent: 'jest' },
        details: { reason: 'Contract ended' }
      });

      expect(prisma.platformAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'school.archive',
          entityType: 'school',
          entityId: 'ABC1234',
          schoolId: 'school-uuid',
          userId: 'root@educonnect.test',
          ipAddress: '10.0.0.1',
          userAgent: 'jest',
          details: { reason: 'Contract ended' }
        }
      });
    });

    it('should default missing values to null and truncate a huge user agent', async () => {
      await audit.record({ action: 'x', entityType: 'school', context: { userAgent: 'a'.repeat(400) } });

      const { data } = prisma.platformAuditLog.create.mock.calls[0][0];
      expect(data).toEqual(expect.objectContaining({ entityId: null, schoolId: null, userId: null, ipAddress: null }));
      expect(data.userAgent).toHaveLength(255);
    });

    it('should log and swallow a failed write instead of undoing the action', async () => {
      prisma.platformAuditLog.create.mockRejectedValue(new Error('table missing'));

      await expect(audit.record({ action: 'x', entityType: 'school' })).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith('Audit log write failed', expect.objectContaining({ message: 'table missing' }));
    });
  });

  describe('recordInTransaction', () => {
    it('should write through the transaction client', async () => {
      const tx = { platformAuditLog: { create: jest.fn().mockResolvedValue({}) } };

      await audit.recordInTransaction(tx, { action: 'school.purge', entityType: 'school', actor: 'root' });

      expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'school.purge', userId: 'root' })
      });
      expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it('should throw when the audit row cannot be written so the transaction rolls back', async () => {
      const tx = { platformAuditLog: { create: jest.fn().mockRejectedValue(new Error('disk full')) } };

      await expect(audit.recordInTransaction(tx, { action: 'x', entityType: 'school' })).rejects.toThrow('disk full');
    });
  });

  describe('list', () => {
    it('should find a school\'s trail by its link and by the code kept in the details', async () => {
      prisma.school.findFirst.mockResolvedValue({ id: 'school-uuid' });

      await audit.list({ schoolId: 'ABC1234' });

      const { where } = prisma.platformAuditLog.findMany.mock.calls[0][0];
      expect(where.OR).toEqual([
        { schoolId: 'school-uuid' },
        { details: { path: ['schoolCode'], equals: 'ABC1234' } }
      ]);
    });

    it('should still find the trail of a school that no longer exists', async () => {
      prisma.school.findFirst.mockResolvedValue(null);

      await audit.list({ schoolId: 'ABC1234' });

      const { where } = prisma.platformAuditLog.findMany.mock.calls[0][0];
      expect(where.OR).toEqual([{ details: { path: ['schoolCode'], equals: 'ABC1234' } }]);
    });

    it('should filter by action and actor and clamp the page size', async () => {
      prisma.platformAuditLog.count.mockResolvedValue(450);

      const result = await audit.list({ action: 'school.purge', actor: 'root', page: '2', limit: '9999' });

      const args = prisma.platformAuditLog.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ action: 'school.purge', userId: 'root' });
      expect(args.take).toBe(200);
      expect(args.skip).toBe(200);
      expect(result.pagination).toEqual({ page: 2, limit: 200, total: 450, pages: 3 });
    });
  });

  it('should read request metadata', () => {
    expect(audit.contextFromRequest({ ip: '1.2.3.4', get: () => 'agent' })).toEqual({ ip: '1.2.3.4', userAgent: 'agent' });
    expect(audit.contextFromRequest({ ip: '1.2.3.4' })).toEqual({ ip: '1.2.3.4', userAgent: undefined });
  });
});

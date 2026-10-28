/**
 * Staff CSV import: teachers become records with no login, to be claimed by a
 * later invitation.
 */

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('shared-unusable-hash') }));

jest.mock('../../config/database', () => {
  const prisma = {
    school: { findFirst: jest.fn() },
    user: { findMany: jest.fn(), createMany: jest.fn() },
    subject: { findMany: jest.fn() }
  };
  prisma.$transaction = jest.fn(async (callback) => callback(prisma));
  return { prisma, connectDB: jest.fn() };
});

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../cacheService', () => ({ invalidatePlatformCachesForSchool: jest.fn() }));
jest.mock('../platformAuditService', () => ({ recordInTransaction: jest.fn().mockResolvedValue({}), record: jest.fn() }));

const bcrypt = require('bcrypt');
const { prisma } = require('../../config/database');
const audit = require('../platformAuditService');
const csv = require('../../utils/csvTable');
const importer = require('../staffImportService');

const file = (...lines) => Buffer.from(['firstName,lastName,email,phone,subjects,role', ...lines].join('\n') + '\n');
const school = (overrides = {}) => ({ id: 'school-uuid', schoolId: 'ABC1234', archivedAt: null, ...overrides });

describe('staffImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.school.findFirst.mockReset().mockResolvedValue(school());
    prisma.user.findMany.mockReset().mockResolvedValue([]);
    prisma.user.createMany.mockReset().mockImplementation(async ({ data }) => ({ count: data.length }));
    prisma.subject.findMany.mockReset().mockResolvedValue([{ name: 'Mathematics' }, { name: 'Physics' }]);
    audit.recordInTransaction.mockResolvedValue({});
  });

  it('should publish a template that the reader and the validator accept', () => {
    const template = importer.templateCsv();
    const { rows } = csv.readCsvTable(Buffer.from(template), importer.STAFF_COLUMNS);

    expect(template.split('\r\n')[0]).toBe('firstName,lastName,email,phone,subjects,role');
    const { errors } = importer.validateRows(rows, { takenEmails: new Set(), subjectByName: new Map() }, 'school-uuid', 'hash');
    expect(errors).toEqual([]);
  });

  describe('a good file', () => {
    it('should create teacher records that cannot log in', async () => {
      const report = await importer.importStaff(
        'ABC1234',
        file('Tunde,Bello,Tunde.Bello@Example.com,08031234567,Mathematics;Physics,teacher'),
        {},
        'root',
        { ip: '1.1.1.1' }
      );

      expect(report.summary).toEqual({ totalRows: 1, valid: 1, invalid: 0, imported: 1 });
      expect(prisma.user.createMany.mock.calls[0][0].data[0]).toEqual({
        schoolId: 'school-uuid',
        firstName: 'Tunde',
        lastName: 'Bello',
        email: 'tunde.bello@example.com',
        phone: '08031234567',
        role: 'teacher',
        subjects: ['Mathematics', 'Physics'],
        classes: [],
        password: 'shared-unusable-hash',
        isVerified: false,
        isTemporaryPassword: true,
        isActive: true
      });
    });

    it('should hash one unusable password for the whole file, not one per row', async () => {
      const lines = Array.from({ length: 300 }, (_, index) => `T${index},Teacher,t${index}@example.com,,,`);

      await importer.importStaff('ABC1234', file(...lines), {}, 'root');

      expect(bcrypt.hash).toHaveBeenCalledTimes(1);
      const passwords = new Set(prisma.user.createMany.mock.calls.flatMap((call) => call[0].data.map((row) => row.password)));
      expect(passwords).toEqual(new Set(['shared-unusable-hash']));
    });

    it('should audit the import in the same transaction', async () => {
      await importer.importStaff('ABC1234', file('Tunde,Bello,t@example.com,,,'), {}, 'root');

      expect(audit.recordInTransaction).toHaveBeenCalledWith(prisma, expect.objectContaining({
        action: 'import.staff', details: expect.objectContaining({ imported: 1 })
      }));
    });

    it('should point to the invitation step afterwards', async () => {
      const report = await importer.importStaff('ABC1234', file('Tunde,Bello,t@example.com,,,'), {}, 'root');

      expect(report.nextStep).toMatch(/staff\/invite/);
    });

    it('should use the school\'s own spelling of a known subject and warn about unknown ones', async () => {
      const report = await importer.importStaff('ABC1234', file('Tunde,Bello,t@example.com,,mathematics;Basket Weaving,'), {}, 'root');

      expect(prisma.user.createMany.mock.calls[0][0].data[0].subjects).toEqual(['Mathematics', 'Basket Weaving']);
      expect(report.warnings).toEqual([
        { line: 2, field: 'subjects', message: '"Basket Weaving" is not a subject set up in this school yet' }
      ]);
      expect(report.summary.invalid).toBe(0);
    });
  });

  describe('dry run', () => {
    it('should validate and write nothing', async () => {
      const report = await importer.importStaff('ABC1234', file('Tunde,Bello,t@example.com,,,', 'Bad,,x,,,'), { dryRun: true }, 'root');

      expect(report.summary).toEqual({ totalRows: 2, valid: 1, invalid: 1, imported: 0 });
      expect(prisma.user.createMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(report.nextStep).toBeUndefined();
    });
  });

  describe('bad rows', () => {
    const errorsFor = async (line) => {
      const report = await importer.importStaff('ABC1234', file(line), { dryRun: true }, 'root');
      return report.errors.map((error) => `${error.field}: ${error.message}`);
    };

    it('should require a name and a valid email', async () => {
      // (A row of only commas is a blank line and is skipped; this one has a phone number.)
      expect(await errorsFor(',,,08031234567,,')).toEqual(['firstName: Required', 'lastName: Required', 'email: Required']);
      expect(await errorsFor('Tunde,Bello,not-an-email,,,')).toEqual(['email: Not a valid email address']);
    });

    it('should never import an admin from a spreadsheet', async () => {
      expect(await errorsFor('Eve,Admin,eve@example.com,,,admin')).toEqual([
        'role: Only teachers can be imported. School admins are not created from a spreadsheet.'
      ]);
      expect(await errorsFor('Tunde,Bello,t@example.com,,,Teacher')).toEqual([]);
    });

    it('should reject cells that would run as formulas and absurd subject lists', async () => {
      expect(await errorsFor('=evil,Bello,t@example.com,,,')).toEqual(['firstName: Must not start with = or @']);
      expect(await errorsFor('Tunde,Bello,t@example.com,,=1+1,')).toEqual(['subjects: "=1+1" is not a valid subject name']);
      const many = Array.from({ length: 16 }, (_, index) => `S${index}`).join(';');
      expect(await errorsFor(`Tunde,Bello,t@example.com,,${many},`)).toEqual(['subjects: At most 15 subjects']);
    });

    it('should skip an email repeated in the file or already used in the school, whatever the person\'s role', async () => {
      prisma.user.findMany.mockResolvedValue([{ email: 'Parent@Example.com' }]);

      const report = await importer.importStaff(
        'ABC1234',
        file('A,One,a@example.com,,,', 'B,Two,A@example.com,,,', 'C,Three,parent@example.com,,,'),
        { dryRun: true },
        'root'
      );

      expect(report.errors).toEqual([
        { line: 3, field: 'email', message: 'Appears more than once in this file' },
        { line: 4, field: 'email', message: 'Someone with this email already exists in the school' }
      ]);
    });

    it('should check existing emails only inside this school', async () => {
      await importer.importStaff('ABC1234', file('A,One,a@example.com,,,'), { dryRun: true }, 'root');

      expect(prisma.user.findMany.mock.calls[0][0].where.schoolId).toBe('school-uuid');
    });

    it('should import the good rows and skip the bad ones', async () => {
      const report = await importer.importStaff('ABC1234', file('A,One,a@example.com,,,', 'B,,b@example.com,,,'), {}, 'root');

      expect(report.summary).toEqual({ totalRows: 2, valid: 1, invalid: 1, imported: 1 });
      expect(prisma.user.createMany.mock.calls[0][0].data.map((row) => row.email)).toEqual(['a@example.com']);
    });
  });

  describe('safeguards', () => {
    it('should refuse an archived school', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ archivedAt: new Date() }));

      await expect(importer.importStaff('ABC1234', file('A,One,a@example.com,,,'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ARCHIVED' });
    });

    it('should report a clash with a concurrent change and import nothing', async () => {
      prisma.user.createMany.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

      await expect(importer.importStaff('ABC1234', file('A,One,a@example.com,,,'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_CONFLICT' });
    });

    it('should insert large files in chunks inside one transaction', async () => {
      const lines = Array.from({ length: 1100 }, (_, index) => `T${index},Teacher,t${index}@example.com,,,`);

      await importer.importStaff('ABC1234', file(...lines), {}, 'root');

      expect(prisma.user.createMany.mock.calls.map((call) => call[0].data.length)).toEqual([500, 500, 100]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});

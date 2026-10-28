/**
 * Student CSV import: row checks, dry run, partial import and safeguards.
 */

jest.mock('../../config/database', () => {
  const prisma = {
    school: { findFirst: jest.fn() },
    class: { findMany: jest.fn() },
    arm: { findMany: jest.fn() },
    student: { findMany: jest.fn(), createMany: jest.fn() }
  };
  prisma.$transaction = jest.fn(async (callback) => callback(prisma));
  return { prisma, connectDB: jest.fn() };
});

jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../studentService', () => ({ invalidateStudentCaches: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../platformAuditService', () => ({ recordInTransaction: jest.fn().mockResolvedValue({}), record: jest.fn() }));
jest.mock('../cacheService', () => ({ invalidatePlatformCachesForSchool: jest.fn() }));

const { prisma } = require('../../config/database');
const { invalidateStudentCaches } = require('../studentService');
const audit = require('../platformAuditService');
const csv = require('../../utils/csvTable');
const importer = require('../studentImportService');

const HEADER = 'firstName,lastName,studentId,email,className,armName,rollNumber,gender,dateOfBirth,phone,address,guardianName,guardianRelationship,guardianPhone,guardianEmail';
const file = (...lines) => Buffer.from([HEADER, ...lines].join('\n') + '\n');

const school = (overrides = {}) => ({ id: 'school-uuid', schoolId: 'ABC1234', schoolName: 'Greenfield', archivedAt: null, ...overrides });

describe('studentImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.school.findFirst.mockReset().mockResolvedValue(school());
    prisma.class.findMany.mockReset().mockResolvedValue([{ id: 'class-1', name: 'JSS1' }, { id: 'class-2', name: 'JSS2' }]);
    prisma.arm.findMany.mockReset().mockResolvedValue([{ id: 'arm-a', name: 'A', classId: 'class-1' }]);
    prisma.student.findMany.mockReset().mockResolvedValue([]);
    prisma.student.createMany.mockReset().mockImplementation(async ({ data }) => ({ count: data.length }));
    audit.recordInTransaction.mockResolvedValue({});
  });

  it('should publish a template that the reader accepts', () => {
    const template = importer.templateCsv();

    expect(template.split('\r\n')[0]).toBe(HEADER);
    const { rows } = csv.readCsvTable(Buffer.from(template), importer.STUDENT_COLUMNS);
    expect(rows).toHaveLength(1);
    const { errors } = importer.validateRows(rows, {
      classByName: new Map([['jss1', { id: 'c', name: 'JSS1' }]]),
      armByKey: new Map([['c|a', { id: 'a', name: 'A' }]]),
      takenStudentIds: new Set(), takenEmails: new Set(), takenRolls: new Set()
    }, 'school-uuid', 'root');
    expect(errors).toEqual([]);
  });

  describe('a good file', () => {
    const row = 'Ada,Okafor,ADM/001,ADA@Example.com,jss1,a,12,F,18/05/2014,08031234567,12 Marina Road,Ngozi Okafor,Mother,08037654321,Ngozi@Example.com';

    it('should import the student as a record, resolving class and arm and tidying values', async () => {
      const report = await importer.importStudents('ABC1234', file(row), {}, 'root@educonnect.test', { ip: '1.1.1.1' });

      expect(report.summary).toEqual({ totalRows: 1, valid: 1, invalid: 0, imported: 1 });
      const [{ data }] = prisma.student.createMany.mock.calls[0];
      expect(data[0]).toEqual({
        schoolId: 'school-uuid',
        firstName: 'Ada',
        lastName: 'Okafor',
        studentId: 'ADM/001',
        email: 'ada@example.com',
        classId: 'class-1',
        armId: 'arm-a',
        currentClass: 'JSS1',
        grade: 'JSS1',
        rollNumber: '12',
        gender: 'female',
        dateOfBirth: new Date(Date.UTC(2014, 4, 18)),
        phone: '08031234567',
        address: '12 Marina Road',
        guardian: { fullName: 'Ngozi Okafor', relationship: 'Mother', phone: '08037654321', email: 'ngozi@example.com' },
        isActive: true,
        createdBy: 'root@educonnect.test'
      });
    });

    it('should create no login and send no email', async () => {
      await importer.importStudents('ABC1234', file(row), {}, 'root');

      expect(prisma.student.createMany.mock.calls[0][0].data[0]).not.toHaveProperty('userId');
      expect(prisma.student.createMany.mock.calls[0][0].data[0]).not.toHaveProperty('password');
    });

    it('should write the audit row in the same transaction and clear student caches', async () => {
      await importer.importStudents('ABC1234', file(row), {}, 'root', { ip: '1.1.1.1' });

      expect(audit.recordInTransaction).toHaveBeenCalledWith(prisma, expect.objectContaining({
        action: 'import.students',
        schoolId: 'school-uuid',
        details: expect.objectContaining({ totalRows: 1, imported: 1, rejected: 0 })
      }));
      expect(invalidateStudentCaches).toHaveBeenCalledWith('school-uuid');
    });

    it('should accept a student with only a name', async () => {
      const report = await importer.importStudents('ABC1234', file('Bo,Eze,,,,,,,,,,,,,'), {}, 'root');

      expect(report.summary.imported).toBe(1);
      const [{ data }] = prisma.student.createMany.mock.calls[0];
      expect(data[0]).toEqual(expect.objectContaining({ firstName: 'Bo', lastName: 'Eze', guardian: undefined, classId: undefined }));
    });
  });

  describe('dry run', () => {
    it('should run every check and write nothing', async () => {
      const report = await importer.importStudents('ABC1234', file('Ada,Okafor,,,JSS1,,,,,,,,,,', 'Bo,,,,,,,,,,,,,,'), { dryRun: true }, 'root');

      expect(report.dryRun).toBe(true);
      expect(report.summary).toEqual({ totalRows: 2, valid: 1, invalid: 1, imported: 0 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.student.createMany).not.toHaveBeenCalled();
      expect(audit.recordInTransaction).not.toHaveBeenCalled();
      expect(invalidateStudentCaches).not.toHaveBeenCalled();
    });
  });

  describe('bad rows', () => {
    const errorsFor = async (line, options = {}) => {
      const report = await importer.importStudents('ABC1234', file(line), { dryRun: true, ...options }, 'root');
      return report.errors.map((error) => `${error.field}: ${error.message}`);
    };

    it('should skip bad rows, import good ones and report each problem with its line', async () => {
      const report = await importer.importStudents(
        'ABC1234',
        file('Ada,Okafor,,,,,,,,,,,,,', ',Eze,,,,,,,,,,,,,', 'Cy,Dee,,,Nowhere,,,,,,,,,,'),
        {},
        'root'
      );

      expect(report.summary).toEqual({ totalRows: 3, valid: 1, invalid: 2, imported: 1 });
      expect(report.errors).toEqual([
        { line: 3, field: 'firstName', message: 'Required' },
        { line: 4, field: 'className', message: 'No active class named "Nowhere" in this school' }
      ]);
      expect(prisma.student.createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it('should reject a missing last name, a bad email, a bad phone and a bad gender', async () => {
      expect(await errorsFor('Ada,,,not-an-email,,,,robot,,12,,,,,')).toEqual([
        'lastName: Required',
        'email: Not a valid email address',
        'phone: Not a valid phone number',
        'gender: Use male, female or other'
      ]);
    });

    it('should reject impossible, future and wrongly formatted birth dates', async () => {
      expect(await errorsFor('Ada,Okafor,,,,,,,31/02/2014,,,,,,')).toEqual(['dateOfBirth: Use YYYY-MM-DD or DD/MM/YYYY']);
      expect(await errorsFor('Ada,Okafor,,,,,,,2999-01-01,,,,,,')).toEqual(['dateOfBirth: Date is in the future or too far in the past']);
      expect(await errorsFor('Ada,Okafor,,,,,,,05/18/2014,,,,,,')).toEqual(['dateOfBirth: Use YYYY-MM-DD or DD/MM/YYYY']);
    });

    it('should reject an arm that does not exist in the class, or an arm without a class', async () => {
      expect(await errorsFor('Ada,Okafor,,,JSS1,Z,,,,,,,,,')).toEqual(['armName: Class JSS1 has no active arm "Z"']);
      expect(await errorsFor('Ada,Okafor,,,,A,,,,,,,,,')).toEqual(['armName: Needs a className']);
    });

    it('should reject cells that would run as formulas', async () => {
      expect(await errorsFor('=cmd|calc,Okafor,,,,,,,,,,,,,')).toEqual(['firstName: Must not start with = or @']);
      expect(await errorsFor('Ada,Okafor,,,,,,,,,@SUM(A1),,,,')).toEqual(['address: Must not start with = or @']);
    });

    it('should require a guardian name when any guardian detail is given and check the rest', async () => {
      expect(await errorsFor('Ada,Okafor,,,,,,,,,,,Mother,,')).toEqual(['guardianName: Required when any guardian detail is given']);
      expect(await errorsFor('Ada,Okafor,,,,,,,,,,Ngozi,,abc,nope')).toEqual([
        'guardianPhone: Not a valid phone number',
        'guardianEmail: Not a valid email address'
      ]);
    });

    it('should report every problem in a row, not just the first', async () => {
      const report = await importer.importStudents('ABC1234', file(',,,bad,Nowhere,,,,,,,,,,'), { dryRun: true }, 'root');

      expect(report.errors.map((error) => error.field)).toEqual(['firstName', 'lastName', 'email', 'className']);
      expect(report.summary.invalid).toBe(1);
    });
  });

  describe('duplicates', () => {
    it('should skip a student ID or email that is repeated inside the file', async () => {
      const report = await importer.importStudents(
        'ABC1234',
        file('Ada,One,ADM/1,a@x.test,,,,,,,,,,,', 'Bo,Two,ADM/1,b@x.test,,,,,,,,,,,', 'Cy,Three,ADM/3,A@x.test,,,,,,,,,,,'),
        { dryRun: true },
        'root'
      );

      expect(report.errors).toEqual([
        { line: 3, field: 'studentId', message: 'Appears more than once in this file' },
        { line: 4, field: 'email', message: 'Appears more than once in this file' }
      ]);
    });

    it('should skip a student ID or email already in the school', async () => {
      prisma.student.findMany.mockResolvedValueOnce([{ studentId: 'ADM/1', email: null }, { studentId: null, email: 'taken@x.test' }]);

      const report = await importer.importStudents(
        'ABC1234',
        file('Ada,One,ADM/1,,,,,,,,,,,,', 'Bo,Two,ADM/2,Taken@x.test,,,,,,,,,,,'),
        { dryRun: true },
        'root'
      );

      expect(report.errors).toEqual([
        { line: 2, field: 'studentId', message: 'A student with this ID already exists in the school' },
        { line: 3, field: 'email', message: 'A student with this email already exists in the school' }
      ]);
    });

    it('should look for existing students only inside this school', async () => {
      await importer.importStudents('ABC1234', file('Ada,One,ADM/1,a@x.test,,,,,,,,,,,'), { dryRun: true }, 'root');

      const { where } = prisma.student.findMany.mock.calls[0][0];
      expect(where.schoolId).toBe('school-uuid');
    });

    it('should reject a roll number used twice in the same class and arm, but not across classes', async () => {
      // No IDs or emails in this file, so the roll-number lookup is the only student query.
      prisma.student.findMany.mockResolvedValueOnce([{ classId: 'class-2', armId: null, rollNumber: '5' }]);

      const report = await importer.importStudents(
        'ABC1234',
        file('Ada,One,,,JSS1,A,5,,,,,,,,', 'Bo,Two,,,JSS1,A,5,,,,,,,,', 'Cy,Three,,,JSS2,,5,,,,,,,,', 'Di,Four,,,JSS1,,5,,,,,,,,'),
        { dryRun: true },
        'root'
      );

      expect(report.errors).toEqual([
        { line: 3, field: 'rollNumber', message: 'Roll number appears twice for the same class and arm in this file' },
        { line: 4, field: 'rollNumber', message: 'Roll number already used in this class and arm' }
      ]);
    });
  });

  describe('safeguards', () => {
    it('should refuse to import into an archived school', async () => {
      prisma.school.findFirst.mockResolvedValue(school({ archivedAt: new Date() }));

      await expect(importer.importStudents('ABC1234', file('Ada,One,,,,,,,,,,,,,'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'SCHOOL_ARCHIVED' });
    });

    it('should answer 404 for an unknown school', async () => {
      prisma.school.findFirst.mockResolvedValue(null);

      await expect(importer.importStudents('ZZZ9999', file('Ada,One,,,,,,,,,,,,,'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('should pass file-level problems through as 400s', async () => {
      await expect(importer.importStudents('ABC1234', Buffer.from('firstName,lastName\n'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 400, code: 'CSV_EMPTY' });
      await expect(importer.importStudents('ABC1234', Buffer.from('name,age\nAda,9\n'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 400, code: 'CSV_MISSING_COLUMNS' });
    });

    it('should import nothing and say why when someone else adds a clashing student mid-import', async () => {
      prisma.student.createMany.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));

      await expect(importer.importStudents('ABC1234', file('Ada,One,ADM/1,,,,,,,,,,,,'), {}, 'root'))
        .rejects.toMatchObject({ statusCode: 409, code: 'IMPORT_CONFLICT' });
      expect(invalidateStudentCaches).not.toHaveBeenCalled();
    });

    it('should not import when the audit row cannot be written', async () => {
      audit.recordInTransaction.mockRejectedValue(new Error('audit unavailable'));

      await expect(importer.importStudents('ABC1234', file('Ada,One,,,,,,,,,,,,,'), {}, 'root')).rejects.toThrow('audit unavailable');
      expect(invalidateStudentCaches).not.toHaveBeenCalled();
    });

    it('should insert large files in chunks inside one transaction', async () => {
      const lines = Array.from({ length: 1200 }, (_, index) => `Pupil${index},Test,ADM/${index},,,,,,,,,,,,`);

      const report = await importer.importStudents('ABC1234', file(...lines), {}, 'root');

      expect(report.summary.imported).toBe(1200);
      expect(prisma.student.createMany.mock.calls.map((call) => call[0].data.length)).toEqual([500, 500, 200]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});

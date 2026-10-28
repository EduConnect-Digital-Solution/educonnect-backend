const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const csv = require('../utils/csvTable');
const audit = require('./platformAuditService');
const { findSchool } = require('./schoolLifecycleService');
const { invalidateStudentCaches } = require('./studentService');

/**
 * Import a school's students from a CSV.
 *
 * Creates student RECORDS only - no logins and no emails. Rows are checked
 * one by one: a bad row is reported and skipped, good rows are imported, and
 * `dryRun` runs every check without writing anything so the file can be fixed
 * first.
 */

const INSERT_CHUNK_SIZE = 500;

const STUDENT_COLUMNS = [
  { key: 'firstName', required: true, aliases: ['givenName', 'forename'] },
  { key: 'lastName', required: true, aliases: ['surname', 'familyName'] },
  { key: 'studentId', aliases: ['admissionNumber', 'admissionNo', 'admissionId', 'regNo', 'registrationNumber'] },
  { key: 'email', aliases: ['emailAddress'] },
  { key: 'className', aliases: ['class'] },
  { key: 'armName', aliases: ['arm', 'division'] },
  { key: 'rollNumber', aliases: ['rollNo', 'roll'] },
  { key: 'gender', aliases: ['sex'] },
  { key: 'dateOfBirth', aliases: ['dob', 'birthDate'] },
  { key: 'phone', aliases: ['phoneNumber', 'mobile'] },
  { key: 'address' },
  { key: 'guardianName', aliases: ['guardian', 'parentName'] },
  { key: 'guardianRelationship', aliases: ['relationship', 'relation'] },
  { key: 'guardianPhone', aliases: ['parentPhone'] },
  { key: 'guardianEmail', aliases: ['parentEmail'] }
];

const TEMPLATE_EXAMPLE = [
  'Ada', 'Okafor', 'ADM/2026/001', 'ada.okafor@example.com', 'JSS1', 'A', '12', 'female',
  '2014-05-18', '08031234567', '12 Marina Road, Lagos', 'Ngozi Okafor', 'Mother', '08037654321', 'ngozi@example.com'
];

const templateCsv = () => csv.buildCsv(STUDENT_COLUMNS.map((column) => column.key), [TEMPLATE_EXAMPLE]);

const lower = (value) => value.toLowerCase();

const validateTextLength = (value, max, field, addError) => {
  if (value.length > max) addError(field, `Must be ${max} characters or fewer`);
  if (csv.looksLikeFormula(value)) addError(field, 'Must not start with = or @');
};

const buildGuardian = (values, addError) => {
  const { guardianName, guardianRelationship, guardianPhone, guardianEmail } = values;
  if (!guardianName && !guardianRelationship && !guardianPhone && !guardianEmail) return undefined;

  if (!guardianName) addError('guardianName', 'Required when any guardian detail is given');
  if (guardianName) validateTextLength(guardianName, 100, 'guardianName', addError);
  if (guardianRelationship) validateTextLength(guardianRelationship, 50, 'guardianRelationship', addError);
  if (guardianPhone && !csv.isPhone(guardianPhone)) addError('guardianPhone', 'Not a valid phone number');
  if (guardianEmail && !csv.isEmail(guardianEmail)) addError('guardianEmail', 'Not a valid email address');

  return {
    fullName: guardianName,
    ...(guardianRelationship && { relationship: guardianRelationship }),
    ...(guardianPhone && { phone: guardianPhone }),
    ...(guardianEmail && { email: lower(guardianEmail) })
  };
};

/** Everything the rows are checked against, loaded once up front. */
const loadReferenceData = async (schoolId, rows) => {
  const fileStudentIds = rows.map((row) => row.values.studentId).filter(Boolean);
  const fileEmails = rows.map((row) => lower(row.values.email)).filter(Boolean);
  const fileRollNumbers = rows.map((row) => row.values.rollNumber).filter(Boolean);

  const [classes, arms, existing, rolls] = await Promise.all([
    prisma.class.findMany({ where: { schoolId, isActive: true }, select: { id: true, name: true } }),
    prisma.arm.findMany({ where: { schoolId, isActive: true }, select: { id: true, name: true, classId: true } }),
    fileStudentIds.length + fileEmails.length === 0
      ? Promise.resolve([])
      : prisma.student.findMany({
          where: {
            schoolId,
            OR: [
              ...(fileStudentIds.length ? [{ studentId: { in: fileStudentIds } }] : []),
              ...(fileEmails.length ? [{ email: { in: fileEmails }, isActive: true }] : [])
            ]
          },
          select: { studentId: true, email: true }
        }),
    fileRollNumbers.length === 0
      ? Promise.resolve([])
      : prisma.student.findMany({
          where: { schoolId, isActive: true, rollNumber: { in: fileRollNumbers } },
          select: { classId: true, armId: true, rollNumber: true }
        })
  ]);

  return {
    classByName: new Map(classes.map((record) => [lower(record.name), record])),
    armByKey: new Map(arms.map((record) => [`${record.classId}|${lower(record.name)}`, record])),
    takenStudentIds: new Set(existing.map((record) => record.studentId).filter(Boolean)),
    takenEmails: new Set(existing.map((record) => record.email && lower(record.email)).filter(Boolean)),
    takenRolls: new Set(rolls.map((record) => `${record.classId}|${record.armId}|${record.rollNumber}`))
  };
};

const validateRows = (rows, reference, schoolId, actor) => {
  const errors = [];
  const valid = [];
  const seenStudentIds = new Set();
  const seenEmails = new Set();
  const seenRolls = new Set();

  for (const { line, values } of rows) {
    const rowErrors = [];
    const addError = (field, message) => rowErrors.push({ line, field, message });

    if (!values.firstName) addError('firstName', 'Required');
    else validateTextLength(values.firstName, 100, 'firstName', addError);
    if (!values.lastName) addError('lastName', 'Required');
    else validateTextLength(values.lastName, 100, 'lastName', addError);

    if (values.studentId) {
      validateTextLength(values.studentId, 50, 'studentId', addError);
      if (reference.takenStudentIds.has(values.studentId)) addError('studentId', 'A student with this ID already exists in the school');
      else if (seenStudentIds.has(values.studentId)) addError('studentId', 'Appears more than once in this file');
    }

    const email = values.email ? lower(values.email) : '';
    if (email) {
      if (!csv.isEmail(email)) addError('email', 'Not a valid email address');
      else if (reference.takenEmails.has(email)) addError('email', 'A student with this email already exists in the school');
      else if (seenEmails.has(email)) addError('email', 'Appears more than once in this file');
    }

    if (values.phone && !csv.isPhone(values.phone)) addError('phone', 'Not a valid phone number');
    if (values.address) validateTextLength(values.address, 500, 'address', addError);

    let gender;
    if (values.gender) {
      gender = csv.normalizeGender(values.gender);
      if (!gender) addError('gender', 'Use male, female or other');
    }

    let dateOfBirth;
    if (values.dateOfBirth) {
      const parsed = csv.parseDate(values.dateOfBirth);
      if (!parsed) addError('dateOfBirth', 'Use YYYY-MM-DD or DD/MM/YYYY');
      else if (!csv.isPlausibleBirthDate(parsed)) addError('dateOfBirth', 'Date is in the future or too far in the past');
      else dateOfBirth = parsed;
    }

    let classRecord;
    let armRecord;
    if (values.className) {
      classRecord = reference.classByName.get(lower(values.className));
      if (!classRecord) addError('className', `No active class named "${values.className}" in this school`);
    }
    if (values.armName) {
      if (!values.className) addError('armName', 'Needs a className');
      else if (classRecord) {
        armRecord = reference.armByKey.get(`${classRecord.id}|${lower(values.armName)}`);
        if (!armRecord) addError('armName', `Class ${classRecord.name} has no active arm "${values.armName}"`);
      }
    }

    if (values.rollNumber) {
      validateTextLength(values.rollNumber, 20, 'rollNumber', addError);
      const rollKey = `${classRecord ? classRecord.id : null}|${armRecord ? armRecord.id : null}|${values.rollNumber}`;
      if (reference.takenRolls.has(rollKey)) addError('rollNumber', 'Roll number already used in this class and arm');
      else if (seenRolls.has(rollKey)) addError('rollNumber', 'Roll number appears twice for the same class and arm in this file');
      else seenRolls.add(rollKey);
    }

    const guardian = buildGuardian(values, addError);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    if (values.studentId) seenStudentIds.add(values.studentId);
    if (email) seenEmails.add(email);

    valid.push({
      schoolId,
      firstName: values.firstName,
      lastName: values.lastName,
      studentId: values.studentId || undefined,
      email: email || undefined,
      classId: classRecord ? classRecord.id : undefined,
      armId: armRecord ? armRecord.id : undefined,
      // The class name is also what fee invoices and the student dashboard show.
      currentClass: classRecord ? classRecord.name : undefined,
      grade: classRecord ? classRecord.name : undefined,
      rollNumber: values.rollNumber || undefined,
      gender,
      dateOfBirth,
      phone: values.phone || undefined,
      address: values.address || undefined,
      guardian,
      isActive: true,
      createdBy: actor
    });
  }

  return { errors, valid };
};

const insertInChunks = async (tx, data) => {
  let created = 0;
  for (let index = 0; index < data.length; index += INSERT_CHUNK_SIZE) {
    const result = await tx.student.createMany({ data: data.slice(index, index + INSERT_CHUNK_SIZE) });
    created += result.count;
  }
  return created;
};

const importStudents = async (schoolCode, buffer, { dryRun = false } = {}, actor, context = {}) => {
  const school = await findSchool(schoolCode);
  if (school.archivedAt) {
    throw new AppError('This school is archived. Restore it before importing.', 409, 'SCHOOL_ARCHIVED');
  }

  const { rows, ignoredColumns } = csv.readCsvTable(buffer, STUDENT_COLUMNS);
  const reference = await loadReferenceData(school.id, rows);
  const { errors, valid } = validateRows(rows, reference, school.id, actor);

  let imported = 0;
  if (!dryRun && valid.length > 0) {
    try {
      imported = await prisma.$transaction(async (tx) => {
        const created = await insertInChunks(tx, valid);
        await audit.recordInTransaction(tx, {
          action: 'import.students',
          entityType: 'school',
          entityId: school.schoolId,
          schoolId: school.id,
          actor,
          context,
          details: { schoolCode: school.schoolId, totalRows: rows.length, imported: created, rejected: rows.length - valid.length }
        });
        return created;
      });
    } catch (error) {
      if (error && error.code === 'P2002') {
        throw new AppError(
          'Some students were added by someone else while this import ran. Nothing was imported - run it again.',
          409,
          'IMPORT_CONFLICT'
        );
      }
      throw error;
    }

    try {
      await invalidateStudentCaches(school.id);
    } catch (error) {
      logger.warn('Student cache invalidation after import failed', { schoolCode, message: error.message });
    }
  }

  return csv.buildReport({ dryRun, totalRows: rows.length, errors, ignoredColumns, imported });
};

module.exports = {
  STUDENT_COLUMNS,
  templateCsv,
  validateRows,
  importStudents
};

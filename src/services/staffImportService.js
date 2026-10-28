const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { prisma } = require('../config/database');
const { AppError } = require('../utils/AppError');
const csv = require('../utils/csvTable');
const audit = require('./platformAuditService');
const { findSchool } = require('./schoolLifecycleService');

/**
 * Import a school's teachers from a CSV.
 *
 * Creates teacher RECORDS only: no usable password, not verified, no email.
 * Such a record cannot log in. When the teacher is invited later (by the
 * school admin, or in bulk by a system admin) the invitation claims this
 * record instead of creating a second user, and that is when the temporary
 * password is generated and emailed.
 *
 * Only teachers can be imported. School admins hold the keys to a school, so
 * they are never created in bulk from a spreadsheet.
 */

const MAX_SUBJECTS = 15;
const MAX_SUBJECT_LENGTH = 60;
const INSERT_CHUNK_SIZE = 500;

const STAFF_COLUMNS = [
  { key: 'firstName', required: true, aliases: ['givenName', 'forename'] },
  { key: 'lastName', required: true, aliases: ['surname', 'familyName'] },
  { key: 'email', required: true, aliases: ['emailAddress'] },
  { key: 'phone', aliases: ['phoneNumber', 'mobile'] },
  { key: 'subjects', aliases: ['subject', 'subjectsTaught'] },
  { key: 'role', aliases: ['position'] }
];

const TEMPLATE_EXAMPLE = ['Tunde', 'Bello', 'tunde.bello@example.com', '08031234567', 'Mathematics;Physics', 'teacher'];

const templateCsv = () => csv.buildCsv(STAFF_COLUMNS.map((column) => column.key), [TEMPLATE_EXAMPLE]);

const lower = (value) => value.toLowerCase();

const addTextChecks = (value, max, field, addError) => {
  if (value.length > max) addError(field, `Must be ${max} characters or fewer`);
  if (csv.looksLikeFormula(value)) addError(field, 'Must not start with = or @');
};

const loadReferenceData = async (schoolId, rows) => {
  const fileEmails = rows.map((row) => lower(row.values.email)).filter(Boolean);

  const [existing, subjects] = await Promise.all([
    fileEmails.length === 0
      ? Promise.resolve([])
      : prisma.user.findMany({ where: { schoolId, email: { in: fileEmails } }, select: { email: true } }),
    prisma.subject.findMany({ where: { schoolId, isActive: true }, select: { name: true } })
  ]);

  return {
    takenEmails: new Set(existing.map((user) => lower(user.email))),
    subjectByName: new Map(subjects.map((subject) => [lower(subject.name), subject.name]))
  };
};

const validateRows = (rows, reference, schoolId, passwordHash) => {
  const errors = [];
  const warnings = [];
  const valid = [];
  const seenEmails = new Set();

  for (const { line, values } of rows) {
    const rowErrors = [];
    const addError = (field, message) => rowErrors.push({ line, field, message });

    if (!values.firstName) addError('firstName', 'Required');
    else addTextChecks(values.firstName, 100, 'firstName', addError);
    if (!values.lastName) addError('lastName', 'Required');
    else addTextChecks(values.lastName, 100, 'lastName', addError);

    const email = lower(values.email);
    if (!email) addError('email', 'Required');
    else if (!csv.isEmail(email)) addError('email', 'Not a valid email address');
    else if (reference.takenEmails.has(email)) addError('email', 'Someone with this email already exists in the school');
    else if (seenEmails.has(email)) addError('email', 'Appears more than once in this file');

    if (values.phone && !csv.isPhone(values.phone)) addError('phone', 'Not a valid phone number');

    if (values.role && lower(values.role) !== 'teacher') {
      addError('role', 'Only teachers can be imported. School admins are not created from a spreadsheet.');
    }

    const subjects = [];
    if (values.subjects) {
      const requested = csv.splitList(values.subjects);
      if (requested.length > MAX_SUBJECTS) addError('subjects', `At most ${MAX_SUBJECTS} subjects`);
      for (const subject of requested) {
        if (subject.length > MAX_SUBJECT_LENGTH || csv.looksLikeFormula(subject)) {
          addError('subjects', `"${subject.slice(0, 30)}" is not a valid subject name`);
          continue;
        }
        const known = reference.subjectByName.get(lower(subject));
        if (!known) warnings.push({ line, field: 'subjects', message: `"${subject}" is not a subject set up in this school yet` });
        subjects.push(known || subject);
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    seenEmails.add(email);
    valid.push({
      schoolId,
      firstName: values.firstName,
      lastName: values.lastName,
      email,
      phone: values.phone || undefined,
      role: 'teacher',
      subjects: [...new Set(subjects)],
      classes: [],
      password: passwordHash,
      // No login yet: unverified, and nobody invited them.
      isVerified: false,
      isTemporaryPassword: true,
      isActive: true
    });
  }

  return { errors, warnings, valid };
};

const insertInChunks = async (tx, data) => {
  let created = 0;
  for (let index = 0; index < data.length; index += INSERT_CHUNK_SIZE) {
    const result = await tx.user.createMany({ data: data.slice(index, index + INSERT_CHUNK_SIZE) });
    created += result.count;
  }
  return created;
};

const importStaff = async (schoolCode, buffer, { dryRun = false } = {}, actor, context = {}) => {
  const school = await findSchool(schoolCode);
  if (school.archivedAt) {
    throw new AppError('This school is archived. Restore it before importing.', 409, 'SCHOOL_ARCHIVED');
  }

  const { rows, ignoredColumns } = csv.readCsvTable(buffer, STAFF_COLUMNS);
  const reference = await loadReferenceData(school.id, rows);

  // One password nobody knows, shared by every imported record. Hashing a
  // fresh one per row would take minutes for a big file and add no security:
  // the record cannot log in until an invitation replaces this password.
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

  const { errors, warnings, valid } = validateRows(rows, reference, school.id, passwordHash);

  let imported = 0;
  if (!dryRun && valid.length > 0) {
    try {
      imported = await prisma.$transaction(async (tx) => {
        const created = await insertInChunks(tx, valid);
        await audit.recordInTransaction(tx, {
          action: 'import.staff',
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
          'Some of these emails were added by someone else while this import ran. Nothing was imported - run it again.',
          409,
          'IMPORT_CONFLICT'
        );
      }
      throw error;
    }
  }

  return {
    ...csv.buildReport({ dryRun, totalRows: rows.length, errors, warnings, ignoredColumns, imported }),
    nextStep: imported > 0
      ? 'The teachers are records only. Invite them with POST /api/system-admin/schools/:schoolId/staff/invite, or from the school admin dashboard; the invitation will match these records.'
      : undefined
  };
};

module.exports = {
  STAFF_COLUMNS,
  templateCsv,
  validateRows,
  importStaff
};

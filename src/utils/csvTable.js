const { parse } = require('csv-parse/sync');
const { AppError } = require('./AppError');

/**
 * CSV reading and cell validation shared by the student and staff importers.
 *
 * Headers are matched loosely ("First Name", "first_name" and "firstname" are
 * the same column) so a spreadsheet exported by a school does not have to be
 * reshaped by hand. Unknown columns are ignored and reported back.
 */

const MAX_ROWS = 5000;
const MAX_REPORTED_ERRORS = 500;
const EARLIEST_BIRTH_YEAR = 1950;

const normalizeHeader = (header) => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{5,18}[0-9]$/;

const isEmail = (value) => value.length <= 254 && EMAIL_PATTERN.test(value);
const isPhone = (value) => PHONE_PATTERN.test(value);

/**
 * A cell that starts with = or @ would run as a formula when someone opens a
 * later export in a spreadsheet. Names and addresses never legitimately
 * start that way.
 */
const looksLikeFormula = (value) => /^[=@]/.test(value);

/**
 * Accepts YYYY-MM-DD and day-first DD/MM/YYYY or DD-MM-YYYY (the usual order
 * in Nigeria). Anything else, including impossible dates, returns null.
 */
const parseDate = (value) => {
  let year;
  let month;
  let day;

  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) {
    [, year, month, day] = match;
  } else if ((match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value))) {
    [, day, month, year] = match;
  } else {
    return null;
  }

  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const valid =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);
  return valid ? date : null;
};

const isPlausibleBirthDate = (date) =>
  date.getTime() <= Date.now() && date.getUTCFullYear() >= EARLIEST_BIRTH_YEAR;

const normalizeGender = (value) => {
  const key = value.toLowerCase();
  if (['m', 'male', 'boy'].includes(key)) return 'male';
  if (['f', 'female', 'girl'].includes(key)) return 'female';
  if (['o', 'other'].includes(key)) return 'other';
  return null;
};

/** Split a list cell on ";" or "|" (a comma would break the CSV itself). */
const splitList = (value) =>
  value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Read a CSV upload into rows keyed by the columns in `columns`.
 *
 * @param {Buffer} buffer
 * @param {Array<{key: string, required?: boolean, aliases?: string[]}>} columns
 * @returns {{rows: Array<{line: number, values: object}>, ignoredColumns: string[]}}
 */
const readCsvTable = (buffer, columns) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('The uploaded file is empty', 400, 'CSV_EMPTY');
  }
  // A spreadsheet saved as .xlsx is a zip file full of NUL bytes, not text.
  if (buffer.includes(0)) {
    throw new AppError('This does not look like a CSV text file. Export the sheet as CSV and try again.', 400, 'CSV_NOT_TEXT');
  }

  const headerLookup = new Map();
  for (const column of columns) {
    headerLookup.set(normalizeHeader(column.key), column.key);
    (column.aliases || []).forEach((alias) => headerLookup.set(normalizeHeader(alias), column.key));
  }

  let headerNames = [];
  const ignoredColumns = [];
  const seenKeys = new Set();

  let records;
  try {
    records = parse(buffer, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
      relax_column_count: true,
      info: true,
      columns: (header) => {
        headerNames = header;
        return header.map((name, index) => {
          const key = headerLookup.get(normalizeHeader(name));
          if (!key) {
            ignoredColumns.push(name);
            return `__ignored_${index}`;
          }
          if (seenKeys.has(key)) {
            throw new AppError(`The column "${key}" appears more than once`, 400, 'CSV_DUPLICATE_COLUMN');
          }
          seenKeys.add(key);
          return key;
        });
      }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(`Could not read the CSV: ${error.message}`, 400, 'CSV_PARSE_ERROR');
  }

  const missing = columns.filter((column) => column.required && !seenKeys.has(column.key)).map((column) => column.key);
  if (missing.length > 0) {
    throw new AppError(
      `The CSV is missing required column(s): ${missing.join(', ')}. Found: ${headerNames.join(', ') || 'none'}`,
      400,
      'CSV_MISSING_COLUMNS'
    );
  }
  if (records.length === 0) {
    throw new AppError('The CSV has a header but no data rows', 400, 'CSV_EMPTY');
  }
  if (records.length > MAX_ROWS) {
    throw new AppError(`The CSV has ${records.length} rows; the limit is ${MAX_ROWS}. Split the file and import it in parts.`, 400, 'CSV_TOO_MANY_ROWS');
  }

  const rows = records.map(({ record, info }) => {
    const values = {};
    for (const column of columns) {
      values[column.key] = record[column.key] === undefined ? '' : String(record[column.key]).trim();
    }
    return { line: info.lines, values };
  });

  return { rows, ignoredColumns };
};

const quoteCell = (value) => {
  const text = String(value === undefined || value === null ? '' : value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Build a CSV string (used for the downloadable templates). */
const buildCsv = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(quoteCell).join(',')).join('\r\n') + '\r\n';

/** The part of an import result both importers share. */
const buildReport = ({ dryRun, totalRows, errors, warnings = [], ignoredColumns, imported }) => {
  const invalidLines = new Set(errors.map((error) => error.line));
  return {
    dryRun,
    summary: {
      totalRows,
      valid: totalRows - invalidLines.size,
      invalid: invalidLines.size,
      imported
    },
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    errorsTruncated: errors.length > MAX_REPORTED_ERRORS,
    warnings: warnings.slice(0, MAX_REPORTED_ERRORS),
    ignoredColumns
  };
};

module.exports = {
  MAX_ROWS,
  normalizeHeader,
  isEmail,
  isPhone,
  looksLikeFormula,
  parseDate,
  isPlausibleBirthDate,
  normalizeGender,
  splitList,
  readCsvTable,
  buildCsv,
  buildReport
};

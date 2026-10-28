/**
 * CSV reader and cell validators shared by the student and staff importers.
 */

const csv = require('../csvTable');

const COLUMNS = [
  { key: 'firstName', required: true, aliases: ['given name'] },
  { key: 'lastName', required: true, aliases: ['surname'] },
  { key: 'email' }
];

const read = (text) => csv.readCsvTable(Buffer.from(text), COLUMNS);

describe('readCsvTable', () => {
  it('should match headers loosely and ignore unknown columns, reporting them', () => {
    const { rows, ignoredColumns } = read('Given Name,SURNAME,E-mail,Notes\nAda,Obi,ada@x.test,hello\n');

    // "Given Name" and "SURNAME" are aliases, "E-mail" matches "email"; "Notes" is unknown.
    expect(rows[0].values).toEqual({ firstName: 'Ada', lastName: 'Obi', email: 'ada@x.test' });
    expect(ignoredColumns).toEqual(['Notes']);
  });

  it('should recognise the canonical name in any case or punctuation', () => {
    const { rows } = read('first_name,Last Name,EMAIL\nAda,Obi,ada@x.test\n'.replace('first_name', 'First-Name'));

    expect(rows[0].values.firstName).toBe('Ada');
    expect(rows[0].values.email).toBe('ada@x.test');
  });

  it('should handle a byte order mark, quoted commas, escaped quotes and multi-line cells', () => {
    const { rows } = read('﻿firstName,lastName,email\r\nAda,"Love, lace",\r\nBo,"say ""hi""",\r\nCy,"two\nlines",\r\n');

    expect(rows.map((row) => row.values.lastName)).toEqual(['Love, lace', 'say "hi"', 'two\nlines']);
  });

  it('should skip blank lines and lines of only commas', () => {
    const { rows } = read('firstName,lastName,email\nAda,Obi,\n\n,,\nBo,Eze,\n');

    expect(rows.map((row) => row.values.firstName)).toEqual(['Ada', 'Bo']);
  });

  it('should trim cells and treat short rows as empty cells', () => {
    const { rows } = read('firstName,lastName,email\n  Ada  ,  Obi  \n');

    expect(rows[0].values).toEqual({ firstName: 'Ada', lastName: 'Obi', email: '' });
  });

  it('should report the line each row came from', () => {
    const { rows } = read('firstName,lastName\nAda,Obi\n\nBo,Eze\n');

    expect(rows.map((row) => row.line)).toEqual([2, 4]);
  });

  it('should reject a file that is missing a required column and say what it found', () => {
    expect(() => read('firstName,email\nAda,a@x.test\n')).toThrow(
      expect.objectContaining({ code: 'CSV_MISSING_COLUMNS', statusCode: 400, message: expect.stringContaining('lastName') })
    );
  });

  it('should reject the same column given twice', () => {
    expect(() => read('firstName,First Name,lastName\nAda,Ada,Obi\n')).toThrow(expect.objectContaining({ code: 'CSV_DUPLICATE_COLUMN' }));
  });

  it('should reject an empty file, a header-only file and a spreadsheet', () => {
    expect(() => csv.readCsvTable(Buffer.alloc(0), COLUMNS)).toThrow(expect.objectContaining({ code: 'CSV_EMPTY' }));
    expect(() => read('firstName,lastName\n')).toThrow(expect.objectContaining({ code: 'CSV_EMPTY' }));
    expect(() => csv.readCsvTable(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]), COLUMNS)).toThrow(expect.objectContaining({ code: 'CSV_NOT_TEXT' }));
  });

  it('should report a malformed quote as a 400', () => {
    expect(() => read('firstName,lastName\n"Ada,Obi\n')).toThrow(expect.objectContaining({ code: 'CSV_PARSE_ERROR', statusCode: 400 }));
  });

  it('should refuse more rows than the limit', () => {
    const body = Array.from({ length: csv.MAX_ROWS + 1 }, (_, index) => `A${index},B${index}`).join('\n');

    expect(() => read(`firstName,lastName\n${body}\n`)).toThrow(expect.objectContaining({ code: 'CSV_TOO_MANY_ROWS' }));
  });

  it('should accept exactly the maximum number of rows', () => {
    const body = Array.from({ length: csv.MAX_ROWS }, (_, index) => `A${index},B${index}`).join('\n');

    expect(read(`firstName,lastName\n${body}\n`).rows).toHaveLength(csv.MAX_ROWS);
  });
});

describe('cell validators', () => {
  it('should validate emails and phone numbers', () => {
    expect(csv.isEmail('ada@school.test')).toBe(true);
    expect(['ada', 'ada@', '@x.test', 'a b@x.test', `${'a'.repeat(250)}@x.test`].some(csv.isEmail)).toBe(false);

    expect(['08031234567', '+2348031234567', '0803 123 4567', '0803-123-4567'].every(csv.isPhone)).toBe(true);
    expect(['', '123', 'phone', '+', '08031234567890123456789'].some(csv.isPhone)).toBe(false);
  });

  it('should parse ISO and day-first dates and refuse impossible ones', () => {
    expect(csv.parseDate('2012-03-09').toISOString()).toBe('2012-03-09T00:00:00.000Z');
    expect(csv.parseDate('09/03/2012').toISOString()).toBe('2012-03-09T00:00:00.000Z');
    expect(csv.parseDate('9-3-2012').toISOString()).toBe('2012-03-09T00:00:00.000Z');
    expect(csv.parseDate('31/02/2012')).toBeNull();
    expect(csv.parseDate('2012-13-01')).toBeNull();
    expect(csv.parseDate('03/09/12')).toBeNull();
    expect(csv.parseDate('March 9 2012')).toBeNull();
  });

  it('should only accept plausible birth dates', () => {
    expect(csv.isPlausibleBirthDate(csv.parseDate('2012-03-09'))).toBe(true);
    expect(csv.isPlausibleBirthDate(new Date(Date.now() + 86400000))).toBe(false);
    expect(csv.isPlausibleBirthDate(csv.parseDate('1899-01-01'))).toBe(false);
  });

  it('should normalise gender words', () => {
    expect(['M', 'male', 'Boy'].map(csv.normalizeGender)).toEqual(['male', 'male', 'male']);
    expect(['f', 'FEMALE', 'girl'].map(csv.normalizeGender)).toEqual(['female', 'female', 'female']);
    expect(csv.normalizeGender('other')).toBe('other');
    expect(csv.normalizeGender('x')).toBeNull();
  });

  it('should split lists on semicolons and pipes but not commas', () => {
    expect(csv.splitList('Maths; Physics |Chemistry;; ')).toEqual(['Maths', 'Physics', 'Chemistry']);
    expect(csv.splitList('Maths, Physics')).toEqual(['Maths, Physics']);
  });

  it('should flag values that would run as a spreadsheet formula', () => {
    expect(csv.looksLikeFormula('=HYPERLINK("http://evil")')).toBe(true);
    expect(csv.looksLikeFormula('@SUM(A1)')).toBe(true);
    expect(csv.looksLikeFormula('Ada')).toBe(false);
    expect(csv.looksLikeFormula('+234 803 000 0000')).toBe(false);
  });
});

describe('buildCsv and buildReport', () => {
  it('should quote cells that need it and round-trip through the reader', () => {
    const text = csv.buildCsv(['firstName', 'lastName'], [['Ada', 'Love, lace'], ['Bo', 'say "hi"']]);

    expect(text).toBe('firstName,lastName\r\nAda,"Love, lace"\r\nBo,"say ""hi"""\r\n');
    expect(read(text).rows.map((row) => row.values.lastName)).toEqual(['Love, lace', 'say "hi"']);
  });

  it('should count a row once however many errors it has', () => {
    const report = csv.buildReport({
      dryRun: true,
      totalRows: 5,
      errors: [{ line: 2, field: 'a', message: 'x' }, { line: 2, field: 'b', message: 'y' }, { line: 4, field: 'a', message: 'z' }],
      ignoredColumns: ['Notes'],
      imported: 0
    });

    expect(report.summary).toEqual({ totalRows: 5, valid: 3, invalid: 2, imported: 0 });
    expect(report.dryRun).toBe(true);
    expect(report.ignoredColumns).toEqual(['Notes']);
  });

  it('should cap how many errors are reported and say so', () => {
    const errors = Array.from({ length: 700 }, (_, index) => ({ line: index + 2, field: 'a', message: 'x' }));

    const report = csv.buildReport({ dryRun: false, totalRows: 700, errors, ignoredColumns: [], imported: 0 });

    expect(report.errors).toHaveLength(500);
    expect(report.errorsTruncated).toBe(true);
    expect(report.summary.invalid).toBe(700);
  });
});

/**
 * Human-readable school codes: three letters taken from the school name plus
 * four digits (for example "GRE4821"). This is the `schoolId` users type at
 * login; the database primary key is a separate UUID.
 */

const SCHOOL_CODE_PATTERN = /^[A-Z]{3}\d{4}$/;
const MAX_CODE_ATTEMPTS = 10;

const buildSchoolCode = (schoolName) => {
  const prefix = String(schoolName || '')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');

  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}${suffix}`;
};

/**
 * Generate a school code that is not used yet. The column is unique, so a
 * clash is checked for instead of being left to fail on insert.
 *
 * @param {object} client Prisma client or transaction client
 * @param {string} schoolName
 */
const generateUniqueSchoolCode = async (client, schoolName) => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = buildSchoolCode(schoolName);
    const clash = await client.school.findUnique({ where: { schoolId: code }, select: { id: true } });
    if (!clash) return code;
  }
  throw new Error('Could not generate a unique school ID, please try again');
};

module.exports = {
  SCHOOL_CODE_PATTERN,
  buildSchoolCode,
  generateUniqueSchoolCode
};

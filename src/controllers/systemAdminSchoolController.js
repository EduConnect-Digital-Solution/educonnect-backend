const catchAsync = require('../utils/catchAsync');
const lifecycle = require('../services/schoolLifecycleService');
const accountRemoval = require('../services/accountRemovalService');
const studentImport = require('../services/studentImportService');
const staffImport = require('../services/staffImportService');
const staffInvite = require('../services/staffInviteService');
const audit = require('../services/platformAuditService');

/**
 * System admin school operations: oversee a school, archive/restore/purge it,
 * remove people, import from CSV and invite imported staff.
 *
 * Failures are thrown as AppError by the services and formatted by the global
 * error handler, so a controller only has to describe the success case.
 */

const actorOf = (req) => req.user.email;
const contextOf = (req) => audit.contextFromRequest(req);
const respond = (res, status, message, data) => res.status(status).json({ success: true, message, data });

// ---------------------------------------------------------------------------
// Oversight
// ---------------------------------------------------------------------------

const getSchoolDetail = catchAsync(async (req, res) => {
  respond(res, 200, 'School retrieved successfully', await lifecycle.getSchoolDetail(req.params.schoolId));
});

const listSchoolStudents = catchAsync(async (req, res) => {
  const { page, limit, search, status, classId } = req.query;
  const result = await lifecycle.listStudents(req.params.schoolId, { page, limit, search, status, classId });
  respond(res, 200, 'Students retrieved successfully', result);
});

const listSchoolStaff = catchAsync(async (req, res) => {
  const { page, limit, search, status, role } = req.query;
  const result = await lifecycle.listStaff(req.params.schoolId, { page, limit, search, status, role });
  respond(res, 200, 'Staff retrieved successfully', result);
});

const listAuditLogs = catchAsync(async (req, res) => {
  const { schoolId, action, actor, page, limit } = req.query;
  respond(res, 200, 'Audit log retrieved successfully', await audit.list({ schoolId, action, actor, page, limit }));
});

// ---------------------------------------------------------------------------
// Archive, restore, purge
// ---------------------------------------------------------------------------

const archiveSchool = catchAsync(async (req, res) => {
  const result = await lifecycle.archiveSchool(req.params.schoolId, req.body, actorOf(req), contextOf(req));
  respond(res, 200, 'School archived. Everyone in it is locked out and the data is kept.', result);
});

const restoreSchool = catchAsync(async (req, res) => {
  const result = await lifecycle.restoreSchool(req.params.schoolId, req.body, actorOf(req), contextOf(req));
  respond(res, 200, 'School restored', result);
});

const deleteSchool = catchAsync(async (req, res) => {
  const result = await lifecycle.deleteSchool(req.params.schoolId, req.body, actorOf(req), contextOf(req));
  respond(res, 200, 'School deleted. It is hidden and locked; nothing was erased and it can be restored.', result);
});

// ---------------------------------------------------------------------------
// Removing people
// ---------------------------------------------------------------------------

const removeUser = catchAsync(async (req, res) => {
  const { schoolId, userId } = req.params;
  const result = await accountRemoval.removeUser(schoolId, userId, req.body, actorOf(req), contextOf(req));
  respond(res, 200, 'User removed. Their account is closed and personal details are erased.', result);
});

const removeStudent = catchAsync(async (req, res) => {
  const { schoolId, studentId } = req.params;
  const result = await accountRemoval.removeStudent(schoolId, studentId, req.body, actorOf(req), contextOf(req));
  respond(res, 200, 'Student removed. Personal details are erased and records are kept.', result);
});

// ---------------------------------------------------------------------------
// CSV import and invitations
// ---------------------------------------------------------------------------

const isDryRun = (req) => req.query.dryRun === 'true';

const importStudents = catchAsync(async (req, res) => {
  const dryRun = isDryRun(req);
  const result = await studentImport.importStudents(req.params.schoolId, req.csvBuffer, { dryRun }, actorOf(req), contextOf(req));
  respond(res, 200, dryRun ? 'Dry run complete. Nothing was imported.' : 'Student import complete', result);
});

const importStaff = catchAsync(async (req, res) => {
  const dryRun = isDryRun(req);
  const result = await staffImport.importStaff(req.params.schoolId, req.csvBuffer, { dryRun }, actorOf(req), contextOf(req));
  respond(res, 200, dryRun ? 'Dry run complete. Nothing was imported.' : 'Staff import complete', result);
});

const sendCsv = (res, filename, content) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(content);
};

const studentTemplate = (req, res) => sendCsv(res, 'students-template.csv', studentImport.templateCsv());
const staffTemplate = (req, res) => sendCsv(res, 'staff-template.csv', staffImport.templateCsv());

const inviteImportedStaff = catchAsync(async (req, res) => {
  const result = await staffInvite.inviteImportedStaff(req.params.schoolId, req.body, actorOf(req), contextOf(req));
  respond(res, 200, 'Invitations processed', result);
});

module.exports = {
  getSchoolDetail,
  listSchoolStudents,
  listSchoolStaff,
  listAuditLogs,
  archiveSchool,
  restoreSchool,
  deleteSchool,
  removeUser,
  removeStudent,
  importStudents,
  importStaff,
  studentTemplate,
  staffTemplate,
  inviteImportedStaff
};

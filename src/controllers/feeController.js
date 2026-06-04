const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const feeService = require('../services/feeService');

const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  return null;
};

const handleError = (res, error, context) => {
  logger.error(`Fee error [${context}]:`, error.message);
  const status = error.message.includes('not found') ? 404
    : error.message.includes('Cannot') || error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('must') ? 400
    : error.message.includes('already') || error.message.includes('published') || error.message.includes('delet') || error.message.includes('void') ? 409
    : 500;
  return res.status(status).json({ success: false, message: error.message });
};

// A. Fee Structure
const getFeeStructures = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getFeeStructures(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getFeeStructures'); }
};

const getFeeStructureById = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getFeeStructureById(req.params.id, req.user.schoolId);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getFeeStructureById'); }
};

const createFeeStructure = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.createFeeStructure(req.user.schoolId, req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Fee structure created successfully', data: result });
  } catch (error) { handleError(res, error, 'createFeeStructure'); }
};

const updateFeeStructure = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.updateFeeStructure(req.params.id, req.user.schoolId, req.body, req.user.id);
    res.json({ success: true, message: 'Fee structure updated successfully', data: result });
  } catch (error) { handleError(res, error, 'updateFeeStructure'); }
};

const deleteFeeStructure = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.deleteFeeStructure(req.params.id, req.user.schoolId);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error, 'deleteFeeStructure'); }
};

const cloneFeeStructure = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.cloneFeeStructure(req.params.id, req.user.schoolId, req.body, req.user.id);
    res.json({ success: true, message: 'Fee structure cloned successfully', data: result });
  } catch (error) { handleError(res, error, 'cloneFeeStructure'); }
};

const transitionFeeStructure = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.transitionFeeStructure(req.params.id, req.user.schoolId, req.body.action, req.user.id);
    res.json({ success: true, message: result.feeStructure.status === 'published' ? 'Fee structure published — parents and students can now see it on their dashboards.' : 'Fee structure reverted to draft.', data: result });
  } catch (error) { handleError(res, error, 'transitionFeeStructure'); }
};

const getFeeStructureVersions = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getFeeStructureVersions(req.params.id, req.user.schoolId);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getFeeStructureVersions'); }
};

// B. Invoices
const getInvoices = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getInvoices(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getInvoices'); }
};

const getInvoiceById = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getInvoiceById(req.params.id, req.user.schoolId);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getInvoiceById'); }
};

const createInvoices = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.createInvoices(req.user.schoolId, req.body, req.user.id);
    res.status(201).json({ success: true, message: `${result.total} invoice(s) created successfully`, data: result });
  } catch (error) { handleError(res, error, 'createInvoices'); }
};

const generateInvoicesForClass = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.generateInvoicesForClass(req.user.schoolId, req.body, req.user.id);
    res.json({ success: true, message: 'Invoices generated for class', data: result });
  } catch (error) { handleError(res, error, 'generateInvoicesForClass'); }
};

const voidInvoice = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.voidInvoice(req.params.id, req.user.schoolId, req.body.reason, req.user.id);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error, 'voidInvoice'); }
};

const getStudentFees = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getStudentFees(req.params.studentId, req.user.schoolId);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getStudentFees'); }
};

// C. Payments
const recordPayment = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.recordPayment(req.params.invoiceId, req.user.schoolId, req.body, req.user.id);
    res.json({ success: true, message: 'Payment recorded successfully', data: result });
  } catch (error) { handleError(res, error, 'recordPayment'); }
};

const initializePayment = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.initializePayment(req.params.invoiceId, req.user.schoolId, req.body);
    res.json({ success: true, message: 'Payment initialized', data: result });
  } catch (error) { handleError(res, error, 'initializePayment'); }
};

const verifyPayment = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.verifyPayment(req.body);
    res.json({ success: true, message: 'Payment verified', data: result });
  } catch (error) { handleError(res, error, 'verifyPayment'); }
};

const getPaymentHistory = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getPaymentHistory(req.params.invoiceId, req.user.schoolId);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getPaymentHistory'); }
};

const getAllPayments = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getAllPayments(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getAllPayments'); }
};

// D. Adjustments
const applyAdjustment = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.applyAdjustment(req.user.schoolId, req.body, req.user.id);
    res.json({ success: true, message: 'Adjustment applied successfully', data: result });
  } catch (error) { handleError(res, error, 'applyAdjustment'); }
};

const getAdjustments = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getAdjustments(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getAdjustments'); }
};

// E. Ledger
const getStudentLedger = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getStudentLedger(req.params.studentId, req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getStudentLedger'); }
};

const getLedgerSummary = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getLedgerSummary(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getLedgerSummary'); }
};

// F. Receipts
const getReceipt = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getReceipt(req.params.paymentId, req.user.schoolId);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getReceipt'); }
};

const sendReceipt = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.sendReceipt(req.params.paymentId, req.user.schoolId, req.body);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error, 'sendReceipt'); }
};

// G. Reporting
const getFeeAnalytics = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getFeeAnalytics(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getFeeAnalytics'); }
};

const getOutstandingBalances = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getOutstandingBalances(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getOutstandingBalances'); }
};

const getAgingReport = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getAgingReport(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getAgingReport'); }
};

const getCollectionReport = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getCollectionReport(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getCollectionReport'); }
};

// H. Reconciliation
const getReconciliation = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.getReconciliation(req.user.schoolId, req.query);
    res.json({ success: true, data: result });
  } catch (error) { handleError(res, error, 'getReconciliation'); }
};

const reconcileTransaction = async (req, res) => {
  const err = handleValidation(req, res);
  if (err) return;
  try {
    const result = await feeService.reconcileTransaction(req.user.schoolId, req.body);
    res.json({ success: true, ...result });
  } catch (error) { handleError(res, error, 'reconcileTransaction'); }
};

module.exports = {
  getFeeStructures,
  getFeeStructureById,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  cloneFeeStructure,
  transitionFeeStructure,
  getFeeStructureVersions,
  getInvoices,
  getInvoiceById,
  createInvoices,
  generateInvoicesForClass,
  voidInvoice,
  getStudentFees,
  recordPayment,
  initializePayment,
  verifyPayment,
  getPaymentHistory,
  getAllPayments,
  applyAdjustment,
  getAdjustments,
  getStudentLedger,
  getLedgerSummary,
  getReceipt,
  sendReceipt,
  getFeeAnalytics,
  getOutstandingBalances,
  getAgingReport,
  getCollectionReport,
  getReconciliation,
  reconcileTransaction
};

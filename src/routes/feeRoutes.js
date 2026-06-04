const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const validation = require('../middleware/feeValidation');

router.use(authenticate);

// A. Fee Structure
router.get('/structures', authorize('fees.read'), validation.validateGetFeeStructures, feeController.getFeeStructures);
router.get('/structures/:id', authorize('fees.read'), validation.validateGetFeeStructureById, feeController.getFeeStructureById);
router.post('/structures', authorize('fees.create'), validation.validateCreateFeeStructure, feeController.createFeeStructure);
router.put('/structures/:id', authorize('fees.update'), validation.validateUpdateFeeStructure, feeController.updateFeeStructure);
router.delete('/structures/:id', authorize('fees.delete'), validation.validateDeleteFeeStructure, feeController.deleteFeeStructure);
router.post('/structures/:id/clone', authorize('fees.create'), validation.validateCloneFeeStructure, feeController.cloneFeeStructure);
router.post('/structures/:id/transition', authorize('fees.update'), validation.validateTransitionFeeStructure, feeController.transitionFeeStructure);
router.get('/structures/:id/versions', authorize('fees.read'), validation.validateGetFeeStructureVersions, feeController.getFeeStructureVersions);

// B. Invoices
router.get('/invoices', authorize('fees.read'), validation.validateGetInvoices, feeController.getInvoices);
router.get('/invoices/:id', authorize('fees.read'), validation.validateGetInvoiceById, feeController.getInvoiceById);
router.post('/invoices', authorize('fees.create'), validation.validateCreateInvoices, feeController.createInvoices);
router.post('/invoices/generate/class', authorize('fees.create'), validation.validateGenerateInvoices, feeController.generateInvoicesForClass);
router.put('/invoices/:id/void', authorize('fees.update'), validation.validateVoidInvoice, feeController.voidInvoice);
router.get('/students/:studentId/fees', authorize('fees.read'), validation.validateGetStudentFees, feeController.getStudentFees);

// C. Payments
router.post('/invoices/:invoiceId/payments', authorize('fees.create'), validation.validateRecordPayment, feeController.recordPayment);
router.post('/invoices/:invoiceId/initialize', authorize('fees.create'), validation.validateInitializePayment, feeController.initializePayment);
router.post('/payments/verify', authorize('fees.create'), validation.validateVerifyPayment, feeController.verifyPayment);
router.get('/invoices/:invoiceId/payments', authorize('fees.read'), validation.validateGetPaymentHistory, feeController.getPaymentHistory);
router.get('/payments', authorize('fees.read'), validation.validateGetAllPayments, feeController.getAllPayments);

// D. Adjustments
router.post('/adjustments', authorize('fees.create'), validation.validateApplyAdjustment, feeController.applyAdjustment);
router.get('/adjustments', authorize('fees.read'), validation.validateGetAdjustments, feeController.getAdjustments);

// E. Ledger
router.get('/ledger/students/:studentId', authorize('fees.read'), validation.validateGetStudentLedger, feeController.getStudentLedger);
router.get('/ledger/summary', authorize('fees.read'), validation.validateGetLedgerSummary, feeController.getLedgerSummary);

// F. Receipts
router.get('/receipts/:paymentId', authorize('fees.read'), validation.validateGetReceipt, feeController.getReceipt);
router.post('/receipts/:paymentId/send', authorize('fees.create'), validation.validateSendReceipt, feeController.sendReceipt);

// G. Reporting
router.get('/reports/analytics', authorize('fees.read'), validation.validateGetFeeAnalytics, feeController.getFeeAnalytics);
router.get('/reports/outstanding', authorize('fees.read'), validation.validateGetOutstandingBalances, feeController.getOutstandingBalances);
router.get('/reports/aging', authorize('fees.read'), validation.validateGetAgingReport, feeController.getAgingReport);
router.get('/reports/collections', authorize('fees.read'), validation.validateGetCollectionReport, feeController.getCollectionReport);

// H. Reconciliation
router.get('/reconciliation', authorize('fees.admin'), validation.validateGetReconciliation, feeController.getReconciliation);
router.post('/reconciliation/match', authorize('fees.admin'), validation.validateReconcileTransaction, feeController.reconcileTransaction);

module.exports = router;

const { body, query, param } = require('express-validator');

const validateGetFeeStructures = [
  query('academicYearId').optional().isString(),
  query('termId').optional().isString(),
  query('classId').optional().isString(),
  query('status').optional().isIn(['draft', 'published']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateGetFeeStructureById = [
  param('id').isUUID().withMessage('Invalid fee structure ID')
];

const validateCreateFeeStructure = [
  body('academicYearId').optional().isString(),
  body('termId').optional().isString(),
  body('classId').optional().isString(),
  body('armId').optional().isString(),
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one fee item is required'),
  body('items.*.feeType').isString().notEmpty(),
  body('items.*.name').isString().notEmpty(),
  body('items.*.amount').isInt({ min: 1 }),
  body('items.*.optional').optional().isBoolean(),
  body('totalAmount').isInt({ min: 1 }).withMessage('Total amount must be a positive integer'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('paymentType').isIn(['one-time', 'installment']).withMessage('Payment type must be one-time or installment'),
  body('installmentPlans').optional().isArray(),
  body('installmentPlans.*.label').if(body('installmentPlans').exists()).isString().notEmpty(),
  body('installmentPlans.*.percentage').if(body('installmentPlans').exists()).isInt({ min: 1, max: 100 }),
  body('installmentPlans.*.dueDate').if(body('installmentPlans').exists()).isISO8601()
];

const validateUpdateFeeStructure = [
  param('id').isUUID().withMessage('Invalid fee structure ID'),
  body('name').optional().trim().isLength({ min: 1 }),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.feeType').optional().isString().notEmpty(),
  body('items.*.name').optional().isString().notEmpty(),
  body('items.*.amount').optional().isInt({ min: 1 }),
  body('items.*.optional').optional().isBoolean(),
  body('totalAmount').optional().isInt({ min: 1 }),
  body('dueDate').optional().isISO8601(),
  body('paymentType').optional().isIn(['one-time', 'installment']),
  body('installmentPlans').optional().isArray(),
  body('installmentPlans.*.label').if(body('installmentPlans').exists()).isString().notEmpty(),
  body('installmentPlans.*.percentage').if(body('installmentPlans').exists()).isInt({ min: 1, max: 100 }),
  body('installmentPlans.*.dueDate').if(body('installmentPlans').exists()).isISO8601()
];

const validateDeleteFeeStructure = [
  param('id').isUUID().withMessage('Invalid fee structure ID')
];

const validateCloneFeeStructure = [
  param('id').isUUID().withMessage('Invalid fee structure ID'),
  body('targetAcademicYearId').optional().isString(),
  body('targetTermId').optional().isString(),
  body('targetClassIds').isArray({ min: 1 }).withMessage('At least one target class ID is required'),
  body('targetClassIds.*').isString().notEmpty()
];

const validateTransitionFeeStructure = [
  param('id').isUUID().withMessage('Invalid fee structure ID'),
  body('action').isIn(['publish', 'revert_draft']).withMessage('Action must be publish or revert_draft')
];

const validateGetFeeStructureVersions = [
  param('id').isUUID().withMessage('Invalid fee structure ID')
];

const validateGetInvoices = [
  query('academicYearId').optional().isString(),
  query('termId').optional().isString(),
  query('classId').optional().isString(),
  query('studentId').optional().isString(),
  query('status').optional().isIn(['pending', 'partial', 'paid', 'overdue', 'void']),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateGetInvoiceById = [
  param('id').isUUID().withMessage('Invalid invoice ID')
];

const validateCreateInvoices = [
  body('invoices').isArray({ min: 1 }).withMessage('At least one invoice is required'),
  body('invoices.*.feeStructureId').isUUID(),
  body('invoices.*.studentId').isUUID()
];

const validateGenerateInvoices = [
  body('feeStructureId').isUUID().withMessage('Fee structure ID is required'),
  body('classId').isUUID().withMessage('Class ID is required'),
  body('armId').optional().isUUID(),
  body('includeOptional').optional().isArray(),
  body('includeOptional.*').isString()
];

const validateVoidInvoice = [
  param('id').isUUID().withMessage('Invalid invoice ID'),
  body('reason').optional().trim().isLength({ max: 500 })
];

const validateGetStudentFees = [
  param('studentId').isUUID().withMessage('Invalid student ID')
];

const validateRecordPayment = [
  param('invoiceId').isUUID().withMessage('Invalid invoice ID'),
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('paymentMethod').isIn(['cash', 'bank_transfer', 'pos', 'cheque', 'card', 'mobile_money']).withMessage('Invalid payment method'),
  body('referenceNumber').optional().trim(),
  body('receiptNumber').optional().trim(),
  body('note').optional().trim().isLength({ max: 500 }),
  body('paidAt').optional().isISO8601()
];

const validateInitializePayment = [
  param('invoiceId').isUUID().withMessage('Invalid invoice ID'),
  body('gateway').isIn(['paystack', 'flutterwave']).withMessage('Gateway must be paystack or flutterwave'),
  body('amount').isInt({ min: 1 }),
  body('email').isEmail(),
  body('callbackUrl').optional().isURL()
];

const validateVerifyPayment = [
  body('reference').isString().notEmpty().withMessage('Payment reference is required'),
  body('gateway').isIn(['paystack', 'flutterwave']).withMessage('Gateway must be paystack or flutterwave')
];

const validateGetPaymentHistory = [
  param('invoiceId').isUUID().withMessage('Invalid invoice ID')
];

const validateGetAllPayments = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('method').optional().isString(),
  query('gateway').optional().isString(),
  query('status').optional().isIn(['pending', 'confirmed', 'failed']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateApplyAdjustment = [
  body('studentId').isUUID().withMessage('Student ID is required'),
  body('invoiceId').optional().isUUID(),
  body('type').isIn(['discount', 'waiver', 'scholarship', 'correction']).withMessage('Invalid adjustment type'),
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('reason').trim().isLength({ min: 1 }).withMessage('Reason is required')
];

const validateGetAdjustments = [
  query('studentId').optional().isUUID(),
  query('type').optional().isString(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601()
];

const validateGetStudentLedger = [
  param('studentId').isUUID().withMessage('Invalid student ID'),
  query('academicYearId').optional().isString(),
  query('termId').optional().isString()
];

const validateGetLedgerSummary = [
  query('academicYearId').optional().isString(),
  query('termId').optional().isString()
];

const validateGetReceipt = [
  param('paymentId').isUUID().withMessage('Invalid payment ID')
];

const validateSendReceipt = [
  param('paymentId').isUUID().withMessage('Invalid payment ID'),
  body('channel').isIn(['email', 'sms']).withMessage('Channel must be email or sms'),
  body('to').isString().notEmpty().withMessage('Recipient is required')
];

const validateGetFeeAnalytics = [
  query('academicYearId').optional().isString(),
  query('termId').optional().isString(),
  query('classId').optional().isString()
];

const validateGetOutstandingBalances = [
  query('academicYearId').optional().isString(),
  query('termId').optional().isString(),
  query('classId').optional().isString(),
  query('armId').optional().isString(),
  query('threshold').optional().isInt(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateGetAgingReport = [
  query('academicYearId').optional().isString(),
  query('termId').optional().isString(),
  query('classId').optional().isString()
];

const validateGetCollectionReport = [
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('academicYearId').optional().isString(),
  query('termId').optional().isString(),
  query('classId').optional().isString()
];

const validateGetReconciliation = [
  query('gateway').optional().isIn(['paystack', 'flutterwave']),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('status').optional().isIn(['matched', 'unmatched']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const validateReconcileTransaction = [
  body('settlementId').isString().notEmpty().withMessage('Settlement ID is required'),
  body('paymentId').isUUID().withMessage('Valid payment ID is required')
];

const validateImportSettlements = [
  body('gateway').optional().isIn(['paystack', 'flutterwave']).withMessage('Gateway must be paystack or flutterwave'),
  body('settlements').isArray({ min: 1 }).withMessage('At least one settlement is required'),
  body('settlements.*.settlementId').isString().notEmpty().withMessage('Settlement ID is required'),
  body('settlements.*.amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer'),
  body('settlements.*.settledAt').isISO8601().withMessage('Valid settlement date is required')
];

module.exports = {
  validateGetFeeStructures,
  validateGetFeeStructureById,
  validateCreateFeeStructure,
  validateUpdateFeeStructure,
  validateDeleteFeeStructure,
  validateCloneFeeStructure,
  validateTransitionFeeStructure,
  validateGetFeeStructureVersions,
  validateGetInvoices,
  validateGetInvoiceById,
  validateCreateInvoices,
  validateGenerateInvoices,
  validateVoidInvoice,
  validateGetStudentFees,
  validateRecordPayment,
  validateInitializePayment,
  validateVerifyPayment,
  validateGetPaymentHistory,
  validateGetAllPayments,
  validateApplyAdjustment,
  validateGetAdjustments,
  validateGetStudentLedger,
  validateGetLedgerSummary,
  validateGetReceipt,
  validateSendReceipt,
  validateGetFeeAnalytics,
  validateGetOutstandingBalances,
  validateGetAgingReport,
  validateGetCollectionReport,
  validateGetReconciliation,
  validateReconcileTransaction,
  validateImportSettlements
};

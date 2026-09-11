const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const AMOUNT_MULTIPLIER = 100;

const koBo = (amount) => Math.round(amount * AMOUNT_MULTIPLIER);
const toNaira = (kobo) => kobo / AMOUNT_MULTIPLIER;

const generateInvoiceNumber = (schoolId, index) => {
  const short = schoolId.length > 5 ? schoolId.slice(0, 5).toUpperCase() : schoolId.toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `INV-${short}-${ts}-${String(index).padStart(4, '0')}`;
};

const generateReceiptNumber = (index) => {
  const ts = Date.now().toString(36).toUpperCase();
  return `RCP-${ts}-${String(index).padStart(4, '0')}`;
};

// ──────────────────────────────────────────────
// A. FEE STRUCTURE LAYER
// ──────────────────────────────────────────────

const getFeeStructures = async (schoolId, { academicYearId, termId, classId, status, page, limit }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 50;
  const where = { schoolId, isActive: true };
  if (academicYearId) where.academicYearId = academicYearId;
  if (termId) where.termId = termId;
  if (classId) where.classId = classId;
  if (status) where.status = status;

  const skip = (page - 1) * limit;
  const [feeStructures, total] = await Promise.all([
    prisma.feeStructure.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
    prisma.feeStructure.count({ where })
  ]);

  return { feeStructures, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getFeeStructureById = async (id, schoolId) => {
  const feeStructure = await prisma.feeStructure.findFirst({
    where: { id, schoolId, isActive: true },
    include: {
      class: { select: { id: true, name: true } },
      arm: { select: { id: true, name: true } }
    }
  });
  if (!feeStructure) throw new Error('Fee structure not found');

  let termName = null;
  if (feeStructure.termId) {
    const term = await prisma.academicTerm.findUnique({
      where: { id: feeStructure.termId },
      select: { name: true }
    });
    termName = term ? term.name : null;
  }

  return {
    feeStructure: {
      ...feeStructure,
      termName,
      className: feeStructure.class ? feeStructure.class.name : null,
      armName: feeStructure.arm ? feeStructure.arm.name : null,
      class: undefined,
      arm: undefined
    }
  };
};

const createFeeStructure = async (schoolId, data, userId) => {
  const { academicYearId, termId, classId, className, armId, name, items, totalAmount, dueDate, paymentType, installmentPlans } = data;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one fee item is required');
  }
  const computedTotal = items.reduce((sum, item) => sum + item.amount, 0);
  if (computedTotal !== totalAmount) {
    throw new Error('Total amount must equal sum of all item amounts');
  }

  if (paymentType === 'installment') {
    if (!installmentPlans || !Array.isArray(installmentPlans) || installmentPlans.length === 0) {
      throw new Error('Installment plans are required when payment type is installment');
    }
    const totalPct = installmentPlans.reduce((sum, ip) => sum + ip.percentage, 0);
    if (totalPct !== 100) {
      throw new Error('Installment plan percentages must sum to 100');
    }
  }

  const feeStructure = await prisma.feeStructure.create({
    data: {
      schoolId, academicYearId, termId, classId, armId,
      name,
      items,
      totalAmount,
      dueDate: new Date(dueDate),
      paymentType,
      installmentPlans: installmentPlans || [],
      status: 'draft',
      version: 1,
      createdBy: userId
    }
  });

  await prisma.feeStructureVersion.create({
    data: {
      feeStructureId: feeStructure.id,
      version: 1,
      snapshot: feeStructure,
      changedBy: userId
    }
  });

  return { feeStructure };
};

const updateFeeStructure = async (id, schoolId, data, userId) => {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId, isActive: true } });
  if (!existing) throw new Error('Fee structure not found');
  if (existing.status === 'published') throw new Error('Published fee structures cannot be edited');

  const { academicYearId, termId, classId, armId, name, items, totalAmount, dueDate, paymentType, installmentPlans } = data;

  if (items) {
    if (!Array.isArray(items) || items.length === 0) throw new Error('At least one fee item is required');
    const computedTotal = items.reduce((sum, item) => sum + item.amount, 0);
    if (computedTotal !== totalAmount) throw new Error('Total amount must equal sum of all item amounts');
  }
  if (paymentType === 'installment' && installmentPlans) {
    if (!Array.isArray(installmentPlans) || installmentPlans.length === 0) throw new Error('Installment plans are required');
    const totalPct = installmentPlans.reduce((sum, ip) => sum + ip.percentage, 0);
    if (totalPct !== 100) throw new Error('Installment plan percentages must sum to 100');
  }

  const newVersion = existing.version + 1;
  const updateData = {
    academicYearId: academicYearId !== undefined ? academicYearId : existing.academicYearId,
    termId: termId !== undefined ? termId : existing.termId,
    classId: classId !== undefined ? classId : existing.classId,
    armId: armId !== undefined ? armId : existing.armId,
    name: name !== undefined ? name : existing.name,
    items: items !== undefined ? items : existing.items,
    totalAmount: totalAmount !== undefined ? totalAmount : existing.totalAmount,
    dueDate: dueDate !== undefined ? new Date(dueDate) : existing.dueDate,
    paymentType: paymentType !== undefined ? paymentType : existing.paymentType,
    installmentPlans: installmentPlans !== undefined ? installmentPlans : existing.installmentPlans,
    version: newVersion
  };

  const feeStructure = await prisma.feeStructure.update({ where: { id }, data: updateData });

  await prisma.feeStructureVersion.create({
    data: {
      feeStructureId: id,
      version: newVersion,
      snapshot: feeStructure,
      changedBy: userId
    }
  });

  return { feeStructure };
};

const deleteFeeStructure = async (id, schoolId) => {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId, isActive: true } });
  if (!existing) throw new Error('Fee structure not found');
  if (existing.status === 'published') throw new Error('Published fee structures cannot be deleted');

  const invoiceCount = await prisma.feeInvoice.count({ where: { feeStructureId: id, isActive: true } });
  if (invoiceCount > 0) throw new Error('Fee structures with associated invoices cannot be deleted');

  await prisma.feeStructure.update({ where: { id }, data: { isActive: false } });
  return { message: 'Fee structure deleted successfully' };
};

const cloneFeeStructure = async (id, schoolId, data, userId) => {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId, isActive: true } });
  if (!existing) throw new Error('Fee structure not found');

  const { targetAcademicYearId, targetTermId, targetClassIds } = data;
  if (!targetClassIds || !Array.isArray(targetClassIds) || targetClassIds.length === 0) {
    throw new Error('At least one target class ID is required');
  }

  const cloned = [];
  for (const classId of targetClassIds) {
    const feeStructure = await prisma.feeStructure.create({
      data: {
        schoolId,
        academicYearId: targetAcademicYearId || existing.academicYearId,
        termId: targetTermId || existing.termId,
        classId,
        armId: null,
        name: `${existing.name} (Copy)`,
        items: existing.items,
        totalAmount: existing.totalAmount,
        dueDate: existing.dueDate,
        paymentType: existing.paymentType,
        installmentPlans: existing.installmentPlans,
        status: 'draft',
        version: 1,
        createdBy: userId
      }
    });

    await prisma.feeStructureVersion.create({
      data: {
        feeStructureId: feeStructure.id,
        version: 1,
        snapshot: feeStructure,
        changedBy: userId
      }
    });

    cloned.push({ id: feeStructure.id, status: feeStructure.status, version: feeStructure.version, name: feeStructure.name });
  }

  return { feeStructures: cloned };
};

const transitionFeeStructure = async (id, schoolId, action, userId) => {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId, isActive: true } });
  if (!existing) throw new Error('Fee structure not found');

  if (action === 'publish') {
    if (existing.status !== 'draft') throw new Error('Only draft fee structures can be published');

    const feeStructure = await prisma.feeStructure.update({
      where: { id },
      data: { status: 'published', version: existing.version + 1 }
    });

    await prisma.feeStructureVersion.create({
      data: {
        feeStructureId: id,
        version: feeStructure.version,
        snapshot: feeStructure,
        changedBy: userId
      }
    });

    return { feeStructure };
  }

  if (action === 'revert_draft') {
    if (existing.status !== 'published') throw new Error('Only published fee structures can be reverted to draft');

    const feeStructure = await prisma.feeStructure.update({
      where: { id },
      data: { status: 'draft', version: existing.version + 1 }
    });

    await prisma.feeStructureVersion.create({
      data: {
        feeStructureId: id,
        version: feeStructure.version,
        snapshot: feeStructure,
        changedBy: userId
      }
    });

    return { feeStructure };
  }

  throw new Error('Invalid action. Use "publish" or "revert_draft"');
};

const getFeeStructureVersions = async (id, schoolId) => {
  const existing = await prisma.feeStructure.findFirst({ where: { id, schoolId, isActive: true } });
  if (!existing) throw new Error('Fee structure not found');

  const versions = await prisma.feeStructureVersion.findMany({
    where: { feeStructureId: id },
    orderBy: { version: 'desc' }
  });

  return { versions, total: versions.length };
};

// ──────────────────────────────────────────────
// B. INVOICE LAYER
// ──────────────────────────────────────────────

const getInvoices = async (schoolId, { academicYearId, termId, classId, studentId, status, search, page, limit }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 50;
  const where = { schoolId, isActive: true };
  if (academicYearId) where.academicYearId = academicYearId;
  if (termId) where.termId = termId;
  if (studentId) where.studentId = studentId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { studentName: { contains: search, mode: 'insensitive' } },
      { feeStructureName: { contains: search, mode: 'insensitive' } },
      { invoiceNumber: { contains: search, mode: 'insensitive' } }
    ];
  }

  let studentIds;
  if (classId) {
    const students = await prisma.student.findMany({ where: { schoolId, classId, isActive: true }, select: { id: true } });
    studentIds = students.map(s => s.id);
    where.studentId = { in: studentIds };
  }

  const skip = (page - 1) * limit;
  const [invoices, total] = await Promise.all([
    prisma.feeInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.feeInvoice.count({ where })
  ]);

  const totalBilled = invoices.reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.amountPaid, 0);

  return {
    invoices,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    summary: { totalBilled, totalPaid, totalOutstanding: totalBilled - totalPaid }
  };
};

const getInvoiceById = async (id, schoolId) => {
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id, schoolId, isActive: true }
  });
  if (!invoice) throw new Error('Invoice not found');
  const [payments, adjustments] = await Promise.all([
    prisma.feePayment.findMany({ where: { invoiceId: id }, orderBy: { createdAt: 'desc' } }),
    prisma.feeAdjustment.findMany({ where: { invoiceId: id } })
  ]);
  return { invoice: { ...invoice, payments, adjustments } };
};

const createInvoices = async (schoolId, data, userId) => {
  const { invoices: invoiceData } = data;
  if (!invoiceData || !Array.isArray(invoiceData) || invoiceData.length === 0) {
    throw new Error('At least one invoice entry is required');
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < invoiceData.length; i++) {
    const { feeStructureId, studentId } = invoiceData[i];
    try {
      const feeStructure = await prisma.feeStructure.findFirst({ where: { id: feeStructureId, schoolId, isActive: true } });
      if (!feeStructure) { errors.push({ index: i, message: 'Fee structure not found' }); continue; }

      const student = await prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true } });
      if (!student) { errors.push({ index: i, message: 'Student not found' }); continue; }

      const existingInvoice = await prisma.feeInvoice.findFirst({
        where: { studentId, feeStructureId, status: { notIn: ['void'] }, isActive: true }
      });
      if (existingInvoice) { errors.push({ index: i, message: 'Invoice already exists for this student and fee structure' }); continue; }

      const invoiceNumber = generateInvoiceNumber(schoolId, i);
      const invoice = await prisma.feeInvoice.create({
        data: {
          schoolId,
          studentId,
          studentName: `${student.firstName} ${student.lastName}`,
          className: student.grade || null,
          feeStructureId,
          feeStructureName: feeStructure.name,
          invoiceNumber,
          amount: feeStructure.totalAmount,
          amountPaid: 0,
          amountDue: feeStructure.totalAmount,
          dueDate: feeStructure.dueDate,
          academicYearId: feeStructure.academicYearId,
          termId: feeStructure.termId,
          status: 'pending',
          createdBy: userId
        }
      });

      await prisma.feeLedgerEntry.create({
        data: {
          schoolId,
          studentId,
          type: 'debit',
          amount: feeStructure.totalAmount,
          balance: feeStructure.totalAmount,
          description: `${feeStructure.name} - ${invoiceNumber}`,
          reference: invoice.id,
          account: 'receivable',
          entryDate: new Date()
        }
      });

      results.push(invoice);
    } catch (err) {
      errors.push({ index: i, message: err.message });
    }
  }

  return { invoices: results, total: results.length, errors };
};

const generateInvoicesForClass = async (schoolId, data, userId) => {
  const { feeStructureId, classId, armId, includeOptional } = data;

  const feeStructure = await prisma.feeStructure.findFirst({ where: { id: feeStructureId, schoolId, isActive: true, status: 'published' } });
  if (!feeStructure) throw new Error('Published fee structure not found');

  const studentWhere = { schoolId, classId, isActive: true, isEnrolled: true };
  if (armId) studentWhere.armId = armId;

  const students = await prisma.student.findMany({ where: studentWhere });
  if (students.length === 0) throw new Error('No active students found for this class');

  const items = includeOptional && Array.isArray(includeOptional)
    ? feeStructure.items.filter(item => item.optional ? includeOptional.includes(item.feeType) : true)
    : feeStructure.items.filter(item => !item.optional);

  const effectiveTotal = items.reduce((sum, item) => sum + item.amount, 0);

  let generated = 0;
  let skipped = 0;
  const invoices = [];

  for (const student of students) {
    const existingInvoice = await prisma.feeInvoice.findFirst({
      where: { studentId: student.id, feeStructureId, status: { notIn: ['void'] }, isActive: true }
    });
    if (existingInvoice) { skipped++; continue; }

    const invoiceNumber = generateInvoiceNumber(schoolId, generated);
    const invoice = await prisma.feeInvoice.create({
      data: {
        schoolId,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.grade || null,
        feeStructureId,
        feeStructureName: feeStructure.name,
        invoiceNumber,
        amount: effectiveTotal,
        amountPaid: 0,
        amountDue: effectiveTotal,
        dueDate: feeStructure.dueDate,
        academicYearId: feeStructure.academicYearId,
        termId: feeStructure.termId,
        status: 'pending',
        createdBy: userId
      }
    });

    await prisma.feeLedgerEntry.create({
      data: {
        schoolId,
        studentId: student.id,
        type: 'debit',
        amount: effectiveTotal,
        balance: effectiveTotal,
        description: `${feeStructure.name} - ${invoiceNumber}`,
        reference: invoice.id,
        account: 'receivable',
        entryDate: new Date()
      }
    });

    invoices.push(invoice);
    generated++;
  }

  return { generated, skipped, invoices };
};

const voidInvoice = async (id, schoolId, reason, userId) => {
  const invoice = await prisma.feeInvoice.findFirst({ where: { id, schoolId, isActive: true } });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'void') throw new Error('Invoice is already voided');
  if (invoice.amountPaid > 0) throw new Error('Cannot void an invoice with recorded payments. Process a refund instead.');

  await prisma.feeInvoice.update({ where: { id }, data: { status: 'void', isActive: false } });

  await prisma.feeLedgerEntry.create({
    data: {
      schoolId,
      studentId: invoice.studentId,
      type: 'credit',
      amount: invoice.amountDue,
      balance: 0,
      description: `Invoice voided: ${reason || 'No reason provided'} - ${invoice.invoiceNumber}`,
      reference: invoice.id,
      account: 'receivable',
      entryDate: new Date()
    }
  });

  return { message: 'Invoice voided successfully' };
};

const getStudentFees = async (studentId, schoolId) => {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true } });
  if (!student) throw new Error('Student not found');

  const invoices = await prisma.feeInvoice.findMany({
    where: { studentId, schoolId, isActive: true },
    orderBy: { createdAt: 'desc' }
  });

  const billed = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.reduce((s, i) => s + i.amountPaid, 0);

  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}`, className: student.grade },
    invoices: invoices.map(i => ({ feeStructureName: i.feeStructureName, amount: i.amount, amountPaid: i.amountPaid, status: i.status })),
    totals: { billed, paid, outstanding: billed - paid }
  };
};

// ──────────────────────────────────────────────
// C. PAYMENT LAYER
// ──────────────────────────────────────────────

const recordPayment = async (invoiceId, schoolId, data, userId) => {
  const invoice = await prisma.feeInvoice.findFirst({
    where: { id: invoiceId, schoolId, isActive: true }
  });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status === 'void') throw new Error('Cannot record payment against a voided invoice');
  if (invoice.status === 'paid') throw new Error('Invoice is already fully paid');

  const { amount, paymentMethod, referenceNumber, receiptNumber: providedReceipt, note, paidAt } = data;

  if (amount <= 0) throw new Error('Payment amount must be positive');
  if (amount > invoice.amountDue) throw new Error('Payment amount exceeds the amount due');

  const paymentCount = await prisma.feePayment.count({ where: { invoiceId } });
  const receiptNum = providedReceipt || generateReceiptNumber(paymentCount + 1);

  const payment = await prisma.feePayment.create({
    data: {
      schoolId,
      invoiceId,
      amount,
      paymentMethod,
      referenceNumber,
      receiptNumber: receiptNum,
      note,
      status: 'confirmed',
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      receivedBy: userId
    }
  });

  const newAmountPaid = invoice.amountPaid + amount;
  const newAmountDue = invoice.amount - newAmountPaid;
  const newStatus = newAmountDue <= 0 ? 'paid' : 'partial';

  const updatedInvoice = await prisma.feeInvoice.update({
    where: { id: invoiceId },
    data: { amountPaid: newAmountPaid, amountDue: newAmountDue, status: newStatus }
  });

  await prisma.feeLedgerEntry.create({
    data: {
      schoolId,
      studentId: invoice.studentId,
      type: 'credit',
      amount,
      balance: newAmountDue,
      description: `${paymentMethod} payment ${receiptNum}${referenceNumber ? ` - ${referenceNumber}` : ''}`,
      reference: payment.id,
      account: 'receivable',
      entryDate: new Date()
    }
  });

  return { payment: { id: payment.id, invoiceId, amount, method: paymentMethod, referenceNumber, receiptNumber: receiptNum, paidAt: payment.paidAt, status: payment.status }, invoice: { id: invoiceId, status: newStatus, amountPaid: newAmountPaid, amountDue: newAmountDue } };
};

const initializePayment = async (invoiceId, schoolId, data) => {
  const invoice = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId, isActive: true } });
  if (!invoice) throw new Error('Invoice not found');

  const { gateway, amount, email, callbackUrl } = data;

  const mockRef = `psk_ref_${Date.now()}`;
  const mockAuthUrl = `https://checkout.${gateway}.com/${mockRef}`;

  return { authorizationUrl: mockAuthUrl, reference: mockRef, accessCode: `ac_${Date.now().toString(36)}`, gateway };
};

const verifyPayment = async (data) => {
  const { reference, gateway } = data;

  const payment = await prisma.feePayment.findFirst({ where: { gatewayReference: reference } });
  if (!payment) throw new Error('Payment not found for this reference');

  if (payment.status === 'confirmed') {
    return { status: 'confirmed', payment: { reference, gateway, amount: payment.amount } };
  }

  const mockSuccess = true;

  if (mockSuccess) {
    await prisma.feePayment.update({ where: { id: payment.id }, data: { status: 'confirmed' } });

    const invoice = await prisma.feeInvoice.findUnique({ where: { id: payment.invoiceId } });
    const newAmountPaid = invoice.amountPaid + payment.amount;
    const newAmountDue = invoice.amount - newAmountPaid;
    const newStatus = newAmountDue <= 0 ? 'paid' : 'partial';

    await prisma.feeInvoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaid: newAmountPaid, amountDue: newAmountDue, status: newStatus }
    });

    await prisma.feeLedgerEntry.create({
      data: {
        schoolId: invoice.schoolId,
        studentId: invoice.studentId,
        type: 'credit',
        amount: payment.amount,
        balance: newAmountDue,
        description: `Gateway payment (${gateway}) ${reference}`,
        reference: payment.id,
        account: 'receivable',
        entryDate: new Date()
      }
    });

    return { status: 'confirmed', payment: { reference, gateway, amount: payment.amount } };
  }

  await prisma.feePayment.update({ where: { id: payment.id }, data: { status: 'failed' } });
  return { status: 'failed', payment: { reference, gateway, amount: payment.amount } };
};

const getPaymentHistory = async (invoiceId, schoolId) => {
  const invoice = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId } });
  if (!invoice) throw new Error('Invoice not found');

  const payments = await prisma.feePayment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: 'desc' }
  });

  const totalPaid = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0);
  return { payments, totalPaid };
};

const getAllPayments = async (schoolId, { from, to, method, gateway, status: paymentStatus, page, limit }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 50;
  const where = { schoolId };
  if (from || to) {
    where.paidAt = {};
    if (from) where.paidAt.gte = new Date(from);
    if (to) where.paidAt.lte = new Date(to);
  }
  if (method) where.paymentMethod = method;
  if (gateway) where.gateway = gateway;
  if (paymentStatus) where.status = paymentStatus;

  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    prisma.feePayment.findMany({ where, orderBy: { paidAt: 'desc' }, skip, take: limit }),
    prisma.feePayment.count({ where })
  ]);

  return { payments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

// ──────────────────────────────────────────────
// D. ADJUSTMENTS LAYER
// ──────────────────────────────────────────────

const applyAdjustment = async (schoolId, data, userId) => {
  const { studentId, invoiceId, type, amount, reason } = data;

  if (!['discount', 'waiver', 'scholarship', 'correction'].includes(type)) {
    throw new Error('Invalid adjustment type');
  }
  if (amount <= 0) throw new Error('Adjustment amount must be positive');

  if (invoiceId) {
    const invoice = await prisma.feeInvoice.findFirst({ where: { id: invoiceId, schoolId, isActive: true } });
    if (!invoice) throw new Error('Invoice not found');
  }

  const adjustment = await prisma.feeAdjustment.create({
    data: { schoolId, studentId, invoiceId, type, amount, reason, approvedBy: userId }
  });

  await prisma.feeLedgerEntry.create({
    data: {
      schoolId,
      studentId,
      type: 'adjustment',
      amount,
      balance: -(amount),
      description: `${type}: ${reason}`,
      reference: adjustment.id,
      account: 'receivable',
      entryDate: new Date()
    }
  });

  if (invoiceId) {
    const invoice = await prisma.feeInvoice.findUnique({ where: { id: invoiceId } });
    if (invoice) {
      const newAmountDue = Math.max(0, invoice.amountDue - amount);
      const newStatus = newAmountDue <= 0 ? 'paid' : invoice.amountPaid > 0 ? 'partial' : invoice.status;
      await prisma.feeInvoice.update({
        where: { id: invoiceId },
        data: { amountDue: newAmountDue, status: newStatus }
      });
    }
  }

  return { adjustment };
};

const getAdjustments = async (schoolId, { studentId, type, from, to }) => {
  const where = { schoolId };
  if (studentId) where.studentId = studentId;
  if (type) where.type = type;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const adjustments = await prisma.feeAdjustment.findMany({ where, orderBy: { createdAt: 'desc' } });
  return { adjustments, total: adjustments.length };
};

// ──────────────────────────────────────────────
// E. LEDGER LAYER
// ──────────────────────────────────────────────

const getStudentLedger = async (studentId, schoolId, { academicYearId, termId }) => {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true } });
  if (!student) throw new Error('Student not found');

  const where = { studentId, schoolId };
  if (academicYearId) {
    where.OR = [
      { reference: { in: (await prisma.feeInvoice.findMany({ where: { academicYearId }, select: { id: true } })).map(i => i.id) } }
    ];
  }

  const entries = await prisma.feeLedgerEntry.findMany({
    where: { studentId, schoolId },
    orderBy: { entryDate: 'asc' }
  });

  const openingBalance = 0;
  const closingBalance = entries.length > 0 ? entries[entries.length - 1].balance : 0;

  return {
    student: { id: student.id, name: `${student.firstName} ${student.lastName}` },
    entries,
    openingBalance,
    closingBalance
  };
};

const getLedgerSummary = async (schoolId, { academicYearId, termId }) => {
  const invoiceWhere = { schoolId, isActive: true };
  if (academicYearId) invoiceWhere.academicYearId = academicYearId;
  if (termId) invoiceWhere.termId = termId;

  const invoices = await prisma.feeInvoice.findMany({ where: invoiceWhere });
  const adjustments = await prisma.feeAdjustment.findMany({ where: { schoolId } });

  const totalReceivable = invoices.reduce((s, i) => s + i.amount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalAdjustments = adjustments.reduce((s, a) => s + a.amount, 0);

  return {
    totalReceivable,
    totalRevenue: totalReceivable,
    totalCollected,
    totalAdjustments,
    totalOutstanding: totalReceivable - totalCollected - totalAdjustments
  };
};

// ──────────────────────────────────────────────
// F. RECEIPTS LAYER
// ──────────────────────────────────────────────

const getReceipt = async (paymentId, schoolId) => {
  const payment = await prisma.feePayment.findFirst({
    where: { id: paymentId, schoolId }
  });
  if (!payment) throw new Error('Payment not found');

  const [invoice, receipt] = await Promise.all([
    prisma.feeInvoice.findUnique({ where: { id: payment.invoiceId } }),
    prisma.feeReceipt.findUnique({ where: { paymentId } })
  ]);
  if (!invoice) throw new Error('Associated invoice not found');

  if (!receipt) {
    const [school, student, feeStructure] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId } }),
      prisma.student.findUnique({ where: { id: invoice.studentId } }),
      prisma.feeStructure.findUnique({ where: { id: invoice.feeStructureId } })
    ]);
    const items = feeStructure ? feeStructure.items : [];

    const newReceipt = await prisma.feeReceipt.create({
      data: {
        paymentId,
        receiptNumber: payment.receiptNumber || `RCP-${payment.id.slice(0, 8).toUpperCase()}`,
        schoolInfo: { name: school.schoolName, logoUrl: school.logo || null, address: school.address },
        studentInfo: { name: `${student.firstName} ${student.lastName}`, className: student.grade },
        items: items.map(i => ({ name: i.name, amount: i.amount })),
        amountPaid: payment.amount,
        balance: invoice.amountDue,
        method: payment.paymentMethod,
        reference: payment.referenceNumber,
        paidAt: payment.paidAt,
        issuedBy: payment.receivedBy
      }
    });

    return { receipt: newReceipt };
  }

  return { receipt };
};

const sendReceipt = async (paymentId, schoolId, data) => {
  const { channel, to } = data;
  const receipt = await getReceipt(paymentId, schoolId);

  logger.info(`Receipt ${receipt.receipt.receiptNumber} dispatched via ${channel} to ${to}`);
  return { message: 'Receipt dispatched' };
};

// ──────────────────────────────────────────────
// G. REPORTING LAYER
// ──────────────────────────────────────────────

const getFeeAnalytics = async (schoolId, { academicYearId, termId, classId }) => {
  const where = { schoolId, isActive: true };
  if (academicYearId) where.academicYearId = academicYearId;
  if (termId) where.termId = termId;
  if (classId) {
    const students = await prisma.student.findMany({ where: { schoolId, classId, isActive: true }, select: { id: true } });
    where.studentId = { in: students.map(s => s.id) };
  }

  const invoices = await prisma.feeInvoice.findMany({ where });

  const totalExpected = invoices.reduce((s, i) => s + i.amount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const totalPending = totalExpected - totalCollected;
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100 * 100) / 100 : 0;

  const studentsBilled = new Set(invoices.map(i => i.studentId)).size;
  const studentsFullyPaid = new Set(invoices.filter(i => i.status === 'paid').map(i => i.studentId)).size;
  const studentsOwing = studentsBilled - studentsFullyPaid;

  const classGroups = {};
  for (const inv of invoices) {
    const key = inv.className || 'Unknown';
    if (!classGroups[key]) classGroups[key] = { expected: 0, collected: 0 };
    classGroups[key].expected += inv.amount;
    classGroups[key].collected += inv.amountPaid;
  }
  const byClass = Object.entries(classGroups).map(([className, v]) => ({ className, expected: v.expected, collected: v.collected }));

  const payments = await prisma.feePayment.findMany({ where: { schoolId, status: 'confirmed' } });
  const methodGroups = {};
  for (const p of payments) {
    if (!methodGroups[p.paymentMethod]) methodGroups[p.paymentMethod] = 0;
    methodGroups[p.paymentMethod] += p.amount;
  }
  const byMethod = Object.entries(methodGroups).map(([method, total]) => ({ method, total }));

  const monthlyGroups = {};
  for (const p of payments) {
    if (p.paidAt) {
      const key = `${p.paidAt.getFullYear()}-${String(p.paidAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyGroups[key]) monthlyGroups[key] = 0;
      monthlyGroups[key] += p.amount;
    }
  }
  const monthlyTrend = Object.entries(monthlyGroups).sort().map(([month, collected]) => ({ month, collected }));

  return { totalExpected, totalCollected, totalPending, collectionRate, studentsBilled, studentsFullyPaid, studentsOwing, byClass, byMethod, monthlyTrend };
};

const getOutstandingBalances = async (schoolId, { academicYearId, termId, classId, armId, threshold, page, limit }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 50;
  const where = { schoolId, isActive: true, status: { in: ['pending', 'partial'] } };
  if (academicYearId) where.academicYearId = academicYearId;
  if (termId) where.termId = termId;
  if (classId) {
    const students = await prisma.student.findMany({ where: { schoolId, classId, isActive: true }, select: { id: true } });
    where.studentId = { in: students.map(s => s.id) };
  }

  const skip = (page - 1) * limit;
  const invoices = await prisma.feeInvoice.findMany({ where, orderBy: { amountDue: 'desc' }, skip, take: limit });
  const total = await prisma.feeInvoice.count({ where });

  const students = [];
  for (const inv of invoices) {
    if (threshold && inv.amountDue < threshold) continue;
    const student = await prisma.student.findUnique({ where: { id: inv.studentId } });
    students.push({
      studentId: inv.studentId,
      studentName: inv.studentName || `${student?.firstName || ''} ${student?.lastName || ''}`,
      className: inv.className || student?.grade || 'N/A',
      billed: inv.amount,
      paid: inv.amountPaid,
      outstanding: inv.amountDue,
      oldestDueDate: inv.dueDate,
      daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000))
    });
  }

  const totals = students.reduce((acc, s) => ({ billed: acc.billed + s.billed, paid: acc.paid + s.paid, outstanding: acc.outstanding + s.outstanding }), { billed: 0, paid: 0, outstanding: 0 });

  return { students, total, totals };
};

const getAgingReport = async (schoolId, { academicYearId, termId, classId }) => {
  const where = { schoolId, isActive: true, status: { in: ['pending', 'partial'] } };
  if (academicYearId) where.academicYearId = academicYearId;
  if (termId) where.termId = termId;
  if (classId) {
    const students = await prisma.student.findMany({ where: { schoolId, classId, isActive: true }, select: { id: true } });
    where.studentId = { in: students.map(s => s.id) };
  }

  const invoices = await prisma.feeInvoice.findMany({ where });

  const buckets = [
    { range: '0-30', label: 'Current', amount: 0, count: 0 },
    { range: '31-60', label: '31-60 days', amount: 0, count: 0 },
    { range: '61-90', label: '61-90 days', amount: 0, count: 0 },
    { range: '90+', label: '90+ days', amount: 0, count: 0 }
  ];

  const now = Date.now();
  for (const inv of invoices) {
    const daysOverdue = Math.max(0, Math.floor((now - new Date(inv.dueDate).getTime()) / 86400000));
    let bucket;
    if (daysOverdue <= 30) bucket = buckets[0];
    else if (daysOverdue <= 60) bucket = buckets[1];
    else if (daysOverdue <= 90) bucket = buckets[2];
    else bucket = buckets[3];
    bucket.amount += inv.amountDue;
    bucket.count++;
  }

  return { buckets };
};

const getCollectionReport = async (schoolId, { from, to, academicYearId, termId, classId }) => {
  const where = { schoolId, status: 'confirmed' };
  if (from || to) {
    where.paidAt = {};
    if (from) where.paidAt.gte = new Date(from);
    if (to) where.paidAt.lte = new Date(to);
  }

  let payments = await prisma.feePayment.findMany({ where, orderBy: { paidAt: 'asc' } });

  if (classId) {
    const students = await prisma.student.findMany({ where: { schoolId, classId, isActive: true }, select: { id: true } });
    const invoiceIds = (await prisma.feeInvoice.findMany({ where: { studentId: { in: students.map(s => s.id) }, schoolId }, select: { id: true } })).map(i => i.id);
    payments = payments.filter(p => invoiceIds.includes(p.invoiceId));
  }

  const dateGroups = {};
  for (const p of payments) {
    if (p.paidAt) {
      const key = p.paidAt.toISOString().split('T')[0];
      if (!dateGroups[key]) dateGroups[key] = 0;
      dateGroups[key] += p.amount;
    }
  }
  const series = Object.entries(dateGroups).sort().map(([date, collected]) => ({ date, collected }));
  const totalCollected = payments.reduce((s, p) => s + p.amount, 0);

  return { series, totalCollected };
};

// ──────────────────────────────────────────────
// H. RECONCILIATION LAYER
// ──────────────────────────────────────────────

const getReconciliation = async (schoolId, { gateway, from, to, status: recStatus, page, limit }) => {
  page = parseInt(page, 10) || 1;
  limit = parseInt(limit, 10) || 50;
  const where = { schoolId };
  if (gateway) where.gateway = gateway;
  if (recStatus) where.status = recStatus;
  if (from || to) {
    where.settledAt = {};
    if (from) where.settledAt.gte = new Date(from);
    if (to) where.settledAt.lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.feeReconciliation.findMany({ where, orderBy: { settledAt: 'desc' }, skip, take: limit }),
    prisma.feeReconciliation.count({ where })
  ]);

  const matched = rows.filter(r => r.status === 'matched').length;
  const unmatched = rows.filter(r => r.status === 'unmatched').length;

  return { rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) }, summary: { matched, unmatched } };
};

const importSettlements = async (schoolId, data) => {
  const { gateway, settlements } = data;
  if (!settlements || !Array.isArray(settlements) || settlements.length === 0) {
    throw new Error('At least one settlement entry is required');
  }

  const existing = await prisma.feeReconciliation.findMany({
    where: { schoolId, settlementId: { in: settlements.map(s => s.settlementId) } },
    select: { settlementId: true }
  });
  const existingIds = new Set(existing.map(e => e.settlementId));

  const toCreate = settlements
    .filter(s => !existingIds.has(s.settlementId))
    .map(s => ({
      schoolId,
      settlementId: s.settlementId,
      gateway: gateway || s.gateway || 'paystack',
      amount: s.amount,
      settledAt: new Date(s.settledAt),
      status: 'unmatched'
    }));

  if (toCreate.length > 0) {
    await prisma.feeReconciliation.createMany({ data: toCreate });
  }

  return {
    message: `${toCreate.length} settlement(s) imported, ${settlements.length - toCreate.length} skipped (already exist)`,
    imported: toCreate.length,
    skipped: settlements.length - toCreate.length
  };
};

const reconcileTransaction = async (schoolId, data) => {
  const { settlementId, paymentId } = data;

  const reconciliation = await prisma.feeReconciliation.findFirst({ where: { settlementId, schoolId } });
  if (!reconciliation) throw new Error('Settlement record not found');

  const payment = await prisma.feePayment.findFirst({ where: { id: paymentId, schoolId } });
  if (!payment) throw new Error('Payment not found');

  await prisma.feeReconciliation.update({
    where: { id: reconciliation.id },
    data: { paymentId, status: 'matched', matchedAt: new Date() }
  });

  return { message: 'Transaction reconciled' };
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

# Fee & Payment Management Engine — Backend API Contract
 
---

---

# A. Fee Configuration Layer

## `GET /api/fees/structures`

List fee structures scoped to academic year / term / class.

**Query Parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `academicYearId` | string | Yes | Filter by academic year |
| `termId` | string | No | Filter by term |
| `classId` | string | No | Filter by class |
| `status` | string | No | Filter by `draft` or `published` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "feeStructures": [
      {
        "_id": "fs_001",
        "id": "fs_001",
        "schoolId": "SUN8935",
        "academicYearId": "year_2025",
        "termId": "term_1",
        "classId": "class_10",
        "className": "JSS1",
        "name": "JSS1 First Term Fees",
        "items": [
          { "feeType": "tuition",     "name": "Tuition",          "amount": 5000000, "optional": false },
          { "feeType": "development", "name": "Development Levy",  "amount": 1000000, "optional": false },
          { "feeType": "transport",   "name": "Transport",         "amount": 1500000, "optional": true }
        ],
        "totalAmount": 7500000,
        "dueDate": "2026-01-15",
        "paymentType": "installment",
        "installmentPlans": [
          { "label": "1st Installment", "percentage": 50, "dueDate": "2026-01-15" },
          { "label": "2nd Installment", "percentage": 50, "dueDate": "2026-03-01" }
        ],
        "status": "published",
        "version": 2,
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-10T00:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

## `GET /api/fees/structures/:id`

Fetch a single fee structure by ID.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "feeStructure": { "...same shape as list item above..." }
  }
}
```

---

## `POST /api/fees/structures`

Create a new fee structure. Always created with `status: "draft"`.

**Request Body**

```json
{
  "academicYearId": "year_2025",
  "termId": "term_1",
  "classId": "class_10",
  "className": "JSS1",
  "name": "JSS1 First Term Fees",
  "items": [
    { "feeType": "tuition", "name": "Tuition", "amount": 5000000, "optional": false },
    { "feeType": "transport", "name": "Transport", "amount": 1500000, "optional": true }
  ],
  "totalAmount": 6500000,
  "dueDate": "2026-01-15",
  "paymentType": "one-time",
  "installmentPlans": []
}
```

> `paymentType` is `"one-time"` or `"installment"`. When `"installment"`, `installmentPlans` must be present and percentages must sum to 100.

**Response `201`**

```json
{
  "success": true,
  "message": "Fee structure created successfully",
  "data": {
    "feeStructure": {
      "_id": "fs_xxx",
      "id": "fs_xxx",
      "status": "draft",
      "version": 1,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  }
}
```

---

## `PUT /api/fees/structures/:id`

Update a fee structure.

> **Rule**: Only `draft` structures are editable. Return `409 Conflict` if `status === "published"`.
> Each successful edit must increment the `version` field.

**Request Body** — same shape as POST.

**Response `200`**

```json
{
  "success": true,
  "message": "Fee structure updated successfully",
  "data": {
    "feeStructure": {
      "_id": "fs_xxx",
      "id": "fs_xxx",
      "version": 2,
      "updatedAt": "2026-01-10T00:00:00.000Z"
    }
  }
}
```

**Error `409`** if structure is published:

```json
{
  "success": false,
  "message": "Published fee structures cannot be edited"
}
```

---

## `DELETE /api/fees/structures/:id`

Delete a fee structure.

> **Rule**: Only `draft` structures with no associated invoices are deletable. Return `409` if published or has invoices.

**Response `200`**

```json
{
  "success": true,
  "message": "Fee structure deleted successfully"
}
```

---

## `POST /api/fees/structures/:id/clone`

Deep-copy a structure into a new term / year as a fresh `draft`.

**Request Body**

```json
{
  "targetAcademicYearId": "year_2026",
  "targetTermId": "term_2",
  "targetClassIds": ["class_10", "class_11"]
}
```

> If `targetClassIds` contains more than one entry, return one cloned structure per class.

**Response `200`**

```json
{
  "success": true,
  "message": "Fee structure cloned successfully",
  "data": {
    "feeStructures": [
      {
        "_id": "fs_clone_1",
        "id": "fs_clone_1",
        "status": "draft",
        "version": 1,
        "name": "JSS1 First Term Fees (Copy)"
      }
    ]
  }
}
```

---

## `POST /api/fees/structures/:id/transition`

Drive the 2-phase lifecycle.

**Request Body**

```json
{ "action": "publish" }
```

| Action | Description |
|---|---|
| `publish` | Moves `draft → published`. Must emit `FEE_STRUCTURE_PUBLISHED`. Prevents further edits. Parents and students see it immediately on their dashboards. |
| `revert_draft` | Emergency revert `published → draft`. Admin-only. Not surfaced in the UI. |

> **Important**: The frontend calls `POST /api/fees/invoices/generate` immediately after a successful `publish` response. The backend `FEE_STRUCTURE_PUBLISHED` event handler may also trigger invoice generation. Both paths must be idempotent — skip already-billed students.

**Response `200`**

```json
{
  "success": true,
  "message": "Fee structure published — parents and students can now see it on their dashboards.",
  "data": {
    "feeStructure": {
      "_id": "fs_001",
      "id": "fs_001",
      "status": "published"
    }
  }
}
```

---

## `GET /api/fees/structures/:id/versions`

Return immutable version history (audit trail).

**Response `200`**

```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "version": 1,
        "snapshot": { "...full structure at that version..." },
        "changedBy": "user_id",
        "changedAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 1
  }
}
```

---

# B. Billing Layer — Invoices

## `GET /api/fees/invoices`

Paginated invoice list with summary KPIs.

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `academicYearId` | string | Required |
| `termId` | string | Optional |
| `classId` | string | Filter by class |
| `studentId` | string | Filter by student |
| `status` | string | `pending`, `partial`, `paid`, `overdue`, `void` |
| `search` | string | Student name or structure name |
| `page` | number | Default `1` |
| `limit` | number | Default `50` |

**Response `200`**

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "inv_001",
        "id": "inv_001",
        "studentId": "stu_1",
        "studentName": "John Doe",
        "classId": "class_10",
        "className": "JSS1",
        "feeStructureId": "fs_001",
        "feeStructureName": "JSS1 First Term Fees",
        "amount": 7500000,
        "amountPaid": 2500000,
        "amountDue": 5000000,
        "status": "partial",
        "dueDate": "2026-01-15",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 50,
    "summary": {
      "totalBilled": 250000000,
      "totalPaid": 150000000,
      "totalOutstanding": 100000000
    }
  }
}
```

---

## `GET /api/fees/invoices/:id`

Fetch a single invoice by ID.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "invoice": { "...same shape as list item..." }
  }
}
```

---

## `POST /api/fees/invoices`

Bulk-create invoices for specific students.

> Emits `BILL_GENERATED` per invoice. Creates a **DEBIT** ledger entry per invoice (Student Receivable).

**Request Body**

```json
{
  "invoices": [
    { "feeStructureId": "fs_001", "studentId": "stu_1" },
    { "feeStructureId": "fs_001", "studentId": "stu_2" }
  ]
}
```

**Response `201`**

```json
{
  "success": true,
  "message": "2 invoice(s) created successfully",
  "data": {
    "invoices": [
      {
        "_id": "inv_001", "id": "inv_001",
        "studentId": "stu_1",
        "feeStructureId": "fs_001",
        "amount": 7500000,
        "amountPaid": 0,
        "amountDue": 7500000,
        "status": "pending",
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 2,
    "errors": []
  }
}
```

---

## `POST /api/fees/invoices/generate`

Auto-called by the frontend immediately after publishing a fee structure. Generates invoices for an entire class. The backend resolves the student roster server-side.

> **Must be idempotent**: skip students who already have an invoice for this fee structure. Never double-bill.
> Emits `BILL_GENERATED` per new invoice. Posts a **DEBIT** ledger entry per invoice.

**Request Body**

```json
{
  "feeStructureId": "fs_001",
  "classId": "class_10",
  "armId": "arm_a",
  "includeOptional": ["transport", "boarding"]
}
```

> `armId` and `includeOptional` are optional. If `includeOptional` is omitted, only mandatory fee items are included.

**Response `200`**

```json
{
  "success": true,
  "message": "Invoices generated for class",
  "data": {
    "generated": 32,
    "skipped": 3,
    "invoices": [ "...array of created invoice objects..." ]
  }
}
```

---

## `POST /api/fees/invoices/:id/void`

Soft-cancel an invoice. Never hard-delete. Posts a reversing ledger entry.

> Emits `INVOICE_VOIDED`.

**Request Body**

```json
{ "reason": "Student transferred out" }
```

**Response `200`**

```json
{
  "success": true,
  "message": "Invoice voided successfully"
}
```

---

## `GET /api/fees/student/:studentId`

Full fee position for a single student.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "student": { "id": "stu_1", "name": "John Doe", "className": "JSS1" },
    "invoices": [
      { "feeStructureName": "JSS1 First Term", "amount": 7500000, "amountPaid": 0, "status": "pending" }
    ],
    "totals": { "billed": 7500000, "paid": 0, "outstanding": 7500000 }
  }
}
```

---

# C. Payment Layer

## `POST /api/fees/invoices/:invoiceId/payment`

Record a manual payment (cash / bank transfer / POS / cheque).

> Posts a **CREDIT** ledger entry. Recomputes invoice status (`partial` or `paid`). Emits `PAYMENT_CONFIRMED`. Returns receipt stub.

**Request Body**

```json
{
  "amount": 2500000,
  "paymentMethod": "cash",
  "referenceNumber": "TXN-001",
  "receiptNumber": "RCP-0001",
  "note": "Paid at front desk",
  "paidAt": "2026-01-15T10:00:00.000Z"
}
```

> `receiptNumber`, `note`, and `paidAt` are optional. If `receiptNumber` is omitted, generate one server-side.

**Response `200`**

```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "_id": "pay_x", "id": "pay_x",
      "invoiceId": "inv_001",
      "amount": 2500000,
      "method": "cash",
      "referenceNumber": "TXN-001",
      "receiptNumber": "RCP-0001",
      "paidAt": "2026-01-15T10:00:00.000Z",
      "status": "confirmed"
    },
    "invoice": {
      "id": "inv_001",
      "status": "partial",
      "amountPaid": 2500000,
      "amountDue": 5000000
    }
  }
}
```

---

## `POST /api/fees/invoices/:invoiceId/payment/initialize`

Initialise an online gateway payment.

> Emits `PAYMENT_INITIATED`. Returns a hosted checkout URL.

**Request Body**

```json
{
  "gateway": "paystack",
  "amount": 7500000,
  "email": "parent@example.com",
  "callbackUrl": "https://yourapp.com/fees/callback"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Payment initialized",
  "data": {
    "authorizationUrl": "https://checkout.paystack.com/ref_abc123",
    "reference": "psk_ref_abc123",
    "accessCode": "ac_xyz",
    "gateway": "paystack"
  }
}
```

---

## `POST /api/fees/payments/verify`

Verify a completed gateway payment server-to-server.

> On success: posts **CREDIT** ledger entry, emits `PAYMENT_CONFIRMED`.
> On failure: emits `PAYMENT_FAILED`.

**Request Body**

```json
{
  "reference": "psk_ref_abc123",
  "gateway": "paystack"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "status": "confirmed",
    "payment": {
      "reference": "psk_ref_abc123",
      "gateway": "paystack",
      "amount": 7500000
    }
  }
}
```

---

## `GET /api/fees/invoices/:invoiceId/payments`

Payment history for a single invoice.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "pay_x", "id": "pay_x",
        "amount": 2500000,
        "method": "cash",
        "receiptNumber": "RCP-0001",
        "paidAt": "2026-01-15T10:00:00.000Z",
        "status": "confirmed"
      }
    ],
    "totalPaid": 2500000
  }
}
```

---

## `GET /api/fees/payments`

School-wide payment feed (cashbook / reconciliation view).

**Query Parameters**: `from`, `to`, `method`, `gateway`, `status`, `page`, `limit`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "payments": [ "...payment objects..." ],
    "total": 100
  }
}
```

---

# D. Adjustments Layer

## `POST /api/fees/adjustments`

Post a discount, waiver, scholarship, or correction.

> Posts an **ADJUSTMENT** ledger entry. Emits `ADJUSTMENT_APPLIED`.

**Request Body**

```json
{
  "studentId": "stu_1",
  "invoiceId": "inv_001",
  "type": "scholarship",
  "amount": 1000000,
  "reason": "Academic excellence scholarship",
  "approvedBy": "user_admin_id"
}
```

> `invoiceId` is optional — if omitted the adjustment applies at the student level.

**Response `200`**

```json
{
  "success": true,
  "message": "Adjustment applied successfully",
  "data": {
    "adjustment": {
      "_id": "adj_001", "id": "adj_001",
      "studentId": "stu_1",
      "invoiceId": "inv_001",
      "type": "scholarship",
      "amount": 1000000,
      "reason": "Academic excellence scholarship",
      "approvedBy": "user_admin_id",
      "createdAt": "2026-01-15T10:00:00.000Z"
    }
  }
}
```

---

## `GET /api/fees/adjustments`

List adjustments.

**Query Parameters**: `studentId`, `type`, `from`, `to`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "adjustments": [ "...adjustment objects..." ],
    "total": 5
  }
}
```

---

# E. Ledger Layer

## `GET /api/fees/ledger/student/:studentId`

Chronological double-entry transaction trail for a student with running balance.

**Query Parameters**: `academicYearId`, `termId`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "student": { "id": "stu_1", "name": "John Doe" },
    "entries": [
      {
        "date": "2026-01-01T00:00:00.000Z",
        "type": "debit",
        "description": "JSS1 First Term Fees",
        "debit": 7500000,
        "credit": 0,
        "balance": 7500000,
        "reference": "inv_001",
        "account": "receivable"
      },
      {
        "date": "2026-01-15T10:00:00.000Z",
        "type": "credit",
        "description": "Cash payment RCP-0001",
        "debit": 0,
        "credit": 2500000,
        "balance": 5000000,
        "reference": "pay_x",
        "account": "receivable"
      }
    ],
    "openingBalance": 0,
    "closingBalance": 5000000
  }
}
```

> `type`: `debit | credit | adjustment`
> `account`: `receivable | revenue`

---

## `GET /api/fees/ledger/summary`

School-level double-entry trial balance.

**Query Parameters**: `academicYearId`, `termId`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "totalReceivable": 250000000,
    "totalRevenue": 250000000,
    "totalCollected": 150000000,
    "totalAdjustments": 5000000,
    "totalOutstanding": 95000000
  }
}
```

---

# F. Receipts

## `GET /api/fees/receipts/:paymentId`

Return a render-ready digital receipt document.

**Response `200`**

```json
{
  "success": true,
  "data": {
    "receipt": {
      "receiptNumber": "RCP-0001",
      "paymentId": "pay_x",
      "school": { "name": "Sunrise Academy", "logoUrl": "https://...", "address": "Lagos" },
      "student": { "name": "John Doe", "className": "JSS1" },
      "items": [
        { "name": "Tuition", "amount": 5000000 },
        { "name": "Development Levy", "amount": 1000000 }
      ],
      "amountPaid": 2500000,
      "balance": 5000000,
      "method": "cash",
      "reference": "TXN-001",
      "paidAt": "2026-01-15T10:00:00.000Z",
      "issuedBy": "Bursar"
    }
  }
}
```

---

## `POST /api/fees/receipts/:paymentId/send`

Email or SMS the receipt to the parent.

**Request Body**

```json
{
  "channel": "email",
  "to": "parent@example.com"
}
```

> `channel` is `"email"` or `"sms"`.

**Response `200`**

```json
{
  "success": true,
  "message": "Receipt dispatched"
}
```

---

# G. Reporting Layer

## `GET /api/fees/analytics`

Top-level financial analytics for the admin overview dashboard.

**Query Parameters**: `academicYearId`, `termId`, `classId`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "totalExpected": 500000000,
    "totalCollected": 350000000,
    "totalPending": 150000000,
    "collectionRate": 70.0,
    "studentsBilled": 240,
    "studentsFullyPaid": 150,
    "studentsOwing": 90,
    "byClass": [
      { "classId": "class_10", "className": "JSS1", "expected": 100000000, "collected": 80000000 }
    ],
    "byMethod": [
      { "method": "paystack", "total": 120000000 },
      { "method": "cash", "total": 90000000 }
    ],
    "monthlyTrend": [
      { "month": "2025-09", "collected": 50000000 }
    ]
  }
}
```

---

## `GET /api/fees/reports/outstanding`

Outstanding balance per student.

**Query Parameters**: `academicYearId`, `termId`, `classId`, `armId`, `threshold` (min outstanding kobo), `page`, `limit`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "students": [
      {
        "studentId": "stu_1",
        "studentName": "John Doe",
        "className": "JSS1",
        "billed": 7500000,
        "paid": 2500000,
        "outstanding": 5000000,
        "oldestDueDate": "2026-01-15",
        "daysOverdue": 12
      }
    ],
    "total": 90,
    "totals": { "billed": 750000000, "paid": 500000000, "outstanding": 250000000 }
  }
}
```

---

## `GET /api/fees/reports/aging`

Arrears aging buckets.

**Query Parameters**: `academicYearId`, `termId`, `classId`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "buckets": [
      { "range": "0-30",  "label": "Current",    "amount": 50000000, "count": 20 },
      { "range": "31-60", "label": "31-60 days",  "amount": 30000000, "count": 12 },
      { "range": "61-90", "label": "61-90 days",  "amount": 15000000, "count": 6  },
      { "range": "90+",   "label": "90+ days",    "amount": 5000000,  "count": 2  }
    ]
  }
}
```

---

## `GET /api/fees/reports/collections`

Collection performance over a date range.

**Query Parameters**: `from`, `to`, `academicYearId`, `termId`, `classId`

**Response `200`**

```json
{
  "success": true,
  "data": {
    "series": [
      { "date": "2026-01-01", "collected": 20000000 },
      { "date": "2026-01-02", "collected": 15000000 }
    ],
    "totalCollected": 350000000
  }
}
```

---

# H. Reconciliation Layer

## `GET /api/fees/reconciliation`

Gateway settlement lines vs recorded payments — flags mismatches.

**Query Parameters**: `gateway` (`paystack | flutterwave`), `from`, `to`, `status` (`matched | unmatched`)

**Response `200`**

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "settlementId": "stl_001",
        "amount": 7500000,
        "gateway": "paystack",
        "settledAt": "2026-01-16T00:00:00.000Z",
        "paymentId": "pay_x",
        "status": "matched"
      }
    ],
    "summary": { "matched": 45, "unmatched": 3 }
  }
}
```

---

## `POST /api/fees/reconciliation/match`

Manually link a gateway settlement to a recorded payment.

**Request Body**

```json
{
  "settlementId": "stl_001",
  "paymentId": "pay_x"
}
```

**Response `200`**

```json
{
  "success": true,
  "message": "Transaction reconciled"
}
```

---

## Full Endpoint Reference

| # | Method | Path | Frontend Function | Layer |
|---|---|---|---|---|
| 1 | GET | `/api/fees/structures` | `getFeeStructures` | A – Config |
| 2 | GET | `/api/fees/structures/:id` | `getFeeStructureById` | A – Config |
| 3 | POST | `/api/fees/structures` | `createFeeStructure` | A – Config |
| 4 | PUT | `/api/fees/structures/:id` | `updateFeeStructure` | A – Config |
| 5 | DELETE | `/api/fees/structures/:id` | `deleteFeeStructure` | A – Config |
| 6 | POST | `/api/fees/structures/:id/clone` | `cloneFeeStructure` | A – Config |
| 7 | POST | `/api/fees/structures/:id/transition` | `transitionFeeStructure` | A – Config |
| 8 | GET | `/api/fees/structures/:id/versions` | `getFeeStructureVersions` | A – Config |
| 9 | GET | `/api/fees/invoices` | `getInvoices` | B – Billing |
| 10 | GET | `/api/fees/invoices/:id` | `getInvoiceById` | B – Billing |
| 11 | POST | `/api/fees/invoices` | `createInvoices` | B – Billing |
| 12 | POST | `/api/fees/invoices/generate` | `generateInvoicesForClass` | B – Billing |
| 13 | POST | `/api/fees/invoices/:id/void` | `voidInvoice` | B – Billing |
| 14 | GET | `/api/fees/student/:studentId` | `getStudentFees` | B – Billing |
| 15 | POST | `/api/fees/invoices/:invoiceId/payment` | `recordPayment` | C – Payments |
| 16 | POST | `/api/fees/invoices/:invoiceId/payment/initialize` | `initializePayment` | C – Payments |
| 17 | POST | `/api/fees/payments/verify` | `verifyPayment` | C – Payments |
| 18 | GET | `/api/fees/invoices/:invoiceId/payments` | `getPaymentHistory` | C – Payments |
| 19 | GET | `/api/fees/payments` | `getAllPayments` | C – Payments |
| 20 | POST | `/api/fees/adjustments` | `applyAdjustment` | D – Adjustments |
| 21 | GET | `/api/fees/adjustments` | `getAdjustments` | D – Adjustments |
| 22 | GET | `/api/fees/ledger/student/:studentId` | `getStudentLedger` | E – Ledger |
| 23 | GET | `/api/fees/ledger/summary` | `getLedgerSummary` | E – Ledger |
| 24 | GET | `/api/fees/receipts/:paymentId` | `getReceipt` | F – Receipts |
| 25 | POST | `/api/fees/receipts/:paymentId/send` | `sendReceipt` | F – Receipts |
| 26 | GET | `/api/fees/analytics` | `getFeeAnalytics` | G – Reporting |
| 27 | GET | `/api/fees/reports/outstanding` | `getOutstandingBalances` | G – Reporting |
| 28 | GET | `/api/fees/reports/aging` | `getAgingReport` | G – Reporting |
| 29 | GET | `/api/fees/reports/collections` | `getCollectionReport` | G – Reporting |
| 30 | GET | `/api/fees/reconciliation` | `getReconciliation` | H – Reconciliation |
| 31 | POST | `/api/fees/reconciliation/match` | `reconcileTransaction` | H – Reconciliation |

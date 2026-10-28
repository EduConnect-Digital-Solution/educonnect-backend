# EduConnect — NexaPay Integration (Frontend API Reference)

NexaPay collects school fees by **bank transfer**. The backend opens a
customer-facing virtual bank account for the invoice and hands the account
number back to the payer. When the money arrives, NexaPay calls the backend
webhook and the invoice is settled automatically.

The frontend never talks to NexaPay directly. Everything goes through the
EduConnect API.

Sections 1–3 are **admin** (or system admin) endpoints; teacher, parent and
student tokens receive `403 Insufficient permissions`. Parents and students pay
through the self-service endpoints in section 4, which only ever touch their
own invoices.

---

## 1. Configure the school (admin only)

The NexaPay credentials belong to the school, not to the deployment. They are
encrypted before they are stored and are never returned by the API.

**`PUT /api/fees/gateway/nexapay/config`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `businessId` | string | ✅ | NexaPay business ID from the dashboard |
| `environment` | `"test"` \| `"prod"` | ✅ | Which NexaPay environment the credentials belong to |
| `apiKey` | string | ✅ | NexaPay API key (write-only). Must start with `nexa-test-` for `test` and `nexa-prod-` for `prod` |
| `webhookSecret` | string | ✅ | NexaPay webhook secret (write-only) |
| `schoolId` | string | ❌ | Only a system admin may target another school |

```bash
curl -X PUT http://localhost:3000/api/fees/gateway/nexapay/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "66f1234567890abcde123456",
    "environment": "test",
    "apiKey": "nexa-test-xxxxxxxx",
    "webhookSecret": "whsec_xxxxxxxx"
  }'
```

```json
{
  "success": true,
  "message": "NexaPay configuration saved",
  "data": {
    "schoolId": "8f14e45f-...",
    "businessId": "66f1234567890abcde123456",
    "environment": "test",
    "configured": true
  }
}
```

**`GET /api/fees/gateway/nexapay/config`** returns the same fields minus the
secrets, so a settings screen can show whether the gateway is set up.

---

## 2. Open a collection

**`POST /api/fees/invoices/:invoiceId/initialize`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gateway` | `"nexapay"` | ✅ | Gateway to use |
| `amount` | integer | ❌ | Kobo. Defaults to the outstanding balance. Cannot exceed it. |
| `email` | email | ❌ | Payer email. Optional for NexaPay. |

```bash
curl -X POST http://localhost:3000/api/fees/invoices/$INVOICE_ID/initialize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "gateway": "nexapay" }'
```

```json
{
  "success": true,
  "message": "Payment initialized",
  "data": {
    "gateway": "nexapay",
    "reference": "nxa_9f2c1b7e...",
    "accountNumber": "0123456789",
    "bankName": "Example Bank",
    "amount": 400000,
    "expiresAt": "2026-10-24T12:00:00.000Z",
    "paymentId": "c1f0a2b8-..."
  }
}
```

`amount` is in **kobo** (₦4,000 = 400000). NexaPay itself is called in naira —
the conversion happens inside the backend.

**Frontend flow:** show the account number, the bank name and the exact amount.
The payer transfers the money from their own bank app, then waits. There is no
redirect and no polling requirement — the backend is notified by the webhook.

Re-initialising the same invoice while a session is still open reuses the
existing virtual account and updates the expected amount instead of opening a
second one.

---

## 3. Verify a payment manually

**`POST /api/fees/payments/verify`**

```json
{ "reference": "nxa_9f2c1b7e...", "gateway": "nexapay", "transactionId": "20260507101530abc" }
```

Useful when a payer claims they sent the money but the invoice is still open.
The reference lookup is scoped to the caller's school.

`transactionId` is optional: it is NexaPay's own id for the transfer (from the
payer's receipt or the NexaPay dashboard) and allows a direct lookup. Without
it, the backend searches NexaPay's 200 most recent wallet transactions for the
reference.

Verifying is always safe: it settles through the same path as the webhook, so
the invoice is credited exactly once no matter how many times either runs.

`data.status` is one of:

| Status | Meaning | What the UI should do |
|--------|---------|-----------------------|
| `confirmed` | Money received, invoice credited | Show the receipt |
| `pending` | No transfer seen yet; the account is still open | Keep showing the account details |
| `failed` | NexaPay reports the transfer failed | Ask the payer to try again |
| `review` | Money received but held for the bursar to reconcile | Tell the payer the school will confirm |

```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "status": "confirmed",
    "payment": {
      "reference": "nxa_9f2c1b7e...",
      "gateway": "nexapay",
      "amount": 400000,
      "receiptNumber": "RCP-LQK3-9F2C-0001",
      "paidAt": "2026-10-21T10:15:00.000Z"
    }
  }
}
```

---

## 4. Parent / student self-service

For **parent** tokens (invoices of children linked to the parent) and **student**
tokens (the student's own invoices). Admin and teacher tokens receive `403`.
An invoice or payment that is not the caller's answers `404`, exactly like one
that does not exist. These routes are rate limited to 30 calls per 15 minutes.

**`GET /api/fees/my/invoices`**

```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "c1f0a2b8-...",
        "invoiceNumber": "INV-8F14E-LQK3-0001",
        "studentId": "5d2e...",
        "studentName": "Ada Lovelace",
        "className": "JSS1",
        "feeStructureName": "JSS1 First Term Fees",
        "amount": 500000,
        "amountPaid": 100000,
        "amountDue": 400000,
        "dueDate": "2026-11-30T00:00:00.000Z",
        "status": "partial",
        "payable": true
      }
    ]
  }
}
```

**`POST /api/fees/my/invoices/:invoiceId/nexapay`** — body `{ "amount": 150000 }`
(optional, kobo; defaults to the outstanding balance). Same response as
section 2: the virtual account number, bank and amount to transfer.

**`POST /api/fees/my/payments/nexapay/verify`** — body
`{ "reference": "nxa_...", "transactionId": "..." }` (`transactionId` optional).
Same response and `status` values as section 3.

---

## 5. The webhook (server to server — not for the frontend)

**`POST /api/fees/nexapay/webhook`** — public, no Bearer token.

- Verified with an HMAC SHA-256 signature over the raw request body.
- Register this URL in the NexaPay dashboard for the `deposit.received` event.
- The endpoint is rate-limit exempt: a burst of provider retries must not delay
  settlement.
- An unknown business ID and an invalid signature both answer `401` with an
  identical body.

| Status | Meaning |
|--------|---------|
| `200` | Accepted — processed, already processed, or ignored |
| `400` | The delivery could not be parsed |
| `401` | Bad signature or unknown business |
| `500` | Processing failed — NexaPay should retry |

Deposits that cannot be matched to an invoice (or target a voided one) are
stored with `needsReview = true` and not applied. A deposit that overpays an
invoice is applied (the invoice becomes `paid`) and the payment is flagged with
`needsReview = true` so the school can refund or carry the excess forward.

---

## Error responses

| Message | Status | Cause |
|---------|--------|-------|
| `Invoice not found` | 404 | The invoice does not exist in your school |
| `Invoice is already fully paid` | 409 | Nothing left to collect |
| `Payment amount exceeds the amount due` | 400 | Amount larger than the outstanding balance |
| `NexaPay is not configured for this school` | 400 | The admin has not saved the gateway configuration yet |
| `Invalid NexaPay API key: ...` | 400 | Key prefix does not match the chosen environment |
| `Invalid NexaPay credentials: ...` | 400 | NexaPay rejected the API key for that business ID |
| `Invalid request: the transfer is not among the recent NexaPay transactions...` | 400 | Verify could not find the transfer in the last 200 transactions; resend with `transactionId` |
| `This payment session was already settled...` | 409 | A deposit settled the session while it was being re-opened; reload the invoice |
| `This NexaPay business ID is already linked to another school` | 409 | One NexaPay merchant per school |
| `Invalid transaction: ...` | 400 | The `transactionId` belongs to another reference or environment |
| `Insufficient permissions` | 403 | The token is not an admin token |
| `NexaPay did not return a virtual account number` | 502 | The provider response did not contain an account number — check the backend logs |
| Any other NexaPay failure | 502 | NexaPay rejected the request or is unreachable |

---

## Environment notes

- `environment: "test"` uses NexaPay's sandbox. Sandbox deposits never settle a
  live invoice and vice versa — the backend ignores an event whose environment
  does not match the saved configuration.
- The webhook signature layout and digest encoding are not published by
  NexaPay. See the open items in the main `README.md`.

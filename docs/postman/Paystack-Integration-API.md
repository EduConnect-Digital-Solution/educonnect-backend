# EduConnect — Paystack Payment Integration (Frontend API Reference)

All fee endpoints require `Authorization: Bearer <token>` from an **admin** (or system admin)
and amounts are in **kobo** (integer). The `fees.*` permissions are granted to admins only;
teacher, parent and student tokens receive `403 Insufficient permissions`.
To convert: `Math.round(amountInNaira * 100)`.

---

## 1. Initialize payment — creates a Paystack checkout session

**`POST /api/fees/invoices/:invoiceId/initialize`** (perm: `fees.create`)

| Param       | Type   | Req  | Notes                                                                            |
|-------------|--------|------|----------------------------------------------------------------------------------|
| `invoiceId` | UUID   | ✅    | Invoice to pay                                                                    |
| `gateway`   | string | ✅    | `"paystack"` (flutterwave not implemented yet)                                     |
| `amount`    | int    | ✅    | Amount in **kobo** (N25,000 = `2500000`). Must be ≤ `amountDue`                    |
| `email`     | email  | ✅    | Payer email (Paystack requires it)                                                 |
| `callbackUrl` | URL  | ❌    | Where Paystack redirects after payment (defaults to server `FRONTEND_URL`)         |

**Response (200):**
```json
{
  "success": true,
  "message": "Payment initialized",
  "data": {
    "authorizationUrl": "https://checkout.paystack.com/abc123",
    "accessCode": "abc123",
    "reference": "psk_<32 hex chars>",
    "gateway": "paystack",
    "paymentId": "<internal payment record uuid>"
  }
}
``` 

**Frontend flow:** send `window.location.href = data.authorizationUrl` to open the Paystack checkout. Paystack redirects back to `callbackUrl` on completion (add `?trxref=` / `?reference=` query params).

---

## 2. Verify a payment

**`POST /api/fees/payments/verify`** (perm: `fees.create`)

| Param       | Type   | Req  | Notes                                                            |
|-------------|--------|------|------------------------------------------------------------------|
| `reference` | string | ✅    | The `reference` from initialize, or the Paystack callback `trxref`/`reference` |
| `gateway`   | string | ✅    | `"paystack"`                                                     |

**Response (200):**
```json
{
  "success": true,
  "message": "Payment verified",
  "data": {
    "status": "confirmed",
    "payment": {
      "reference": "psk_abc123",
      "gateway": "paystack",
      "amount": 250000,
      "receiptNumber": "RCP-MABC123-0001",
      "paidAt": "2026-09-16T14:20:00.000Z"
    }
  }
}
```

- `status` is `confirmed` or `failed`.
- On `confirmed`, the invoice is updated (amountPaid / amountDue / status) and a ledger entry + receipt number are generated.
- The call is **idempotent** — safe to call repeatedly.

---

## 3. Paystack webhook — server-to-server (NOT for the frontend)

**`POST /api/fees/paystack/webhook`** — public, no Bearer token.

- Verified via `x-paystack-signature` header (HMAC-SHA512 of the raw body using `PAYSTACK_SECRET_KEY`).
- Handles the `charge.success` event, idempotently, with amount-mismatch protection.
- Register this URL in the Paystack dashboard (event: `charge.success`).

---

## Supporting endpoints (useful for the UI)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fees/invoices/:invoiceId/payments` | Payment history for one invoice → `{ success, data: { payments: [...] } }` |
| GET | `/api/fees/payments?from=&to=&gateway=paystack&status=confirmed&page=&limit=` | All payments, filterable |
| GET | `/api/fees/receipts/:paymentId` | Fetch receipt for a confirmed payment |
| GET | `/api/fees/structures/:id` | Fee structure detail — now also returns `termName`, `className`, `armName` alongside `termId` / `classId` / `armId` |

---

## Error format (all endpoints)

```json
{ "success": false, "message": "..." }
```

| Common errors | Status |
|---|---|
| `Payment amount exceeds the amount due` | 400 |
| `Insufficient permissions` | 403 |
| `Invoice not found` | 404 |
| `Paystack is not configured` | 500 |
| `Payment amount mismatch with Paystack record` | 500 |
| Paystack rejected the request or is unreachable | 502 |

---

## Notes

- `PAYSTACK_SECRET_KEY` is currently a **test key** (`sk_test_...`) → payments hit the Paystack sandbox.
- The webhook signature must match the same secret key as the one that initialized the payment.
- Amounts are integer kobo — the frontend must convert naira → kobo before calling initialize.
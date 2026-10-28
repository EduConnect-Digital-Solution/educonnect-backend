/**
 * Fee route access tests: who can reach which fee endpoints.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../middleware/auth', () => ({
  // The test picks the caller's role with a header.
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { userId: 'user-1', id: 'user-1', role: req.headers['x-test-role'], schoolId: 'school-1' };
    next();
  })
}));

jest.mock('../../controllers/feeController', () => {
  const ok = (req, res) => res.status(200).json({ success: true });
  return new Proxy({}, { get: () => ok });
});

const feeRoutes = require('../feeRoutes');

const app = express();
app.use(express.json());
app.use('/api/fees', feeRoutes);

const INVOICE_ID = '8f14e45f-ceea-4b6b-9b6a-2f1c3d4e5f60';

describe('fee route access', () => {
  it.each(['parent', 'student'])('should let a %s list and pay their own invoices', async (role) => {
    const list = await request(app).get('/api/fees/my/invoices').set('x-test-role', role);
    const pay = await request(app).post(`/api/fees/my/invoices/${INVOICE_ID}/nexapay`).set('x-test-role', role).send({});
    const verify = await request(app).post('/api/fees/my/payments/nexapay/verify').set('x-test-role', role).send({ reference: 'nxa_1' });

    expect(list.status).toBe(200);
    expect(pay.status).toBe(200);
    expect(verify.status).toBe(200);
  });

  it.each(['parent', 'student', 'teacher'])('should keep a %s out of the school-wide fee routes', async (role) => {
    const response = await request(app).get('/api/fees/invoices').set('x-test-role', role);
    expect(response.status).toBe(403);
  });

  it('should let an admin use the school-wide fee routes but not the self-service ones', async () => {
    const backOffice = await request(app).get('/api/fees/invoices').set('x-test-role', 'admin');
    const selfService = await request(app).get('/api/fees/my/invoices').set('x-test-role', 'admin');

    expect(backOffice.status).toBe(200);
    expect(selfService.status).toBe(403);
  });
});

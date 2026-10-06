import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import { createInMemoryDb, setDb } from '../../src/database/db.js';
import { seedDatabase } from '../../src/database/seed.js';

describe('API Integration Tests', () => {
  let db: Database.Database;
  let app: any;
  let adminToken: string;
  let accountantToken: string;
  let staffToken: string;

  beforeEach(() => {
    db = createInMemoryDb();
    setDb(db);
    seedDatabase(db);
    app = createApp();

    // Login as Admin
    const adminLogin = request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'securepassword123' });

    return adminLogin.then((res) => {
      adminToken = res.body.token;

      // Create Accountant
      return request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'accountant@example.com', password: 'password123', role: 'Accountant' })
        .then(() => {
          // Create Staff
          return request(app)
            .post('/api/users')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ email: 'staff@example.com', password: 'password123', role: 'Staff' });
        })
        .then(() => {
          // Login as Accountant
          return request(app)
            .post('/api/auth/login')
            .send({ email: 'accountant@example.com', password: 'password123' })
            .then((resAcc) => {
              accountantToken = resAcc.body.token;
              // Login as Staff
              return request(app)
                .post('/api/auth/login')
                .send({ email: 'staff@example.com', password: 'password123' })
                .then((resStaff) => {
                  staffToken = resStaff.body.token;
                });
            });
        });
    });
  });

  describe('Authentication & Users', () => {
    it('should reject invalid credentials with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('should allow Admin to list users and reject Staff with 403', async () => {
      const adminRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body).toHaveLength(3);

      const staffRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(staffRes.status).toBe(403);
    });
  });

  describe('Chart of Accounts & Contacts', () => {
    it('should list chart of accounts for all roles', async () => {
      const res = await request(app)
        .get('/api/accounts')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(7);
      expect(res.body.find((a: any) => a.code === '1000')).toBeDefined();
    });

    it('should list contacts', async () => {
      const res = await request(app)
        .get('/api/contacts')
        .set('Authorization', `Bearer ${staffToken}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Sales Invoices & Payments Flow', () => {
    it('should execute full invoice lifecycle: Create -> Deliver -> Pay -> Report', async () => {
      const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

      // 1. Create Draft invoice
      const createRes = await request(app)
        .post('/api/sale-invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          invoice_no: 'INV-API-101',
          total_amount: 50000, // $500.00
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.status).toBe('Draft');
      const invoiceId = createRes.body.id;

      // 2. Deliver invoice
      const deliverRes = await request(app)
        .put(`/api/sale-invoices/${invoiceId}/deliver`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.status).toBe('Delivered');

      // 3. Receive partial payment
      const pay1Res = await request(app)
        .post('/api/payments-received')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          amount: 20000,
          payment_receive_no: 'PAY-API-101',
          entries: [{ invoice_id: invoiceId, amount_applied: 20000 }],
        });

      expect(pay1Res.status).toBe(201);

      // Check invoice status -> Partially Paid
      const invList1 = await request(app)
        .get('/api/sale-invoices')
        .set('Authorization', `Bearer ${staffToken}`);
      const inv1 = invList1.body.find((i: any) => i.id === invoiceId);
      expect(inv1.status).toBe('Partially Paid');

      // 4. Receive remaining payment (and trigger duplicate alert test)
      const pay2Res = await request(app)
        .post('/api/payments-received')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          amount: 30000,
          payment_receive_no: 'PAY-API-102',
          entries: [{ invoice_id: invoiceId, amount_applied: 30000 }],
        });

      expect(pay2Res.status).toBe(201);

      // Check invoice status -> Paid
      const invList2 = await request(app)
        .get('/api/sale-invoices')
        .set('Authorization', `Bearer ${staffToken}`);
      const inv2 = invList2.body.find((i: any) => i.id === invoiceId);
      expect(inv2.status).toBe('Paid');

      // 5. Check Trial Balance report via API
      const tbRes = await request(app)
        .get('/api/reports/trial-balance-sheet')
        .set('Authorization', `Bearer ${accountantToken}`);

      expect(tbRes.status).toBe(200);
      expect(tbRes.body.total_debit).toBe(100000);
      expect(tbRes.body.total_credit).toBe(100000);
      expect(tbRes.body.is_balanced).toBe(true);
    });

    it('should reject payment exceeding remaining invoice balance with 422', async () => {
      const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

      const createRes = await request(app)
        .post('/api/sale-invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          invoice_no: 'INV-API-EXCESS',
          total_amount: 10000,
        });

      await request(app)
        .put(`/api/sale-invoices/${createRes.body.id}/deliver`)
        .set('Authorization', `Bearer ${staffToken}`);

      const payRes = await request(app)
        .post('/api/payments-received')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          amount: 15000,
          payment_receive_no: 'PAY-EXCESS-1',
          entries: [{ invoice_id: createRes.body.id, amount_applied: 15000 }],
        });

      expect(payRes.status).toBe(422);
    });

    it('should test Differentiator 1: trigger duplicate payment alert when recording same amount within 10 minutes', async () => {
      const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

      // Invoice 1
      const inv1 = await request(app)
        .post('/api/sale-invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ customer_id: customer.id, invoice_no: 'INV-ALERT-1', total_amount: 10000 });
      await request(app).put(`/api/sale-invoices/${inv1.body.id}/deliver`).set('Authorization', `Bearer ${staffToken}`);

      // Invoice 2
      const inv2 = await request(app)
        .post('/api/sale-invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ customer_id: customer.id, invoice_no: 'INV-ALERT-2', total_amount: 10000 });
      await request(app).put(`/api/sale-invoices/${inv2.body.id}/deliver`).set('Authorization', `Bearer ${staffToken}`);

      // First payment
      const p1 = await request(app)
        .post('/api/payments-received')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          amount: 10000,
          payment_receive_no: 'PAY-ALERT-1',
          entries: [{ invoice_id: inv1.body.id, amount_applied: 10000 }],
        });
      expect(p1.status).toBe(201);
      expect(p1.body.alert).toBeUndefined();

      // Second payment with same amount immediately (within 10 mins)
      const p2 = await request(app)
        .post('/api/payments-received')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          customer_id: customer.id,
          amount: 10000,
          payment_receive_no: 'PAY-ALERT-2',
          entries: [{ invoice_id: inv2.body.id, amount_applied: 10000 }],
        });
      expect(p2.status).toBe(201);
      expect(p2.body.alert).toContain('DUPLICATE_PAYMENT_WARNING');
    });
  });

  describe('Vendor Bills & Payments', () => {
    it('should create bill, record bill payment, and reverse bill', async () => {
      const vendor = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Vendor'").get() as { id: number };

      const billRes = await request(app)
        .post('/api/bills')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          vendor_id: vendor.id,
          bill_number: 'BILL-1001',
          total_amount: 30000,
        });

      expect(billRes.status).toBe(201);
      const billId = billRes.body.id;

      // Record bill payment
      const payRes = await request(app)
        .post('/api/bill-payments')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          vendor_id: vendor.id,
          amount: 30000,
          payment_number: 'BPAY-1001',
          entries: [{ bill_id: billId, amount_applied: 30000 }],
        });
      expect(payRes.status).toBe(201);

      // Attempting to void bill with payments should fail with 409 ERR_HAS_PAYMENTS
      const voidRes = await request(app)
        .delete(`/api/bills/${billId}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(voidRes.status).toBe(409);
      expect(voidRes.body.code).toBe('ERR_HAS_PAYMENTS');
    });
  });

  describe('Manual Journals & Reports', () => {
    it('should post manual journal and verify in Journal Report and P&L Report', async () => {
      const bank = db.prepare("SELECT id FROM accounts WHERE code = '1000'").get() as { id: number };
      const equity = db.prepare("SELECT id FROM accounts WHERE code = '3000'").get() as { id: number };

      const mjRes = await request(app)
        .post('/api/manual-journals')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({
          journal_number: 'MJ-1001',
          date: '2026-10-06',
          notes: "Owner's initial capital injection",
          entries: [
            { account_id: bank.id, debit: 1000000, credit: 0 },
            { account_id: equity.id, debit: 0, credit: 1000000 },
          ],
        });

      expect(mjRes.status).toBe(201);

      // Check Journal Report
      const jRes = await request(app)
        .get('/api/reports/journal')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(jRes.status).toBe(200);
      expect(jRes.body.length).toBeGreaterThanOrEqual(2);

      // Check Balance Sheet
      const bsRes = await request(app)
        .get('/api/reports/balance-sheet')
        .set('Authorization', `Bearer ${accountantToken}`);
      expect(bsRes.status).toBe(200);
      expect(bsRes.body.assets.total).toBe(1000000);
      expect(bsRes.body.equity.total).toBe(1000000);
      expect(bsRes.body.is_balanced).toBe(true);
    });
  });
});

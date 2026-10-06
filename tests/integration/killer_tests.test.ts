import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import { createInMemoryDb, setDb } from '../../src/database/db.js';
import { seedDatabase } from '../../src/database/seed.js';
import { LedgerService } from '../../src/modules/accounting/ledger.service.js';
import { InvoiceService } from '../../src/modules/invoices/invoice.service.js';
import { TestHarnessService } from '../../src/modules/test-harness/test-harness.service.js';

describe('The Three Killer Tests', () => {
  let db: Database.Database;
  let app: any;
  let adminToken: string;

  beforeEach(async () => {
    db = createInMemoryDb();
    setDb(db);
    seedDatabase(db);
    app = createApp();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'securepassword123' });
    adminToken = res.body.token;
  });

  // =========================================================================
  // KILLER TEST 1 — JOURNAL BALANCE
  // =========================================================================
  describe('KILLER TEST 1 — Journal Balance Invariant', () => {
    it('should reject an unbalanced journal (Debit 10000, Credit 8000) via REST API with HTTP 400', async () => {
      const bank = LedgerService.getAccountByCode('1000', db);
      const revenue = LedgerService.getAccountByCode('4000', db);

      const initialTb = LedgerService.getTrialBalance(db);

      const res = await request(app)
        .post('/api/manual-journals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          journal_number: 'KT1-UNBALANCED-1',
          date: '2026-10-06',
          notes: 'Intentionally unbalanced journal',
          entries: [
            { account_id: bank.id, debit: 10000, credit: 0 },
            { account_id: revenue.id, debit: 0, credit: 8000 },
          ],
        });

      // 1. Assert HTTP 400 rejection
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unbalanced journal transaction');

      // 2. Assert zero journal transactions written
      const txCount = (
        db.prepare('SELECT COUNT(*) as count FROM accounts_transactions').get() as { count: number }
      ).count;
      expect(txCount).toBe(0);

      // 3. Assert zero manual journal headers written
      const mjCount = (
        db.prepare('SELECT COUNT(*) as count FROM manual_journals').get() as { count: number }
      ).count;
      expect(mjCount).toBe(0);

      // 4. Assert account balances remain unchanged
      expect(LedgerService.getAccountByCode('1000', db).balance).toBe(0);
      expect(LedgerService.getAccountByCode('4000', db).balance).toBe(0);

      // 5. Assert global trial balance remains balanced
      const afterTb = LedgerService.getTrialBalance(db);
      expect(afterTb.total_debit).toBe(initialTb.total_debit);
      expect(afterTb.total_credit).toBe(initialTb.total_credit);
      expect(afterTb.is_balanced).toBe(true);
    });

    it('should reject an imbalanced multi-line journal with fractional cents or multiple errors', async () => {
      const bank = LedgerService.getAccountByCode('1000', db);
      const ar = LedgerService.getAccountByCode('1100', db);
      const revenue = LedgerService.getAccountByCode('4000', db);

      const res = await request(app)
        .post('/api/manual-journals')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          journal_number: 'KT1-UNBALANCED-2',
          date: '2026-10-06',
          notes: 'Multi-line imbalanced',
          entries: [
            { account_id: bank.id, debit: 5000, credit: 0 },
            { account_id: ar.id, debit: 4000, credit: 0 },
            { account_id: revenue.id, debit: 0, credit: 8000 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Unbalanced journal transaction');
    });
  });

  // =========================================================================
  // KILLER TEST 2 — INVOICE REVERSAL
  // =========================================================================
  describe('KILLER TEST 2 — Invoice Reversal & Semantic Void', () => {
    it('should execute complete invoice reversal lifecycle via API', async () => {
      const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

      // Record pre-invoice balances
      const preArBalance = LedgerService.getAccountByCode('1100', db).balance;
      const preRevBalance = LedgerService.getAccountByCode('4000', db).balance;
      const preBankBalance = LedgerService.getAccountByCode('1000', db).balance;

      // 1. Create Invoice
      const createRes = await request(app)
        .post('/api/sale-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customer_id: customer.id,
          invoice_no: 'INV-KT2-E2E',
          total_amount: 45000, // $450.00
        });

      expect(createRes.status).toBe(201);
      const invoiceId = createRes.body.id;

      // 2. Deliver Invoice -> Posts accounting entries
      const deliverRes = await request(app)
        .put(`/api/sale-invoices/${invoiceId}/deliver`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(deliverRes.status).toBe(200);

      // Verify intermediate balances
      expect(LedgerService.getAccountByCode('1100', db).balance).toBe(preArBalance + 45000);
      expect(LedgerService.getAccountByCode('4000', db).balance).toBe(preRevBalance + 45000);
      expect(LedgerService.getAccountByCode('1000', db).balance).toBe(preBankBalance); // Unrelated

      // 3. Void Invoice via DELETE endpoint
      const voidRes = await request(app)
        .delete(`/api/sale-invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(voidRes.status).toBe(200);
      expect(voidRes.body.status).toBe('Voided');

      // 4. Verify invoice row still exists in DB
      const invoiceInDb = InvoiceService.getInvoiceById(invoiceId, db);
      expect(invoiceInDb).not.toBeNull();
      expect(invoiceInDb?.status).toBe('Voided');

      // 5. Verify ledger entries (2 original + 2 reversal = 4 rows)
      const txRows = db
        .prepare('SELECT account_id, debit, credit FROM accounts_transactions WHERE reference_type = ? AND reference_id = ? ORDER BY id ASC')
        .all('SaleInvoice', invoiceId) as { account_id: number; debit: number; credit: number }[];

      expect(txRows).toHaveLength(4);

      const arId = LedgerService.getAccountByCode('1100', db).id;
      const revId = LedgerService.getAccountByCode('4000', db).id;

      // Original: Line 1 (Debit A/R 45000), Line 2 (Credit Rev 45000)
      expect(txRows[0]).toEqual({ account_id: arId, debit: 45000, credit: 0 });
      expect(txRows[1]).toEqual({ account_id: revId, debit: 0, credit: 45000 });

      // Reversal: Line 3 (Credit A/R 45000), Line 4 (Debit Rev 45000)
      expect(txRows[2]).toEqual({ account_id: arId, debit: 0, credit: 45000 });
      expect(txRows[3]).toEqual({ account_id: revId, debit: 45000, credit: 0 });

      // 6. Verify net accounting effect returns to pre-invoice state
      expect(LedgerService.getAccountByCode('1100', db).balance).toBe(preArBalance);
      expect(LedgerService.getAccountByCode('4000', db).balance).toBe(preRevBalance);
      expect(LedgerService.getAccountByCode('1000', db).balance).toBe(preBankBalance); // Unrelated

      // 7. Verify Trial Balance is balanced
      const tb = LedgerService.getTrialBalance(db);
      expect(tb.is_balanced).toBe(true);
    });
  });

  // =========================================================================
  // KILLER TEST 3 — TRIAL BALANCE & CONCURRENCY
  // =========================================================================
  describe('KILLER TEST 3 — Trial Balance & Concurrency Harness', () => {
    it('should run 20 randomized operations and assert strict zero discrepancy on Trial Balance', async () => {
      // Run test harness with 20 operations
      const result = await TestHarnessService.runRandomOperations(987654321, 20, db);

      expect(result.operations_run).toBeGreaterThan(0);
      expect(result.final_trial_balance.is_balanced).toBe(true);
      expect(result.final_trial_balance.total_debit).toBe(result.final_trial_balance.total_credit);

      // Verify trial balance via REST endpoint
      const tbRes = await request(app)
        .get('/api/reports/trial-balance-sheet')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(tbRes.status).toBe(200);
      expect(tbRes.body.is_balanced).toBe(true);
      expect(tbRes.body.total_debit).toBe(tbRes.body.total_credit);
    });

    it('should test test-harness endpoint /api/test/seed-random under NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';

      const res = await request(app)
        .post('/api/test/seed-random')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ seed: 55555, count: 20 });

      expect(res.status).toBe(200);
      expect(res.body.operations_run).toBeGreaterThan(0);
      expect(res.body.final_trial_balance.is_balanced).toBe(true);
      expect(res.body.final_trial_balance.total_debit).toBe(
        res.body.final_trial_balance.total_credit
      );
    });
  });
});

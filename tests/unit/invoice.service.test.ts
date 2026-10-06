import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createInMemoryDb } from '../../src/database/db.js';
import { seedDatabase } from '../../src/database/seed.js';
import { InvoiceService, InvoiceError } from '../../src/modules/invoices/invoice.service.js';
import { LedgerService } from '../../src/modules/accounting/ledger.service.js';

describe('Invoice Lifecycle and Reversal (Killer Test 2)', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createInMemoryDb();
    seedDatabase(db);
  });

  it('should create a Draft invoice without creating any ledger entries', () => {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number };
    const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

    const result = InvoiceService.createInvoice(
      {
        customer_id: customer.id,
        invoice_no: 'INV-1001',
        total_amount: 15000, // $150.00
      },
      admin.id,
      db
    );

    expect(result.id).toBeDefined();
    expect(result.status).toBe('Draft');

    // Verify invoice exists
    const invoice = InvoiceService.getInvoiceById(result.id, db);
    expect(invoice?.status).toBe('Draft');
    expect(invoice?.total_amount).toBe(15000);

    // Verify ZERO ledger entries
    const txCount = (
      db.prepare('SELECT COUNT(*) as count FROM accounts_transactions').get() as { count: number }
    ).count;
    expect(txCount).toBe(0);

    // Verify account balances remain 0
    expect(LedgerService.getAccountByCode('1100', db).balance).toBe(0);
    expect(LedgerService.getAccountByCode('4000', db).balance).toBe(0);
  });

  it('should deliver/post an invoice and create balanced ledger entries', () => {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number };
    const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

    const created = InvoiceService.createInvoice(
      {
        customer_id: customer.id,
        invoice_no: 'INV-1002',
        total_amount: 20000, // $200.00
      },
      admin.id,
      db
    );

    const delivered = InvoiceService.deliverInvoice(created.id, db);
    expect(delivered.status).toBe('Delivered');

    // Verify status updated in DB
    const invoice = InvoiceService.getInvoiceById(created.id, db);
    expect(invoice?.status).toBe('Delivered');

    // Verify ledger entries created (A/R debited, Revenue credited)
    const arAccount = LedgerService.getAccountByCode('1100', db);
    const revenueAccount = LedgerService.getAccountByCode('4000', db);

    expect(arAccount.balance).toBe(20000);
    expect(revenueAccount.balance).toBe(20000);

    // Verify Trial Balance
    const tb = LedgerService.getTrialBalance(db);
    expect(tb.total_debit).toBe(20000);
    expect(tb.total_credit).toBe(20000);
    expect(tb.is_balanced).toBe(true);
  });

  it('should execute Killer Test 2: Invoice Reversal / Semantic Void', () => {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number };
    const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

    // 1. Create and deliver invoice
    const created = InvoiceService.createInvoice(
      {
        customer_id: customer.id,
        invoice_no: 'INV-KT2',
        total_amount: 35000,
      },
      admin.id,
      db
    );
    InvoiceService.deliverInvoice(created.id, db);

    // Verify initial posted state
    expect(LedgerService.getAccountByCode('1100', db).balance).toBe(35000);
    expect(LedgerService.getAccountByCode('4000', db).balance).toBe(35000);
    expect(LedgerService.getAccountByCode('1000', db).balance).toBe(0); // Unrelated account

    // 2. Void invoice (DELETE endpoint equivalent)
    const voidResult = InvoiceService.voidInvoice(created.id, db);
    expect(voidResult.status).toBe('Voided');

    // 3. Verify invoice record STILL EXISTS in DB (No SQL DELETE)
    const invoiceAfterVoid = InvoiceService.getInvoiceById(created.id, db);
    expect(invoiceAfterVoid).not.toBeNull();
    expect(invoiceAfterVoid?.status).toBe('Voided');

    // 4. Verify balances returned to pre-invoice state
    expect(LedgerService.getAccountByCode('1100', db).balance).toBe(0);
    expect(LedgerService.getAccountByCode('4000', db).balance).toBe(0);
    expect(LedgerService.getAccountByCode('1000', db).balance).toBe(0); // Unrelated untouched

    // 5. Verify ledger entries: 2 original + 2 inverse = 4 entries
    const transactions = db
      .prepare('SELECT account_id, debit, credit FROM accounts_transactions WHERE reference_type = ? AND reference_id = ?')
      .all('SaleInvoice', created.id) as { account_id: number; debit: number; credit: number }[];

    expect(transactions).toHaveLength(4);

    // Original entries: Debit A/R 35000, Credit Rev 35000
    // Reversal entries: Credit A/R 35000, Debit Rev 35000
    const arId = LedgerService.getAccountByCode('1100', db).id;
    const revId = LedgerService.getAccountByCode('4000', db).id;

    const arLines = transactions.filter((t) => t.account_id === arId);
    expect(arLines).toHaveLength(2);
    expect(arLines.find((t) => t.debit === 35000 && t.credit === 0)).toBeDefined();
    expect(arLines.find((t) => t.credit === 35000 && t.debit === 0)).toBeDefined();

    const revLines = transactions.filter((t) => t.account_id === revId);
    expect(revLines).toHaveLength(2);
    expect(revLines.find((t) => t.credit === 35000 && t.debit === 0)).toBeDefined();
    expect(revLines.find((t) => t.debit === 35000 && t.credit === 0)).toBeDefined();

    // 6. Verify Trial Balance remains strictly balanced
    const tb = LedgerService.getTrialBalance(db);
    expect(tb.total_debit).toBe(70000);
    expect(tb.total_credit).toBe(70000);
    expect(tb.is_balanced).toBe(true);
  });

  it('should reject voiding an already voided invoice with ERR_ALREADY_VOIDED', () => {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number };
    const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

    const created = InvoiceService.createInvoice(
      {
        customer_id: customer.id,
        invoice_no: 'INV-1003',
        total_amount: 10000,
      },
      admin.id,
      db
    );
    InvoiceService.deliverInvoice(created.id, db);
    InvoiceService.voidInvoice(created.id, db);

    // Attempt second void
    try {
      InvoiceService.voidInvoice(created.id, db);
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err).toBeInstanceOf(InvoiceError);
      expect(err.statusCode).toBe(409);
      expect(err.errorCode).toBe('ERR_ALREADY_VOIDED');
    }
  });

  it('should reject duplicate invoice_no with HTTP 409 Conflict', () => {
    const admin = db.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number };
    const customer = db.prepare("SELECT id FROM contacts WHERE contact_type = 'Customer'").get() as { id: number };

    InvoiceService.createInvoice(
      {
        customer_id: customer.id,
        invoice_no: 'INV-UNIQUE-1',
        total_amount: 10000,
      },
      admin.id,
      db
    );

    expect(() => {
      InvoiceService.createInvoice(
        {
          customer_id: customer.id,
          invoice_no: 'INV-UNIQUE-1',
          total_amount: 20000,
        },
        admin.id,
        db
      );
    }).toThrow(InvoiceError);
  });
});

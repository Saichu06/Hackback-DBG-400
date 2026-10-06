import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createInMemoryDb, withTransaction } from '../../src/database/db.js';
import { seedDatabase } from '../../src/database/seed.js';
import {
  LedgerService,
  AccountingError,
} from '../../src/modules/accounting/ledger.service.js';

describe('Accounting Core - Ledger Engine', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createInMemoryDb();
    seedDatabase(db);
  });

  it('should post a valid balanced 2-line journal entry and update balances', () => {
    const bank = LedgerService.getAccountByCode('1000', db); // Asset
    const revenue = LedgerService.getAccountByCode('4000', db); // Revenue

    const lines = [
      { account_id: bank.id, debit: 50000, credit: 0 },
      { account_id: revenue.id, debit: 0, credit: 50000 },
    ];

    const entries = LedgerService.postJournal('ManualJournal', 1, lines, db);

    expect(entries).toHaveLength(2);

    const updatedBank = LedgerService.getAccountByCode('1000', db);
    const updatedRevenue = LedgerService.getAccountByCode('4000', db);

    expect(updatedBank.balance).toBe(50000);
    expect(updatedRevenue.balance).toBe(50000);

    const tb = LedgerService.getTrialBalance(db);
    expect(tb.total_debit).toBe(50000);
    expect(tb.total_credit).toBe(50000);
    expect(tb.is_balanced).toBe(true);
  });

  it('should post a valid balanced multi-line journal entry (e.g. GST split)', () => {
    const ar = LedgerService.getAccountByCode('1100', db); // Asset
    const revenue = LedgerService.getAccountByCode('4000', db); // Revenue
    const taxPayable = LedgerService.getAccountByCode('2100', db); // Liability

    // Total invoice: $118 = $100 revenue + $18 tax
    const lines = [
      { account_id: ar.id, debit: 11800, credit: 0 },
      { account_id: revenue.id, debit: 0, credit: 10000 },
      { account_id: taxPayable.id, debit: 0, credit: 1800 },
    ];

    const entries = LedgerService.postJournal('SaleInvoice', 101, lines, db);

    expect(entries).toHaveLength(3);

    const updatedAr = LedgerService.getAccountByCode('1100', db);
    const updatedRevenue = LedgerService.getAccountByCode('4000', db);
    const updatedTax = LedgerService.getAccountByCode('2100', db);

    expect(updatedAr.balance).toBe(11800);
    expect(updatedRevenue.balance).toBe(10000);
    expect(updatedTax.balance).toBe(1800);

    const tb = LedgerService.getTrialBalance(db);
    expect(tb.total_debit).toBe(11800);
    expect(tb.total_credit).toBe(11800);
    expect(tb.is_balanced).toBe(true);
  });

  it('should reject an unbalanced journal entry before persisting (Killer Test 1)', () => {
    const bank = LedgerService.getAccountByCode('1000', db);
    const revenue = LedgerService.getAccountByCode('4000', db);

    const unbalancedLines = [
      { account_id: bank.id, debit: 10000, credit: 0 },
      { account_id: revenue.id, debit: 0, credit: 8000 },
    ];

    expect(() => {
      LedgerService.postJournal('ManualJournal', 99, unbalancedLines, db);
    }).toThrow(AccountingError);

    // Verify zero rows written
    const txCount = (
      db.prepare('SELECT COUNT(*) as count FROM accounts_transactions').get() as {
        count: number;
      }
    ).count;
    expect(txCount).toBe(0);

    // Verify balances unchanged
    expect(LedgerService.getAccountByCode('1000', db).balance).toBe(0);
    expect(LedgerService.getAccountByCode('4000', db).balance).toBe(0);
  });

  it('should reject a journal line with both debit and credit > 0', () => {
    const bank = LedgerService.getAccountByCode('1000', db);
    const revenue = LedgerService.getAccountByCode('4000', db);

    const invalidLines = [
      { account_id: bank.id, debit: 1000, credit: 500 },
      { account_id: revenue.id, debit: 0, credit: 500 },
    ];

    expect(() => {
      LedgerService.validateJournal(invalidLines);
    }).toThrow(AccountingError);
  });

  it('should reject a journal line with 0 debit and 0 credit', () => {
    const bank = LedgerService.getAccountByCode('1000', db);
    const revenue = LedgerService.getAccountByCode('4000', db);

    const invalidLines = [
      { account_id: bank.id, debit: 0, credit: 0 },
      { account_id: revenue.id, debit: 0, credit: 0 },
    ];

    expect(() => {
      LedgerService.validateJournal(invalidLines);
    }).toThrow(AccountingError);
  });

  it('should reject floating-point / fractional cents amounts', () => {
    const bank = LedgerService.getAccountByCode('1000', db);
    const revenue = LedgerService.getAccountByCode('4000', db);

    const invalidLines = [
      { account_id: bank.id, debit: 100.5, credit: 0 },
      { account_id: revenue.id, debit: 0, credit: 100.5 },
    ];

    expect(() => {
      LedgerService.validateJournal(invalidLines);
    }).toThrow(AccountingError);
  });

  it('should safely reverse a transaction with exact inverse debits/credits', () => {
    const ar = LedgerService.getAccountByCode('1100', db);
    const revenue = LedgerService.getAccountByCode('4000', db);

    // Initial post: Debit A/R 25000, Credit Revenue 25000
    LedgerService.postJournal(
      'SaleInvoice',
      201,
      [
        { account_id: ar.id, debit: 25000, credit: 0 },
        { account_id: revenue.id, debit: 0, credit: 25000 },
      ],
      db
    );

    expect(LedgerService.getAccountByCode('1100', db).balance).toBe(25000);
    expect(LedgerService.getAccountByCode('4000', db).balance).toBe(25000);

    // Execute reversal
    const reversal = LedgerService.reverseTransaction('SaleInvoice', 201, db);
    expect(reversal).toHaveLength(2);

    // Balances must return to exactly 0
    expect(LedgerService.getAccountByCode('1100', db).balance).toBe(0);
    expect(LedgerService.getAccountByCode('4000', db).balance).toBe(0);

    // Total debits and credits across all 4 transactions must balance
    const tb = LedgerService.getTrialBalance(db);
    expect(tb.total_debit).toBe(50000);
    expect(tb.total_credit).toBe(50000);
    expect(tb.is_balanced).toBe(true);
  });

  it('should rollback cleanly and leave no partial state on transaction failure', () => {
    const bank = LedgerService.getAccountByCode('1000', db);

    expect(() => {
      withTransaction((database) => {
        // Post a valid journal
        LedgerService.postJournal(
          'ManualJournal',
          301,
          [
            { account_id: bank.id, debit: 10000, credit: 0 },
            { account_id: bank.id, debit: 0, credit: 10000 },
          ],
          database
        );
        // Throw an unexpected error inside transaction
        throw new Error('Simulated database crash');
      }, db);
    }).toThrow('Simulated database crash');

    // Verify rollback
    const txCount = (
      db.prepare('SELECT COUNT(*) as count FROM accounts_transactions').get() as {
        count: number;
      }
    ).count;
    expect(txCount).toBe(0);
    expect(LedgerService.getAccountByCode('1000', db).balance).toBe(0);
  });
});

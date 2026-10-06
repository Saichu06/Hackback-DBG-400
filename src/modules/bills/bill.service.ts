import Database from 'better-sqlite3';
import { getDb, withTransaction } from '../../database/db.js';
import { Bill, BillStatus, JournalLine } from '../../types/index.js';
import { LedgerService } from '../accounting/ledger.service.js';

export interface CreateBillInput {
  vendor_id: number;
  bill_number: string;
  total_amount: number; // in cents
  entries?: {
    amount: number;
    tax_rate?: number | null;
    tax_amount?: number;
  }[];
}

export interface BillPaymentEntryInput {
  bill_id: number;
  amount_applied: number; // in cents
}

export interface CreateBillPaymentInput {
  vendor_id: number;
  amount: number; // in cents
  payment_number: string;
  entries: BillPaymentEntryInput[];
}

export class BillError extends Error {
  public statusCode: number;
  public errorCode?: string;

  constructor(message: string, statusCode: number = 400, errorCode?: string) {
    super(message);
    this.name = 'BillError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class BillService {
  public static listBills(dbInstance?: Database.Database): Bill[] {
    const db = dbInstance || getDb();
    return db
      .prepare('SELECT id, bill_number, vendor_id, total_amount, status, created_at FROM bills ORDER BY id DESC')
      .all() as Bill[];
  }

  public static getBillById(id: number, dbInstance?: Database.Database): Bill | null {
    const db = dbInstance || getDb();
    const bill = db
      .prepare('SELECT id, bill_number, vendor_id, total_amount, status, created_at FROM bills WHERE id = ?')
      .get(id) as Bill | undefined;
    return bill || null;
  }

  public static createBill(
    input: CreateBillInput,
    dbInstance?: Database.Database
  ): { id: number; status: BillStatus } {
    if (!input.bill_number || typeof input.bill_number !== 'string') {
      throw new BillError('bill_number is required', 400);
    }
    if (!Number.isInteger(input.vendor_id) || input.vendor_id <= 0) {
      throw new BillError('Valid vendor_id is required', 400);
    }
    if (!Number.isInteger(input.total_amount) || input.total_amount <= 0) {
      throw new BillError('total_amount must be a positive integer in cents', 400);
    }

    const execute = (db: Database.Database) => {
      // Validate vendor
      const vendor = db.prepare("SELECT id FROM contacts WHERE id = ?").get(input.vendor_id);
      if (!vendor) {
        throw new BillError('Vendor not found', 400);
      }

      // Check unique bill_number
      const existing = db.prepare('SELECT id FROM bills WHERE bill_number = ?').get(input.bill_number);
      if (existing) {
        throw new BillError(`Bill number ${input.bill_number} already exists`, 409);
      }

      // Insert Bill with initial status 'Open'
      const insertBillStmt = db.prepare(`
        INSERT INTO bills (bill_number, vendor_id, total_amount, status)
        VALUES (?, ?, ?, 'Open')
      `);
      const result = insertBillStmt.run(input.bill_number, input.vendor_id, input.total_amount);
      const billId = Number(result.lastInsertRowid);

      // Insert line items
      if (input.entries && input.entries.length > 0) {
        const insertItemStmt = db.prepare(`
          INSERT INTO items_entries (reference_type, reference_id, amount, tax_rate, tax_amount)
          VALUES ('Bill', ?, ?, ?, ?)
        `);
        for (const entry of input.entries) {
          insertItemStmt.run(billId, entry.amount, entry.tax_rate ?? null, entry.tax_amount ?? 0);
        }
      } else {
        db.prepare(`
          INSERT INTO items_entries (reference_type, reference_id, amount, tax_rate, tax_amount)
          VALUES ('Bill', ?, ?, NULL, 0)
        `).run(billId, input.total_amount);
      }

      // Post accounting entries:
      // Debit: General Expenses (5000)
      // Credit: Accounts Payable (2000)
      const expenseAccount = LedgerService.getAccountByCode('5000', db);
      const apAccount = LedgerService.getAccountByCode('2000', db);

      const lines: JournalLine[] = [
        { account_id: expenseAccount.id, debit: input.total_amount, credit: 0 },
        { account_id: apAccount.id, debit: 0, credit: input.total_amount },
      ];

      LedgerService.postJournal('Bill', billId, lines, db);

      return { id: billId, status: 'Open' as BillStatus };
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }

  public static voidBill(
    billId: number,
    dbInstance?: Database.Database
  ): { id: number; status: 'Voided' } {
    const execute = (db: Database.Database) => {
      const bill = this.getBillById(billId, db);
      if (!bill) {
        throw new BillError(`Bill ${billId} not found`, 404);
      }

      if (bill.status === 'Voided') {
        throw new BillError('Bill is already voided', 409, 'ERR_ALREADY_VOIDED');
      }

      // Check payments applied
      const paymentsCount = (
        db.prepare('SELECT COUNT(*) as count FROM bill_payments_entries WHERE bill_id = ?').get(bill.id) as { count: number }
      ).count;

      if (paymentsCount > 0) {
        throw new BillError('Cannot void bill that has applied payments', 409, 'ERR_HAS_PAYMENTS');
      }

      // Reverse accounting entries
      LedgerService.reverseTransaction('Bill', bill.id, db);

      // Update status to Voided (no SQL DELETE)
      db.prepare("UPDATE bills SET status = 'Voided' WHERE id = ?").run(bill.id);

      return { id: bill.id, status: 'Voided' as const };
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }

  public static recordBillPayment(
    input: CreateBillPaymentInput,
    dbInstance?: Database.Database
  ): { id: number } {
    if (!input.payment_number || typeof input.payment_number !== 'string') {
      throw new BillError('payment_number is required', 400);
    }
    if (!Number.isInteger(input.vendor_id) || input.vendor_id <= 0) {
      throw new BillError('Valid vendor_id is required', 400);
    }
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BillError('amount must be a positive integer in cents', 400);
    }
    if (!input.entries || input.entries.length === 0) {
      throw new BillError('At least one bill entry must be provided', 400);
    }

    let sumApplied = 0;
    for (const entry of input.entries) {
      if (!Number.isInteger(entry.amount_applied) || entry.amount_applied <= 0) {
        throw new BillError('amount_applied must be a positive integer in cents', 400);
      }
      sumApplied += entry.amount_applied;
    }

    if (sumApplied !== input.amount) {
      throw new BillError(
        `Total amount applied (${sumApplied}) must equal payment amount (${input.amount})`,
        422
      );
    }

    const execute = (db: Database.Database) => {
      // Validate vendor
      const vendor = db.prepare('SELECT id FROM contacts WHERE id = ?').get(input.vendor_id);
      if (!vendor) {
        throw new BillError('Vendor not found', 400);
      }

      // Check unique payment_number
      const existing = db.prepare('SELECT id FROM bill_payments WHERE payment_number = ?').get(input.payment_number);
      if (existing) {
        throw new BillError(`Payment number ${input.payment_number} already exists`, 409);
      }

      // Validate each bill and check remaining balance
      for (const entry of input.entries) {
        const bill = db
          .prepare('SELECT id, bill_number, vendor_id, total_amount, status FROM bills WHERE id = ?')
          .get(entry.bill_id) as Bill | undefined;

        if (!bill) {
          throw new BillError(`Bill ${entry.bill_id} not found`, 404);
        }
        if (bill.vendor_id !== input.vendor_id) {
          throw new BillError(`Bill ${bill.bill_number} does not belong to vendor ${input.vendor_id}`, 400);
        }
        if (bill.status !== 'Open' && bill.status !== 'Partially Paid') {
          throw new BillError(`Cannot apply payment to bill with status '${bill.status}'`, 400);
        }

        const paidSoFar = (
          db
            .prepare('SELECT COALESCE(SUM(amount_applied), 0) as total_paid FROM bill_payments_entries WHERE bill_id = ?')
            .get(bill.id) as { total_paid: number }
        ).total_paid;

        const remainingBalance = bill.total_amount - paidSoFar;
        if (entry.amount_applied > remainingBalance) {
          throw new BillError(
            `Amount applied (${entry.amount_applied}) exceeds remaining bill balance (${remainingBalance}) for bill ${bill.bill_number}`,
            422
          );
        }
      }

      // Insert bill_payments
      const insertPaymentStmt = db.prepare(`
        INSERT INTO bill_payments (payment_number, vendor_id, amount)
        VALUES (?, ?, ?)
      `);
      const paymentResult = insertPaymentStmt.run(input.payment_number, input.vendor_id, input.amount);
      const paymentId = Number(paymentResult.lastInsertRowid);

      // Insert bill_payments_entries & update bill status
      const insertEntryStmt = db.prepare(`
        INSERT INTO bill_payments_entries (bill_payment_id, bill_id, amount_applied)
        VALUES (?, ?, ?)
      `);

      for (const entry of input.entries) {
        insertEntryStmt.run(paymentId, entry.bill_id, entry.amount_applied);

        const totalPaidAfter = (
          db
            .prepare('SELECT COALESCE(SUM(amount_applied), 0) as total_paid FROM bill_payments_entries WHERE bill_id = ?')
            .get(entry.bill_id) as { total_paid: number }
        ).total_paid;

        const bill = db.prepare('SELECT total_amount FROM bills WHERE id = ?').get(entry.bill_id) as { total_amount: number };
        const newStatus = totalPaidAfter >= bill.total_amount ? 'Paid' : 'Partially Paid';
        db.prepare('UPDATE bills SET status = ? WHERE id = ?').run(newStatus, entry.bill_id);
      }

      // Accounting entries:
      // Debit: Accounts Payable (2000)
      // Credit: Bank (1000)
      const apAccount = LedgerService.getAccountByCode('2000', db);
      const bankAccount = LedgerService.getAccountByCode('1000', db);

      const lines: JournalLine[] = [
        { account_id: apAccount.id, debit: input.amount, credit: 0 },
        { account_id: bankAccount.id, debit: 0, credit: input.amount },
      ];

      LedgerService.postJournal('BillPayment', paymentId, lines, db);

      return { id: paymentId };
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }
}

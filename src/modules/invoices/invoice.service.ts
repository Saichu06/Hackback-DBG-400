import Database from 'better-sqlite3';
import { getDb, withTransaction } from '../../database/db.js';
import {
  InvoiceStatus,
  JournalLine,
  SalesInvoice,
} from '../../types/index.js';
import { LedgerService, AccountingError } from '../accounting/ledger.service.js';
import { ShopSettingsService } from '../settings/shop-settings.service.js';

export interface CreateInvoiceInput {
  customer_id: number;
  invoice_no: string;
  total_amount: number; // in integer cents
  created_by_id?: number;
  entries?: {
    amount: number;
    tax_rate?: number | null;
    tax_amount?: number;
    hsn_code?: string | null;
  }[];
}

/**
 * Splits an already-computed line tax amount into CGST/SGST (intra-state) or IGST
 * (inter-state), per docs/DATA_MODEL.md §3. Only runs when the shop has GST settings
 * configured (state_code set) — otherwise returns all zeros, which is exactly the old
 * behavior: the line keeps a plain `tax_amount` and deliverInvoice falls back to posting
 * it to the single generic Tax Payable account, unchanged from before this feature existed.
 */
function splitGst(
  taxAmount: number,
  customerStateCode: string | null | undefined,
  shopStateCode: string | null | undefined
): { cgst_paise: number; sgst_paise: number; igst_paise: number } {
  if (!taxAmount || taxAmount <= 0 || !shopStateCode) {
    return { cgst_paise: 0, sgst_paise: 0, igst_paise: 0 };
  }
  const isIntraState = !!customerStateCode && customerStateCode === shopStateCode;
  if (isIntraState) {
    const cgst = Math.floor(taxAmount / 2);
    return { cgst_paise: cgst, sgst_paise: taxAmount - cgst, igst_paise: 0 };
  }
  return { cgst_paise: 0, sgst_paise: 0, igst_paise: taxAmount };
}

export class InvoiceError extends Error {
  public statusCode: number;
  public errorCode?: string;

  constructor(message: string, statusCode: number = 400, errorCode?: string) {
    super(message);
    this.name = 'InvoiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class InvoiceService {
  /**
   * Retrieves all sales invoices.
   */
  public static listInvoices(dbInstance?: Database.Database): SalesInvoice[] {
    const db = dbInstance || getDb();
    return db
      .prepare('SELECT id, invoice_no, total_amount, status, customer_id, created_by_id, created_at FROM sales_invoices ORDER BY id DESC')
      .all() as SalesInvoice[];
  }

  /**
   * Retrieves a single invoice by ID.
   */
  public static getInvoiceById(id: number, dbInstance?: Database.Database): SalesInvoice | null {
    const db = dbInstance || getDb();
    const invoice = db
      .prepare('SELECT id, invoice_no, total_amount, status, customer_id, created_by_id, created_at FROM sales_invoices WHERE id = ?')
      .get(id) as SalesInvoice | undefined;
    return invoice || null;
  }

  /**
   * Creates a new sales invoice in Draft state.
   * Draft invoices do NOT post to the ledger.
   */
  public static createInvoice(
    input: CreateInvoiceInput,
    userId: number,
    dbInstance?: Database.Database
  ): { id: number; status: InvoiceStatus } {
    if (!input.invoice_no || typeof input.invoice_no !== 'string') {
      throw new InvoiceError('invoice_no is required', 400);
    }
    if (!Number.isInteger(input.customer_id) || input.customer_id <= 0) {
      throw new InvoiceError('Valid customer_id is required', 400);
    }
    if (!Number.isInteger(input.total_amount) || input.total_amount <= 0) {
      throw new InvoiceError('total_amount must be a positive integer in cents', 400);
    }

    const execute = (db: Database.Database) => {
      // Validate customer existence
      const customer = db.prepare('SELECT id FROM contacts WHERE id = ?').get(input.customer_id);
      if (!customer) {
        throw new InvoiceError('Customer not found', 400);
      }

      // Check unique invoice_no
      const existing = db.prepare('SELECT id FROM sales_invoices WHERE invoice_no = ?').get(input.invoice_no);
      if (existing) {
        throw new InvoiceError(`Invoice number ${input.invoice_no} already exists`, 409);
      }

      // Insert invoice in Draft state
      const insertInvoiceStmt = db.prepare(`
        INSERT INTO sales_invoices (invoice_no, customer_id, created_by_id, total_amount, status)
        VALUES (?, ?, ?, ?, 'Draft')
      `);

      const result = insertInvoiceStmt.run(
        input.invoice_no,
        input.customer_id,
        userId,
        input.total_amount
      );

      const invoiceId = Number(result.lastInsertRowid);

      // Resolve GST context once per invoice (docs/DATA_MODEL.md §3): if the shop has no
      // state_code configured, splitGst() always returns zeros and nothing below changes
      // from pre-GST-Pack behavior.
      const shopSettings = ShopSettingsService.get(db);
      const customerRow = db
        .prepare('SELECT state_code FROM contacts WHERE id = ?')
        .get(input.customer_id) as { state_code: string | null } | undefined;

      // Insert line items if provided
      if (input.entries && input.entries.length > 0) {
        const insertItemStmt = db.prepare(`
          INSERT INTO items_entries (reference_type, reference_id, amount, tax_rate, tax_amount, hsn_code, cgst_paise, sgst_paise, igst_paise)
          VALUES ('SaleInvoice', ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const entry of input.entries) {
          const taxAmount = entry.tax_amount ?? 0;
          const gst = splitGst(taxAmount, customerRow?.state_code, shopSettings?.state_code);
          insertItemStmt.run(
            invoiceId,
            entry.amount,
            entry.tax_rate ?? null,
            taxAmount,
            entry.hsn_code ?? null,
            gst.cgst_paise,
            gst.sgst_paise,
            gst.igst_paise
          );
        }
      } else {
        // Default single line item
        db.prepare(`
          INSERT INTO items_entries (reference_type, reference_id, amount, tax_rate, tax_amount)
          VALUES ('SaleInvoice', ?, ?, NULL, 0)
        `).run(invoiceId, input.total_amount);
      }

      return { id: invoiceId, status: 'Draft' as InvoiceStatus };
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }

  /**
   * Delivers and posts an invoice to the general ledger.
   * Atomically:
   * 1. Updates status to 'Delivered'
   * 2. Generates debit (Accounts Receivable) and credit (Sales Revenue & Tax Payable)
   * 3. Validates and posts to accounts_transactions
   * 4. Updates account balances
   */
  public static deliverInvoice(
    invoiceId: number,
    dbInstance?: Database.Database
  ): { id: number; status: 'Delivered' } {
    const execute = (db: Database.Database) => {
      const invoice = this.getInvoiceById(invoiceId, db);
      if (!invoice) {
        throw new InvoiceError(`Invoice ${invoiceId} not found`, 404);
      }

      if (invoice.status !== 'Draft') {
        throw new InvoiceError(
          `Invoice cannot be delivered because current status is ${invoice.status}`,
          400
        );
      }

      // Fetch line items
      const items = db
        .prepare('SELECT amount, tax_rate, tax_amount, cgst_paise, sgst_paise, igst_paise FROM items_entries WHERE reference_type = ? AND reference_id = ?')
        .all('SaleInvoice', invoice.id) as {
        amount: number;
        tax_rate: number | null;
        tax_amount: number;
        cgst_paise: number | null;
        sgst_paise: number | null;
        igst_paise: number | null;
      }[];

      let totalTax = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      for (const item of items) {
        totalTax += item.tax_amount || 0;
        totalCgst += item.cgst_paise || 0;
        totalSgst += item.sgst_paise || 0;
        totalIgst += item.igst_paise || 0;
      }

      const totalRevenue = invoice.total_amount - totalTax;
      const hasGstSplit = totalCgst + totalSgst + totalIgst > 0;

      // Accounts
      const arAccount = LedgerService.getAccountByCode('1100', db); // Accounts Receivable
      const revenueAccount = LedgerService.getAccountByCode('4000', db); // Sales Revenue

      const lines: JournalLine[] = [
        { account_id: arAccount.id, debit: invoice.total_amount, credit: 0 },
      ];

      if (hasGstSplit) {
        // GST Filing Pack path (docs/DATA_MODEL.md §3): post to the dedicated CGST/SGST/IGST
        // Payable accounts instead of the generic Tax Payable, so the report's ledger tie-out
        // has something to check itself against. totalCgst+totalSgst+totalIgst === totalTax by
        // construction (splitGst() in createInvoice), so the journal still balances exactly.
        if (totalCgst > 0) {
          const cgstAccount = LedgerService.getAccountByCode('2101', db);
          lines.push({ account_id: cgstAccount.id, debit: 0, credit: totalCgst });
        }
        if (totalSgst > 0) {
          const sgstAccount = LedgerService.getAccountByCode('2102', db);
          lines.push({ account_id: sgstAccount.id, debit: 0, credit: totalSgst });
        }
        if (totalIgst > 0) {
          const igstAccount = LedgerService.getAccountByCode('2103', db);
          lines.push({ account_id: igstAccount.id, debit: 0, credit: totalIgst });
        }
        lines.push({ account_id: revenueAccount.id, debit: 0, credit: totalRevenue });
      } else if (totalTax > 0) {
        const taxAccount = LedgerService.getAccountByCode('2100', db); // Tax Payable
        lines.push({ account_id: taxAccount.id, debit: 0, credit: totalTax });
        lines.push({ account_id: revenueAccount.id, debit: 0, credit: totalRevenue });
      } else {
        lines.push({ account_id: revenueAccount.id, debit: 0, credit: invoice.total_amount });
      }

      // Post to ledger atomically
      LedgerService.postJournal('SaleInvoice', invoice.id, lines, db);

      // Update invoice status to Delivered
      db.prepare("UPDATE sales_invoices SET status = 'Delivered' WHERE id = ?").run(invoice.id);

      return { id: invoice.id, status: 'Delivered' as const };
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }

  /**
   * Semantic Void / Reversal of an invoice (DELETE /api/sale-invoices/:id).
   * Does NOT physically delete the invoice from the database.
   */
  public static voidInvoice(
    invoiceId: number,
    dbInstance?: Database.Database
  ): { id: number; status: 'Voided' } {
    const execute = (db: Database.Database) => {
      const invoice = this.getInvoiceById(invoiceId, db);
      if (!invoice) {
        throw new InvoiceError(`Invoice ${invoiceId} not found`, 404);
      }

      if (invoice.status === 'Voided') {
        throw new InvoiceError(
          'Invoice is already voided',
          409,
          'ERR_ALREADY_VOIDED'
        );
      }

      // Check for existing payments
      const paymentsCount = (
        db
          .prepare('SELECT COUNT(*) as count FROM payment_receives_entries WHERE invoice_id = ?')
          .get(invoice.id) as { count: number }
      ).count;

      if (paymentsCount > 0) {
        throw new InvoiceError(
          'Cannot void invoice that has applied payments',
          409,
          'ERR_HAS_PAYMENTS'
        );
      }

      // If invoice was Delivered, reverse the accounting transaction
      if (invoice.status === 'Delivered') {
        LedgerService.reverseTransaction('SaleInvoice', invoice.id, db);
      }

      // Mark invoice as Voided (NO SQL DELETE)
      db.prepare("UPDATE sales_invoices SET status = 'Voided' WHERE id = ?").run(invoice.id);

      return { id: invoice.id, status: 'Voided' as const };
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }
}

import { getDb, withTransaction } from '../../database/db.js';
import { LedgerService } from '../accounting/ledger.service.js';
export class InvoiceError extends Error {
    statusCode;
    errorCode;
    constructor(message, statusCode = 400, errorCode) {
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
    static listInvoices(dbInstance) {
        const db = dbInstance || getDb();
        return db
            .prepare('SELECT id, invoice_no, total_amount, status, customer_id, created_by_id, created_at FROM sales_invoices ORDER BY id DESC')
            .all();
    }
    /**
     * Retrieves a single invoice by ID.
     */
    static getInvoiceById(id, dbInstance) {
        const db = dbInstance || getDb();
        const invoice = db
            .prepare('SELECT id, invoice_no, total_amount, status, customer_id, created_by_id, created_at FROM sales_invoices WHERE id = ?')
            .get(id);
        return invoice || null;
    }
    /**
     * Creates a new sales invoice in Draft state.
     * Draft invoices do NOT post to the ledger.
     */
    static createInvoice(input, userId, dbInstance) {
        if (!input.invoice_no || typeof input.invoice_no !== 'string') {
            throw new InvoiceError('invoice_no is required', 400);
        }
        if (!Number.isInteger(input.customer_id) || input.customer_id <= 0) {
            throw new InvoiceError('Valid customer_id is required', 400);
        }
        if (!Number.isInteger(input.total_amount) || input.total_amount <= 0) {
            throw new InvoiceError('total_amount must be a positive integer in cents', 400);
        }
        const execute = (db) => {
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
            const result = insertInvoiceStmt.run(input.invoice_no, input.customer_id, userId, input.total_amount);
            const invoiceId = Number(result.lastInsertRowid);
            // Insert line items if provided
            if (input.entries && input.entries.length > 0) {
                const insertItemStmt = db.prepare(`
          INSERT INTO items_entries (reference_type, reference_id, amount, tax_rate, tax_amount)
          VALUES ('SaleInvoice', ?, ?, ?, ?)
        `);
                for (const entry of input.entries) {
                    insertItemStmt.run(invoiceId, entry.amount, entry.tax_rate ?? null, entry.tax_amount ?? 0);
                }
            }
            else {
                // Default single line item
                db.prepare(`
          INSERT INTO items_entries (reference_type, reference_id, amount, tax_rate, tax_amount)
          VALUES ('SaleInvoice', ?, ?, NULL, 0)
        `).run(invoiceId, input.total_amount);
            }
            return { id: invoiceId, status: 'Draft' };
        };
        if (dbInstance) {
            return execute(dbInstance);
        }
        else {
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
    static deliverInvoice(invoiceId, dbInstance) {
        const execute = (db) => {
            const invoice = this.getInvoiceById(invoiceId, db);
            if (!invoice) {
                throw new InvoiceError(`Invoice ${invoiceId} not found`, 404);
            }
            if (invoice.status !== 'Draft') {
                throw new InvoiceError(`Invoice cannot be delivered because current status is ${invoice.status}`, 400);
            }
            // Fetch line items
            const items = db
                .prepare('SELECT amount, tax_rate, tax_amount FROM items_entries WHERE reference_type = ? AND reference_id = ?')
                .all('SaleInvoice', invoice.id);
            let totalTax = 0;
            for (const item of items) {
                totalTax += item.tax_amount || 0;
            }
            const totalRevenue = invoice.total_amount - totalTax;
            // Accounts
            const arAccount = LedgerService.getAccountByCode('1100', db); // Accounts Receivable
            const revenueAccount = LedgerService.getAccountByCode('4000', db); // Sales Revenue
            const lines = [
                { account_id: arAccount.id, debit: invoice.total_amount, credit: 0 },
            ];
            if (totalTax > 0) {
                const taxAccount = LedgerService.getAccountByCode('2100', db); // Tax Payable
                lines.push({ account_id: taxAccount.id, debit: 0, credit: totalTax });
                lines.push({ account_id: revenueAccount.id, debit: 0, credit: totalRevenue });
            }
            else {
                lines.push({ account_id: revenueAccount.id, debit: 0, credit: invoice.total_amount });
            }
            // Post to ledger atomically
            LedgerService.postJournal('SaleInvoice', invoice.id, lines, db);
            // Update invoice status to Delivered
            db.prepare("UPDATE sales_invoices SET status = 'Delivered' WHERE id = ?").run(invoice.id);
            return { id: invoice.id, status: 'Delivered' };
        };
        if (dbInstance) {
            return execute(dbInstance);
        }
        else {
            return withTransaction(execute);
        }
    }
    /**
     * Semantic Void / Reversal of an invoice (DELETE /api/sale-invoices/:id).
     * Does NOT physically delete the invoice from the database.
     */
    static voidInvoice(invoiceId, dbInstance) {
        const execute = (db) => {
            const invoice = this.getInvoiceById(invoiceId, db);
            if (!invoice) {
                throw new InvoiceError(`Invoice ${invoiceId} not found`, 404);
            }
            if (invoice.status === 'Voided') {
                throw new InvoiceError('Invoice is already voided', 409, 'ERR_ALREADY_VOIDED');
            }
            // Check for existing payments
            const paymentsCount = db
                .prepare('SELECT COUNT(*) as count FROM payment_receives_entries WHERE invoice_id = ?')
                .get(invoice.id).count;
            if (paymentsCount > 0) {
                throw new InvoiceError('Cannot void invoice that has applied payments', 409, 'ERR_HAS_PAYMENTS');
            }
            // If invoice was Delivered, reverse the accounting transaction
            if (invoice.status === 'Delivered') {
                LedgerService.reverseTransaction('SaleInvoice', invoice.id, db);
            }
            // Mark invoice as Voided (NO SQL DELETE)
            db.prepare("UPDATE sales_invoices SET status = 'Voided' WHERE id = ?").run(invoice.id);
            return { id: invoice.id, status: 'Voided' };
        };
        if (dbInstance) {
            return execute(dbInstance);
        }
        else {
            return withTransaction(execute);
        }
    }
}

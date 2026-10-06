import { withTransaction } from '../../database/db.js';
import { LedgerService } from '../accounting/ledger.service.js';
export class PaymentError extends Error {
    statusCode;
    errorCode;
    constructor(message, statusCode = 400, errorCode) {
        super(message);
        this.name = 'PaymentError';
        this.statusCode = statusCode;
        this.errorCode = errorCode;
    }
}
export class PaymentService {
    /**
     * Evaluates heuristic alerts for duplicate or unusual payment amounts (Differentiator 1).
     */
    static checkPaymentAlerts(customerId, amount, db) {
        // 1. Check for duplicate payment within the last 10 minutes
        const recentDuplicate = db
            .prepare(`
        SELECT id FROM payment_receives
        WHERE customer_id = ? 
          AND amount = ?
          AND datetime(created_at) >= datetime('now', '-10 minutes')
        LIMIT 1
      `)
            .get(customerId, amount);
        if (recentDuplicate) {
            return 'DUPLICATE_PAYMENT_WARNING: A payment with the identical amount was recorded for this customer in the last 10 minutes.';
        }
        // 2. Check for unusually large payment (>= 5x average of previous payments, if >= 3 previous payments exist)
        const history = db
            .prepare(`
        SELECT AVG(amount) as avg_amount, COUNT(*) as count
        FROM payment_receives
        WHERE customer_id = ?
      `)
            .get(customerId);
        if (history && history.count >= 3 && history.avg_amount && history.avg_amount > 0) {
            if (amount >= history.avg_amount * 5) {
                return `UNUSUAL_AMOUNT_WARNING: Payment amount (${amount} cents) is unusually large compared to the customer's average (${Math.round(history.avg_amount)} cents).`;
            }
        }
        return null;
    }
    /**
     * Records payment received against invoice(s) and posts double-entry transaction.
     * Debit Bank, Credit Accounts Receivable.
     */
    static recordPaymentReceived(input, dbInstance) {
        if (!input.payment_receive_no || typeof input.payment_receive_no !== 'string') {
            throw new PaymentError('payment_receive_no is required', 400);
        }
        if (!Number.isInteger(input.customer_id) || input.customer_id <= 0) {
            throw new PaymentError('Valid customer_id is required', 400);
        }
        if (!Number.isInteger(input.amount) || input.amount <= 0) {
            throw new PaymentError('amount must be a positive integer in cents', 400);
        }
        if (!input.entries || input.entries.length === 0) {
            throw new PaymentError('At least one invoice entry must be provided', 400);
        }
        let sumApplied = 0;
        for (const entry of input.entries) {
            if (!Number.isInteger(entry.amount_applied) || entry.amount_applied <= 0) {
                throw new PaymentError('amount_applied must be a positive integer in cents', 400);
            }
            sumApplied += entry.amount_applied;
        }
        if (sumApplied !== input.amount) {
            throw new PaymentError(`Total amount applied (${sumApplied}) must equal payment amount (${input.amount})`, 422);
        }
        const execute = (db) => {
            // Validate customer
            const customer = db.prepare('SELECT id FROM contacts WHERE id = ?').get(input.customer_id);
            if (!customer) {
                throw new PaymentError('Customer not found', 400);
            }
            // Check unique payment_receive_no
            const existing = db
                .prepare('SELECT id FROM payment_receives WHERE payment_receive_no = ?')
                .get(input.payment_receive_no);
            if (existing) {
                throw new PaymentError(`Payment receive number ${input.payment_receive_no} already exists`, 409);
            }
            // Check differentiator alerts before inserting
            const alert = this.checkPaymentAlerts(input.customer_id, input.amount, db);
            // Validate each invoice and check remaining balance
            for (const entry of input.entries) {
                const invoice = db
                    .prepare('SELECT id, invoice_no, customer_id, total_amount, status FROM sales_invoices WHERE id = ?')
                    .get(entry.invoice_id);
                if (!invoice) {
                    throw new PaymentError(`Invoice ${entry.invoice_id} not found`, 404);
                }
                if (invoice.customer_id !== input.customer_id) {
                    throw new PaymentError(`Invoice ${invoice.invoice_no} does not belong to customer ${input.customer_id}`, 400);
                }
                if (invoice.status !== 'Delivered' && invoice.status !== 'Partially Paid') {
                    throw new PaymentError(`Cannot apply payment to invoice with status '${invoice.status}'`, 400);
                }
                // Calculate already paid amount
                const paidSoFar = db
                    .prepare(`
              SELECT COALESCE(SUM(amount_applied), 0) as total_paid
              FROM payment_receives_entries
              WHERE invoice_id = ?
            `)
                    .get(invoice.id).total_paid;
                const remainingBalance = invoice.total_amount - paidSoFar;
                if (entry.amount_applied > remainingBalance) {
                    throw new PaymentError(`Amount applied (${entry.amount_applied}) exceeds remaining invoice balance (${remainingBalance}) for invoice ${invoice.invoice_no}`, 422, 'ERR_EXCEEDS_INVOICE_BALANCE');
                }
            }
            // Insert payment_receives
            const insertPaymentStmt = db.prepare(`
        INSERT INTO payment_receives (payment_receive_no, customer_id, amount)
        VALUES (?, ?, ?)
      `);
            const paymentResult = insertPaymentStmt.run(input.payment_receive_no, input.customer_id, input.amount);
            const paymentId = Number(paymentResult.lastInsertRowid);
            // Insert payment_receives_entries & update invoice statuses
            const insertEntryStmt = db.prepare(`
        INSERT INTO payment_receives_entries (payment_receive_id, invoice_id, amount_applied)
        VALUES (?, ?, ?)
      `);
            for (const entry of input.entries) {
                insertEntryStmt.run(paymentId, entry.invoice_id, entry.amount_applied);
                const totalPaidAfter = db
                    .prepare(`
              SELECT COALESCE(SUM(amount_applied), 0) as total_paid
              FROM payment_receives_entries
              WHERE invoice_id = ?
            `)
                    .get(entry.invoice_id).total_paid;
                const invoice = db
                    .prepare('SELECT total_amount FROM sales_invoices WHERE id = ?')
                    .get(entry.invoice_id);
                const newStatus = totalPaidAfter >= invoice.total_amount ? 'Paid' : 'Partially Paid';
                db.prepare('UPDATE sales_invoices SET status = ? WHERE id = ?').run(newStatus, entry.invoice_id);
            }
            // Post double-entry journal:
            // Debit: Bank (1000)
            // Credit: Accounts Receivable (1100)
            const bankAccount = LedgerService.getAccountByCode('1000', db);
            const arAccount = LedgerService.getAccountByCode('1100', db);
            const lines = [
                { account_id: bankAccount.id, debit: input.amount, credit: 0 },
                { account_id: arAccount.id, debit: 0, credit: input.amount },
            ];
            LedgerService.postJournal('PaymentReceive', paymentId, lines, db);
            return { id: paymentId, alert };
        };
        if (dbInstance) {
            return execute(dbInstance);
        }
        else {
            return withTransaction(execute);
        }
    }
}

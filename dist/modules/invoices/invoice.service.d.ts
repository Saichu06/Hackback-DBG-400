import Database from 'better-sqlite3';
import { InvoiceStatus, SalesInvoice } from '../../types/index.js';
export interface CreateInvoiceInput {
    customer_id: number;
    invoice_no: string;
    total_amount: number;
    created_by_id?: number;
    entries?: {
        amount: number;
        tax_rate?: number | null;
        tax_amount?: number;
    }[];
}
export declare class InvoiceError extends Error {
    statusCode: number;
    errorCode?: string;
    constructor(message: string, statusCode?: number, errorCode?: string);
}
export declare class InvoiceService {
    /**
     * Retrieves all sales invoices.
     */
    static listInvoices(dbInstance?: Database.Database): SalesInvoice[];
    /**
     * Retrieves a single invoice by ID.
     */
    static getInvoiceById(id: number, dbInstance?: Database.Database): SalesInvoice | null;
    /**
     * Creates a new sales invoice in Draft state.
     * Draft invoices do NOT post to the ledger.
     */
    static createInvoice(input: CreateInvoiceInput, userId: number, dbInstance?: Database.Database): {
        id: number;
        status: InvoiceStatus;
    };
    /**
     * Delivers and posts an invoice to the general ledger.
     * Atomically:
     * 1. Updates status to 'Delivered'
     * 2. Generates debit (Accounts Receivable) and credit (Sales Revenue & Tax Payable)
     * 3. Validates and posts to accounts_transactions
     * 4. Updates account balances
     */
    static deliverInvoice(invoiceId: number, dbInstance?: Database.Database): {
        id: number;
        status: 'Delivered';
    };
    /**
     * Semantic Void / Reversal of an invoice (DELETE /api/sale-invoices/:id).
     * Does NOT physically delete the invoice from the database.
     */
    static voidInvoice(invoiceId: number, dbInstance?: Database.Database): {
        id: number;
        status: 'Voided';
    };
}

import Database from 'better-sqlite3';
export interface PaymentReceiveEntryInput {
    invoice_id: number;
    amount_applied: number;
}
export interface CreatePaymentReceiveInput {
    customer_id: number;
    amount: number;
    payment_receive_no: string;
    entries: PaymentReceiveEntryInput[];
}
export declare class PaymentError extends Error {
    statusCode: number;
    errorCode?: string;
    constructor(message: string, statusCode?: number, errorCode?: string);
}
export declare class PaymentService {
    /**
     * Evaluates heuristic alerts for duplicate or unusual payment amounts (Differentiator 1).
     */
    static checkPaymentAlerts(customerId: number, amount: number, db: Database.Database): string | null;
    /**
     * Records payment received against invoice(s) and posts double-entry transaction.
     * Debit Bank, Credit Accounts Receivable.
     */
    static recordPaymentReceived(input: CreatePaymentReceiveInput, dbInstance?: Database.Database): {
        id: number;
        alert: string | null;
    };
}

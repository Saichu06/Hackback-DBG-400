import Database from 'better-sqlite3';
import { Bill, BillStatus } from '../../types/index.js';
export interface CreateBillInput {
    vendor_id: number;
    bill_number: string;
    total_amount: number;
    entries?: {
        amount: number;
        tax_rate?: number | null;
        tax_amount?: number;
    }[];
}
export interface BillPaymentEntryInput {
    bill_id: number;
    amount_applied: number;
}
export interface CreateBillPaymentInput {
    vendor_id: number;
    amount: number;
    payment_number: string;
    entries: BillPaymentEntryInput[];
}
export declare class BillError extends Error {
    statusCode: number;
    errorCode?: string;
    constructor(message: string, statusCode?: number, errorCode?: string);
}
export declare class BillService {
    static listBills(dbInstance?: Database.Database): Bill[];
    static getBillById(id: number, dbInstance?: Database.Database): Bill | null;
    static createBill(input: CreateBillInput, dbInstance?: Database.Database): {
        id: number;
        status: BillStatus;
    };
    static voidBill(billId: number, dbInstance?: Database.Database): {
        id: number;
        status: 'Voided';
    };
    static recordBillPayment(input: CreateBillPaymentInput, dbInstance?: Database.Database): {
        id: number;
    };
}

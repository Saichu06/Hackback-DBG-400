import Database from 'better-sqlite3';
import { Account, AccountTransaction, AccountType, JournalLine, ReferenceType } from '../../types/index.js';
export declare class AccountingError extends Error {
    statusCode: number;
    constructor(message: string, statusCode?: number);
}
export declare class LedgerService {
    /**
     * Validates journal lines before persisting:
     * 1. Total debits === Total credits (strictly equal)
     * 2. Integer cents only (no fractional numbers)
     * 3. Single-sided lines: either (debit > 0 && credit === 0) or (credit > 0 && debit === 0)
     * 4. Must contain at least 2 lines
     */
    static validateJournal(lines: JournalLine[]): void;
    /**
     * Posts a validated journal transaction to the ledger and updates account balances.
     * All operations are executed atomically inside a transaction.
     */
    static postJournal(referenceType: ReferenceType, referenceId: number, lines: JournalLine[], dbInstance?: Database.Database): AccountTransaction[];
    /**
     * Reverses a posted transaction by creating exact offsetting entries.
     * Original Debit -> Reversal Credit
     * Original Credit -> Reversal Debit
     */
    static reverseTransaction(referenceType: ReferenceType, referenceId: number, dbInstance?: Database.Database): AccountTransaction[];
    /**
     * Derives the real-time Trial Balance report directly from committed ledger state.
     */
    static getTrialBalance(dbInstance?: Database.Database): {
        accounts: {
            id: number;
            code: string;
            name: string;
            type: AccountType;
            balance: number;
            total_debit: number;
            total_credit: number;
            net_debit: number;
            net_credit: number;
        }[];
        total_debit: number;
        total_credit: number;
        is_balanced: boolean;
    };
    /**
     * Helper to retrieve an account by its unique code (e.g. '1000', '1100', '4000').
     */
    static getAccountByCode(code: string, dbInstance?: Database.Database): Account;
}

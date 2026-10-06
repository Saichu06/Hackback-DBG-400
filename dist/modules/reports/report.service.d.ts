import Database from 'better-sqlite3';
export declare class ReportService {
    /**
     * GET /api/reports/journal
     * Retrieves all double-entry journal transactions.
     */
    static getJournalReport(dbInstance?: Database.Database): {
        date: string;
        account: string;
        debit: number;
        credit: number;
    }[];
    /**
     * GET /api/reports/trial-balance-sheet
     * Summarizes all account balances to verify debits == credits.
     */
    static getTrialBalanceSheet(dbInstance?: Database.Database): {
        accounts: {
            id: number;
            code: string;
            name: string;
            type: import("../../types/index.js").AccountType;
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
     * GET /api/reports/balance-sheet
     * Generates Balance Sheet: Assets vs Liabilities & Equity.
     */
    static getBalanceSheet(dbInstance?: Database.Database): {
        assets: {
            accounts: {
                id: number;
                code: string;
                name: string;
                account_type: string;
                balance: number;
            }[];
            total: number;
        };
        liabilities: {
            accounts: {
                id: number;
                code: string;
                name: string;
                account_type: string;
                balance: number;
            }[];
            total: number;
        };
        equity: {
            accounts: {
                id: number;
                code: string;
                name: string;
                account_type: string;
                balance: number;
            }[];
            total: number;
            current_year_earnings: number;
            total_equity_with_earnings: number;
        };
        is_balanced: boolean;
    };
    /**
     * GET /api/reports/profit-loss-sheet
     * Generates Profit & Loss: Revenue vs Expenses.
     */
    static getProfitLossSheet(dbInstance?: Database.Database): {
        revenue: {
            accounts: {
                id: number;
                code: string;
                name: string;
                account_type: string;
                balance: number;
            }[];
            total: number;
        };
        expenses: {
            accounts: {
                id: number;
                code: string;
                name: string;
                account_type: string;
                balance: number;
            }[];
            total: number;
        };
        net_income: number;
    };
}

import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { LedgerService } from '../accounting/ledger.service.js';

export class ReportService {
  /**
   * GET /api/reports/journal
   * Retrieves all double-entry journal transactions.
   */
  public static getJournalReport(dbInstance?: Database.Database) {
    const db = dbInstance || getDb();
    const rows = db
      .prepare(`
        SELECT 
          t.created_at as date,
          a.name as account,
          a.code as account_code,
          t.reference_type,
          t.reference_id,
          t.debit,
          t.credit
        FROM accounts_transactions t
        JOIN accounts a ON t.account_id = a.id
        ORDER BY t.id ASC
      `)
      .all() as {
      date: string;
      account: string;
      account_code: string;
      reference_type: string;
      reference_id: number;
      debit: number;
      credit: number;
    }[];

    return rows.map((r) => ({
      date: r.date,
      account: `${r.account_code} - ${r.account}`,
      debit: r.debit,
      credit: r.credit,
    }));
  }

  /**
   * GET /api/reports/trial-balance-sheet
   * Summarizes all account balances to verify debits == credits.
   */
  public static getTrialBalanceSheet(dbInstance?: Database.Database) {
    return LedgerService.getTrialBalance(dbInstance);
  }

  /**
   * GET /api/reports/balance-sheet
   * Generates Balance Sheet: Assets vs Liabilities & Equity.
   */
  public static getBalanceSheet(dbInstance?: Database.Database) {
    const db = dbInstance || getDb();
    const accounts = db
      .prepare('SELECT id, code, name, account_type, balance FROM accounts ORDER BY code ASC')
      .all() as {
      id: number;
      code: string;
      name: string;
      account_type: string;
      balance: number;
    }[];

    const assets = accounts.filter((a) => a.account_type === 'Asset');
    const liabilities = accounts.filter((a) => a.account_type === 'Liability');
    const equity = accounts.filter((a) => a.account_type === 'Equity');

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

    // Also calculate net income from Revenue - Expense and include in equity reconciliation if needed
    const revenues = accounts.filter((a) => a.account_type === 'Revenue');
    const expenses = accounts.filter((a) => a.account_type === 'Expense');
    const totalRevenue = revenues.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      assets: {
        accounts: assets,
        total: totalAssets,
      },
      liabilities: {
        accounts: liabilities,
        total: totalLiabilities,
      },
      equity: {
        accounts: equity,
        total: totalEquity,
        current_year_earnings: netIncome,
        total_equity_with_earnings: totalEquity + netIncome,
      },
      is_balanced: totalAssets === totalLiabilities + totalEquity + netIncome,
    };
  }

  /**
   * GET /api/reports/profit-loss-sheet
   * Generates Profit & Loss: Revenue vs Expenses.
   */
  public static getProfitLossSheet(dbInstance?: Database.Database) {
    const db = dbInstance || getDb();
    const accounts = db
      .prepare('SELECT id, code, name, account_type, balance FROM accounts ORDER BY code ASC')
      .all() as {
      id: number;
      code: string;
      name: string;
      account_type: string;
      balance: number;
    }[];

    const revenue = accounts.filter((a) => a.account_type === 'Revenue');
    const expenses = accounts.filter((a) => a.account_type === 'Expense');

    const totalRevenue = revenue.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    return {
      revenue: {
        accounts: revenue,
        total: totalRevenue,
      },
      expenses: {
        accounts: expenses,
        total: totalExpenses,
      },
      net_income: netIncome,
    };
  }
}

import Database from 'better-sqlite3';
import { getDb, withTransaction } from '../../database/db.js';
import {
  Account,
  AccountTransaction,
  AccountType,
  JournalLine,
  ReferenceType,
} from '../../types/index.js';

export class AccountingError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'AccountingError';
    this.statusCode = statusCode;
  }
}

export class LedgerService {
  /**
   * Validates journal lines before persisting:
   * 1. Total debits === Total credits (strictly equal)
   * 2. Integer cents only (no fractional numbers)
   * 3. Single-sided lines: either (debit > 0 && credit === 0) or (credit > 0 && debit === 0)
   * 4. Must contain at least 2 lines
   */
  public static validateJournal(lines: JournalLine[]): void {
    if (!lines || lines.length < 2) {
      throw new AccountingError(
        'A journal transaction must contain at least 2 entries',
        400
      );
    }

    let totalDebit = 0;
    let totalCredit = 0;

    for (const [index, line] of lines.entries()) {
      if (!Number.isInteger(line.account_id) || line.account_id <= 0) {
        throw new AccountingError(
          `Line ${index + 1}: Invalid account_id`,
          400
        );
      }

      if (!Number.isInteger(line.debit) || !Number.isInteger(line.credit)) {
        throw new AccountingError(
          `Line ${index + 1}: Debits and credits must be integers in cents`,
          400
        );
      }

      if (line.debit < 0 || line.credit < 0) {
        throw new AccountingError(
          `Line ${index + 1}: Debits and credits cannot be negative`,
          400
        );
      }

      const isDebit = line.debit > 0 && line.credit === 0;
      const isCredit = line.credit > 0 && line.debit === 0;

      if (!isDebit && !isCredit) {
        throw new AccountingError(
          `Line ${index + 1}: A line must be either a debit or a credit, never both or zero`,
          400
        );
      }

      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    if (totalDebit !== totalCredit) {
      throw new AccountingError(
        `Unbalanced journal transaction: total debits (${totalDebit}) do not equal total credits (${totalCredit})`,
        400
      );
    }
  }

  /**
   * Posts a validated journal transaction to the ledger and updates account balances.
   * All operations are executed atomically inside a transaction.
   */
  public static postJournal(
    referenceType: ReferenceType,
    referenceId: number,
    lines: JournalLine[],
    dbInstance?: Database.Database
  ): AccountTransaction[] {
    // 1. Validate in-memory first (Killer Test 1)
    this.validateJournal(lines);

    const execute = (db: Database.Database): AccountTransaction[] => {
      const insertedTransactions: AccountTransaction[] = [];

      const insertTxStmt = db.prepare(`
        INSERT INTO accounts_transactions (account_id, reference_type, reference_id, debit, credit)
        VALUES (?, ?, ?, ?, ?)
      `);

      const getAccountStmt = db.prepare(`
        SELECT id, code, name, account_type, balance FROM accounts WHERE id = ?
      `);

      const updateBalanceStmt = db.prepare(`
        UPDATE accounts SET balance = balance + ? WHERE id = ?
      `);

      for (const line of lines) {
        const account = getAccountStmt.get(line.account_id) as Account | undefined;
        if (!account) {
          throw new AccountingError(`Account with ID ${line.account_id} not found`, 400);
        }

        // Insert into accounts_transactions
        const result = insertTxStmt.run(
          line.account_id,
          referenceType,
          referenceId,
          line.debit,
          line.credit
        );

        // Calculate balance delta based on account type normal balance:
        // Asset & Expense: Debit increases (+), Credit decreases (-)
        // Liability, Equity, Revenue: Credit increases (+), Debit decreases (-)
        let delta = 0;
        if (account.account_type === 'Asset' || account.account_type === 'Expense') {
          delta = line.debit - line.credit;
        } else {
          delta = line.credit - line.debit;
        }

        updateBalanceStmt.run(delta, line.account_id);

        insertedTransactions.push({
          id: Number(result.lastInsertRowid),
          account_id: line.account_id,
          reference_type: referenceType,
          reference_id: referenceId,
          debit: line.debit,
          credit: line.credit,
        });
      }

      return insertedTransactions;
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }

  /**
   * Reverses a posted transaction by creating exact offsetting entries.
   * Original Debit -> Reversal Credit
   * Original Credit -> Reversal Debit
   */
  public static reverseTransaction(
    referenceType: ReferenceType,
    referenceId: number,
    dbInstance?: Database.Database
  ): AccountTransaction[] {
    const execute = (db: Database.Database): AccountTransaction[] => {
      // 1. Fetch original transactions
      const originalEntries = db
        .prepare(`
          SELECT account_id, debit, credit
          FROM accounts_transactions
          WHERE reference_type = ? AND reference_id = ?
        `)
        .all(referenceType, referenceId) as {
        account_id: number;
        debit: number;
        credit: number;
      }[];

      if (!originalEntries || originalEntries.length === 0) {
        throw new AccountingError(
          `No transactions found to reverse for ${referenceType} ID ${referenceId}`,
          400
        );
      }

      // 2. Generate exact inverse lines
      const reversalLines: JournalLine[] = originalEntries.map((entry) => ({
        account_id: entry.account_id,
        debit: entry.credit,
        credit: entry.debit,
      }));

      // 3. Post reversal journal
      return this.postJournal(referenceType, referenceId, reversalLines, db);
    };

    if (dbInstance) {
      return execute(dbInstance);
    } else {
      return withTransaction(execute);
    }
  }

  /**
   * Derives the real-time Trial Balance report directly from committed ledger state.
   */
  public static getTrialBalance(dbInstance?: Database.Database) {
    const db = dbInstance || getDb();

    // 1. Fetch total debits and credits per account from accounts_transactions
    const accountsData = db
      .prepare(`
        SELECT 
          a.id,
          a.code,
          a.name,
          a.account_type,
          a.balance,
          COALESCE(SUM(t.debit), 0) as total_debit,
          COALESCE(SUM(t.credit), 0) as total_credit
        FROM accounts a
        LEFT JOIN accounts_transactions t ON a.id = t.account_id
        GROUP BY a.id, a.code, a.name, a.account_type, a.balance
        ORDER BY a.code ASC
      `)
      .all() as {
      id: number;
      code: string;
      name: string;
      account_type: AccountType;
      balance: number;
      total_debit: number;
      total_credit: number;
    }[];

    let overallDebit = 0;
    let overallCredit = 0;

    const formattedAccounts = accountsData.map((acc) => {
      overallDebit += acc.total_debit;
      overallCredit += acc.total_credit;

      // Net debit or credit position for standard trial balance reporting
      let netDebit = 0;
      let netCredit = 0;

      if (acc.account_type === 'Asset' || acc.account_type === 'Expense') {
        const net = acc.total_debit - acc.total_credit;
        if (net >= 0) {
          netDebit = net;
        } else {
          netCredit = -net;
        }
      } else {
        const net = acc.total_credit - acc.total_debit;
        if (net >= 0) {
          netCredit = net;
        } else {
          netDebit = -net;
        }
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.account_type,
        balance: acc.balance,
        total_debit: acc.total_debit,
        total_credit: acc.total_credit,
        net_debit: netDebit,
        net_credit: netCredit,
      };
    });

    const isBalanced = overallDebit === overallCredit;

    return {
      accounts: formattedAccounts,
      total_debit: overallDebit,
      total_credit: overallCredit,
      is_balanced: isBalanced,
    };
  }

  /**
   * Helper to retrieve an account by its unique code (e.g. '1000', '1100', '4000').
   */
  public static getAccountByCode(code: string, dbInstance?: Database.Database): Account {
    const db = dbInstance || getDb();
    const account = db
      .prepare('SELECT id, code, name, account_type, parent_account_id, balance FROM accounts WHERE code = ?')
      .get(code) as Account | undefined;

    if (!account) {
      throw new AccountingError(`Account with code ${code} not found`, 404);
    }
    return account;
  }
}

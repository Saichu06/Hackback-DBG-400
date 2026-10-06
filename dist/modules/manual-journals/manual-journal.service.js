import { withTransaction } from '../../database/db.js';
import { LedgerService, AccountingError } from '../accounting/ledger.service.js';
export class ManualJournalService {
    static createManualJournal(input, dbInstance) {
        if (!input.journal_number || typeof input.journal_number !== 'string') {
            throw new AccountingError('journal_number is required', 400);
        }
        if (!input.date || typeof input.date !== 'string') {
            throw new AccountingError('date is required', 400);
        }
        if (!input.entries || input.entries.length < 2) {
            throw new AccountingError('entries must contain at least 2 lines', 400);
        }
        // LedgerService validates debit === credit and integer cents
        const lines = input.entries.map((e) => ({
            account_id: e.account_id,
            debit: e.debit,
            credit: e.credit,
        }));
        LedgerService.validateJournal(lines);
        const execute = (db) => {
            // Check unique journal_number
            const existing = db
                .prepare('SELECT id FROM manual_journals WHERE journal_number = ?')
                .get(input.journal_number);
            if (existing) {
                throw new AccountingError(`Journal number ${input.journal_number} already exists`, 409);
            }
            // Insert into manual_journals
            const insertJournalStmt = db.prepare(`
        INSERT INTO manual_journals (journal_number, date, notes)
        VALUES (?, ?, ?)
      `);
            const journalResult = insertJournalStmt.run(input.journal_number, input.date, input.notes || '');
            const journalId = Number(journalResult.lastInsertRowid);
            // Insert into manual_journals_entries
            const insertEntryStmt = db.prepare(`
        INSERT INTO manual_journals_entries (manual_journal_id, account_id, debit, credit)
        VALUES (?, ?, ?, ?)
      `);
            for (const line of lines) {
                insertEntryStmt.run(journalId, line.account_id, line.debit, line.credit);
            }
            // Post to accounts_transactions and update balances
            LedgerService.postJournal('ManualJournal', journalId, lines, db);
            return { id: journalId };
        };
        if (dbInstance) {
            return execute(dbInstance);
        }
        else {
            return withTransaction(execute);
        }
    }
}

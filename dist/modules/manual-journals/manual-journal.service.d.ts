import Database from 'better-sqlite3';
export interface CreateManualJournalInput {
    journal_number: string;
    date: string;
    notes?: string;
    entries: {
        account_id: number;
        debit: number;
        credit: number;
    }[];
}
export declare class ManualJournalService {
    static createManualJournal(input: CreateManualJournalInput, dbInstance?: Database.Database): {
        id: number;
    };
}

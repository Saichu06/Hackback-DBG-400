import Database from 'better-sqlite3';
export declare class AccountService {
    static listAccounts(dbInstance?: Database.Database): {
        id: number;
        code: string;
        name: string;
        type: string;
        balance: number;
    }[];
}

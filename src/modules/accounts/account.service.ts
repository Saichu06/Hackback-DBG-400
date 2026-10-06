import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';

export class AccountService {
  public static listAccounts(dbInstance?: Database.Database) {
    const db = dbInstance || getDb();
    const accounts = db
      .prepare('SELECT id, code, name, account_type as type, balance FROM accounts ORDER BY code ASC')
      .all() as {
      id: number;
      code: string;
      name: string;
      type: string;
      balance: number;
    }[];
    return accounts;
  }
}

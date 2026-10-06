import { getDb } from '../../database/db.js';
export class AccountService {
    static listAccounts(dbInstance) {
        const db = dbInstance || getDb();
        const accounts = db
            .prepare('SELECT id, code, name, account_type as type, balance FROM accounts ORDER BY code ASC')
            .all();
        return accounts;
    }
}

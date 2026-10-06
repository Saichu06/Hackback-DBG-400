import { getDb } from '../../database/db.js';
export class ContactService {
    static listContacts(dbInstance) {
        const db = dbInstance || getDb();
        return db
            .prepare('SELECT id, name, contact_type FROM contacts ORDER BY id ASC')
            .all();
    }
    static createContact(name, contact_type, dbInstance) {
        const db = dbInstance || getDb();
        const result = db
            .prepare('INSERT INTO contacts (name, contact_type) VALUES (?, ?)')
            .run(name, contact_type);
        return {
            id: Number(result.lastInsertRowid),
            name,
            contact_type,
        };
    }
}

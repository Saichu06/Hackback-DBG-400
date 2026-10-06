import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { Contact, ContactType } from '../../types/index.js';

export class ContactService {
  public static listContacts(dbInstance?: Database.Database): Contact[] {
    const db = dbInstance || getDb();
    return db
      .prepare('SELECT id, name, contact_type, gstin, state_code FROM contacts ORDER BY id ASC')
      .all() as Contact[];
  }

  public static getContactById(id: number, dbInstance?: Database.Database): Contact | null {
    const db = dbInstance || getDb();
    const contact = db
      .prepare('SELECT id, name, contact_type, gstin, state_code FROM contacts WHERE id = ?')
      .get(id) as Contact | undefined;
    return contact || null;
  }

  public static createContact(
    name: string,
    contact_type: ContactType,
    dbInstance?: Database.Database,
    gstin?: string | null,
    state_code?: string | null
  ): Contact {
    const db = dbInstance || getDb();
    const result = db
      .prepare('INSERT INTO contacts (name, contact_type, gstin, state_code) VALUES (?, ?, ?, ?)')
      .run(name, contact_type, gstin ?? null, state_code ?? null);
    return {
      id: Number(result.lastInsertRowid),
      name,
      contact_type,
      gstin: gstin ?? null,
      state_code: state_code ?? null,
    };
  }
}

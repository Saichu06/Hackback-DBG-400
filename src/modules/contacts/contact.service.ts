import Database from 'better-sqlite3';
import { getDb } from '../../database/db.js';
import { Contact, ContactType } from '../../types/index.js';

export class ContactService {
  public static listContacts(dbInstance?: Database.Database): Contact[] {
    const db = dbInstance || getDb();
    return db
      .prepare('SELECT id, name, contact_type FROM contacts ORDER BY id ASC')
      .all() as Contact[];
  }

  public static createContact(
    name: string,
    contact_type: ContactType,
    dbInstance?: Database.Database
  ): Contact {
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

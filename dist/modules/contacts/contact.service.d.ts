import Database from 'better-sqlite3';
import { Contact, ContactType } from '../../types/index.js';
export declare class ContactService {
    static listContacts(dbInstance?: Database.Database): Contact[];
    static createContact(name: string, contact_type: ContactType, dbInstance?: Database.Database): Contact;
}

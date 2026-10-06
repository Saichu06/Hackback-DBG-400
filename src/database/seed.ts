import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getDb, withTransaction } from './db.js';
import { config } from '../config/env.js';

export function seedDatabase(dbInstance?: Database.Database): void {
  const db = dbInstance || getDb();

  withTransaction((database) => {
    // 1. Seed initial Admin user if not present
    const existingAdmin = database
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(config.seedAdmin.email);

    if (!existingAdmin) {
      const passwordHash = bcrypt.hashSync(config.seedAdmin.password, 10);
      database
        .prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)')
        .run(config.seedAdmin.email, passwordHash, 'Admin');
      console.log(`Seeded admin user: ${config.seedAdmin.email}`);
    }

    // 2. Seed Default Chart of Accounts (PRD.md §2b)
    const defaultAccounts = [
      { code: '1000', name: 'Bank', account_type: 'Asset' },
      { code: '1100', name: 'Accounts Receivable', account_type: 'Asset' },
      { code: '2000', name: 'Accounts Payable', account_type: 'Liability' },
      { code: '2100', name: 'Tax Payable', account_type: 'Liability' },
      { code: '3000', name: "Owner's Equity", account_type: 'Equity' },
      { code: '4000', name: 'Sales Revenue', account_type: 'Revenue' },
      { code: '5000', name: 'General Expenses', account_type: 'Expense' },
    ];

    const insertAccountStmt = database.prepare(
      'INSERT OR IGNORE INTO accounts (code, name, account_type, balance) VALUES (?, ?, ?, 0)'
    );

    for (const acc of defaultAccounts) {
      insertAccountStmt.run(acc.code, acc.name, acc.account_type);
    }
    console.log('Seeded chart of accounts.');

    // 3. Seed default contacts if empty
    const contactsCount = (database.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number }).count;
    if (contactsCount === 0) {
      const insertContactStmt = database.prepare(
        'INSERT INTO contacts (contact_type, name) VALUES (?, ?)'
      );
      insertContactStmt.run('Customer', 'ACME Corp');
      insertContactStmt.run('Customer', 'Apex Retail');
      insertContactStmt.run('Vendor', 'Global Supplies Ltd');
      console.log('Seeded default contacts.');
    }
  }, db);
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase();
  console.log('Database seeded successfully.');
}

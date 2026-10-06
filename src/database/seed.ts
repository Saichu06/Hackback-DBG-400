import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { getDb, withTransaction } from './db.js';
import { config } from '../config/env.js';
import { ShopSettingsService } from '../modules/settings/shop-settings.service.js';
import { InvoiceService } from '../modules/invoices/invoice.service.js';

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

    // 2. Seed Default Chart of Accounts (PRD.md §2b) plus the three GST payable
    // accounts needed by the GST Filing Pack (docs/DATA_MODEL.md §3). The GST
    // accounts are additive — they sit alongside the generic Tax Payable (2100),
    // they do not replace it.
    const defaultAccounts = [
      { code: '1000', name: 'Bank', account_type: 'Asset' },
      { code: '1100', name: 'Accounts Receivable', account_type: 'Asset' },
      { code: '2000', name: 'Accounts Payable', account_type: 'Liability' },
      { code: '2100', name: 'Tax Payable', account_type: 'Liability' },
      { code: '2101', name: 'CGST Payable', account_type: 'Liability' },
      { code: '2102', name: 'SGST Payable', account_type: 'Liability' },
      { code: '2103', name: 'IGST Payable', account_type: 'Liability' },
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

    // 3. Seed default contacts if empty. ACME Corp and Apex Retail get GST state
    // codes so the GST Filing Pack demo data (seedGstDemoData, below) has one
    // intra-state and one inter-state customer to work with.
    const contactsCount = (database.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number }).count;
    if (contactsCount === 0) {
      const insertContactStmt = database.prepare(
        'INSERT INTO contacts (contact_type, name, gstin, state_code) VALUES (?, ?, ?, ?)'
      );
      insertContactStmt.run('Customer', 'ACME Corp', '27AAAAA0000A1Z5', '27');
      insertContactStmt.run('Customer', 'Apex Retail', '29BBBBB1111B2Z6', '29');
      database.prepare('INSERT INTO contacts (contact_type, name) VALUES (?, ?)').run('Vendor', 'Global Supplies Ltd');
      console.log('Seeded default contacts.');
    }

    // 4. Seed shop settings (state 27 = Maharashtra) so sales to ACME Corp (also
    // state 27) are intra-state (CGST+SGST) and sales to Apex Retail (state 29,
    // Karnataka) are inter-state (IGST) — see docs/DATA_MODEL.md §3.
    const existingSettings = ShopSettingsService.get(database);
    if (!existingSettings) {
      ShopSettingsService.upsert('27CCCCC2222C3Z7', '27', database);
      console.log('Seeded shop GST settings (state 27).');
    }
  }, db);
}

/**
 * Seeds the GST Filing Pack demo invoices (PRD.md §2d acceptance criteria / build checklist
 * item 7): a 5% intra-state invoice, an 18% intra-state invoice with one line missing its HSN
 * code, an 18% inter-state invoice, and one voided invoice — all delivered (posted) so they show
 * up in the current month's GST Filing Pack and Trial Balance alike.
 *
 * Deliberately NOT part of seedDatabase() above: seedDatabase() is also called on every server
 * boot (src/index.ts) and by every test's fresh in-memory database, both of which need a
 * zero-ledger-impact starting state. This demo-data seed posts real journal entries, so it is
 * only ever invoked once, explicitly, via `npm run seed`.
 */
export function seedGstDemoData(dbInstance?: Database.Database): void {
  const db = dbInstance || getDb();

  withTransaction((database) => {
    const invoiceCount = (database.prepare('SELECT COUNT(*) as count FROM sales_invoices').get() as { count: number }).count;
    if (invoiceCount > 0) {
      return; // already seeded — keep this idempotent across repeated `npm run seed` calls
    }

    const admin = database.prepare("SELECT id FROM users WHERE role = 'Admin'").get() as { id: number } | undefined;
    const acme = database.prepare("SELECT id FROM contacts WHERE name = 'ACME Corp'").get() as { id: number } | undefined;
    const apex = database.prepare("SELECT id FROM contacts WHERE name = 'Apex Retail'").get() as { id: number } | undefined;
    if (!admin || !acme || !apex) {
      return; // base seedDatabase() hasn't run yet — nothing to attach demo invoices to
    }

    const stamp = Date.now();

    // 5% intra-state
    const inv1 = InvoiceService.createInvoice(
      {
        customer_id: acme.id,
        invoice_no: `GST-DEMO-5PCT-${stamp}`,
        total_amount: 210000, // 200000 taxable + 10000 tax (5% of 200000)
        entries: [{ amount: 200000, tax_rate: 500, tax_amount: 10000, hsn_code: '6109' }],
      },
      admin.id,
      database
    );
    InvoiceService.deliverInvoice(inv1.id, database);

    // 18% intra-state, two lines — one with an HSN code, one deliberately without
    // (PRD.md §2d acceptance criteria #3: "missing HSN" must be surfaced, not dropped)
    const inv2 = InvoiceService.createInvoice(
      {
        customer_id: acme.id,
        invoice_no: `GST-DEMO-18PCT-${stamp}`,
        total_amount: 649000, // (500000+90000) + (50000+9000)
        entries: [
          { amount: 500000, tax_rate: 1800, tax_amount: 90000, hsn_code: '6109' },
          { amount: 50000, tax_rate: 1800, tax_amount: 9000, hsn_code: null },
        ],
      },
      admin.id,
      database
    );
    InvoiceService.deliverInvoice(inv2.id, database);

    // 18% inter-state (customer in a different state than the shop)
    const inv3 = InvoiceService.createInvoice(
      {
        customer_id: apex.id,
        invoice_no: `GST-DEMO-INTERSTATE-${stamp}`,
        total_amount: 354000, // 300000 taxable + 54000 tax (18% of 300000)
        entries: [{ amount: 300000, tax_rate: 1800, tax_amount: 54000, hsn_code: '6109' }],
      },
      admin.id,
      database
    );
    InvoiceService.deliverInvoice(inv3.id, database);

    // Delivered then voided — must disappear from the GST Filing Pack while the
    // ledger tie-out still passes, because the void posts an exact reversal.
    const inv4 = InvoiceService.createInvoice(
      {
        customer_id: acme.id,
        invoice_no: `GST-DEMO-VOIDED-${stamp}`,
        total_amount: 118000,
        entries: [{ amount: 100000, tax_rate: 1800, tax_amount: 18000, hsn_code: '6109' }],
      },
      admin.id,
      database
    );
    InvoiceService.deliverInvoice(inv4.id, database);
    InvoiceService.voidInvoice(inv4.id, database);

    console.log('Seeded GST Filing Pack demo invoices (5%, 18% intra, 18% inter-state, 1 voided).');
  }, db);
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase();
  seedGstDemoData();
  console.log('Database seeded successfully.');
}

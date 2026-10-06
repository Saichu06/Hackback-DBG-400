-- Database Schema Definition for Double-Entry Accounting Ledger
-- Conforms strictly to docs/DATA_MODEL.md

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Accountant', 'Staff')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')),
  parent_account_id INTEGER REFERENCES accounts(id) ON DELETE RESTRICT,
  balance INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_accounts_name ON accounts(name);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('Customer', 'Vendor')),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  created_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Delivered', 'Partially Paid', 'Paid', 'Voided')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT NOT NULL UNIQUE,
  vendor_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Open', 'Partially Paid', 'Paid', 'Voided')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('SaleInvoice', 'Bill')),
  reference_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  tax_rate INTEGER,
  tax_amount INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_entries_ref ON items_entries(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS payment_receives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_receive_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_receives_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_receive_id INTEGER NOT NULL REFERENCES payment_receives(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  amount_applied INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pay_rec_entries_pid ON payment_receives_entries(payment_receive_id);
CREATE INDEX IF NOT EXISTS idx_pay_rec_entries_inv ON payment_receives_entries(invoice_id);

CREATE TABLE IF NOT EXISTS bill_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_number TEXT NOT NULL UNIQUE,
  vendor_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  amount INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_payments_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_payment_id INTEGER NOT NULL REFERENCES bill_payments(id) ON DELETE CASCADE,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE RESTRICT,
  amount_applied INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bill_pay_entries_bpid ON bill_payments_entries(bill_payment_id);
CREATE INDEX IF NOT EXISTS idx_bill_pay_entries_bid ON bill_payments_entries(bill_id);

CREATE TABLE IF NOT EXISTS manual_journals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_number TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manual_journals_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manual_journal_id INTEGER NOT NULL REFERENCES manual_journals(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_manual_journals_entries_mjid ON manual_journals_entries(manual_journal_id);

CREATE TABLE IF NOT EXISTS accounts_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  reference_type TEXT NOT NULL CHECK (reference_type IN ('SaleInvoice', 'Bill', 'PaymentReceive', 'BillPayment', 'ManualJournal')),
  reference_id INTEGER NOT NULL,
  debit INTEGER NOT NULL DEFAULT 0,
  credit INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_single_sided CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX IF NOT EXISTS idx_accounts_transactions_ref ON accounts_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_accounts_transactions_account ON accounts_transactions(account_id);

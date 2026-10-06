export type UserRole = 'Admin' | 'Accountant' | 'Staff';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at?: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: number;
  code: string;
  name: string;
  account_type: AccountType;
  parent_account_id: number | null;
  balance: number; // in integer cents
}

export type ContactType = 'Customer' | 'Vendor';

export interface Contact {
  id: number;
  contact_type: ContactType;
  name: string;
  gstin?: string | null;
  state_code?: string | null;
}

export interface ShopSettings {
  id: 1;
  gstin: string | null;
  state_code: string | null;
}

export type InvoiceStatus = 'Draft' | 'Delivered' | 'Partially Paid' | 'Paid' | 'Voided';

export interface SalesInvoice {
  id: number;
  invoice_no: string;
  customer_id: number;
  created_by_id: number;
  total_amount: number; // in integer cents
  status: InvoiceStatus;
  created_at?: string;
}

export type BillStatus = 'Draft' | 'Open' | 'Partially Paid' | 'Paid' | 'Voided';

export interface Bill {
  id: number;
  bill_number: string;
  vendor_id: number;
  total_amount: number; // in integer cents
  status: BillStatus;
  created_at?: string;
}

export type ReferenceType =
  | 'SaleInvoice'
  | 'Bill'
  | 'PaymentReceive'
  | 'BillPayment'
  | 'ManualJournal';

export interface ItemEntry {
  id?: number;
  reference_type: 'SaleInvoice' | 'Bill';
  reference_id: number;
  amount: number; // in integer cents
  tax_rate: number | null; // in basis points (e.g. 1800 = 18.00%)
  tax_amount: number; // in integer cents
  hsn_code?: string | null;
  cgst_paise?: number;
  sgst_paise?: number;
  igst_paise?: number;
}

export interface PaymentReceive {
  id: number;
  payment_receive_no: string;
  customer_id: number;
  amount: number; // in integer cents
  created_at?: string;
}

export interface PaymentReceiveEntry {
  id?: number;
  payment_receive_id: number;
  invoice_id: number;
  amount_applied: number; // in integer cents
}

export interface BillPayment {
  id: number;
  payment_number: string;
  vendor_id: number;
  amount: number; // in integer cents
  created_at?: string;
}

export interface BillPaymentEntry {
  id?: number;
  bill_payment_id: number;
  bill_id: number;
  amount_applied: number; // in integer cents
}

export interface ManualJournal {
  id: number;
  journal_number: string;
  date: string;
  notes: string;
  created_at?: string;
}

export interface ManualJournalEntry {
  id?: number;
  manual_journal_id: number;
  account_id: number;
  debit: number; // in integer cents
  credit: number; // in integer cents
}

export interface AccountTransaction {
  id?: number;
  account_id: number;
  reference_type: ReferenceType;
  reference_id: number;
  debit: number; // in integer cents
  credit: number; // in integer cents
  created_at?: string;
}

export interface JournalLine {
  account_id: number;
  debit: number;
  credit: number;
}

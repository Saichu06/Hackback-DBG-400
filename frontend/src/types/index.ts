export type UserRole = 'Admin' | 'Accountant' | 'Staff';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at?: string;
}

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  balance: number; // in cents
}

export type ContactType = 'Customer' | 'Vendor';

export interface Contact {
  id: number;
  contact_type: ContactType;
  name: string;
}

export type InvoiceStatus = 'Draft' | 'Delivered' | 'Partially Paid' | 'Paid' | 'Voided';

export interface SalesInvoice {
  id: number;
  invoice_no: string;
  customer_id: number;
  total_amount: number; // in cents
  status: InvoiceStatus;
  created_at?: string;
}

export type BillStatus = 'Draft' | 'Open' | 'Partially Paid' | 'Paid' | 'Voided';

export interface Bill {
  id: number;
  bill_number: string;
  vendor_id: number;
  total_amount: number; // in cents
  status: BillStatus;
  created_at?: string;
}

export interface JournalEntry {
  date: string;
  account: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceAccount {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
  total_debit: number;
  total_credit: number;
  net_debit: number;
  net_credit: number;
}

export interface TrialBalanceResponse {
  accounts: TrialBalanceAccount[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface BalanceSheetResponse {
  assets: {
    accounts: Account[];
    total: number;
  };
  liabilities: {
    accounts: Account[];
    total: number;
  };
  equity: {
    accounts: Account[];
    total: number;
    current_year_earnings: number;
    total_equity_with_earnings: number;
  };
  is_balanced: boolean;
}

export interface ProfitLossResponse {
  revenue: {
    accounts: Account[];
    total: number;
  };
  expenses: {
    accounts: Account[];
    total: number;
  };
  net_income: number;
}

export interface GstByRateRow {
  rate_bp: number;
  line_type: 'intra-state' | 'inter-state';
  invoice_count: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
}

export interface GstByHsnRow {
  hsn_code: string;
  description: string | null;
  quantity: number;
  taxable_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_tax_paise: number;
}

export interface GstTieOutEntry {
  report_paise: number;
  ledger_paise: number;
  ok: boolean;
}

export interface GstFilingPack {
  month: string;
  by_rate: GstByRateRow[];
  by_hsn: GstByHsnRow[];
  tie_out: {
    cgst: GstTieOutEntry;
    sgst: GstTieOutEntry;
    igst: GstTieOutEntry;
  };
}

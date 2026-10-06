import {
  Account,
  BalanceSheetResponse,
  Bill,
  Contact,
  GstFilingPack,
  JournalEntry,
  ProfitLossResponse,
  SalesInvoice,
  TrialBalanceResponse,
  User,
  UserRole,
} from '../types/index.js';

const API_BASE = '/api';

export class ApiError extends Error {
  public status: number;
  public code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = data?.error || response.statusText || 'An unexpected error occurred';
    throw new ApiError(message, response.status, data?.code);
  }

  return data as T;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },

  users: {
    list: () => request<User[]>('/users'),
    create: (payload: { email: string; password: string; role: UserRole }) =>
      request<User>('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  accounts: {
    list: () => request<Account[]>('/accounts'),
  },

  contacts: {
    list: () => request<Contact[]>('/contacts'),
    create: (payload: { name: string; contact_type: 'Customer' | 'Vendor' }) =>
      request<Contact>('/contacts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  invoices: {
    list: () => request<SalesInvoice[]>('/sale-invoices'),
    create: (payload: {
      customer_id: number;
      invoice_no: string;
      total_amount: number;
      entries?: { amount: number; tax_rate?: number; tax_amount?: number; hsn_code?: string }[];
    }) =>
      request<{ id: number; status: string }>('/sale-invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    deliver: (id: number) =>
      request<{ id: number; status: string }>(`/sale-invoices/${id}/deliver`, {
        method: 'PUT',
      }),
    void: (id: number) =>
      request<{ id: number; status: string }>(`/sale-invoices/${id}`, {
        method: 'DELETE',
      }),
  },

  payments: {
    create: (payload: {
      customer_id: number;
      amount: number;
      payment_receive_no: string;
      entries: { invoice_id: number; amount_applied: number }[];
    }) =>
      request<{ id: number; alert?: string }>('/payments-received', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  bills: {
    list: () => request<Bill[]>('/bills'),
    create: (payload: {
      vendor_id: number;
      bill_number: string;
      total_amount: number;
      entries?: { amount: number; tax_rate?: number; tax_amount?: number }[];
    }) =>
      request<{ id: number }>('/bills', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    void: (id: number) =>
      request<{ id: number; status: string }>(`/bills/${id}`, {
        method: 'DELETE',
      }),
    pay: (payload: {
      vendor_id: number;
      amount: number;
      payment_number: string;
      entries: { bill_id: number; amount_applied: number }[];
    }) =>
      request<{ id: number }>('/bill-payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  manualJournals: {
    create: (payload: {
      journal_number: string;
      date: string;
      notes?: string;
      entries: { account_id: number; debit: number; credit: number }[];
    }) =>
      request<{ id: number }>('/manual-journals', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  reports: {
    journal: () => request<JournalEntry[]>('/reports/journal'),
    trialBalance: () => request<TrialBalanceResponse>('/reports/trial-balance-sheet'),
    balanceSheet: () => request<BalanceSheetResponse>('/reports/balance-sheet'),
    profitLoss: () => request<ProfitLossResponse>('/reports/profit-loss-sheet'),
  },

  gst: {
    get: (month: string) => request<GstFilingPack>(`/v1/reports/gst?month=${encodeURIComponent(month)}`),
    downloadCsv: async (month: string): Promise<void> => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/v1/reports/gst.csv?month=${encodeURIComponent(month)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new ApiError(data?.error || 'Failed to download CSV', response.status, data?.code);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst-filing-pack-${month}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  },

  test: {
    seedRandom: (seed: number, count: number) =>
      request<{ operations_run: number; final_trial_balance: TrialBalanceResponse }>(
        '/test/seed-random',
        {
          method: 'POST',
          body: JSON.stringify({ seed, count }),
        }
      ),
  },

  chatbot: {
    send: (message: string, history: { role: 'user' | 'assistant'; content: string }[]) =>
      request<{ reply: string }>('/chatbot', {
        method: 'POST',
        body: JSON.stringify({ message, history }),
      }),
  },
};

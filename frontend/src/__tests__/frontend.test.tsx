import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import { LoginPage } from '../pages/LoginPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { TrialBalancePage } from '../pages/TrialBalancePage.js';
import { PaymentsPage } from '../pages/PaymentsPage.js';
import { api } from '../services/api.js';

// Mock API
vi.mock('../services/api.js', () => ({
  api: {
    auth: {
      login: vi.fn(),
    },
    accounts: {
      list: vi.fn(),
    },
    contacts: {
      list: vi.fn(),
    },
    invoices: {
      list: vi.fn(),
      create: vi.fn(),
      deliver: vi.fn(),
      void: vi.fn(),
    },
    payments: {
      create: vi.fn(),
    },
    bills: {
      list: vi.fn(),
      create: vi.fn(),
    },
    reports: {
      trialBalance: vi.fn(),
      journal: vi.fn(),
      balanceSheet: vi.fn(),
      profitLoss: vi.fn(),
    },
    test: {
      seedRandom: vi.fn(),
    },
  },
}));

describe('Frontend Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('LoginPage Component', () => {
    it('should render login form with email and password inputs', () => {
      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In to Ledger/i })).toBeInTheDocument();
    });

    it('should handle login submission and display API error on failure', async () => {
      (api.auth.login as any).mockRejectedValueOnce(new Error('Invalid email or password'));

      render(
        <AuthProvider>
          <BrowserRouter>
            <LoginPage />
          </BrowserRouter>
        </AuthProvider>
      );

      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'wrong@example.com' },
      });
      fireEvent.change(screen.getByLabelText(/Password/i), {
        target: { value: 'wrongpass' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign In to Ledger/i }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid email or password/i)).toBeInTheDocument();
      });
    });
  });

  describe('DashboardPage Component', () => {
    it('should render ledger health indicator when balanced', async () => {
      // DashboardPage is always rendered behind a logged-in session in real usage
      // (ProtectedRoute guards it) — its Trial Balance banner is Admin/Accountant-only,
      // so simulate an authenticated Admin session for this test.
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, email: 'admin@example.com', role: 'Admin' }));

      (api.reports.trialBalance as any).mockResolvedValueOnce({
        accounts: [],
        total_debit: 50000,
        total_credit: 50000,
        is_balanced: true,
      });
      (api.invoices.list as any).mockResolvedValueOnce([]);
      (api.accounts.list as any).mockResolvedValueOnce([]);
      (api.reports.journal as any).mockResolvedValueOnce([]);

      render(
        <AuthProvider>
          <BrowserRouter>
            <DashboardPage />
          </BrowserRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/LEDGER BALANCED/i)).toBeInTheDocument();
        expect(screen.getByText(/Double-Entry Invariant Satisfied/i)).toBeInTheDocument();
      });
    });
  });

  describe('TrialBalancePage Component', () => {
    it('should render trial balance accounts and total debit/credit sums', async () => {
      (api.reports.trialBalance as any).mockResolvedValueOnce({
        accounts: [
          {
            id: 1,
            code: '1000',
            name: 'Bank',
            type: 'Asset',
            balance: 20000,
            total_debit: 20000,
            total_credit: 0,
            net_debit: 20000,
            net_credit: 0,
          },
          {
            id: 2,
            code: '4000',
            name: 'Sales Revenue',
            type: 'Revenue',
            balance: 20000,
            total_debit: 0,
            total_credit: 20000,
            net_debit: 0,
            net_credit: 20000,
          },
        ],
        total_debit: 20000,
        total_credit: 20000,
        is_balanced: true,
      });

      render(
        <AuthProvider>
          <BrowserRouter>
            <TrialBalancePage />
          </BrowserRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Trial Balance Report/i)).toBeInTheDocument();
        expect(screen.getByText(/✓ LEDGER BALANCED/i)).toBeInTheDocument();
        expect(screen.getByText(/Sales Revenue/i)).toBeInTheDocument();
      });
    });
  });

  describe('PaymentsPage & Differentiator 1 Alert', () => {
    it('should render non-blocking duplicate payment advisory warning on payment completion', async () => {
      (api.contacts.list as any).mockResolvedValueOnce([
        { id: 1, name: 'ACME Corp', contact_type: 'Customer' },
      ]);
      (api.invoices.list as any).mockResolvedValueOnce([
        { id: 10, invoice_no: 'INV-10', customer_id: 1, total_amount: 15000, status: 'Delivered' },
      ]);
      (api.payments.create as any).mockResolvedValueOnce({
        id: 99,
        alert: 'DUPLICATE_PAYMENT_WARNING: A payment with the identical amount was recorded for this customer in the last 10 minutes.',
      });

      render(
        <AuthProvider>
          <BrowserRouter>
            <PaymentsPage />
          </BrowserRouter>
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Record Customer Payment/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Record & Post Payment/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/Differentiator Advisory: Intelligent Payment Alert/i)
        ).toBeInTheDocument();
        expect(screen.getByText(/DUPLICATE_PAYMENT_WARNING/i)).toBeInTheDocument();
      });
    });
  });
});

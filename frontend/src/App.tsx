import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Layout } from './components/layout/Layout.js';
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { AccountsPage } from './pages/AccountsPage.js';
import { ContactsPage } from './pages/ContactsPage.js';
import { InvoicesPage } from './pages/InvoicesPage.js';
import { NewInvoicePage } from './pages/NewInvoicePage.js';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage.js';
import { PaymentsPage } from './pages/PaymentsPage.js';
import { BillsPage } from './pages/BillsPage.js';
import { NewBillPage } from './pages/NewBillPage.js';
import { JournalPage } from './pages/JournalPage.js';
import { TrialBalancePage } from './pages/TrialBalancePage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { GstFilingPackPage } from './pages/GstFilingPackPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { TestHarnessPage } from './pages/TestHarnessPage.js';

const FullScreenLoader: React.FC = () => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8f7f4',
      color: 'var(--text-secondary)',
      gap: '12px',
    }}
  >
    <div
      className="animate-fade-in"
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: '2px solid rgba(154, 106, 28, 0.25)',
        borderTopColor: '#9a6a1c',
        animation: 'spin-slow 0.7s linear infinite',
      }}
    />
    <span>Loading Ledger Core…</span>
  </div>
);

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAccountant?: boolean;
  requireStaff?: boolean;
}> = ({ children, requireAdmin = false, requireAccountant = false, requireStaff = false }) => {
  const { user, token, isLoading, isAdmin, isAccountant, isStaff } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAccountant && !isAccountant) {
    return <Navigate to="/dashboard" replace />;
  }

  // Sales invoices, contacts, payments, and bills are Admin/Staff-only per the
  // backend's role guards (see API.md) — Accountant has no server access to
  // these, so gate them client-side too instead of showing a silently broken page.
  if (requireStaff && !isStaff) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

/** Root route "/": marketing landing page for guests, redirects straight to the dashboard once signed in. */
const HomeGate: React.FC = () => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (token && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeGate />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Pathless layout route: groups every authenticated page under the
              Sidebar/Navbar chrome without consuming a URL segment, so each
              page keeps its own top-level path (e.g. /invoices, /reports). */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute requireStaff>
                  <ContactsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute requireStaff>
                  <InvoicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/new"
              element={
                <ProtectedRoute requireStaff>
                  <NewInvoicePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices/:id"
              element={
                <ProtectedRoute requireStaff>
                  <InvoiceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute requireStaff>
                  <PaymentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills"
              element={
                <ProtectedRoute requireStaff>
                  <BillsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills/new"
              element={
                <ProtectedRoute requireStaff>
                  <NewBillPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <ProtectedRoute requireAccountant>
                  <JournalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trial-balance"
              element={
                <ProtectedRoute requireAccountant>
                  <TrialBalancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requireAccountant>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gst-filing-pack"
              element={
                <ProtectedRoute requireAccountant>
                  <GstFilingPackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requireAdmin>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/test-harness"
              element={
                <ProtectedRoute requireAdmin>
                  <TestHarnessPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

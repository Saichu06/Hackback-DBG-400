import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  FileText,
  BookOpen,
  Receipt,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
} from 'lucide-react';
import { api } from '../services/api.js';
import {
  Account,
  JournalEntry,
  SalesInvoice,
  TrialBalanceResponse,
} from '../types/index.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { AccountTypeBarChart, InvoiceStatusDonut } from '../components/charts/DashboardCharts.js';
import { AnimatedNumber } from '../components/ui/AnimatedNumber.js';
import { SkeletonCardGrid, SkeletonBlock, SkeletonText } from '../components/ui/Skeleton.js';
import { useAuth } from '../context/AuthContext.js';

export const DashboardPage: React.FC = () => {
  const { isAccountant, isStaff, isLoading: authLoading } = useAuth();
  const [trialBalance, setTrialBalance] = useState<TrialBalanceResponse | null>(null);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Trial Balance & Journal are Admin/Accountant-only; Sales Invoices are
  // Admin/Staff-only (see docs/API.md) — only fetch what this role can
  // actually read, so an Accountant or Staff login never hits a 403 here.
  const fetchDashboardData = async () => {
    setLoading(true);
    const [tbRes, invRes, accRes, jRes] = await Promise.allSettled([
      isAccountant ? api.reports.trialBalance() : Promise.resolve(null),
      isStaff ? api.invoices.list() : Promise.resolve([]),
      api.accounts.list(),
      isAccountant ? api.reports.journal() : Promise.resolve([]),
    ]);
    setTrialBalance(tbRes.status === 'fulfilled' ? tbRes.value : null);
    setInvoices(invRes.status === 'fulfilled' ? invRes.value : []);
    setAccounts(accRes.status === 'fulfilled' ? accRes.value : []);
    setJournal(jRes.status === 'fulfilled' ? jRes.value : []);
    setLoading(false);
  };

  useEffect(() => {
    // Wait for AuthContext to finish resolving the session from localStorage first —
    // otherwise isAccountant/isStaff are still at their default (false) and this fetch
    // would wrongly skip role-permitted calls on every fresh page load of /dashboard.
    if (authLoading) return;
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAccountant, isStaff]);

  if (loading) {
    return (
      <div className="skeleton-page">
        <div>
          <SkeletonText width="260px" />
          <SkeletonText width="380px" />
        </div>
        <SkeletonBlock height={110} />
        <SkeletonCardGrid count={4} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          <SkeletonBlock height={220} />
          <SkeletonBlock height={220} />
        </div>
      </div>
    );
  }

  const difference = trialBalance ? Math.abs(trialBalance.total_debit - trialBalance.total_credit) : 0;
  const isBalanced = trialBalance?.is_balanced ?? false;

  const deliveredCount = invoices.filter((i) => i.status === 'Delivered').length;
  const paidCount = invoices.filter((i) => i.status === 'Paid').length;
  const draftCount = invoices.filter((i) => i.status === 'Draft').length;
  const voidedCount = invoices.filter((i) => i.status === 'Voided').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header */}
      <div className="animate-fade-in-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Accounting Dashboard
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Live double-entry overview and ledger integrity status
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isStaff && (
            <Link to="/invoices/new" className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Create Invoice</span>
            </Link>
          )}
          {isAccountant && (
            <Link to="/trial-balance" className="btn btn-secondary">
              <Scale size={16} />
              <span>View Trial Balance</span>
            </Link>
          )}
        </div>
      </div>

      {/* Primary Health Banner (Admin/Accountant only — Trial Balance is not Staff-visible) */}
      {isAccountant ? (
        <div
          className="glass-panel animate-fade-in-up"
          style={{
            padding: '24px',
            animationDelay: '0.05s',
            background: isBalanced
              ? 'linear-gradient(135deg, rgba(21, 128, 61, 0.1) 0%, rgba(255, 255, 255, 0.5) 100%)'
              : 'linear-gradient(135deg, rgba(185, 28, 28, 0.12) 0%, rgba(255, 255, 255, 0.5) 100%)',
            border: `1px solid ${isBalanced ? 'rgba(21, 128, 61, 0.3)' : 'rgba(185, 28, 28, 0.35)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: isBalanced ? 'rgba(21, 128, 61, 0.14)' : 'rgba(185, 28, 28, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isBalanced ? <CheckCircle2 size={28} color="#15803d" /> : <AlertTriangle size={28} color="#b91c1c" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isBalanced ? '#15803d' : '#b91c1c' }}>
                  {isBalanced ? 'LEDGER BALANCED' : 'OUT OF BALANCE'}
                </span>
                <span className={`badge ${isBalanced ? 'badge-balanced' : 'badge-unbalanced'}`}>
                  {isBalanced ? 'Double-Entry Invariant Satisfied' : 'Action Required'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
                {isBalanced
                  ? 'Every transaction strictly balances: Total Debits exactly equal Total Credits.'
                  : `Imbalance detected: Discrepancy of ${formatMoney(difference)}.`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Debits
              </div>
              <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1d4ed8' }}>
                <AnimatedNumber value={trialBalance?.total_debit ?? 0} format={formatMoney} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Credits
              </div>
              <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: '#15803d' }}>
                <AnimatedNumber value={trialBalance?.total_credit ?? 0} format={formatMoney} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                Difference
              </div>
              <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 700, color: difference === 0 ? '#15803d' : '#b91c1c' }}>
                <AnimatedNumber value={difference} format={formatMoney} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel animate-fade-in-up" style={{ padding: '20px 24px', animationDelay: '0.05s' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Trial Balance and ledger health are visible to Admin and Accountant roles. As Staff, use
            the Sales Invoices and Payments pages below to manage day-to-day transactions.
          </p>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-panel card-interactive stagger-item" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Accounts</span>
            <BookOpen size={18} color="#6d28d9" />
          </div>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            <AnimatedNumber value={accounts.length} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Chart of accounts seeded & active
          </div>
        </div>

        {isStaff && (
          <div className="glass-panel card-interactive stagger-item" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sales Invoices</span>
              <FileText size={18} color="#1d4ed8" />
            </div>
            <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
              <AnimatedNumber value={invoices.length} />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.75rem' }}>
              <span style={{ color: '#1d4ed8' }}>{deliveredCount} Posted</span>
              <span style={{ color: '#15803d' }}>{paidCount} Paid</span>
              <span style={{ color: '#6b7280' }}>{draftCount} Draft</span>
            </div>
          </div>
        )}

        {isAccountant && (
          <div className="glass-panel card-interactive stagger-item" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Journal Entries</span>
              <FileSpreadsheet size={18} color="#15803d" />
            </div>
            <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
              <AnimatedNumber value={journal.length} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Committed double-entry ledger lines
            </div>
          </div>
        )}

        {isStaff && (
        <div className="glass-panel card-interactive stagger-item" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Voided / Reversed</span>
            <Receipt size={18} color="#b91c1c" />
          </div>
          <div className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px' }}>
            <AnimatedNumber value={voidedCount} />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Preserved audit reversals
          </div>
        </div>
        )}
      </div>

      {/* Visual Breakdown Charts (Sales Invoices status chart is Staff-only data; account
          balances are visible to all three roles) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        <div className="glass-panel card-interactive animate-fade-in-up" style={{ padding: '20px' }}>
          <AccountTypeBarChart accounts={accounts} />
        </div>
        {isStaff && (
        <div className="glass-panel card-interactive animate-fade-in-up" style={{ padding: '20px', animationDelay: '0.08s' }}>
          <InvoiceStatusDonut
            statusCounts={{
              Draft: draftCount,
              Delivered: deliveredCount,
              'Partially Paid': invoices.filter((i) => i.status === 'Partially Paid').length,
              Paid: paidCount,
              Voided: voidedCount,
            }}
          />
        </div>
        )}
      </div>

      {/* Two Column Section: Recent Invoices & Recent Journal Activity */}
      {(isStaff || isAccountant) && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '20px' }}>
        {/* Recent Invoices Card */}
        {isStaff && (
        <div className="glass-panel card-interactive" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Sales Invoices</h2>
            <Link to="/invoices" style={{ fontSize: '0.8125rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View All</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {invoices.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No invoices created yet.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 5).map((inv) => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontWeight: 600 }}>{inv.invoice_no}</td>
                      <td className="mono">{formatMoney(inv.total_amount)}</td>
                      <td>
                        <span className={`badge badge-${inv.status.toLowerCase().replace(' ', '-')}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <Link to={`/invoices/${inv.id}`} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* Recent Journal Activity Card */}
        {isAccountant && (
        <div className="glass-panel card-interactive" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Ledger Activity</h2>
            <Link to="/journal" style={{ fontSize: '0.8125rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View Journal</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {journal.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No journal transactions recorded yet.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Account</th>
                    <th style={{ textAlign: 'right' }}>Debit</th>
                    <th style={{ textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.slice(-5).reverse().map((entry, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{formatDate(entry.date)}</td>
                      <td style={{ fontWeight: 600 }}>{entry.account}</td>
                      <td className="mono" style={{ textAlign: 'right', color: entry.debit > 0 ? '#1d4ed8' : 'var(--text-muted)' }}>
                        {entry.debit > 0 ? formatMoney(entry.debit) : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: entry.credit > 0 ? '#15803d' : 'var(--text-muted)' }}>
                        {entry.credit > 0 ? formatMoney(entry.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}
      </div>
      )}
    </div>
  );
};

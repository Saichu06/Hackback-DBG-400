import React, { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import { api } from '../services/api.js';
import { TrialBalanceResponse } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const TrialBalancePage: React.FC = () => {
  const [data, setData] = useState<TrialBalanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      const res = await api.reports.trialBalance();
      setData(res);
    } catch (err) {
      console.error('Failed to load trial balance', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  const totalDebits = data?.total_debit ?? 0;
  const totalCredits = data?.total_credit ?? 0;
  const difference = Math.abs(totalDebits - totalCredits);
  const isBalanced = data?.is_balanced ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Trial Balance Report
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Verification that all organizational debits strictly equal all credits
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} className="btn btn-secondary">
            <Printer size={16} />
            <span>Print Report</span>
          </button>
          <button onClick={fetchTrialBalance} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Trial Balance Health Hero Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 32px',
          background: isBalanced
            ? 'linear-gradient(135deg, rgba(21, 128, 61, 0.12) 0%, rgba(255, 255, 255, 0.6) 100%)'
            : 'linear-gradient(135deg, rgba(185, 28, 28, 0.15) 0%, rgba(255, 255, 255, 0.6) 100%)',
          border: `2px solid ${isBalanced ? 'rgba(21, 128, 61, 0.35)' : 'rgba(185, 28, 28, 0.4)'}`,
          boxShadow: isBalanced ? '0 0 30px rgba(21, 128, 61, 0.12)' : '0 0 30px rgba(185, 28, 28, 0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '14px',
                background: isBalanced ? 'rgba(21, 128, 61, 0.16)' : 'rgba(185, 28, 28, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isBalanced ? <CheckCircle2 size={32} color="#15803d" /> : <AlertTriangle size={32} color="#b91c1c" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.02em', color: isBalanced ? '#15803d' : '#b91c1c' }}>
                  {isBalanced ? '✓ LEDGER BALANCED' : '⚠ LEDGER OUT OF BALANCE'}
                </span>
                <span className={`badge ${isBalanced ? 'badge-balanced' : 'badge-unbalanced'}`}>
                  {isBalanced ? 'Exact Mathematical Equivalence' : 'Invariant Violation'}
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '4px' }}>
                {isBalanced
                  ? 'Double-Entry Invariant Confirmed: Total Debits strictly equal Total Credits with zero discrepancy.'
                  : `CRITICAL: Discrepancy of ${formatMoney(difference)} detected in ledger.`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Debits
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1d4ed8' }}>
                {formatMoney(totalDebits)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Credits
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803d' }}>
                {formatMoney(totalCredits)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                Difference
              </div>
              <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 900, color: difference === 0 ? '#15803d' : '#b91c1c' }}>
                {formatMoney(difference)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={7} cols={5} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Code</th>
                  <th>Account Name</th>
                  <th>Account Type</th>
                  <th style={{ textAlign: 'right', width: '200px' }}>Debit Balance</th>
                  <th style={{ textAlign: 'right', width: '200px' }}>Credit Balance</th>
                </tr>
              </thead>
              <tbody>
                {data?.accounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {acc.code}
                    </td>
                    <td style={{ fontWeight: 600 }}>{acc.name}</td>
                    <td>
                      <span className="badge badge-active">{acc.type}</span>
                    </td>
                    <td
                      className="mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: acc.total_debit > 0 ? '#1d4ed8' : 'var(--text-muted)',
                      }}
                    >
                      {acc.total_debit > 0 ? formatMoney(acc.total_debit) : '—'}
                    </td>
                    <td
                      className="mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: acc.total_credit > 0 ? '#15803d' : 'var(--text-muted)',
                      }}
                    >
                      {acc.total_credit > 0 ? formatMoney(acc.total_credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(24, 24, 27, 0.04)', fontWeight: 800 }}>
                  <td colSpan={3} style={{ padding: '16px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Total Organizational Sum
                  </td>
                  <td className="mono" style={{ textAlign: 'right', padding: '16px', fontSize: '1.125rem', color: '#1d4ed8' }}>
                    {formatMoney(totalDebits)}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', padding: '16px', fontSize: '1.125rem', color: '#15803d' }}>
                    {formatMoney(totalCredits)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

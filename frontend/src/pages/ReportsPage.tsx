import React, { useEffect, useState } from 'react';
import { RefreshCw, Scale, TrendingUp } from 'lucide-react';
import { api } from '../services/api.js';
import { BalanceSheetResponse, ProfitLossResponse } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonBlock } from '../components/ui/Skeleton.js';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'BS' | 'PL'>('BS');
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResponse | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLossResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [bs, pl] = await Promise.all([
        api.reports.balanceSheet(),
        api.reports.profitLoss(),
      ]);
      setBalanceSheet(bs);
      setProfitLoss(pl);
    } catch (err) {
      console.error('Failed to load financial reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Financial Statements
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Official accounting reports: Balance Sheet and Profit & Loss Statement
          </p>
        </div>
        <button onClick={fetchReports} className="btn btn-secondary">
          <RefreshCw size={16} />
          <span>Refresh Reports</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setActiveTab('BS')}
          className={`btn ${activeTab === 'BS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 18px' }}
        >
          <Scale size={16} />
          <span>Balance Sheet</span>
        </button>
        <button
          onClick={() => setActiveTab('PL')}
          className={`btn ${activeTab === 'PL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 18px' }}
        >
          <TrendingUp size={16} />
          <span>Profit & Loss (P&L)</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
          <SkeletonBlock height={280} />
          <SkeletonBlock height={280} />
        </div>
      ) : activeTab === 'BS' && balanceSheet ? (
        /* Balance Sheet Report */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Bar */}
          <div
            className="glass-panel"
            style={{
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderLeft: balanceSheet.is_balanced ? '4px solid #15803d' : '4px solid #b91c1c',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                Accounting Equation: Assets = Liabilities + Equity
              </span>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {balanceSheet.is_balanced ? '✓ Perfectly Balanced' : '⚠ Imbalance Detected'}
              </div>
            </div>
            <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {formatMoney(balanceSheet.assets.total)} = {formatMoney(balanceSheet.liabilities.total + balanceSheet.equity.total_equity_with_earnings)}
            </div>
          </div>

          {/* Balance Sheet Sections Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
            {/* Assets */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1d4ed8' }}>Assets</h2>
                <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>
                  {formatMoney(balanceSheet.assets.total)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {balanceSheet.assets.accounts.map((acc) => (
                  <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      <span className="mono" style={{ color: 'var(--text-muted)' }}>{acc.code}</span> {acc.name}
                    </span>
                    <span className="mono" style={{ fontWeight: 600 }}>{formatMoney(acc.balance)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Liabilities */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#b91c1c' }}>Liabilities</h2>
                  <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b91c1c' }}>
                    {formatMoney(balanceSheet.liabilities.total)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {balanceSheet.liabilities.accounts.map((acc) => (
                    <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span className="mono" style={{ color: 'var(--text-muted)' }}>{acc.code}</span> {acc.name}
                      </span>
                      <span className="mono" style={{ fontWeight: 600 }}>{formatMoney(acc.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equity */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#15803d' }}>Owner's Equity</h2>
                  <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                    {formatMoney(balanceSheet.equity.total_equity_with_earnings)}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {balanceSheet.equity.accounts.map((acc) => (
                    <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        <span className="mono" style={{ color: 'var(--text-muted)' }}>{acc.code}</span> {acc.name}
                      </span>
                      <span className="mono" style={{ fontWeight: 600 }}>{formatMoney(acc.balance)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
                    <span style={{ color: '#92400e', fontStyle: 'italic' }}>Current Year Earnings (Net Income)</span>
                    <span className="mono" style={{ fontWeight: 700, color: '#92400e' }}>
                      {formatMoney(balanceSheet.equity.current_year_earnings)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'PL' && profitLoss ? (
        /* Profit & Loss Report */
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Net Income Card */}
          <div
            className="glass-panel"
            style={{
              padding: '28px',
              textAlign: 'center',
              background: profitLoss.net_income >= 0
                ? 'linear-gradient(135deg, rgba(21, 128, 61, 0.12) 0%, rgba(255, 255, 255, 0.5) 100%)'
                : 'linear-gradient(135deg, rgba(185, 28, 28, 0.12) 0%, rgba(255, 255, 255, 0.5) 100%)',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Net Income (Profit / Loss)
            </div>
            <div className="mono" style={{ fontSize: '2.5rem', fontWeight: 900, marginTop: '8px', color: profitLoss.net_income >= 0 ? '#15803d' : '#b91c1c' }}>
              {formatMoney(profitLoss.net_income)}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Total Revenue ({formatMoney(profitLoss.revenue.total)}) − Total Expenses ({formatMoney(profitLoss.expenses.total)})
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#15803d' }}>Revenue</h2>
              <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                {formatMoney(profitLoss.revenue.total)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profitLoss.revenue.accounts.map((acc) => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <span className="mono" style={{ color: 'var(--text-muted)' }}>{acc.code}</span> {acc.name}
                  </span>
                  <span className="mono" style={{ fontWeight: 600 }}>{formatMoney(acc.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses Breakdown */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#b91c1c' }}>Expenses</h2>
              <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b91c1c' }}>
                {formatMoney(profitLoss.expenses.total)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {profitLoss.expenses.accounts.map((acc) => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <span className="mono" style={{ color: 'var(--text-muted)' }}>{acc.code}</span> {acc.name}
                  </span>
                  <span className="mono" style={{ fontWeight: 600 }}>{formatMoney(acc.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

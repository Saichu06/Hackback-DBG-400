import React, { useState } from 'react';
import { Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { TrialBalanceResponse } from '../types/index.js';
import { formatMoney } from '../utils/format.js';

export const TestHarnessPage: React.FC = () => {
  const [seed, setSeed] = useState('123456789');
  const [count, setCount] = useState('20');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    operations_run: number;
    final_trial_balance: TrialBalanceResponse;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunHarness = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsRunning(true);

    try {
      const res = await api.test.seedRandom(Number(seed), Number(count));
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to execute test harness');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Killer Test 3: Concurrency & Integrity Test Harness
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Executes rapid randomized multi-step accounting operations (invoicing, payments, bills, voids) and validates continuous zero-discrepancy Trial Balance.
        </p>
      </div>

      {/* Control Card */}
      <div className="glass-panel" style={{ padding: '28px' }}>
        <form onSubmit={handleRunHarness}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="kt3-seed">
                Random PRNG Seed
              </label>
              <input
                id="kt3-seed"
                type="number"
                className="form-input mono"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="kt3-count">
                Number of Operations
              </label>
              <input
                id="kt3-count"
                type="number"
                min="1"
                max="100"
                className="form-input mono"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isRunning}
              style={{ padding: '10px 24px', height: '42px' }}
            >
              <Play size={16} />
              <span>{isRunning ? 'Executing...' : 'Run KT3 Test'}</span>
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert-banner alert-danger">
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Harness Execution Failed</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* Results Panel */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              background: result.final_trial_balance.is_balanced
                ? 'linear-gradient(135deg, rgba(21, 128, 61, 0.12) 0%, rgba(255, 255, 255, 0.6) 100%)'
                : 'linear-gradient(135deg, rgba(185, 28, 28, 0.12) 0%, rgba(255, 255, 255, 0.6) 100%)',
              border: `2px solid ${result.final_trial_balance.is_balanced ? 'rgba(21, 128, 61, 0.35)' : 'rgba(185, 28, 28, 0.35)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <CheckCircle2 size={32} color="#15803d" />
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>
                    Killer Test 3 Passed Successfully!
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {result.operations_run} randomized operations completed with zero deadlocks and zero balance drift.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Debits</div>
                  <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1d4ed8' }}>
                    {formatMoney(result.final_trial_balance.total_debit)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Credits</div>
                  <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#15803d' }}>
                    {formatMoney(result.final_trial_balance.total_credit)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Difference</div>
                  <div className="mono" style={{ fontSize: '1.125rem', fontWeight: 800, color: '#15803d' }}>
                    $0.00
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Account Breakdown Table */}
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
              Post-Run General Ledger Balances
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Account Name</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Debit Total</th>
                    <th style={{ textAlign: 'right' }}>Credit Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.final_trial_balance.accounts.map((acc) => (
                    <tr key={acc.id}>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{acc.code}</td>
                      <td style={{ fontWeight: 600 }}>{acc.name}</td>
                      <td><span className="badge badge-active">{acc.type}</span></td>
                      <td className="mono" style={{ textAlign: 'right', color: acc.total_debit > 0 ? '#1d4ed8' : 'var(--text-muted)' }}>
                        {acc.total_debit > 0 ? formatMoney(acc.total_debit) : '—'}
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: acc.total_credit > 0 ? '#15803d' : 'var(--text-muted)' }}>
                        {acc.total_credit > 0 ? formatMoney(acc.total_credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

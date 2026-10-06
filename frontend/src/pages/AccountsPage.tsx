import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';
import { Account, AccountType } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.accounts.list();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const filteredAccounts = filterType === 'ALL'
    ? accounts
    : accounts.filter((a) => a.type === filterType);

  const accountTypes: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Chart of Accounts
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Hierarchical chart of accounts and real-time ledger balances
          </p>
        </div>
        <button onClick={fetchAccounts} className="btn btn-secondary">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterType('ALL')}
          className={`btn ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
        >
          All Accounts ({accounts.length})
        </button>
        {accountTypes.map((type) => {
          const count = accounts.filter((a) => a.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`btn ${filterType === type ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      {/* Accounts Table Card */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={7} cols={4} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Code</th>
                  <th>Account Name</th>
                  <th>Account Type</th>
                  <th style={{ textAlign: 'right' }}>Current Balance</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((account) => (
                  <tr key={account.id}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {account.code}
                    </td>
                    <td style={{ fontWeight: 600 }}>{account.name}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            account.type === 'Asset'
                              ? 'rgba(59, 130, 246, 0.15)'
                              : account.type === 'Liability'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : account.type === 'Revenue'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : account.type === 'Expense'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(168, 85, 247, 0.15)',
                          color:
                            account.type === 'Asset'
                              ? '#1d4ed8'
                              : account.type === 'Liability'
                              ? '#b91c1c'
                              : account.type === 'Revenue'
                              ? '#15803d'
                              : account.type === 'Expense'
                              ? '#92400e'
                              : '#7e22ce',
                        }}
                      >
                        {account.type}
                      </span>
                    </td>
                    <td
                      className="mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: '0.9375rem',
                        color: account.balance !== 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    >
                      {formatMoney(account.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

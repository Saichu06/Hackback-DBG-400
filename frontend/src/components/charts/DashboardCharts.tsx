import React from 'react';
import { Account, AccountType, InvoiceStatus } from '../../types/index.js';
import { formatMoney } from '../../utils/format.js';

// Colors are reused 1:1 from the existing badge/accent palette used elsewhere
// in the app (AccountsPage account-type badges, invoice status badges) so
// these charts read as part of the same system rather than inventing a new
// palette. Color never carries meaning alone — every segment also has a
// direct text label and a legend entry.
const ACCOUNT_TYPE_COLOR: Record<AccountType, string> = {
  Asset: '#1d4ed8',
  Liability: '#b91c1c',
  Equity: '#7e22ce',
  Revenue: '#15803d',
  Expense: '#b45309',
};

const ACCOUNT_TYPE_ORDER: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  Draft: '#6b7280',
  Delivered: '#1d4ed8',
  'Partially Paid': '#b45309',
  Paid: '#15803d',
  Voided: '#b91c1c',
};

const STATUS_ORDER: InvoiceStatus[] = ['Draft', 'Delivered', 'Partially Paid', 'Paid', 'Voided'];

/**
 * Horizontal bar chart: net balance per account type.
 * Sequential magnitude encoding per category, fixed categorical color per
 * type (matches Chart of Accounts page), baseline-anchored thin bars.
 */
export const AccountTypeBarChart: React.FC<{ accounts: Account[] }> = ({ accounts }) => {
  const totals = ACCOUNT_TYPE_ORDER.map((type) => ({
    type,
    total: accounts.filter((a) => a.type === type).reduce((sum, a) => sum + a.balance, 0),
  }));

  const maxAbs = Math.max(1, ...totals.map((t) => Math.abs(t.total)));

  return (
    <div>
      <div className="chart-card-title">Net Balance by Account Type</div>
      <div>
        {totals.map((t) => {
          const widthPct = (Math.abs(t.total) / maxAbs) * 100;
          const color = ACCOUNT_TYPE_COLOR[t.type];
          return (
            <div className="chart-bar-row" key={t.type} title={`${t.type}: ${formatMoney(t.total)}`}>
              <span className="chart-bar-label">{t.type}</span>
              <span className="chart-bar-track">
                <span
                  className="chart-bar-fill"
                  style={{
                    width: `${Math.max(widthPct, t.total === 0 ? 0 : 2)}%`,
                    background: color,
                  }}
                />
              </span>
              <span className="chart-bar-value" style={{ color }}>
                {formatMoney(t.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Donut chart: invoice count by lifecycle status. A legend with counts is
 * always rendered (identity never relies on color alone), and segments
 * ≥ 8% share get a direct percentage label.
 */
export const InvoiceStatusDonut: React.FC<{ statusCounts: Record<string, number> }> = ({
  statusCounts,
}) => {
  const segments = STATUS_ORDER.map((status) => ({
    status,
    count: statusCounts[status] || 0,
    color: STATUS_COLOR[status],
  })).filter((s) => s.count > 0);

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <div>
        <div className="chart-card-title">Invoice Status Breakdown</div>
        <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
          No invoices yet — create one to see the breakdown.
        </div>
      </div>
    );
  }

  const radius = 42;
  const strokeWidth = 16;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div>
      <div className="chart-card-title">Invoice Status Breakdown</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
          <g transform="rotate(-90 60 60)">
            {segments.map((seg) => {
              const fraction = seg.count / total;
              const dash = fraction * circumference;
              const gap = circumference - dash;
              const offset = cumulative;
              cumulative += dash;
              return (
                <circle
                  key={seg.status}
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${Math.max(dash - 2, 0)} ${gap + 2}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                >
                  <title>{`${seg.status}: ${seg.count} (${Math.round(fraction * 100)}%)`}</title>
                </circle>
              );
            })}
          </g>
          <text
            x="60"
            y="56"
            textAnchor="middle"
            fontSize="22"
            fontWeight="800"
            fill="#18181b"
          >
            {total}
          </text>
          <text x="60" y="74" textAnchor="middle" fontSize="9" fill="#8c8c86" letterSpacing="0.05em">
            INVOICES
          </text>
        </svg>

        <div className="chart-legend" style={{ marginTop: 0, flexDirection: 'column', gap: '8px' }}>
          {segments.map((seg) => (
            <div className="chart-legend-item" key={seg.status}>
              <span className="chart-legend-swatch" style={{ background: seg.color }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{seg.status}</span>
              <span>
                {seg.count} ({Math.round((seg.count / total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

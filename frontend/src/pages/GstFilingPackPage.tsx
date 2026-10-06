import React, { useEffect, useState } from 'react';
import { Download, Printer, CheckCircle2, XCircle, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../services/api.js';
import { GstFilingPack } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonBlock } from '../components/ui/Skeleton.js';

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatRupees(paise: number): string {
  return formatMoney(paise, '₹'); // ₹
}

function formatRatePercent(rateBp: number): string {
  return `${(rateBp / 100).toFixed(rateBp % 100 === 0 ? 0 : 2)}%`;
}

export const GstFilingPackPage: React.FC = () => {
  const [month, setMonth] = useState(currentMonthValue());
  const [pack, setPack] = useState<GstFilingPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchPack = async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.gst.get(m);
      setPack(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the GST Filing Pack');
      setPack(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPack(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await api.gst.downloadCsv(month);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download CSV');
    } finally {
      setDownloading(false);
    }
  };

  const isEmpty = pack && pack.by_rate.length === 0 && pack.by_hsn.length === 0;

  const rateTotal = pack
    ? pack.by_rate.reduce(
        (acc, r) => ({
          invoice_count: acc.invoice_count + r.invoice_count,
          taxable_paise: acc.taxable_paise + r.taxable_paise,
          cgst_paise: acc.cgst_paise + r.cgst_paise,
          sgst_paise: acc.sgst_paise + r.sgst_paise,
          igst_paise: acc.igst_paise + r.igst_paise,
          total_tax_paise: acc.total_tax_paise + r.total_tax_paise,
        }),
        { invoice_count: 0, taxable_paise: 0, cgst_paise: 0, sgst_paise: 0, igst_paise: 0, total_tax_paise: 0 }
      )
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="animate-fade-in-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            GST Filing Pack
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Monthly tax-by-rate and HSN summary, tied out against the ledger's GST payable accounts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="month"
            className="form-input mono"
            style={{ width: '170px' }}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Filing month"
          />
          <button onClick={() => window.print()} className="btn btn-secondary">
            <Printer size={16} />
            <span>Print</span>
          </button>
          <button onClick={handleDownload} className="btn btn-primary" disabled={downloading || !pack}>
            <Download size={16} />
            <span>{downloading ? 'Downloading...' : 'Download CSV'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert-banner alert-danger">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="skeleton-page">
          <SkeletonBlock height={90} />
          <SkeletonBlock height={220} />
          <SkeletonBlock height={160} />
        </div>
      ) : isEmpty ? (
        <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
          <FileSpreadsheet size={40} color="#6b7280" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No invoices this month</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
            No delivered or paid GST invoices were found for {month}. Totals are zero.
          </p>
        </div>
      ) : pack ? (
        <>
          {/* Block C summary banner up top for immediate trust signal */}
          <div
            className="glass-panel animate-fade-in-up"
            style={{
              padding: '20px 24px',
              display: 'flex',
              gap: '28px',
              flexWrap: 'wrap',
              borderLeft: `4px solid ${
                pack.tie_out.cgst.ok && pack.tie_out.sgst.ok && pack.tie_out.igst.ok ? '#15803d' : '#b91c1c'
              }`,
            }}
          >
            {(['cgst', 'sgst', 'igst'] as const).map((key) => {
              const entry = pack.tie_out[key];
              const gap = entry.report_paise - entry.ledger_paise;
              return (
                <div key={key} style={{ minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {entry.ok ? <CheckCircle2 size={16} color="#15803d" /> : <XCircle size={16} color="#b91c1c" />}
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {key.toUpperCase()} in report {formatRupees(entry.report_paise)} = {key.toUpperCase()} ledger movement {formatRupees(entry.ledger_paise)}
                    </span>
                  </div>
                  {!entry.ok && (
                    <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '4px' }}>
                      Gap: {formatRupees(gap)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Block A: Tax by Rate */}
          <div className="glass-panel card-interactive" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
              Block A — Tax by Rate
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>GST Rate</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Invoices</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.by_rate.map((r, idx) => (
                    <tr key={idx}>
                      <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{formatRatePercent(r.rate_bp)}</td>
                      <td>
                        <span className={`badge ${r.line_type === 'intra-state' ? 'badge-active' : 'badge-partial'}`}>
                          {r.line_type}
                        </span>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{r.invoice_count}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(r.taxable_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: '#1d4ed8' }}>{formatRupees(r.cgst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: '#15803d' }}>{formatRupees(r.sgst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: '#92400e' }}>{formatRupees(r.igst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatRupees(r.total_tax_paise)}</td>
                    </tr>
                  ))}
                </tbody>
                {rateTotal && (
                  <tfoot>
                    <tr style={{ background: 'rgba(24, 24, 27, 0.04)', fontWeight: 800 }}>
                      <td colSpan={2}>Total</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{rateTotal.invoice_count}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(rateTotal.taxable_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(rateTotal.cgst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(rateTotal.sgst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(rateTotal.igst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(rateTotal.total_tax_paise)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Block B: HSN Summary */}
          <div className="glass-panel card-interactive" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
              Block B — HSN Summary
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>HSN Code</th>
                    <th style={{ textAlign: 'right' }}>Lines</th>
                    <th style={{ textAlign: 'right' }}>Taxable Value</th>
                    <th style={{ textAlign: 'right' }}>CGST</th>
                    <th style={{ textAlign: 'right' }}>SGST</th>
                    <th style={{ textAlign: 'right' }}>IGST</th>
                    <th style={{ textAlign: 'right' }}>Total Tax</th>
                  </tr>
                </thead>
                <tbody>
                  {pack.by_hsn.map((h) => (
                    <tr key={h.hsn_code}>
                      <td className="mono" style={{ fontWeight: 700, color: h.hsn_code === '(missing HSN)' ? '#b91c1c' : 'var(--accent-primary)' }}>
                        {h.hsn_code}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{h.quantity}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(h.taxable_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: '#1d4ed8' }}>{formatRupees(h.cgst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: '#15803d' }}>{formatRupees(h.sgst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', color: '#92400e' }}>{formatRupees(h.igst_paise)}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{formatRupees(h.total_tax_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Block C: full tie-out table */}
          <div className="glass-panel card-interactive" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
              Block C — Ledger Tie-Out
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tax Type</th>
                    <th style={{ textAlign: 'right' }}>Report Total</th>
                    <th style={{ textAlign: 'right' }}>Ledger Movement</th>
                    <th style={{ textAlign: 'center' }}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {(['cgst', 'sgst', 'igst'] as const).map((key) => {
                    const entry = pack.tie_out[key];
                    return (
                      <tr key={key}>
                        <td style={{ fontWeight: 700 }}>{key.toUpperCase()} Payable</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(entry.report_paise)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{formatRupees(entry.ledger_paise)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {entry.ok ? (
                            <CheckCircle2 size={18} color="#15803d" />
                          ) : (
                            <XCircle size={18} color="#b91c1c" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Scale,
  CreditCard,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Contact, SalesInvoice } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonBlock, SkeletonText } from '../components/ui/Skeleton.js';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [customerName, setCustomerName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);

  const fetchInvoice = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [invList, contactList] = await Promise.all([
        api.invoices.list(),
        api.contacts.list(),
      ]);
      const found = invList.find((i) => i.id === Number(id));
      if (found) {
        setInvoice(found);
        const cust = contactList.find((c: Contact) => c.id === found.customer_id);
        setCustomerName(cust ? cust.name : `Customer #${found.customer_id}`);
      } else {
        setErrorMessage(`Invoice #${id} not found.`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load invoice details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const handleDeliver = async () => {
    if (!invoice) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setActionLoading(true);

    try {
      await api.invoices.deliver(invoice.id);
      setSuccessMessage('Invoice Delivered & Posted to Ledger! Double-entry transactions created successfully (Debit A/R, Credit Sales Revenue).');
      fetchInvoice();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to deliver invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!invoice) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setActionLoading(true);
    setShowVoidModal(false);

    try {
      await api.invoices.void(invoice.id);
      setSuccessMessage('Invoice Voided! Exact offsetting reversal ledger entries were generated. Net accounting effect is now zeroed.');
      fetchInvoice();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to void invoice');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="skeleton-page" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <SkeletonText width="160px" />
        <SkeletonBlock height={260} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#b91c1c' }}>Invoice not found</h2>
        <Link to="/invoices" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          Back to Invoices
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Back Button */}
      <Link to="/invoices" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <ArrowLeft size={16} />
        <span>Back to Invoices</span>
      </Link>

      {/* Notifications */}
      {successMessage && (
        <div className="alert-banner alert-success">
          <CheckCircle2 size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Action Successful</div>
            <div>{successMessage}</div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="alert-banner alert-danger">
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Operation Error</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Main Invoice Card */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        {/* Header with Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {invoice.invoice_no}
              </h1>
              <span className={`badge badge-${invoice.status.toLowerCase().replace(' ', '-')}`} style={{ fontSize: '0.875rem', padding: '6px 14px' }}>
                {invoice.status}
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
              Sales Invoice #{invoice.id} • Customer: <strong style={{ color: 'var(--text-primary)' }}>{customerName}</strong>
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Due Amount
            </div>
            <div className="mono" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              {formatMoney(invoice.total_amount)}
            </div>
          </div>
        </div>

        {/* Accounting Lifecycle Diagram */}
        <div style={{ margin: '28px 0', padding: '20px', background: 'rgba(24, 24, 27, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            Accounting Lifecycle & Ledger State
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {/* Stage 1: Draft */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: invoice.status === 'Draft' ? 'rgba(113, 113, 122, 0.12)' : 'rgba(24, 24, 27, 0.02)',
                border: invoice.status === 'Draft' ? '1px solid #6b7280' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: invoice.status === 'Draft' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                1. Draft Mode
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Invoice saved. 0 ledger lines written.
              </div>
            </div>

            {/* Stage 2: Delivered / Posted */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background:
                  invoice.status === 'Delivered' || invoice.status === 'Partially Paid' || invoice.status === 'Paid'
                    ? 'rgba(29, 78, 216, 0.08)'
                    : 'rgba(24, 24, 27, 0.02)',
                border:
                  invoice.status === 'Delivered' || invoice.status === 'Partially Paid' || invoice.status === 'Paid'
                    ? '1px solid #1d4ed8'
                    : '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color:
                    invoice.status === 'Delivered' || invoice.status === 'Partially Paid' || invoice.status === 'Paid'
                      ? '#1d4ed8'
                      : 'var(--text-muted)',
                }}
              >
                2. Delivered / Posted
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Debit: A/R (1100)<br />Credit: Sales (4000)
              </div>
            </div>

            {/* Stage 3: Voided / Reversal */}
            <div
              style={{
                padding: '14px',
                borderRadius: 'var(--radius-sm)',
                background: invoice.status === 'Voided' ? 'rgba(185, 28, 28, 0.1)' : 'rgba(24, 24, 27, 0.02)',
                border: invoice.status === 'Voided' ? '1px solid #b91c1c' : '1px solid var(--border-color)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: invoice.status === 'Voided' ? '#b91c1c' : 'var(--text-muted)' }}>
                3. Voided (Reversed)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Offsetting inverse entries generated. No SQL delete.
              </div>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Link to="/journal" className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
              <FileSpreadsheet size={16} />
              <span>Inspect in Journal</span>
            </Link>
            <Link to="/trial-balance" className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
              <Scale size={16} />
              <span>Verify Trial Balance</span>
            </Link>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {invoice.status === 'Draft' && (
              <button
                onClick={handleDeliver}
                className="btn btn-primary"
                disabled={actionLoading}
                style={{ padding: '10px 20px' }}
              >
                <Send size={16} />
                <span>{actionLoading ? 'Posting...' : 'Deliver & Post to Ledger'}</span>
              </button>
            )}

            {invoice.status === 'Delivered' && (
              <>
                <Link
                  to={`/payments?customer_id=${invoice.customer_id}&invoice_id=${invoice.id}`}
                  className="btn btn-success"
                  style={{ padding: '10px 18px' }}
                >
                  <CreditCard size={16} />
                  <span>Record Payment</span>
                </Link>
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="btn btn-danger"
                  disabled={actionLoading}
                  style={{ padding: '10px 18px' }}
                >
                  <Trash2 size={16} />
                  <span>Void Invoice</span>
                </button>
              </>
            )}

            {invoice.status === 'Voided' && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
                This invoice has been voided. All ledger entries are reversed and preserved for audit integrity.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Void */}
      {showVoidModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#b91c1c' }}>
                Confirm Semantic Void & Reversal
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9375rem', lineHeight: '1.6' }}>
                Are you sure you want to void invoice <strong className="mono">{invoice.invoice_no}</strong>?
              </p>
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(185, 28, 28, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(185, 28, 28, 0.2)', fontSize: '0.8125rem', color: '#b91c1c' }}>
                ✓ This operation will create exact offsetting reversal transactions in the General Ledger.<br />
                ✓ The invoice row will NOT be deleted from the database.<br />
                ✓ Net accounting balances will be returned to the pre-invoice state.
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowVoidModal(false)}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                className="btn btn-danger"
                disabled={actionLoading}
              >
                {actionLoading ? 'Voiding...' : 'Yes, Void & Post Reversal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

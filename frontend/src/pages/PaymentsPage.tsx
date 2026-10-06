import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CreditCard, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { Contact, SalesInvoice } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonBlock } from '../components/ui/Skeleton.js';

export const PaymentsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedCustId = searchParams.get('customer_id');
  const preselectedInvId = searchParams.get('invoice_id');

  const [customers, setCustomers] = useState<Contact[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>(preselectedCustId ? Number(preselectedCustId) : '');
  const [invoiceId, setInvoiceId] = useState<number | ''>(preselectedInvId ? Number(preselectedInvId) : '');
  const [paymentNo, setPaymentNo] = useState(`PAY-${Date.now().toString().slice(-6)}`);
  const [amountDollars, setAmountDollars] = useState('150.00');

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [alertWarning, setAlertWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [contactList, invList] = await Promise.all([
          api.contacts.list(),
          api.invoices.list(),
        ]);
        const custs = contactList.filter((c: Contact) => c.contact_type === 'Customer');
        setCustomers(custs);
        setInvoices(invList);

        if (!customerId && custs.length > 0) {
          setCustomerId(custs[0].id);
        }
      } catch (err) {
        console.error('Failed to load payment data', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filter invoices for selected customer that are Delivered or Partially Paid
  const eligibleInvoices = (invoices || []).filter(
    (inv) =>
      inv &&
      inv.customer_id === Number(customerId) &&
      (inv.status === 'Delivered' || inv.status === 'Partially Paid')
  );

  useEffect(() => {
    if (eligibleInvoices.length > 0 && !invoiceId) {
      setInvoiceId(eligibleInvoices[0].id);
      setAmountDollars((eligibleInvoices[0].total_amount / 100).toFixed(2));
    }
  }, [customerId, invoices]);

  const handleInvoiceChange = (id: number) => {
    setInvoiceId(id);
    const selected = eligibleInvoices.find((i) => i.id === id);
    if (selected) {
      setAmountDollars((selected.total_amount / 100).toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setAlertWarning(null);

    const parsedCents = Math.round(parseFloat(amountDollars) * 100);
    if (isNaN(parsedCents) || parsedCents <= 0) {
      setErrorMessage('Please enter a valid positive payment amount');
      return;
    }
    if (!customerId) {
      setErrorMessage('Please select a customer');
      return;
    }
    if (!invoiceId) {
      setErrorMessage('Please select an eligible invoice');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.payments.create({
        customer_id: Number(customerId),
        payment_receive_no: paymentNo.trim(),
        amount: parsedCents,
        entries: [
          {
            invoice_id: Number(invoiceId),
            amount_applied: parsedCents,
          },
        ],
      });

      setSuccessMessage(`Payment recorded and posted to ledger (Debit Bank, Credit Accounts Receivable)! Payment ID #${res.id}.`);

      // Inspect for Differentiator heuristic alerts (Gap 1)
      if (res.alert) {
        setAlertWarning(res.alert);
      }

      // Generate next payment number
      setPaymentNo(`PAY-${Date.now().toString().slice(-6)}`);

      // Refresh invoices
      try {
        const updatedInvoices = await api.invoices.list();
        setInvoices(updatedInvoices || []);
      } catch {
        // ignore
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Record Customer Payment
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Applies payment against delivered sales invoices and posts double-entry transaction to Bank (1000) & Accounts Receivable (1100).
        </p>
      </div>

      {/* Differentiator Warning Banner (Non-Blocking) */}
      {alertWarning && (
        <div className="alert-banner alert-warning" style={{ border: '2px solid rgba(245, 158, 11, 0.6)' }}>
          <AlertTriangle size={24} color="#b45309" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#92400e' }}>
              ⚠ Differentiator Advisory: Intelligent Payment Alert
            </div>
            <div style={{ marginTop: '2px', lineHeight: '1.5' }}>
              {alertWarning}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Note: The payment completed successfully. This advisory alert was generated to prevent accidental duplicate entries.
            </div>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="alert-banner alert-success">
          <CheckCircle2 size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Payment Processed</div>
            <div>{successMessage}</div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="alert-banner alert-danger">
          <AlertCircle size={20} />
          <div>
            <div style={{ fontWeight: 700 }}>Payment Error</div>
            <div>{errorMessage}</div>
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '30px' }}>
        {loading ? (
          <SkeletonBlock height={320} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="pay-customer">
                Customer *
              </label>
              <select
                id="pay-customer"
                className="form-select"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(Number(e.target.value));
                  setInvoiceId('');
                }}
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pay-invoice">
                Target Sales Invoice *
              </label>
              {eligibleInvoices.length === 0 ? (
                <div style={{ padding: '12px', background: 'rgba(24, 24, 27, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No delivered or unpaid invoices found for this customer. <Link to="/invoices/new" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Create one first</Link>.
                </div>
              ) : (
                <select
                  id="pay-invoice"
                  className="form-select mono"
                  value={invoiceId}
                  onChange={(e) => handleInvoiceChange(Number(e.target.value))}
                  required
                >
                  {eligibleInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_no} — Due: {formatMoney(inv.total_amount)} ({inv.status})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="pay-number">
                  Payment Receipt No *
                </label>
                <input
                  id="pay-number"
                  type="text"
                  className="form-input mono"
                  value={paymentNo}
                  onChange={(e) => setPaymentNo(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="pay-amount">
                  Payment Amount ($) *
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-input mono"
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  required
                />
              </div>
            </div>

            <div
              style={{
                marginTop: '16px',
                padding: '14px 18px',
                background: 'rgba(154, 106, 28, 0.08)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(154, 106, 28, 0.2)',
                fontSize: '0.8125rem',
                color: '#44403c',
              }}
            >
              <strong>Accounting Entries Generated:</strong><br />
              • <strong style={{ color: '#1d4ed8' }}>DEBIT</strong> Bank (1000) — +${amountDollars || '0.00'}<br />
              • <strong style={{ color: '#15803d' }}>CREDIT</strong> Accounts Receivable (1100) — -${amountDollars || '0.00'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting || eligibleInvoices.length === 0}
                style={{ padding: '10px 24px' }}
              >
                <CreditCard size={16} />
                <span>{isSubmitting ? 'Posting Payment...' : 'Record & Post Payment'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

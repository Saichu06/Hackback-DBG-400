import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api.js';
import { Contact } from '../types/index.js';

export const NewInvoicePage: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [lines, setLines] = useState<
    { description: string; amountDollars: string; taxRateBasisPoints: number; hsnCode: string }[]
  >([{ description: 'Consulting / Accounting Services', amountDollars: '150.00', taxRateBasisPoints: 0, hsnCode: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const contacts = await api.contacts.list();
        const custList = contacts.filter((c: Contact) => c.contact_type === 'Customer');
        setCustomers(custList);
        if (custList.length > 0) {
          setCustomerId(custList[0].id);
        }
      } catch (err) {
        console.error('Failed to load contacts', err);
      }
    };
    loadCustomers();
  }, []);

  const addLine = () => {
    setLines([...lines, { description: 'Item / Service', amountDollars: '50.00', taxRateBasisPoints: 0, hsnCode: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;
    setLines(updated);
  };

  // Calculate totals (taxable amount + tax per line, so the invoice total correctly
  // includes GST when a rate is selected — see deliverInvoice's totalRevenue = total - totalTax).
  let totalCents = 0;
  lines.forEach((l) => {
    const amt = Math.round(parseFloat(l.amountDollars || '0') * 100);
    const safeAmt = isNaN(amt) ? 0 : amt;
    const taxAmt = l.taxRateBasisPoints > 0 ? Math.round((safeAmt * l.taxRateBasisPoints) / 10000) : 0;
    totalCents += safeAmt + taxAmt;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select a customer');
      return;
    }
    if (!invoiceNo.trim()) {
      setError('Invoice number is required');
      return;
    }
    if (totalCents <= 0) {
      setError('Total amount must be greater than zero');
      return;
    }

    setIsSubmitting(true);
    try {
      const entries = lines.map((l) => {
        const amt = Math.round(parseFloat(l.amountDollars || '0') * 100);
        const taxRate = l.taxRateBasisPoints > 0 ? l.taxRateBasisPoints : null;
        const taxAmt = taxRate ? Math.round((amt * taxRate) / 10000) : 0;
        return {
          amount: amt,
          tax_rate: taxRate ?? undefined,
          tax_amount: taxAmt,
          hsn_code: l.hsnCode.trim() || undefined,
        };
      });

      const res = await api.invoices.create({
        customer_id: Number(customerId),
        invoice_no: invoiceNo.trim(),
        total_amount: totalCents,
        entries,
      });

      navigate(`/invoices/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create sales invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Back Link */}
      <Link to="/invoices" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <ArrowLeft size={16} />
        <span>Back to Invoices</span>
      </Link>

      <div className="glass-panel" style={{ padding: '30px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>New Sales Invoice</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Invoices are created in <span className="badge badge-draft">Draft</span> state. They will post double-entry ledger transactions when delivered.
          </p>
        </div>

        {error && (
          <div className="alert-banner alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="invoice-customer">
                Customer *
              </label>
              <select
                id="invoice-customer"
                className="form-select"
                value={customerId}
                onChange={(e) => setCustomerId(Number(e.target.value))}
                required
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (ID: #{c.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="invoice-no">
                Invoice Number *
              </label>
              <input
                id="invoice-no"
                type="text"
                className="form-input mono"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Line Items */}
          <div style={{ marginTop: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Line Items
              </span>
              <button type="button" onClick={addLine} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                <Plus size={14} />
                <span>Add Item</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                    gap: '10px',
                    alignItems: 'center',
                    background: 'rgba(24, 24, 27, 0.025)',
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(idx, 'description', e.target.value)}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input mono"
                    placeholder="Amount ($)"
                    value={line.amountDollars}
                    onChange={(e) => updateLine(idx, 'amountDollars', e.target.value)}
                  />
                  <select
                    className="form-select"
                    value={line.taxRateBasisPoints}
                    onChange={(e) => updateLine(idx, 'taxRateBasisPoints', Number(e.target.value))}
                  >
                    <option value={0}>0% (No Tax)</option>
                    <option value={500}>5% GST</option>
                    <option value={1200}>12% GST</option>
                    <option value={1800}>18% GST</option>
                    <option value={2800}>28% GST</option>
                  </select>
                  <input
                    type="text"
                    className="form-input mono"
                    placeholder="HSN code"
                    value={line.hsnCode}
                    onChange={(e) => updateLine(idx, 'hsnCode', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="btn btn-secondary"
                    style={{ padding: '8px', color: '#b91c1c' }}
                    disabled={lines.length === 1}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Total & Submit */}
          <div
            style={{
              padding: '16px 20px',
              background: 'rgba(24, 24, 27, 0.04)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '1rem', fontWeight: 600 }}>Total Invoice Amount:</span>
            <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
              ${(totalCents / 100).toFixed(2)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <Link to="/invoices" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Save size={16} />
              <span>{isSubmitting ? 'Creating Invoice...' : 'Save Draft Invoice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

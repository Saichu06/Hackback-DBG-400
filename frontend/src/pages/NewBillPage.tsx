import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { Contact } from '../types/index.js';

export const NewBillPage: React.FC = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Contact[]>([]);
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [billNumber, setBillNumber] = useState(`BILL-${Date.now().toString().slice(-6)}`);
  const [amountDollars, setAmountDollars] = useState('250.00');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const loadVendors = async () => {
      try {
        const contacts = await api.contacts.list();
        const vList = contacts.filter((c: Contact) => c.contact_type === 'Vendor');
        setVendors(vList);
        if (vList.length > 0) {
          setVendorId(vList[0].id);
        }
      } catch (err) {
        console.error('Failed to load contacts', err);
      }
    };
    loadVendors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedCents = Math.round(parseFloat(amountDollars) * 100);
    if (!vendorId) {
      setError('Please select a vendor');
      return;
    }
    if (!billNumber.trim()) {
      setError('Bill number is required');
      return;
    }
    if (isNaN(parsedCents) || parsedCents <= 0) {
      setError('Total amount must be a positive amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.bills.create({
        vendor_id: Number(vendorId),
        bill_number: billNumber.trim(),
        total_amount: parsedCents,
      });
      navigate('/bills');
    } catch (err: any) {
      setError(err.message || 'Failed to create vendor bill');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <Link to="/bills" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <ArrowLeft size={16} />
        <span>Back to Bills</span>
      </Link>

      <div className="glass-panel" style={{ padding: '30px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>New Vendor Purchase Bill</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Creates an open purchase bill and posts double-entry journal (Debit General Expenses 5000, Credit Accounts Payable 2000).
          </p>
        </div>

        {error && (
          <div className="alert-banner alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="bill-vendor">
              Vendor *
            </label>
            <select
              id="bill-vendor"
              className="form-select"
              value={vendorId}
              onChange={(e) => setVendorId(Number(e.target.value))}
              required
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} (ID: #{v.id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="bill-no">
                Bill Number *
              </label>
              <input
                id="bill-no"
                type="text"
                className="form-input mono"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="bill-amount">
                Total Amount ($) *
              </label>
              <input
                id="bill-amount"
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <Link to="/bills" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Save size={16} />
              <span>{isSubmitting ? 'Creating...' : 'Create & Post Bill'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

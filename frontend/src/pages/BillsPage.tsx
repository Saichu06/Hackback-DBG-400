import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, PlusCircle, RefreshCw, Trash2, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { Bill, Contact } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const BillsPage: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [paymentNumber, setPaymentNumber] = useState(`BPAY-${Date.now().toString().slice(-6)}`);
  const [payAmountDollars, setPayAmountDollars] = useState('');

  const fetchBills = async () => {
    try {
      setLoading(true);
      const [billData, contactData] = await Promise.all([
        api.bills.list(),
        api.contacts.list(),
      ]);
      setBills(billData);
      const vendorMap: Record<number, string> = {};
      contactData.forEach((c: Contact) => {
        vendorMap[c.id] = c.name;
      });
      setVendors(vendorMap);
    } catch (err) {
      console.error('Failed to load bills', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const handleVoid = async (billId: number) => {
    if (!confirm('Are you sure you want to void this vendor bill? This will generate offsetting reversal ledger entries.')) {
      return;
    }
    setErrorMessage(null);
    setSuccessMessage(null);
    setActionLoading(true);
    try {
      await api.bills.void(billId);
      setSuccessMessage('Bill voided and reversed successfully.');
      fetchBills();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to void bill');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPayModal = (bill: Bill) => {
    setPayingBill(bill);
    setPaymentNumber(`BPAY-${Date.now().toString().slice(-6)}`);
    setPayAmountDollars((bill.total_amount / 100).toFixed(2));
  };

  const handleRecordBillPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setActionLoading(true);

    const cents = Math.round(parseFloat(payAmountDollars) * 100);
    try {
      await api.bills.pay({
        vendor_id: payingBill.vendor_id,
        amount: cents,
        payment_number: paymentNumber.trim(),
        entries: [{ bill_id: payingBill.id, amount_applied: cents }],
      });
      setSuccessMessage('Bill payment recorded and posted to ledger (Debit AP, Credit Bank).');
      setPayingBill(null);
      fetchBills();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to pay bill');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Vendor Purchase Bills
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage supplier purchase bills, expenses, and bill payments
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchBills} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <Link to="/bills/new" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>New Bill</span>
          </Link>
        </div>
      </div>

      {successMessage && (
        <div className="alert-banner alert-success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert-banner alert-danger">
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={6} cols={6} />
        ) : bills.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Receipt size={40} color="#6b7280" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No bills recorded</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Create your first vendor bill to record business expenses.
            </p>
            <Link to="/bills/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
              <PlusCircle size={16} />
              <span>Create Bill</span>
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill Number</th>
                  <th>Vendor</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th>Status</th>
                  <th>Ledger State</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {bill.bill_number}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {vendors[bill.vendor_id] || `Vendor #${bill.vendor_id}`}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatMoney(bill.total_amount)}
                    </td>
                    <td>
                      <span className={`badge badge-${bill.status.toLowerCase().replace(' ', '-')}`}>
                        {bill.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {bill.status === 'Open' && 'Debit Expenses (5000), Credit AP (2000)'}
                      {bill.status === 'Paid' && 'Fully settled from Bank (1000)'}
                      {bill.status === 'Partially Paid' && 'Partially settled from Bank'}
                      {bill.status === 'Voided' && 'Offsetting reversal entries created'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {(bill.status === 'Open' || bill.status === 'Partially Paid') && (
                          <>
                            <button
                              onClick={() => handleOpenPayModal(bill)}
                              className="btn btn-success"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              <CreditCard size={14} />
                              <span>Pay</span>
                            </button>
                            {bill.status === 'Open' && (
                              <button
                                onClick={() => handleVoid(bill.id)}
                                className="btn btn-danger"
                                disabled={actionLoading}
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                <Trash2 size={14} />
                                <span>Void</span>
                              </button>
                            )}
                          </>
                        )}
                        {bill.status === 'Voided' && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reversed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pay Modal */}
      {payingBill && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>
                Pay Vendor Bill ({payingBill.bill_number})
              </h3>
            </div>
            <form onSubmit={handleRecordBillPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="bpay-number">
                    Payment Reference Number *
                  </label>
                  <input
                    id="bpay-number"
                    type="text"
                    className="form-input mono"
                    value={paymentNumber}
                    onChange={(e) => setPaymentNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bpay-amount">
                    Payment Amount ($) *
                  </label>
                  <input
                    id="bpay-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input mono"
                    value={payAmountDollars}
                    onChange={(e) => setPayAmountDollars(e.target.value)}
                    required
                  />
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Posts: <strong>DEBIT</strong> Accounts Payable (2000) & <strong>CREDIT</strong> Bank (1000).
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setPayingBill(null)}
                  className="btn btn-secondary"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm Bill Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

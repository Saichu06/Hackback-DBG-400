import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, PlusCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { api } from '../services/api.js';
import { Contact, SalesInvoice } from '../types/index.js';
import { formatMoney } from '../utils/format.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [contacts, setContacts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const [invData, contactData] = await Promise.all([
        api.invoices.list(),
        api.contacts.list(),
      ]);
      setInvoices(invData);
      const contactMap: Record<number, string> = {};
      contactData.forEach((c: Contact) => {
        contactMap[c.id] = c.name;
      });
      setContacts(contactMap);
    } catch (err) {
      console.error('Failed to load invoices', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Sales Invoices
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage sales invoicing, delivery to ledger, and semantic reversals
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchInvoices} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <Link to="/invoices/new" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={6} cols={6} />
        ) : invoices.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <FileText size={40} color="#6b7280" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No invoices found</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Create your first draft sales invoice to get started.
            </p>
            <Link to="/invoices/new" className="btn btn-primary" style={{ marginTop: '16px' }}>
              <PlusCircle size={16} />
              <span>Create Invoice</span>
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Customer</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th>Status</th>
                  <th>Ledger Impact</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                      {inv.invoice_no}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {contacts[inv.customer_id] || `Customer #${inv.customer_id}`}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {formatMoney(inv.total_amount)}
                    </td>
                    <td>
                      <span className={`badge badge-${inv.status.toLowerCase().replace(' ', '-')}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {inv.status === 'Draft' && 'None (Unposted draft)'}
                      {inv.status === 'Delivered' && 'Debit A/R, Credit Sales Revenue'}
                      {inv.status === 'Partially Paid' && 'Debit A/R & Partial Cash'}
                      {inv.status === 'Paid' && 'Fully settled to Bank'}
                      {inv.status === 'Voided' && 'Offsetting reversal entries created'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                      >
                        <span>View / Action</span>
                        <ArrowRight size={14} />
                      </Link>
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

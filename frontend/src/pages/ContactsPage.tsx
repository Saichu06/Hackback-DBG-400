import React, { useEffect, useState } from 'react';
import { UserCheck, Building2, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';
import { api, ApiError } from '../services/api.js';
import { Contact, ContactType } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const ContactsPage: React.FC = () => {
  const { isStaff } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'Customer' | 'Vendor'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ContactType>('Customer');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const data = await api.contacts.list();
      setContacts(data);
    } catch (err) {
      console.error('Failed to load contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newName.trim()) {
      setModalError('Name is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.contacts.create({ name: newName.trim(), contact_type: newType });
      setShowModal(false);
      setNewName('');
      setNewType('Customer');
      fetchContacts();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Failed to create contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredContacts = filterType === 'ALL'
    ? contacts
    : contacts.filter((c) => c.contact_type === filterType);

  const customerCount = contacts.filter((c) => c.contact_type === 'Customer').length;
  const vendorCount = contacts.filter((c) => c.contact_type === 'Vendor').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Contacts Directory
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Customers for sales invoicing and vendors for expense bills
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchContacts} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          {isStaff && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <PlusCircle size={16} />
              <span>New Contact</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setFilterType('ALL')}
          className={`btn ${filterType === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
        >
          All Contacts ({contacts.length})
        </button>
        <button
          onClick={() => setFilterType('Customer')}
          className={`btn ${filterType === 'Customer' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
        >
          Customers ({customerCount})
        </button>
        <button
          onClick={() => setFilterType('Vendor')}
          className={`btn ${filterType === 'Vendor' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
        >
          Vendors ({vendorCount})
        </button>
      </div>

      {/* Table Card */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={5} cols={4} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Contact Name</th>
                  <th>Contact Type</th>
                  <th>Role in Accounting</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => (
                  <tr key={contact.id}>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>#{contact.id}</td>
                    <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {contact.contact_type === 'Customer' ? (
                        <UserCheck size={16} color="#1d4ed8" />
                      ) : (
                        <Building2 size={16} color="#b45309" />
                      )}
                      <span>{contact.name}</span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: contact.contact_type === 'Customer' ? 'var(--info-bg)' : 'var(--warning-bg)',
                          color: contact.contact_type === 'Customer' ? '#1d4ed8' : '#92400e',
                        }}
                      >
                        {contact.contact_type}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {contact.contact_type === 'Customer'
                        ? 'Receives sales invoices & makes payments'
                        : 'Issues purchase bills & receives bill payments'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Contact Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>New Contact</h3>
            </div>
            <form onSubmit={handleCreateContact}>
              <div className="modal-body">
                {modalError && (
                  <div className="alert-banner alert-danger">
                    <AlertCircle size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-name">
                    Name *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    className="form-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Northwind Traders"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="contact-type">
                    Type *
                  </label>
                  <select
                    id="contact-type"
                    className="form-select"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ContactType)}
                  >
                    <option value="Customer">Customer (for sales invoices)</option>
                    <option value="Vendor">Vendor (for purchase bills)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

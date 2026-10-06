import React, { useEffect, useState } from 'react';
import { PlusCircle, RefreshCw, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { api } from '../services/api.js';
import { User, UserRole } from '../types/index.js';
import { formatDate } from '../utils/format.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Staff');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.users.list();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);

    try {
      await api.users.create({
        email: email.trim(),
        password,
        role,
      });
      setSuccessMessage(`User ${email} created successfully with role ${role}.`);
      setShowModal(false);
      setEmail('');
      setPassword('');
      fetchUsers();
    } catch (err: any) {
      setModalError(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            System User Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage staff, accountants, and administrators with role-based access control
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchUsers} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button onClick={() => setShowModal(true)} className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="alert-banner alert-success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={4} cols={5} />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>ID</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Privileges</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>#{u.id}</td>
                    <td style={{ fontWeight: 600 }}>{u.email}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            u.role === 'Admin'
                              ? 'rgba(154, 106, 28, 0.15)'
                              : u.role === 'Accountant'
                              ? 'rgba(21, 128, 61, 0.12)'
                              : 'rgba(29, 78, 216, 0.1)',
                          color:
                            u.role === 'Admin'
                              ? '#7c5614'
                              : u.role === 'Accountant'
                              ? '#15803d'
                              : '#1d4ed8',
                        }}
                      >
                        <Shield size={12} />
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                      {u.role === 'Admin' && 'Full System Access + User Management + Testing'}
                      {u.role === 'Accountant' && 'General Ledger + Journals + Financial Reports'}
                      {u.role === 'Staff' && 'Invoicing + Bills + Customer Payments'}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {formatDate(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Add System User</h3>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                {modalError && (
                  <div className="alert-banner alert-danger">
                    <AlertCircle size={18} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="user-email">
                    Email Address *
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="accountant@example.com"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-password">
                    Password *
                  </label>
                  <input
                    id="user-password"
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••••••"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-role">
                    Role *
                  </label>
                  <select
                    id="user-role"
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    required
                  >
                    <option value="Staff">Staff (Invoicing & Bills)</option>
                    <option value="Accountant">Accountant (Journals & Reports)</option>
                    <option value="Admin">Admin (Full Control)</option>
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

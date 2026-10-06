import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw, PlusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';
import { Account, JournalEntry } from '../types/index.js';
import { formatMoney, formatDate } from '../utils/format.js';
import { useAuth } from '../context/AuthContext.js';
import { SkeletonTableRows } from '../components/ui/Skeleton.js';

export const JournalPage: React.FC = () => {
  const { isAccountant } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual Journal modal state
  const [showModal, setShowModal] = useState(false);
  const [journalNumber, setJournalNumber] = useState(`MJ-${Date.now().toString().slice(-6)}`);
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [debitAccountId, setDebitAccountId] = useState<number | ''>('');
  const [creditAccountId, setCreditAccountId] = useState<number | ''>('');
  const [amountDollars, setAmountDollars] = useState('100.00');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchJournal = async () => {
    try {
      setLoading(true);
      const [jData, accData] = await Promise.all([
        api.reports.journal(),
        api.accounts.list(),
      ]);
      setEntries(jData);
      setAccounts(accData);
      if (accData.length >= 2) {
        setDebitAccountId(accData[0].id);
        setCreditAccountId(accData[1].id);
      }
    } catch (err) {
      console.error('Failed to load journal entries', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournal();
  }, []);

  const handleCreateManualJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    if (!debitAccountId || !creditAccountId) {
      setModalError('Please select both debit and credit accounts');
      return;
    }
    if (debitAccountId === creditAccountId) {
      setModalError('Debit and credit accounts must be different');
      return;
    }

    const cents = Math.round(parseFloat(amountDollars) * 100);
    if (isNaN(cents) || cents <= 0) {
      setModalError('Amount must be a positive number');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.manualJournals.create({
        journal_number: journalNumber.trim(),
        date: journalDate,
        notes,
        entries: [
          { account_id: Number(debitAccountId), debit: cents, credit: 0 },
          { account_id: Number(creditAccountId), debit: 0, credit: cents },
        ],
      });
      setModalSuccess('Manual journal entry created and balanced in the ledger!');
      setTimeout(() => {
        setShowModal(false);
        setModalSuccess(null);
        setJournalNumber(`MJ-${Date.now().toString().slice(-6)}`);
        fetchJournal();
      }, 1000);
    } catch (err: any) {
      setModalError(err.message || 'Failed to post manual journal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDebits = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredits = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            General Journal Sheet
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Complete auditable double-entry transaction record
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={fetchJournal} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          {isAccountant && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Manual Adjustment</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ flex: 1, padding: '16px 20px', minWidth: '200px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Journal Entries
          </div>
          <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>
            {entries.length} lines
          </div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: '16px 20px', minWidth: '200px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Cumulative Debits
          </div>
          <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8', marginTop: '4px' }}>
            {formatMoney(totalDebits)}
          </div>
        </div>
        <div className="glass-panel" style={{ flex: 1, padding: '16px 20px', minWidth: '200px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Cumulative Credits
          </div>
          <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '4px' }}>
            {formatMoney(totalCredits)}
          </div>
        </div>
      </div>

      {/* Journal Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <SkeletonTableRows rows={6} cols={4} />
        ) : entries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <FileSpreadsheet size={40} color="#6b7280" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>No Journal Entries</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '4px' }}>
              Deliver invoices or record manual adjustments to create double-entry transactions.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Date</th>
                  <th>Account</th>
                  <th style={{ textAlign: 'right', width: '160px' }}>Debit</th>
                  <th style={{ textAlign: 'right', width: '160px' }}>Credit</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={index}>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {formatDate(entry.date)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{entry.account}</td>
                    <td
                      className="mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: entry.debit > 0 ? '#1d4ed8' : 'var(--text-muted)',
                      }}
                    >
                      {entry.debit > 0 ? formatMoney(entry.debit) : '—'}
                    </td>
                    <td
                      className="mono"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: entry.credit > 0 ? '#15803d' : 'var(--text-muted)',
                      }}
                    >
                      {entry.credit > 0 ? formatMoney(entry.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Adjustment Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Post Manual Journal Adjustment</h3>
            </div>
            <form onSubmit={handleCreateManualJournal}>
              <div className="modal-body">
                {modalError && (
                  <div className="alert-banner alert-danger">
                    <AlertCircle size={18} />
                    <span>{modalError}</span>
                  </div>
                )}
                {modalSuccess && (
                  <div className="alert-banner alert-success">
                    <CheckCircle2 size={18} />
                    <span>{modalSuccess}</span>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mj-num">
                      Journal Number *
                    </label>
                    <input
                      id="mj-num"
                      type="text"
                      className="form-input mono"
                      value={journalNumber}
                      onChange={(e) => setJournalNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mj-date">
                      Date *
                    </label>
                    <input
                      id="mj-date"
                      type="date"
                      className="form-input"
                      value={journalDate}
                      onChange={(e) => setJournalDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="mj-debit">
                    Debit Account *
                  </label>
                  <select
                    id="mj-debit"
                    className="form-select"
                    value={debitAccountId}
                    onChange={(e) => setDebitAccountId(Number(e.target.value))}
                    required
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="mj-credit">
                    Credit Account *
                  </label>
                  <select
                    id="mj-credit"
                    className="form-select"
                    value={creditAccountId}
                    onChange={(e) => setCreditAccountId(Number(e.target.value))}
                    required
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="mj-amount">
                    Amount ($) *
                  </label>
                  <input
                    id="mj-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input mono"
                    value={amountDollars}
                    onChange={(e) => setAmountDollars(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="mj-notes">
                    Notes / Description
                  </label>
                  <textarea
                    id="mj-notes"
                    className="form-textarea"
                    rows={2}
                    placeholder="Reason for manual adjustment..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
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
                  {isSubmitting ? 'Posting...' : 'Post Balanced Journal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

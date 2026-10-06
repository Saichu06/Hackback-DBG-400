import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, CheckCircle2, AlertTriangle, ChevronDown, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Chart of Accounts',
  '/contacts': 'Contacts',
  '/invoices': 'Sales Invoices',
  '/invoices/new': 'New Invoice',
  '/payments': 'Payments',
  '/bills': 'Vendor Bills',
  '/bills/new': 'New Bill',
  '/journal': 'Journal Sheet',
  '/trial-balance': 'Trial Balance',
  '/reports': 'Financial Reports',
  '/gst-filing-pack': 'GST Filing Pack',
  '/users': 'User Management',
  '/test-harness': 'KT3 Test Harness',
};

function pageTitleFor(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (/^\/invoices\/\d+$/.test(pathname)) return 'Invoice Detail';
  return 'Ledger Core';
}

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isBalanced, setIsBalanced] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const tb = await api.reports.trialBalance();
        setIsBalanced(tb.is_balanced);
      } catch (err) {
        setIsBalanced(null);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="top-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
          {pageTitleFor(location.pathname)}
        </div>

        {isBalanced !== null && (
          <div
            className={`badge ${isBalanced ? 'badge-balanced' : 'badge-unbalanced'}`}
            style={{ padding: '6px 14px', fontSize: '0.75rem' }}
          >
            {isBalanced ? (
              <>
                <CheckCircle2 size={14} />
                <span>LEDGER BALANCED</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} />
                <span>OUT OF BALANCE</span>
              </>
            )}
          </div>
        )}
      </div>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button className="user-menu-trigger" onClick={() => setMenuOpen((v) => !v)}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(154, 106, 28, 0.15)', border: '1px solid rgba(154, 106, 28, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={16} color="#7c5614" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.8438rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.email}
            </span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
              {user?.role}
            </span>
          </div>
          <ChevronDown size={15} color="var(--text-muted)" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>

        {menuOpen && (
          <div className="user-menu-dropdown">
            <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>{user?.email}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Signed in as {user?.role}</div>
            </div>
            <button className="user-menu-item" onClick={logout}>
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  FileText,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  Scale,
  BarChart3,
  UserCog,
  FlaskConical,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const Sidebar: React.FC = () => {
  const { isAdmin, isAccountant, isStaff } = useAuth();

  // Matches the backend's role guards (see docs/API.md) exactly, so nobody sees
  // a nav item that just 403s when they click it — Accountant has no server
  // access to Contacts/Invoices/Payments/Bills, Staff has none to Journal/
  // Trial Balance/Reports/GST Filing Pack.
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Accounts', path: '/accounts', icon: BookOpen, show: true },
    { name: 'Contacts', path: '/contacts', icon: Users, show: isStaff },
    { name: 'Sales Invoices', path: '/invoices', icon: FileText, show: isStaff },
    { name: 'Payments', path: '/payments', icon: CreditCard, show: isStaff },
    { name: 'Bills', path: '/bills', icon: Receipt, show: isStaff },
    { name: 'Journal', path: '/journal', icon: FileSpreadsheet, show: isAccountant },
    { name: 'Trial Balance', path: '/trial-balance', icon: Scale, show: isAccountant },
    { name: 'Reports', path: '/reports', icon: BarChart3, show: isAccountant },
    { name: 'GST Filing Pack', path: '/gst-filing-pack', icon: Landmark, show: isAccountant },
  ].filter((item) => item.show);

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <Link
        to="/dashboard"
        className="brand-mark"
        style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}
      >
        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #9a6a1c, #7c5614)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px var(--accent-glow)', flexShrink: 0 }}>
          <Scale size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ledger Core
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Double-Entry
          </div>
        </div>
      </Link>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px 4px' }}>
          Menu
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) => `nav-link-v2 ${isActive ? 'active' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.name}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '16px 12px 4px' }}>
              Administration
            </div>
            <NavLink to="/users" className={({ isActive }) => `nav-link-v2 ${isActive ? 'active' : ''}`}>
              <UserCog size={18} />
              <span>Users</span>
            </NavLink>
            <NavLink to="/test-harness" className={({ isActive }) => `nav-link-v2 ${isActive ? 'active' : ''}`}>
              <FlaskConical size={18} />
              <span>KT3 Test Harness</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer tag */}
      <div
        style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.6875rem',
          color: 'var(--text-muted)',
        }}
      >
        <span className="live-pulse-dot" />
        <span>Ledger engine live · SQLite WAL</span>
      </div>
    </aside>
  );
};

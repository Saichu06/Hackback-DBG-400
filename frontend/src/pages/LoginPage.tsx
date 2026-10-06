import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Scale,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('securepassword123');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      {/* Visual side */}
      <div className="login-visual">
        <div className="login-visual-grid" />

        <Link
          to="/"
          style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 600 }}
        >
          <ArrowLeft size={15} />
          <span>Back to overview</span>
        </Link>

        <div style={{ position: 'relative', zIndex: 1 }} className="animate-fade-in-up">
          <div className="brand-mark" style={{ marginBottom: '28px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '11px',
                background: 'linear-gradient(135deg, #9a6a1c, #7c5614)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px var(--accent-glow)',
              }}
            >
              <Scale size={21} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Ledger Core</span>
          </div>

          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, maxWidth: '420px' }}>
            Double-entry accounting that proves itself.
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '14px', maxWidth: '400px', lineHeight: 1.6 }}>
            Every transaction is locked, validated, and balanced before it's committed —
            verified live by three automated killer tests.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="login-stat-card animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <CheckCircle2 size={16} color="#15803d" />
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Trial Balance</span>
            </div>
            <div className="mono" style={{ fontSize: '1.375rem', fontWeight: 800, color: '#15803d' }}>
              $0.00 discrepancy
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Across every account, every time.
            </div>
          </div>

          <div className="login-stat-card animate-fade-in-up" style={{ animationDelay: '0.18s', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShieldCheck size={22} color="#7c5614" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Role-guarded routes for <strong style={{ color: 'var(--text-primary)' }}>Admin</strong>,{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Accountant</strong> &{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Staff</strong>.
            </div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="login-form-side">
        <div className="glass-panel animate-scale-in" style={{ maxWidth: '420px', width: '100%', padding: '40px', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span className="landing-eyebrow" style={{ marginBottom: '14px', display: 'inline-flex' }}>
              <Sparkles size={13} />
              Welcome back
            </span>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '14px' }}>
              Sign in to your ledger
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Use the credentials issued by your Admin.
            </p>
          </div>

          {error && (
            <div className="alert-banner alert-danger" style={{ marginBottom: '20px' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={16}
                  color="#6b7280"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="login-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={16}
                  color="#6b7280"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '38px' }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '0.9375rem' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <span>Sign In to Ledger</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Default Demo: <span className="mono" style={{ color: '#475569' }}>admin@example.com</span> /{' '}
            <span className="mono" style={{ color: '#475569' }}>securepassword123</span>
          </div>
        </div>
      </div>
    </div>
  );
};

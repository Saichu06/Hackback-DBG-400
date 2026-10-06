import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale,
  ArrowRight,
  ShieldCheck,
  Lock,
  Hash,
  GitCommitHorizontal,
  UserCog,
  Sparkles,
  CheckCircle2,
  FileText,
  CreditCard,
  BookOpen,
  BarChart3,
  Users,
  Bot,
  AlertTriangle,
} from 'lucide-react';

/**
 * Lightweight scroll-reveal: any element with data-reveal gets `.is-visible`
 * once it enters the viewport. No external deps.
 */
function useScrollReveal() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  return rootRef;
}

const FEATURES = [
  {
    icon: Lock,
    color: '#9a6a1c',
    title: 'Pessimistic Row Locking',
    desc: 'Every balance mutation runs inside an immediate ACID transaction that acquires an exclusive write lock before updating — concurrent payments can never silently clobber each other.',
  },
  {
    icon: Hash,
    color: '#44403c',
    title: 'True Database Uniqueness',
    desc: 'Invoice numbers, bill numbers, payment references, journal numbers, and account codes are enforced with real schema-level UNIQUE constraints, not application-memory checks.',
  },
  {
    icon: GitCommitHorizontal,
    color: '#15803d',
    title: 'Integer-Cent Precision',
    desc: 'Every amount is stored and processed as an integer in cents — never floating point — eliminating rounding drift across millions of transactions.',
  },
  {
    icon: Scale,
    color: '#b45309',
    title: 'Debit = Credit, Always',
    desc: 'The ledger engine asserts sum(debits) === sum(credits) in memory before a single row is written. Imbalanced payloads are rejected with HTTP 400, zero rows persisted.',
  },
  {
    icon: UserCog,
    color: '#7e22ce',
    title: 'Strict Role Separation',
    desc: 'Admin, Accountant, and Staff each get explicit route-level guards — Staff can invoice and collect payment, only Accountants post manual journals, only Admins manage users.',
  },
  {
    icon: Bot,
    color: '#0e7490',
    title: 'AI Ledger Assistant',
    desc: 'A built-in Gemini-powered assistant answers "how do I..." questions scoped to exactly what the signed-in role is permitted to do — no generic chatbot filler.',
  },
];

const DIFFERENTIATORS = [
  {
    icon: AlertTriangle,
    title: 'Duplicate Payment Detection',
    desc: 'If an identical payment amount lands for the same customer within a 10-minute window, the system flags it with a non-blocking advisory — before it corrupts a receivable balance.',
  },
  {
    icon: AlertTriangle,
    title: 'Unusual Amount Heuristic',
    desc: "Once a customer has 3+ prior payments, any new payment at 5x or more their historical average triggers an alert — catching a stray extra zero before books close.",
  },
];

const ROLES = [
  {
    icon: UserCog,
    name: 'Admin',
    color: '#9a6a1c',
    bullets: [
      'Full system access, every module',
      'Create Accountant & Staff users',
      'Run the KT3 concurrency test harness',
    ],
  },
  {
    icon: BarChart3,
    name: 'Accountant',
    color: '#15803d',
    bullets: [
      'Journal Sheet, Trial Balance, P&L, Balance Sheet',
      'Post manual journal adjustments',
      'Cannot create invoices, bills, or users',
    ],
  },
  {
    icon: Users,
    name: 'Staff',
    color: '#1d4ed8',
    bullets: [
      'Create & deliver sales invoices',
      'Record customer payments & vendor bills',
      'No access to reports or manual journals',
    ],
  },
];

const STEPS = [
  { icon: ShieldCheck, title: 'Authenticate', desc: 'Sign in and receive a role-scoped JWT session.' },
  { icon: FileText, title: 'Create & Deliver', desc: 'Draft a sales invoice, then deliver it to post Debit A/R, Credit Revenue.' },
  { icon: CreditCard, title: 'Record Payment', desc: 'Apply a customer payment — posts Debit Bank, Credit A/R automatically.' },
  { icon: Scale, title: 'Verify Trial Balance', desc: 'Confirm total debits strictly equal total credits, every time.' },
];

const KILLER_TESTS = [
  {
    id: 'KT-1',
    name: 'Journal Balance Invariant',
    requirement: 'sum(debits) === sum(credits) or the transaction is rejected with HTTP 400.',
  },
  {
    id: 'KT-2',
    name: 'Invoice Reversal / Semantic Void',
    requirement: 'Voiding posts exact inverse entries, zeroes net balance, never deletes the row.',
  },
  {
    id: 'KT-3',
    name: 'Trial Balance & Concurrency',
    requirement: '20 simultaneous operations under seeded PRNG — ledger stays balanced to zero discrepancy.',
  },
];

export const LandingPage: React.FC = () => {
  const rootRef = useScrollReveal();

  return (
    <div className="landing-root" ref={rootRef}>
      <div className="landing-mesh" />

      {/* Nav */}
      <nav className="landing-nav">
        <div className="brand-mark">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #9a6a1c, #7c5614)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}
          >
            <Scale size={17} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>Ledger Core</span>
        </div>

        <div className="landing-nav-links">
          <a className="landing-nav-link" href="#features">Features</a>
          <a className="landing-nav-link" href="#how-it-works">How it Works</a>
          <a className="landing-nav-link" href="#roles">Roles</a>
          <a className="landing-nav-link" href="#proof">Proof</a>
        </div>

        <Link to="/login" className="btn btn-primary">
          <span>Sign In</span>
          <ArrowRight size={15} />
        </Link>
      </nav>

      {/* Hero */}
      <header className="landing-section" style={{ paddingTop: '110px', paddingBottom: '60px' }}>
        <div data-reveal>
          <span className="landing-eyebrow">
            <Sparkles size={13} />
            GST-Ready Double-Entry Ledger
          </span>
          <h1 className="landing-h1">
            Accounting infrastructure<br />that never goes out of balance.
          </h1>
          <p className="landing-lede">
            A rebuilt double-entry ledger engine with pessimistic row locking, real database
            constraints, and an AI assistant for every role — designed so that debits strictly
            equal credits, every single time, even under concurrent load.
          </p>
          <div className="landing-cta-row">
            <Link to="/login" className="btn btn-primary btn-lg">
              <span>Enter Dashboard</span>
              <ArrowRight size={17} />
            </Link>
            <a href="#proof" className="btn btn-secondary btn-lg">
              <span>See the Killer Tests</span>
            </a>
          </div>

          <div className="landing-trust-row">
            <div>
              <strong>0¢</strong>
              Floating-point drift
            </div>
            <div>
              <strong>3 / 3</strong>
              Killer tests passing
            </div>
            <div>
              <strong>20</strong>
              Concurrent ops, zero clobbers
            </div>
            <div>
              <strong>100%</strong>
              Role-guarded routes
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="landing-section" id="features">
        <div className="landing-section-head" data-reveal>
          <span className="landing-eyebrow">What makes this different</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '16px', letterSpacing: '-0.02em' }}>
            Built to fix the gaps that corrupt real books
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
            Six engineering guarantees, verified by an automated test suite — not marketing claims.
          </p>
        </div>

        <div className="landing-feature-grid">
          {FEATURES.map((f, i) => (
            <div className="landing-feature-card stagger-item" key={f.title} data-reveal style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="landing-feature-icon" style={{ background: `${f.color}1f` }}>
                <f.icon size={22} color={f.color} />
              </div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '8px' }}>{f.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Differentiators */}
      <section className="landing-section" style={{ paddingTop: '20px' }}>
        <div className="landing-section-head" data-reveal>
          <span className="landing-eyebrow">Our differentiator</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '16px', letterSpacing: '-0.02em' }}>
            Catches mistakes before reconciliation does
          </h2>
        </div>
        <div className="landing-feature-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          {DIFFERENTIATORS.map((d, i) => (
            <div className="landing-feature-card stagger-item" key={d.title} data-reveal style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="landing-feature-icon" style={{ background: 'rgba(180, 83, 9, 0.14)' }}>
                <d.icon size={22} color="#b45309" />
              </div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '8px' }}>{d.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{d.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section" id="how-it-works">
        <div className="landing-section-head" data-reveal>
          <span className="landing-eyebrow">Core flow</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '16px', letterSpacing: '-0.02em' }}>
            From invoice to verified balance
          </h2>
        </div>
        <div className="landing-step-row">
          {STEPS.map((s, i) => (
            <div className="landing-step stagger-item" key={s.title} data-reveal style={{ animationDelay: `${i * 0.07}s` }}>
              <div className="landing-step-num">{i + 1}</div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <s.icon size={16} color="#7c5614" />
                {s.title}
              </h3>
              <p style={{ fontSize: '0.8438rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="landing-section" id="roles">
        <div className="landing-section-head" data-reveal>
          <span className="landing-eyebrow">One app, three clearances</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '16px', letterSpacing: '-0.02em' }}>
            Permissions that match the org chart
          </h2>
        </div>
        <div className="landing-role-grid">
          {ROLES.map((r, i) => (
            <div className="landing-role-card stagger-item" key={r.name} data-reveal style={{ animationDelay: `${i * 0.07}s` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${r.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <r.icon size={19} color={r.color} />
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>{r.name}</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {r.bullets.map((b) => (
                  <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8438rem', color: 'var(--text-secondary)' }}>
                    <CheckCircle2 size={15} color={r.color} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Proof: Killer Tests */}
      <section className="landing-section" id="proof">
        <div className="landing-section-head" data-reveal>
          <span className="landing-eyebrow">Verified, not promised</span>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '16px', letterSpacing: '-0.02em' }}>
            The three killer tests
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>
            Every one of these is a live automated test in the codebase, re-run on every change.
          </p>
        </div>

        <div className="glass-panel" data-reveal style={{ padding: '8px 24px', overflowX: 'auto' }}>
          <table className="landing-proof-table">
            <thead>
              <tr>
                <th style={{ width: '70px' }}>ID</th>
                <th>Test</th>
                <th>Core Requirement</th>
                <th style={{ width: '100px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {KILLER_TESTS.map((t) => (
                <tr key={t.id}>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{t.id}</td>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.requirement}</td>
                  <td>
                    <span className="badge badge-balanced">
                      <CheckCircle2 size={13} />
                      PASS
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-final-cta" data-reveal>
        <BookOpen size={36} color="#9a6a1c" style={{ marginBottom: '18px' }} />
        <h2 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '14px' }}>
          Ready to see it balance?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '28px' }}>
          Sign in with the seeded admin account and explore the full ledger.
        </p>
        <Link to="/login" className="btn btn-primary btn-lg">
          <span>Enter Dashboard</span>
          <ArrowRight size={17} />
        </Link>
      </section>

      <footer className="landing-footer">
        <div className="brand-mark">
          <Scale size={15} />
          <span style={{ fontWeight: 700 }}>Ledger Core</span>
        </div>
        <span>Double-entry accounting engine · SQLite + Express + React · AI assistant by Gemini</span>
      </footer>
    </div>
  );
};

import React from 'react';

export const SkeletonText: React.FC<{ width?: string | number }> = ({ width = '100%' }) => (
  <div className="skeleton skeleton-text" style={{ width }} />
);

export const SkeletonBlock: React.FC<{ height?: string | number }> = ({ height = 80 }) => (
  <div className="skeleton skeleton-block" style={{ height }} />
);

/** Renders N fake table rows with `cols` skeleton bars each — used while a data-table is loading. */
export const SkeletonTableRows: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div>
    {Array.from({ length: rows }).map((_, r) => (
      <div className="skeleton-row" key={r}>
        {Array.from({ length: cols }).map((_, c) => (
          <div className="skeleton" style={{ height: 14, flex: c === 0 ? 0.6 : 1 }} key={c} />
        ))}
      </div>
    ))}
  </div>
);

/** A grid of KPI-card-shaped skeletons — used for dashboard-style stat rows. */
export const SkeletonCardGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div className="glass-panel" style={{ padding: '20px' }} key={i}>
        <SkeletonText width="60%" />
        <div style={{ height: 10 }} />
        <SkeletonBlock height={36} />
      </div>
    ))}
  </div>
);

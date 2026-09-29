/** Small building blocks reused across the pages. */
import { ReactNode } from 'react';
import { prettyLabel } from '../types';

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1>{children}</h1>
      {action}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rise mb-4 rounded-xl px-4 py-3 text-[15px]"
      style={{ background: 'var(--tint-red-bg)', color: 'var(--red)' }}
      role="alert"
    >
      {message}
    </div>
  );
}

export function SuccessMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="rise mb-4 rounded-xl px-4 py-3 text-[15px]"
      style={{ background: 'var(--tint-green-bg)', color: 'var(--green)' }}
      role="status"
    >
      {message}
    </div>
  );
}

export function Loading() {
  return (
    <p className="t-sub py-12 text-center" role="status">
      Loading...
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card t-sub px-6 py-12 text-center">{children}</div>;
}

/** A coloured pill showing a report's or claim's status. */
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { background: string; color: string }> = {
    ACTIVE: { background: 'var(--tint-blue-bg)', color: 'var(--blue)' },
    OPEN: { background: 'var(--tint-blue-bg)', color: 'var(--blue)' },
    RESOLVED: { background: 'var(--tint-green-bg)', color: 'var(--green)' },
    APPROVED: { background: 'var(--tint-green-bg)', color: 'var(--green)' },
    PENDING: { background: 'var(--tint-amber-bg)', color: 'var(--amber)' },
    REJECTED: { background: 'var(--tint-red-bg)', color: 'var(--red)' },
    CLOSED: { background: 'var(--fill)', color: 'var(--label-2)' },
  };
  return (
    <span className="badge" style={styles[status] ?? styles.CLOSED}>
      {prettyLabel(status)}
    </span>
  );
}

/**
 * One line in a grouped list, the way iOS Settings shows details:
 * label on the left, value on the right, hairlines in between.
 */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="list-row">
      <span style={{ color: 'var(--label-2)' }}>{label}</span>
      <span className="text-right" style={{ fontWeight: 510 }}>
        {value}
      </span>
    </div>
  );
}

/** Dates are stored as dates only, so they are formatted without a time. */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Brand is null when the user chose "Unknown". */
export function formatBrand(brand: string | null): string {
  return brand ?? 'Unknown';
}

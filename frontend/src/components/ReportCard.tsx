/** The tile used in the browse list and in "my found items" (REQ-56). */
import { Link } from 'react-router-dom';
import { FoundReport, prettyLabel } from '../types';
import { formatBrand, formatDate, StatusBadge } from './ui';

export function FoundReportCard({ report, to }: { report: FoundReport; to: string }) {
  return (
    <Link to={to} className="card tappable block overflow-hidden">
      {report.photoUrl ? (
        <img
          src={report.photoUrl}
          alt={report.itemName}
          className="aspect-[4/3] w-full object-cover"
          style={{ background: 'var(--fill)' }}
          loading="lazy"
        />
      ) : (
        <div
          className="t-caption flex aspect-[4/3] w-full items-center justify-center"
          style={{ background: 'var(--fill)' }}
        >
          No photo
        </div>
      )}

      <div className="p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <h3 className="leading-tight">{report.itemName}</h3>
          {report.status !== 'OPEN' && <StatusBadge status={report.status} />}
        </div>

        {/* REQ-56: category, colour, brand, date found and location name. */}
        <p className="t-foot">
          {prettyLabel(report.category)} &middot; {prettyLabel(report.colour)} &middot;{' '}
          {formatBrand(report.brand)}
        </p>
        <p className="t-foot mt-0.5 truncate">
          {formatDate(report.dateFound)} &middot; {report.locationName}
        </p>
      </div>
    </Link>
  );
}

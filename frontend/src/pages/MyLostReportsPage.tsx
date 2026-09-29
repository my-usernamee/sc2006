/** The user's own lost item reports (SRS 4.2). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { lostApi } from '../api';
import { RowSkeletonList, StaggerItem, StaggerList } from '../components/motion';
import {
  EmptyState,
  ErrorMessage,
  formatBrand,
  formatDate,
  PageTitle,
  StatusBadge,
} from '../components/ui';
import { LostReport, prettyLabel } from '../types';

export function MyLostReportsPage() {
  const [reports, setReports] = useState<LostReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lostApi
      .mine()
      .then(setReports)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <RowSkeletonList />;

  return (
    <div>
      <PageTitle
        action={
          <Link to="/lost/new" className="btn-primary btn-sm">
            Report lost item
          </Link>
        }
      >
        My lost items
      </PageTitle>

      <ErrorMessage message={error} />

      {reports.length === 0 ? (
        <EmptyState>You have not reported any lost items yet.</EmptyState>
      ) : (
        <StaggerList className="space-y-3">
          {reports.map((report) => (
            <StaggerItem key={report.id}>
            <Link to={`/lost/${report.id}`} className="card tappable block p-4">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <h3>{report.itemName}</h3>
                <StatusBadge status={report.status} />
              </div>
              <p className="t-foot">
                {prettyLabel(report.category)} &middot; {prettyLabel(report.colour)} &middot;{' '}
                {formatBrand(report.brand)}
              </p>
              <p className="t-foot mt-0.5">
                {formatDate(report.dateLost)} &middot; {report.locationName}
              </p>
              <p className="t-caption mt-2">
                Notifies from a match score of {report.notificationThreshold}
              </p>
            </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}

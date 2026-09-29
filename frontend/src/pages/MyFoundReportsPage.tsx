/** The user's own found item reports (SRS 4.3). */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { foundApi } from '../api';
import { CardSkeletonGrid, StaggerItem, StaggerList } from '../components/motion';
import { FoundReportCard } from '../components/ReportCard';
import { EmptyState, ErrorMessage, PageTitle } from '../components/ui';
import { FoundReport } from '../types';

export function MyFoundReportsPage() {
  const [reports, setReports] = useState<FoundReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    foundApi
      .mine()
      .then(setReports)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <CardSkeletonGrid count={4} />;

  return (
    <div>
      <PageTitle
        action={
          <Link to="/found/new" className="btn-primary btn-sm">
            Report found item
          </Link>
        }
      >
        My found items
      </PageTitle>

      <ErrorMessage message={error} />

      {reports.length === 0 ? (
        <EmptyState>You have not reported any found items yet.</EmptyState>
      ) : (
        <StaggerList className="grid grid-cols-2 gap-3">
          {reports.map((report) => (
            <StaggerItem key={report.id}>
              <FoundReportCard report={report} to={`/found/${report.id}`} />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}

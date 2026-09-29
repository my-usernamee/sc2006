/**
 * One lost item report: its details, its possible matches (REQ-53), and the
 * edit and delete actions (REQ-24, REQ-25).
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { lostApi } from '../api';
import { FoundReportCard } from '../components/ReportCard';
import {
  ErrorMessage,
  formatBrand,
  formatDate,
  Loading,
  PageTitle,
  Row,
  StatusBadge,
} from '../components/ui';
import { LostReport, MatchEntry, prettyLabel } from '../types';

export function LostReportDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState<LostReport | null>(null);
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([lostApi.get(id), lostApi.matches(id)])
      .then(([r, m]) => {
        setReport(r);
        setMatches(m);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm('Delete this lost item report? This cannot be undone.')) return;
    try {
      await lostApi.remove(id);
      navigate('/lost');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <Loading />;
  if (!report) return <ErrorMessage message={error ?? 'Report not found.'} />;

  const isActive = report.status === 'ACTIVE';

  return (
    <div>
      <PageTitle action={<StatusBadge status={report.status} />}>{report.itemName}</PageTitle>
      <ErrorMessage message={error} />

      {report.photoUrl && (
        <img
          src={report.photoUrl}
          alt={report.itemName}
          className="card mb-5 max-h-72 w-full object-cover"
        />
      )}

      <div className="list mb-5">
        <Row label="Category" value={prettyLabel(report.category)} />
        <Row label="Colour" value={prettyLabel(report.colour)} />
        <Row label="Brand" value={formatBrand(report.brand)} />
        <Row label="Date lost" value={formatDate(report.dateLost)} />
        <Row label="Location" value={report.locationName} />
        <Row label="Notify from" value={String(report.notificationThreshold)} />
      </div>

      {/* Only the owner ever sees this, which is why it may be shown here. */}
      {report.privateDescription && (
        <div className="card mb-5 p-4">
          <p className="t-caption mb-1 font-semibold uppercase tracking-[0.05em]">
            Private description
          </p>
          <p className="t-body">{report.privateDescription}</p>
        </div>
      )}

      {/* REQ-24 / REQ-25: editing and deleting are only offered while Active.
          The backend also refuses if an ownership claim is pending (REQ-63). */}
      {isActive && (
        <div className="mb-6 flex gap-3">
          <Link to={`/lost/${report.id}/edit`} className="btn-secondary flex-1">
            Edit
          </Link>
          <button onClick={handleDelete} className="btn-danger flex-1">
            Delete
          </button>
        </div>
      )}

      {/* REQ-53: found items whose match score reached this report's threshold. */}
      <h2 className="mb-3 text-lg font-semibold">Possible matches</h2>
      {matches.length === 0 ? (
        <p className="text-sm text-[var(--label-2)]">
          No found items have reached your match score of {report.notificationThreshold} yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {matches.map((match) => (
            <div key={match.foundReport.id}>
              <FoundReportCard
                report={match.foundReport}
                to={`/browse/${match.foundReport.id}`}
              />
              <p className="mt-1 text-center text-xs font-medium text-[var(--blue)]">
                Match score {match.matchScore}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


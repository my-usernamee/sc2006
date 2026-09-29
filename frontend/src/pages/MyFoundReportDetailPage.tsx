/** One of the user's own found reports, with edit and delete (REQ-39, REQ-40). */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { foundApi } from '../api';
import {
  ErrorMessage,
  formatBrand,
  formatDate,
  Loading,
  PageTitle,
  Row,
  StatusBadge,
} from '../components/ui';
import { FoundReport, prettyLabel } from '../types';

export function MyFoundReportDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<FoundReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    foundApi
      .get(id)
      .then(setReport)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm('Delete this found item report? This cannot be undone.')) return;
    try {
      await foundApi.remove(id);
      navigate('/found');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (loading) return <Loading />;
  if (!report) return <ErrorMessage message={error ?? 'Report not found.'} />;

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
        <Row label="Date found" value={formatDate(report.dateFound)} />
        <Row label="Location" value={report.locationName} />
      </div>

      {report.privateDescription && (
        <div className="card mb-5 p-4">
          <p className="t-caption mb-1 font-semibold uppercase tracking-[0.05em]">
            Private description
          </p>
          <p className="t-body">{report.privateDescription}</p>
        </div>
      )}

      {/* REQ-39 / REQ-40: only while the report is still Open. */}
      {report.status === 'OPEN' && (
        <div className="flex gap-3">
          <Link to={`/found/${report.id}/edit`} className="btn-secondary flex-1">
            Edit
          </Link>
          <button onClick={handleDelete} className="btn-danger flex-1">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}


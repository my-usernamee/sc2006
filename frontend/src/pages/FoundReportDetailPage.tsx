/**
 * One found item, with the button that starts an ownership claim.
 * REQ-60 / REQ-61: to claim, the user picks one of their own Active lost reports.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { claimApi, foundApi, lostApi } from '../api';
import {
  ErrorMessage,
  formatBrand,
  formatDate,
  Loading,
  PageTitle,
  Row,
  StatusBadge,
} from '../components/ui';
import { FoundReport, LostReport, prettyLabel } from '../types';

export function FoundReportDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState<FoundReport | null>(null);
  const [myLostReports, setMyLostReports] = useState<LostReport[]>([]);
  const [selectedLostId, setSelectedLostId] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([foundApi.get(id), lostApi.mine()])
      .then(([foundReport, lostReports]) => {
        setReport(foundReport);
        // REQ-61: only Active reports may be attached to a claim.
        setMyLostReports(lostReports.filter((r) => r.status === 'ACTIVE'));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleClaim() {
    setError(null);
    setClaiming(true);
    try {
      const claim = await claimApi.submit({
        foundReportId: id,
        lostReportId: selectedLostId,
      });
      navigate(`/claims/${claim.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setClaiming(false);
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
          className="card mb-5 max-h-80 w-full object-cover"
        />
      )}

      {/* REQ-56: the details shown for a found report. */}
      <div className="list mb-5">
        <Row label="Category" value={prettyLabel(report.category)} />
        <Row label="Colour" value={prettyLabel(report.colour)} />
        <Row label="Brand" value={formatBrand(report.brand)} />
        <Row label="Date found" value={formatDate(report.dateFound)} />
        <Row label="Location" value={report.locationName} />
        {report.finderDisplayName && <Row label="Found by" value={report.finderDisplayName} />}
      </div>

      {/*
        REQ-59: the finder's Telegram username and the private description are
        deliberately absent here - the backend never sends them to this screen.
      */}

      {report.status === 'OPEN' ? (
        <div className="card p-4">
          <h2 className="mb-1 font-medium">Is this yours?</h2>
          <p className="mb-3 text-sm text-[var(--label-2)]">
            Choose the lost item report this matches. The finder will review your claim.
          </p>

          {myLostReports.length === 0 ? (
            <p className="text-sm text-[var(--label-2)]">
              You need an active lost item report before you can make a claim.
            </p>
          ) : (
            <div className="space-y-3">
              <select
                className="input"
                value={selectedLostId}
                onChange={(e) => setSelectedLostId(e.target.value)}
              >
                <option value="">Select one of your lost item reports</option>
                {myLostReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.itemName} - lost {formatDate(r.dateLost)}
                  </option>
                ))}
              </select>

              <button
                className="btn-primary w-full"
                disabled={!selectedLostId || claiming}
                onClick={handleClaim}
              >
                {claiming ? 'Submitting...' : 'Claim this item'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4 text-sm text-[var(--label-2)]">
          This item has already been returned to its owner.
        </div>
      )}
    </div>
  );
}


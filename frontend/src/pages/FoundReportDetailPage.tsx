/**
 * One found item, with the button that starts an ownership claim.
 * REQ-60 / REQ-61: to claim, the user picks one of their own Active lost reports.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { claimApi, foundApi, lostApi } from "../api";
import {
  ErrorMessage,
  formatBrand,
  formatDate,
  Loading,
  PageTitle,
  Row,
  StatusBadge,
} from "../components/ui";
import { FoundReport, LostReport, prettyLabel } from "../types";

export function FoundReportDetailPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const lostId = params.get("lost"),
    matchId = params.get("match");
  const [matchContext, setMatchContext] = useState<{
    matchScore: number;
    lostItemName: string;
    available: boolean;
  } | null>(null);
  const navigate = useNavigate();

  const [report, setReport] = useState<FoundReport | null>(null);
  const [myLostReports, setMyLostReports] = useState<LostReport[]>([]);
  const [selectedLostId, setSelectedLostId] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedLostId("");
    const matchRequest =
      lostId && matchId
        ? lostApi.match(lostId, matchId)
        : Promise.resolve(null);
    Promise.all([
      matchRequest.then((m) =>
        m
          ? {
              ...m.foundReport,
              canClaim: m.available && m.foundReport.canClaim,
            }
          : foundApi.get(id),
      ),
      lostApi.mine(),
      matchRequest,
    ])
      .then(([foundReport, lostReports, match]) => {
        if (!active) return;
        if (match && match.foundReport.id !== id)
          throw new Error("This match belongs to a different report.");
        setMatchContext(match);
        if (match?.available && lostId) setSelectedLostId(lostId);
        setReport(foundReport);
        setMyLostReports(
          lostReports.filter((r) => r.status === "ACTIVE" && !r.locked),
        );
      })
      .catch((e) => {
        if (active) {
          setReport(null);
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, lostId, matchId]);

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
  if (!report) return <ErrorMessage message={error ?? "Report not found."} />;

  return (
    <div>
      <PageTitle action={<StatusBadge status={report.status} />}>
        {report.itemName}
      </PageTitle>
      <ErrorMessage message={error} />

      {matchContext && (
        <div className="card mb-4 p-4">
          <strong>Match Score: {matchContext.matchScore}</strong>
          <p>Compared with your lost report: {matchContext.lostItemName}</p>
          {!matchContext.available && (
            <p>
              This is a historical match. The reports are no longer eligible for
              a claim.
            </p>
          )}
        </div>
      )}
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
        {report.finderDisplayName && (
          <Row label="Found by" value={report.finderDisplayName} />
        )}
      </div>

      {/*
        REQ-59: the finder's Telegram username and the private description are
        deliberately absent here - the backend never sends them to this screen.
      */}

      {report.canClaim && (!matchContext || matchContext.available) ? (
        <div className="card p-4">
          <h2 className="mb-1 font-medium">Is this yours?</h2>
          <p className="mb-3 text-sm text-[var(--label-2)]">
            Choose the lost item report this matches. The finder will review
            your claim.
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
                {claiming ? "Submitting..." : "Claim this item"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4 text-sm text-[var(--label-2)]">
          {report.isOwner
            ? "This is your found report. Manage it from the Found tab."
            : report.locked
              ? "This report is currently linked to a Pending claim."
              : "This item is no longer available to claim."}
        </div>
      )}
    </div>
  );
}

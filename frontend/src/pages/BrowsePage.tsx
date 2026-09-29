/** Browse, search and filter Open found reports (SRS 4.5, REQ-55 to REQ-59). */
import { useEffect, useState } from 'react';
import { foundApi } from '../api';
import { CardSkeletonGrid, StaggerItem, StaggerList } from '../components/motion';
import { FoundReportCard } from '../components/ReportCard';
import { EmptyState, ErrorMessage, PageTitle } from '../components/ui';
import { CATEGORIES, COLOURS, FoundReport, prettyLabel } from '../types';

export function BrowsePage() {
  const [reports, setReports] = useState<FoundReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // REQ-57 and REQ-58: the search term and the two filters.
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [colour, setColour] = useState('');

  // Re-fetch whenever a filter changes. The short delay stops a request going
  // out on every single keystroke.
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      foundApi
        .browse({ q, category, colour, page })
        .then((data) => {
          setReports(data.reports);
          setTotal(data.total);
          setError(null);
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [q, category, colour, page]);

  // Changing a filter should take the user back to the first page.
  useEffect(() => setPage(1), [q, category, colour]);

  const pageCount = Math.ceil(total / 12);

  return (
    <div>
      <PageTitle>Found items</PageTitle>

      <div className="mb-5 space-y-3">
        {/* REQ-57: search by item name */}
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search found items"
        />

        {/* REQ-58: filter by category and colour */}
        <div className="grid grid-cols-2 gap-3">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {prettyLabel(c)}
              </option>
            ))}
          </select>

          <select className="input" value={colour} onChange={(e) => setColour(e.target.value)}>
            <option value="">All colours</option>
            {COLOURS.map((c) => (
              <option key={c} value={c}>
                {prettyLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <CardSkeletonGrid />
      ) : reports.length === 0 ? (
        <EmptyState>No found items match what you are looking for.</EmptyState>
      ) : (
        <>
          {/* The `key` restarts the stagger whenever the filters change, so
              new results animate in rather than silently swapping. */}
          <StaggerList
            key={`${q}|${category}|${colour}|${page}`}
            className="grid grid-cols-2 gap-3"
          >
            {reports.map((report) => (
              <StaggerItem key={report.id}>
                <FoundReportCard report={report} to={`/browse/${report.id}`} />
              </StaggerItem>
            ))}
          </StaggerList>

          {pageCount > 1 && (
            <div className="mt-5 flex items-center justify-center gap-3 text-sm">
              <button
                className="btn-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span className="t-foot">
                Page {page} of {pageCount}
              </span>
              <button
                className="btn-secondary btn-sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The claims inbox, in two tabs:
 *   "To review"  - claims other people made on items I found (I am the Finder)
 *   "My claims"  - claims I made on items other people found
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { claimApi } from '../api';
import { RowSkeletonList, SPRING, StaggerItem, StaggerList } from '../components/motion';
import {
  EmptyState,
  ErrorMessage,
  formatDate,
  Loading,
  PageTitle,
  StatusBadge,
} from '../components/ui';
import { Claim } from '../types';

export function ClaimsPage() {
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const load = tab === 'incoming' ? claimApi.incoming() : claimApi.outgoing();
    load
      .then(setClaims)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div>
      <PageTitle>Ownership claims</PageTitle>

      {/* A segmented control, the standard iOS way to switch between two
          views of the same kind of thing. */}
      <div className="segmented mb-5">
        <TabButton active={tab === 'incoming'} onClick={() => setTab('incoming')}>
          To review
        </TabButton>
        <TabButton active={tab === 'outgoing'} onClick={() => setTab('outgoing')}>
          My claims
        </TabButton>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <RowSkeletonList />
      ) : claims.length === 0 ? (
        <EmptyState>
          {tab === 'incoming'
            ? 'Nobody has claimed any of your found items yet.'
            : 'You have not claimed any items yet.'}
        </EmptyState>
      ) : (
        <StaggerList className="space-y-3">
          {claims.map((claim) => (
            <StaggerItem key={claim.id}>
            <Link to={`/claims/${claim.id}`} className="card tappable block p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3>{claim.foundReport.itemName}</h3>
                <StatusBadge status={claim.status} />
              </div>
              <p className="t-foot">
                {tab === 'incoming'
                  ? `Claimed by ${claim.claimant.displayName}`
                  : `Found by ${claim.finder.displayName}`}{' '}
                &middot; {formatDate(claim.createdAt)}
              </p>
            </Link>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="segment relative"
      style={{ color: active ? 'var(--label)' : 'var(--label-2)' }}
    >
      {/* The white pill slides between the two segments instead of blinking
          from one to the other. */}
      {active && (
        <motion.span
          layoutId="segment-pill"
          className="segment-active absolute inset-0 rounded-lg"
          transition={SPRING}
        />
      )}
      <span className="relative">{children}</span>
    </button>
  );
}

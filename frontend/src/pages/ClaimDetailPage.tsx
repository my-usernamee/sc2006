/**
 * The claim review screen (SRS 4.6).
 *
 * What is visible here depends entirely on what the backend chose to send:
 *   - REQ-66: the private descriptions appear only for the Finder
 *   - REQ-70: the Telegram usernames appear only once the claim is approved
 * The frontend simply shows a section when the field is present.
 */
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { claimApi } from '../api';
import { EASE_OUT, SPRING } from '../components/motion';
import {
  ErrorMessage,
  formatBrand,
  formatDate,
  Loading,
  PageTitle,
  StatusBadge,
} from '../components/ui';
import { Claim, prettyLabel } from '../types';

export function ClaimDetailPage() {
  const { id = '' } = useParams();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    claimApi
      .get(id)
      .then(setClaim)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  async function decide(approve: boolean) {
    const question = approve
      ? 'Approve this claim? Your Telegram usernames will be shared with each other and both reports will be closed.'
      : 'Reject this claim?';
    if (!confirm(question)) return;

    setBusy(true);
    setError(null);
    try {
      setClaim(approve ? await claimApi.approve(id) : await claimApi.reject(id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!claim) return <ErrorMessage message={error ?? 'Claim not found.'} />;

  // If the backend sent us the private descriptions, we are the Finder (REQ-66).
  const isFinder = claim.foundReport.privateDescription !== undefined;
  const isPending = claim.status === 'PENDING';

  return (
    <div>
      <PageTitle action={<StatusBadge status={claim.status} />}>Ownership claim</PageTitle>
      <ErrorMessage message={error} />

      {/* REQ-65: the Finder can see the lost item report attached to the claim. */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <ItemPanel
          heading="Lost item"
          subheading={`Reported by ${claim.claimant.displayName}`}
          photoUrl={claim.lostReport.photoUrl}
          itemName={claim.lostReport.itemName}
          category={claim.lostReport.category}
          colour={claim.lostReport.colour}
          brand={claim.lostReport.brand}
          dateLabel="Lost"
          date={claim.lostReport.dateLost}
          locationName={claim.lostReport.locationName}
          privateDescription={claim.lostReport.privateDescription}
        />
        <ItemPanel
          heading="Found item"
          subheading={`Reported by ${claim.finder.displayName}`}
          photoUrl={claim.foundReport.photoUrl}
          itemName={claim.foundReport.itemName}
          category={claim.foundReport.category}
          colour={claim.foundReport.colour}
          brand={claim.foundReport.brand}
          dateLabel="Found"
          date={claim.foundReport.dateFound}
          locationName={claim.foundReport.locationName}
          privateDescription={claim.foundReport.privateDescription}
        />
      </div>

      {/* REQ-67: only the Finder decides, and only while the claim is Pending. */}
      {isFinder && isPending && (
        <motion.div
          className="card mb-5 p-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
        >
          <h2 className="mb-1">Do the two descriptions match?</h2>
          <p className="t-sub mb-4">
            Approving shares your Telegram usernames with each other and closes both reports.
          </p>
          <div className="flex gap-3">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>
              Approve
            </button>
            <button className="btn-danger flex-1" disabled={busy} onClick={() => decide(false)}>
              Reject
            </button>
          </div>
        </motion.div>
      )}

      {!isFinder && isPending && (
        <div className="card t-sub mb-5 p-4">
          Waiting for {claim.finder.displayName} to review your claim.
        </div>
      )}

      {/* REQ-70: contact details, shown only after approval. */}
      {claim.status === 'APPROVED' && (
        <motion.div
          className="card overflow-hidden"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
        >
          <div
            className="flex items-center gap-3.5 p-4"
            style={{ background: 'var(--tint-green-bg)' }}
          >
            <AnimatedTick />
            <div>
              <h2 style={{ color: 'var(--green)' }}>Claim approved</h2>
              <p className="t-sub mt-0.5">
                Message each other on Telegram to arrange the handover.
              </p>
            </div>
          </div>
          <div className="list-row">
            <span style={{ color: 'var(--label-2)' }}>{claim.claimant.displayName} (owner)</span>
            <span style={{ fontWeight: 590 }}>{claim.claimant.telegramUsername}</span>
          </div>
          <div className="list-row">
            <span style={{ color: 'var(--label-2)' }}>{claim.finder.displayName} (finder)</span>
            <span style={{ fontWeight: 590 }}>{claim.finder.telegramUsername}</span>
          </div>
        </motion.div>
      )}

      {/* REQ-68: after a rejection both reports simply become editable again. */}
      {claim.status === 'REJECTED' && (
        <div className="card t-sub p-4">
          This claim was rejected. Both reports are active again.
        </div>
      )}
    </div>
  );
}

function ItemPanel(props: {
  heading: string;
  subheading: string;
  photoUrl: string | null;
  itemName: string;
  category: string;
  colour: string;
  brand: string | null;
  dateLabel: string;
  date: string;
  locationName: string;
  privateDescription?: string | null;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--separator)' }}>
        <h3>{props.heading}</h3>
        <p className="t-caption mt-0.5">{props.subheading}</p>
      </div>

      {props.photoUrl && (
        <img
          src={props.photoUrl}
          alt={props.itemName}
          className="h-40 w-full object-cover"
          style={{ background: 'var(--fill)' }}
        />
      )}

      <div className="p-4">
        <p className="text-[15px]" style={{ fontWeight: 590 }}>{props.itemName}</p>
        <p className="t-foot mt-1">
          {prettyLabel(props.category)} &middot; {prettyLabel(props.colour)} &middot;{' '}
          {formatBrand(props.brand)}
        </p>
        <p className="t-foot mt-0.5">
          {props.dateLabel} {formatDate(props.date)} &middot; {props.locationName}
        </p>

        {/* REQ-66: present only when the viewer is the Finder. */}
        {props.privateDescription !== undefined && (
          <div className="mt-3.5 rounded-xl p-3" style={{ background: 'var(--tint-amber-bg)' }}>
            <p
              className="t-caption mb-1 font-semibold uppercase tracking-[0.05em]"
              style={{ color: 'var(--amber)' }}
            >
              Private description
            </p>
            <p className="text-[15px]">{props.privateDescription || 'Not provided.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A tick that draws itself.
 *
 * `pathLength` animates the SVG stroke from nothing to the full line, so the
 * tick is drawn rather than faded in. The circle scales up first and the tick
 * follows, which reads as "done" more strongly than either alone.
 */
function AnimatedTick() {
  return (
    <motion.svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ ...SPRING, delay: 0.05 }}
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="17" cy="17" r="17" fill="var(--green)" />
      <motion.path
        d="M10.5 17.5l4.5 4.5 8.5-9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.34, ease: EASE_OUT, delay: 0.16 }}
      />
    </motion.svg>
  );
}

/**
 * The in-app notification list (REQ-51, REQ-53, REQ-64, REQ-71).
 * There is no push service - opening this page is how a user finds out.
 * Tapping a notification marks it read and opens the thing it refers to.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import { RowSkeletonList, StaggerItem, StaggerList } from '../components/motion';
import { EmptyState, ErrorMessage, PageTitle } from '../components/ui';
import { NotificationItem } from '../types';

/** The wording for each kind of notification. */
function describe(item: NotificationItem): string {
  const name = item.itemName ?? 'an item';
  switch (item.type) {
    case 'MATCH_FOUND':
      return `Possible match: "${name}" scored ${item.matchScore}`;
    case 'CLAIM_SUBMITTED':
      return `Someone has claimed your found item "${name}"`;
    case 'CLAIM_APPROVED':
      return `Your claim for "${name}" was approved`;
    case 'CLAIM_REJECTED':
      return `Your claim for "${name}" was rejected`;
  }
}

/** Where tapping the notification should take the user. */
function destinationOf(item: NotificationItem): string {
  if (item.type === 'MATCH_FOUND') return `/browse/${item.foundReportId}`;
  return `/claims/${item.claimId}`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notificationApi
      .list()
      .then(setItems)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function open(item: NotificationItem) {
    if (!item.read) {
      await notificationApi.markRead(item.id).catch(() => undefined);
    }
    navigate(destinationOf(item));
  }

  if (loading) return <RowSkeletonList />;

  return (
    <div>
      <PageTitle>Notifications</PageTitle>
      <ErrorMessage message={error} />

      {items.length === 0 ? (
        <EmptyState>You have no notifications yet.</EmptyState>
      ) : (
        <StaggerList className="space-y-2">
          {items.map((item) => (
            <StaggerItem key={item.id}>
            <button
              onClick={() => open(item)}
              className="card tappable flex w-full items-start gap-3 p-4 text-left"
            >
              {/* An unread notification gets a blue dot, the way Mail marks
                  unread messages. */}
              <span
                className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: item.read ? 'transparent' : 'var(--blue)' }}
                aria-label={item.read ? undefined : 'Unread'}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug" style={{ fontWeight: 510 }}>
                  {describe(item)}
                </span>
                <span className="t-caption mt-1 block">
                  {new Date(item.createdAt).toLocaleString('en-SG')}
                </span>
              </span>
            </button>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}

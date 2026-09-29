/**
 * The shell around every logged-in page.
 *
 * The header and the tab bar are translucent layers that page content scrolls
 * underneath, rather than solid strips. That is why the page has padding at
 * the top and bottom: the content passes behind the glass instead of stopping
 * at it.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { notificationApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { EASE_OUT, SPRING } from './motion';

/** Tabs are named after what is inside them, not vague words like "Home". */
const TABS = [
  { to: '/browse', label: 'Browse', icon: 'search' },
  { to: '/lost', label: 'Lost', icon: 'tag' },
  { to: '/found', label: 'Found', icon: 'hand' },
  { to: '/claims', label: 'Claims', icon: 'check' },
  { to: '/notifications', label: 'Alerts', icon: 'bell' },
] as const;

/** Simple line icons, drawn inline so there is no icon library to install. */
function TabIcon({ name }: { name: (typeof TABS)[number]['icon'] }) {
  const paths: Record<string, string> = {
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4-4',
    tag: 'M4 11.5V5a1 1 0 0 1 1-1h6.5a1 1 0 0 1 .7.3l7.5 7.5a1 1 0 0 1 0 1.4l-6.5 6.5a1 1 0 0 1-1.4 0L4.3 12.2a1 1 0 0 1-.3-.7ZM8 8h.01',
    hand: 'M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6.5a1.5 1.5 0 0 1 3 0V15a5 5 0 0 1-5 5h-1a6 6 0 0 1-6-6v-2.5a1.5 1.5 0 0 1 3 0V13',
    check: 'M9 12.5l2.2 2.2L15.5 10M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z',
    bell: 'M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9ZM10 18a2 2 0 0 0 4 0',
  };
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  // Refresh the unread badge whenever the user moves to another page.
  useEffect(() => {
    notificationApi
      .unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => setUnread(0));
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="chrome sticky top-0 z-[500]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            to="/browse"
            className="text-[19px] font-bold tracking-[-0.02em]"
            style={{ color: 'var(--label)' }}
          >
            FoundIt
          </Link>

          <div className="flex items-center gap-4 text-[15px]">
            <Link to="/account" style={{ color: 'var(--blue)' }}>
              {user?.displayName}
            </Link>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              style={{ color: 'var(--label-2)' }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* The bottom padding keeps the last element clear of the tab bar.

          Only the page content inside <main> is swapped on navigation. The
          header and the tab bar stay mounted, which is why the tab indicator
          can slide between tabs instead of restarting each time.

          `mode="wait"` lets the outgoing page finish leaving before the new
          one arrives, so the two never overlap. The exit is shorter than the
          entrance, because a slow exit feels like the app is holding you up. */}
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="chrome fixed inset-x-0 bottom-0 z-[500]">
        <div
          className="mx-auto flex max-w-2xl"
          style={{ borderTop: '1px solid var(--separator)' }}
        >
          {TABS.map((tab) => {
            const active = location.pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className="tappable relative flex flex-1 flex-col items-center gap-1 pb-2.5 pt-2"
                style={{ color: active ? 'var(--blue)' : 'var(--label-2)' }}
                aria-current={active ? 'page' : undefined}
              >
                {/* A single dot moves between tabs rather than one fading out
                    and another fading in. `layoutId` is what makes Framer
                    Motion treat them as the same element and animate the
                    travel between the two positions. */}
                {active && (
                  <motion.span
                    layoutId="tab-indicator"
                    className="absolute inset-x-3 top-0 h-[3px] rounded-b-full"
                    style={{ background: 'var(--blue)' }}
                    transition={SPRING}
                  />
                )}

                <span className="relative">
                  <motion.span
                    className="block"
                    animate={{ scale: active ? 1.06 : 1 }}
                    transition={SPRING}
                  >
                    <TabIcon name={tab.icon} />
                  </motion.span>

                  {tab.to === '/notifications' && unread > 0 && (
                    <motion.span
                      // The badge pops in, because a number appearing out of
                      // nowhere is easy to miss.
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={SPRING}
                      className="absolute -right-2 -top-1 rounded-full px-1.5 text-[11px] font-semibold text-white"
                      style={{ background: 'var(--red)', minWidth: 17 }}
                    >
                      {unread}
                    </motion.span>
                  )}
                </span>
                <span className="text-[10px] font-medium tracking-[0.01em]">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

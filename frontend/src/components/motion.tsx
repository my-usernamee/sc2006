/**
 * The app's animation vocabulary, defined once.
 *
 * Every animated thing in FoundIt uses one of the pieces below, so the timing
 * stays consistent and there is only one file to look at to understand the
 * motion. Two rules from the guidance shape all of it:
 *
 *   1. Only `transform` and `opacity` are animated. Both are handled by the
 *      GPU, so the animation stays at 60fps. Animating width, height or top
 *      forces the browser to re-layout on every frame.
 *   2. Things leave faster than they arrive (about 75% of the enter time).
 *      A slow exit feels like the interface is holding you up.
 */
import { motion, Variants } from 'framer-motion';
import { ReactNode } from 'react';

/** The easing curve used for entrances: fast at first, then a gentle settle. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** A soft spring for anything that should feel physical rather than timed. */
export const SPRING = { type: 'spring' as const, stiffness: 420, damping: 34 };

/* -------------------------------------------------------------------------
   Page transitions
   ------------------------------------------------------------------------- */

/**
 * Wraps a page so it fades and lifts in when it becomes visible, and fades
 * out slightly faster when the user navigates away.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.26, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------
   Staggered lists
   ------------------------------------------------------------------------- */

/**
 * Put `staggerContainer` on the list and `staggerItem` on each child, and the
 * items arrive one shortly after another instead of all at once. The delay is
 * deliberately small - 40ms - because a long stagger makes a list feel slow
 * to load rather than lively.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: EASE_OUT },
  },
};

/** Convenience wrappers so pages do not repeat the variant names. */
export function StaggerList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------
   Loading skeletons
   ------------------------------------------------------------------------- */

/**
 * A grey block in the shape of the content that is coming.
 *
 * This replaces a "Loading..." message. Because the placeholder is the same
 * shape and position as the real content, nothing jumps when the data lands,
 * and the wait feels shorter than a spinner does.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** The placeholder shown while the browse grid loads. */
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The placeholder shown while a list of rows loads. */
export function RowSkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card space-y-2.5 p-4">
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-3 w-full rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Unread-notifications badge state (Zustand).
 *
 * `NotificationBell` owns the server truth (it refetches on navigation and
 * every 60s while the tab is visible); the list decrements optimistically so
 * the badge reacts the instant a notification is opened or all are read.
 */

import { create } from 'zustand';

interface NotificationBadgeState {
  /** `null` while the first count is still loading. */
  unread: number | null;
  setUnread: (count: number | null) => void;
  decrementUnread: () => void;
}

export const useNotificationBadge = create<NotificationBadgeState>((set) => ({
  unread: null,
  setUnread: (unread) => set({ unread }),
  decrementUnread: () =>
    set((state) => ({
      unread: state.unread === null ? null : Math.max(0, state.unread - 1),
    })),
}));

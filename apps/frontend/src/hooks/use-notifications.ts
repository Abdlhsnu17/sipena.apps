"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAuthToken, isLocalAuthToken } from "@/services/auth-utils";
import notificationService, {
    AppNotification,
    NotificationCategory,
} from "@/services/notification.service";

const DEFAULT_POLL_INTERVAL_MS = 60000;

interface UseNotificationsOptions {
  /** Auto-poll interval in ms. Set to 0 to disable polling. */
  pollIntervalMs?: number;
  /** Max notifications to fetch per refresh. */
  limit?: number;
  /** Optional category filter. */
  category?: NotificationCategory;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, limit = 20, category } = options;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!getAuthToken()) {
      if (isMountedRef.current) {
        setNotifications([]);
        setUnreadCount(0);
      }
      return;
    }

    if (isMountedRef.current) setIsLoading(true);
    try {
      const res = await notificationService.list({ limit, category });
      if (!isMountedRef.current) return;
      if (res.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unreadCount);
      }
    } catch {
      // silent: notifications must never break the shell
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [limit, category]);

  const markAsRead = useCallback(async (id: number) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id && !item.isRead ? { ...item, isRead: true } : item))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationService.markAsRead(id);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllAsRead();
    } catch {
      void refresh();
    }
  }, [refresh]);

  const remove = useCallback(async (id: number) => {
    let wasUnread = false;
    setNotifications((prev) => {
      const target = prev.find((item) => item.id === id);
      wasUnread = Boolean(target && !target.isRead);
      return prev.filter((item) => item.id !== id);
    });
    if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await notificationService.remove(id);
    } catch {
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    isMountedRef.current = true;
    void refresh();

    if (pollIntervalMs <= 0) {
      return () => {
        isMountedRef.current = false;
      };
    }

    const intervalId = window.setInterval(() => void refresh(), pollIntervalMs);
    return () => {
      isMountedRef.current = false;
      window.clearInterval(intervalId);
    };
  }, [refresh, pollIntervalMs]);

  // Real-time updates via Server-Sent Events. The polling above stays as a
  // fallback in case the stream cannot be established (e.g. offline, proxy).
  useEffect(() => {
    const token = getAuthToken();
    // Local (offline) auth sessions are not backed by the API, so skip the stream.
    if (!token || isLocalAuthToken(token)) return;

    const source = notificationService.createEventSource(token);
    if (!source) return;

    const handleEvent = () => {
      void refresh();
    };

    source.addEventListener("notification", handleEvent);
    // On error the browser automatically attempts to reconnect; nothing to do.

    return () => {
      source.removeEventListener("notification", handleEvent);
      source.close();
    };
  }, [refresh]);

  return { notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead, remove };
}

export default useNotifications;

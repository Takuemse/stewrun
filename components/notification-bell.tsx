"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, RefreshCw } from "lucide-react";
import Link from "next/link";

type Notification = {
  id: string;
  title: string;
  message: string;
  href: string;
  created_at: string;
  read_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isNotification(value: unknown): value is Notification {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.message === "string" &&
    typeof value.href === "string" &&
    value.href.startsWith("/") &&
    !value.href.startsWith("//") &&
    typeof value.created_at === "string" &&
    (typeof value.read_at === "string" || value.read_at === null)
  );
}

function getErrorMessage(payload: unknown) {
  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : "Unable to update notifications.";
}

async function fetchNotifications(): Promise<Notification[]> {
  const response = await fetch("/api/notifications", {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const payload: unknown = await response.json();

  if (!response.ok) throw new Error(getErrorMessage(payload));
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.notifications) ||
    !payload.notifications.every(isNotification)
  ) {
    throw new Error("The notification response was invalid.");
  }

  return payload.notifications;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setNotifications(await fetchNotifications());
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    function refresh() {
      void fetchNotifications()
        .then((loadedNotifications) => {
          if (active) {
            setNotifications(loadedNotifications);
            setError("");
          }
        })
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Unable to load notifications.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    refresh();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  async function markRead(id: string) {
    if (savingId || markingAll) return;
    setSavingId(id);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) throw new Error(getErrorMessage(payload));
      if (!isRecord(payload)) {
        throw new Error("The updated notification response was invalid.");
      }

      const updatedNotification = payload.notification;
      if (!isNotification(updatedNotification)) {
        throw new Error("The updated notification response was invalid.");
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === updatedNotification.id ? updatedNotification : item,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update this notification.",
      );
    } finally {
      setSavingId(null);
    }
  }

  async function markAllRead() {
    if (savingId || markingAll) return;
    setMarkingAll(true);
    setError("");

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAll: true }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) throw new Error(getErrorMessage(payload));
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update notifications.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  const unreadCount = notifications.filter((item) => item.read_at === null).length;

  return (
    <details className="relative">
      <summary
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        className="relative flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-ink-900/10 text-ink-900 hover:bg-cream-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 [&::-webkit-details-marker]:hidden"
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-clay-500 px-1 text-[10px] font-bold leading-5 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-ink-900/10 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between gap-2 border-b border-ink-900/10 pb-3">
          <h2 className="text-sm font-semibold text-ink-900">Notifications</h2>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={markingAll || savingId !== null}
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-clay-500 hover:bg-cream-50 disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-md border border-red-700/20 bg-red-50 p-3 text-xs text-red-800" role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadNotifications();
              }}
              className="mt-2 inline-flex min-h-8 items-center gap-1 font-semibold"
            >
              <RefreshCw aria-hidden="true" className="size-3.5" />
              Retry
            </button>
          </div>
        )}

        {loading && (
          <p className="flex items-center gap-2 py-4 text-xs text-ink-900/60" role="status">
            <RefreshCw aria-hidden="true" className="size-3.5 animate-spin" />
            Loading...
          </p>
        )}

        {!loading && !error && notifications.length === 0 && (
          <p className="py-5 text-center text-xs text-ink-900/60">
            You are all caught up.
          </p>
        )}

        {!loading && notifications.length > 0 && (
          <ul className="max-h-80 divide-y divide-ink-900/10 overflow-y-auto">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className={`py-3 ${notification.read_at === null ? "bg-cream-50/60" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink-900">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-ink-900/65">
                      {notification.message}
                    </p>
                    <Link
                      href={notification.href}
                      className="mt-2 inline-flex min-h-8 items-center text-xs font-semibold text-clay-500 underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                  {notification.read_at === null && (
                    <button
                      type="button"
                      aria-label={`Mark ${notification.title} as read`}
                      onClick={() => void markRead(notification.id)}
                      disabled={savingId !== null || markingAll}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border border-ink-900/10 text-ink-900 hover:bg-white disabled:opacity-50"
                    >
                      <Check aria-hidden="true" className="size-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

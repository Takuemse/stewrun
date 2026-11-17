"use client";

import { ClipboardList, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AccountSignOut from "@/components/account-sign-out";
import NotificationBell from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";

const destinations = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/my-requests", label: "My Lunch", icon: ClipboardList },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function CustomerNavigation() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
      setSessionResolved(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  function isActive(href: string) {
    return href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  function destinationLink(
    destination: (typeof destinations)[number],
    mobile = false,
  ) {
    const active = isActive(destination.href);
    const Icon = destination.icon;

    return (
      <Link
        key={destination.href}
        href={destination.href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-12 items-center justify-center gap-2 border-b-2 border-transparent px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${
          mobile ? "min-w-0 flex-col gap-1 px-1 text-xs" : ""
        } ${
          active
            ? "border-clay-500 font-semibold text-ink-900"
            : "font-medium text-ink-900 hover:text-clay-500"
        }`}
      >
        <Icon
          aria-hidden="true"
          className={`${mobile ? "size-5" : "size-4"} ${
            active ? "text-clay-500" : ""
          }`}
        />
        <span className={mobile ? "truncate" : ""}>{destination.label}</span>
      </Link>
    );
  }

  return (
    <>
      <header className="border-b border-ink-900/10 bg-cream-50">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/dashboard"
            aria-label="StewRun home"
            className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-md bg-clay-500 font-display text-xl font-semibold text-white"
            >
              S
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-ink-900">
              StewRun
            </span>
          </Link>

          <nav
            aria-label="Customer navigation"
            className="hidden items-center gap-1 md:flex"
          >
            {destinations.map((destination) => destinationLink(destination))}
          </nav>

          {sessionResolved && !signedIn ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-md px-3 text-sm font-semibold text-ink-900 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex min-h-12 items-center justify-center rounded-md bg-clay-500 px-4 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              >
                Create account
              </Link>
            </div>
          ) : null}
          {sessionResolved && signedIn ? (
            <div className="hidden items-center gap-2 md:flex">
              <NotificationBell />
              <AccountSignOut />
            </div>
          ) : null}
          {sessionResolved && signedIn ? (
            <div className="md:hidden">
              <NotificationBell />
            </div>
          ) : null}
        </div>
      </header>

      <nav
        aria-label="Customer navigation"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-900/10 bg-cream-50 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        <div
          className={`mx-auto grid max-w-lg ${
            sessionResolved && signedIn ? "grid-cols-4" : "grid-cols-3"
          }`}
        >
          {destinations.map((destination) =>
            destinationLink(destination, true),
          )}
          {sessionResolved && signedIn ? (
            <AccountSignOut compact />
          ) : null}
        </div>
      </nav>
    </>
  );
}

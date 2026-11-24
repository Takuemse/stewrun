"use client";

import { ClipboardList, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import AccountSignOut from "@/components/account-sign-out";
import NotificationBell from "@/components/notification-bell";
import { createClient } from "@/lib/supabase/client";
import { BrandLogo } from "@/components/brand-logo";

const destinations = [
  { href: "/dashboard", label: "Dashboard", icon: House },
  { href: "/my-requests", label: "My Lunch", icon: ClipboardList },
  { href: "/profile", label: "Profile", icon: UserRound },
];

/* Layout rules are scoped here so the sidebar / mobile switch does not
   depend on Tailwind generating new utility classes.
   Desktop (1024px and up): fixed left sidebar, 15rem wide.
   Below that: header with logo and bell, plus the fixed bottom navigation. */
const navStyles = `
  .cust-side{display:none}
  .cust-mhead{position:relative;z-index:30}
  .cust-mnav{position:fixed;left:0;right:0;bottom:0;z-index:50}
  .cust-side-link{display:flex;align-items:center;gap:12px;min-height:48px;
    padding:0 16px;border-radius:14px;font-size:15px;font-weight:600;
    color:#2A211C;text-decoration:none;transition:background .15s}
  .cust-side-link:hover{background:rgba(255,255,255,.7)}
  .cust-side-link[aria-current="page"]{background:#fff;color:#B4472B;
    box-shadow:0 6px 16px rgba(120,70,30,.10)}
  .cust-side-link:focus-visible{outline:2px solid #B4472B;outline-offset:2px}
  @media (min-width:1024px){
    .cust-side{display:flex;flex-direction:column;gap:24px;position:fixed;
      top:0;bottom:0;left:0;width:15rem;z-index:30;padding:20px 16px 24px;
      background:#FAF5EF;border-right:1px solid rgba(42,33,28,.1);
      overflow-y:auto}
    .cust-mhead,.cust-mnav{display:none}
  }
`;

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

  function mobileLink(destination: (typeof destinations)[number]) {
    const active = isActive(destination.href);
    const Icon = destination.icon;

    return (
      <Link
        key={destination.href}
        href={destination.href}
        aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 border-b-2 border-transparent px-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${
          active
            ? "border-clay-500 font-semibold text-ink-900"
            : "font-medium text-ink-900 hover:text-clay-500"
        }`}
      >
        <Icon
          aria-hidden="true"
          className={`size-5 ${active ? "text-clay-500" : ""}`}
        />
        <span className="truncate">{destination.label}</span>
      </Link>
    );
  }

  function sideLink(destination: (typeof destinations)[number]) {
    const active = isActive(destination.href);
    const Icon = destination.icon;

    return (
      <Link
        key={destination.href}
        href={destination.href}
        aria-current={active ? "page" : undefined}
        className="cust-side-link"
      >
        <Icon aria-hidden="true" className="size-5" />
        <span>{destination.label}</span>
      </Link>
    );
  }

  return (
    <>
      <style>{navStyles}</style>

      {/* Desktop sidebar */}
      <aside className="cust-side" aria-label="Customer sidebar">
        <Link
          href="/dashboard"
          aria-label="StewRun home"
          className="inline-flex min-h-12 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
        >
          <BrandLogo className="h-[42px] w-[150px]" />
        </Link>

        <nav
          aria-label="Customer navigation"
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          {destinations.map((destination) => sideLink(destination))}
        </nav>

        <div
          style={{
            marginTop: "auto",
            background: "#FDF4E9",
            borderRadius: 20,
            padding: 18,
          }}
        >
          <p className="font-display text-lg leading-tight text-ink-900">
            Support
            <br />
            local cooks
          </p>
          <p className="mt-1.5 text-xs leading-5 text-ink-900/70">
            Good food. Stronger community.
          </p>
          <span
            aria-hidden="true"
            className="mt-3 block h-1 w-12 rounded-full bg-saffron-500"
          />
        </div>
      </aside>

      {/* Mobile and tablet header */}
      <header className="cust-mhead border-b border-ink-900/10 bg-cream-50">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/dashboard"
            aria-label="StewRun home"
            className="inline-flex min-h-12 shrink-0 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
          >
            <BrandLogo className="h-[42px] w-[150px]" />
          </Link>

          {sessionResolved && signedIn ? <NotificationBell /> : null}

          {sessionResolved && !signedIn ? (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-md px-3 text-sm font-semibold text-ink-900 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              >
                Sign in
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {/* Mobile and tablet bottom navigation */}
      <nav
        aria-label="Customer navigation"
        className="cust-mnav border-t border-ink-900/10 bg-cream-50 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div
          className={`mx-auto grid max-w-lg ${
            sessionResolved && signedIn ? "grid-cols-4" : "grid-cols-3"
          }`}
        >
          {destinations.map((destination) => mobileLink(destination))}
          {sessionResolved && signedIn ? (
            <AccountSignOut compact />
          ) : null}
        </div>
      </nav>
    </>
  );
}
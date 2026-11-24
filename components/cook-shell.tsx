"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Caveat } from "next/font/google";
import {
  ClipboardList,
  ShoppingBag,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import AccountMenu from "@/components/account-menu";
import AccountSignOut from "@/components/account-sign-out";
import { BrandLogo } from "@/components/brand-logo";
import NotificationBell from "@/components/notification-bell";

const script = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });

const destinations = [
  { href: "/cook", label: "Requests", icon: ClipboardList, exact: true },
  { href: "/cook/orders", label: "Orders", icon: ShoppingBag, exact: false },
  { href: "/cook/menu", label: "Menu", icon: UtensilsCrossed, exact: false },
  { href: "/cook/profile", label: "Profile", icon: UserRound, exact: false },
];

/** Links for the "Welcome back" dropdown on cook pages. */
export const cookAccountLinks = [
  { href: "/cook/profile", label: "Profile" },
  { href: "/cook/orders", label: "Orders" },
  { href: "/cook/menu", label: "Menu" },
  { href: "/", label: "StewRun home" },
];

/* Every ck-* rule lives here, scoped, so none of the cook layout depends on
   Tailwind generating new utility classes. */
export const cookStyles = `
  /* ── Shell ─────────────────────────────────────────────── */
  .ck-side-nav{display:none}
  .ck-mhead{position:relative;z-index:30}
  .ck-mnav{position:fixed;left:0;right:0;bottom:0;z-index:50}
  .ck-content{position:relative;padding-bottom:calc(4rem + env(safe-area-inset-bottom,0px))}
  .ck-link{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 18px;
    border-radius:999px;font-size:15px;font-weight:600;color:#2A211C;
    text-decoration:none;transition:background .15s}
  .ck-link:hover{background:rgba(180,71,43,.08)}
  .ck-link[aria-current="page"]{background:#B4472B;color:#fff;
    box-shadow:0 6px 16px rgba(180,71,43,.25)}
  .ck-link:focus-visible{outline:2px solid #B4472B;outline-offset:2px}
  .ck-tag{margin-top:auto;border-radius:44px 20px 20px 20px;padding:20px 18px;
    background:linear-gradient(150deg,#FBE6CC 0%,#F3CFA3 100%)}
  .ck-top{display:none}

  /* ── Page ──────────────────────────────────────────────── */
  .ck-wrap{max-width:1280px;margin:0 auto;padding:16px 16px 40px}
  .ck-hero{position:relative;border-radius:28px;padding:20px;
    background:linear-gradient(120deg,#F9E9D3 0%,#F3DDBF 100%)}
  /* The terracotta circle is clipped by its own layer, so the hero itself
     can let the bell and account dropdowns open past its edge. */
  .ck-hero-bg{position:absolute;inset:0;z-index:0;overflow:hidden;
    border-radius:28px;pointer-events:none}
  .ck-hero-bg::after{content:"";position:absolute;right:-80px;top:-60px;
    width:220px;height:220px;border-radius:50%;background:#B4472B}
  .ck-hero>*:not(.ck-hero-bg){position:relative;z-index:1}
  .ck-hero>.ck-hero-top{z-index:3}
  .ck-hero-top{display:flex;flex-wrap:wrap;align-items:center;
    justify-content:space-between;gap:12px}
  .ck-hero-actions{display:none}
  .ck-pill{display:inline-flex;align-items:center;gap:8px;min-height:36px;
    padding:0 14px;border-radius:999px;background:#fff;font-size:12.5px;font-weight:600;
    color:#2A211C}
  .ck-pill i{width:8px;height:8px;border-radius:50%;background:#2F7D4F}
  .ck-pill.is-paused i{background:#E8A030}
  .ck-pill.is-unknown i{background:#9C8F84}
  .ck-hero-body{display:grid;gap:18px;margin-top:20px}
  .ck-eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
    color:#4F5B45;margin:0}
  .ck-h1{margin:6px 0 0;font-size:34px;line-height:1.08}
  .ck-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .ck-tile{background:rgba(255,255,255,.95);border-radius:18px;padding:12px 14px;min-width:0}
  .ck-tile b{display:block;font-size:30px;line-height:1.1;color:#2A211C}
  .ck-tile span{font-size:12px;line-height:1.3;color:#4A3F38}
  .ck-tile.is-tint{background:#FBEDE6}

  .ck-grid{display:flex;flex-direction:column;gap:24px;margin-top:24px}
  .ck-main,.ck-side{display:contents}
  .ck-i-banner{order:0}
  .ck-i-counter{order:4}
  .ck-i-counter.ck-urgent{order:1}
  .ck-i-requests{order:2}
  .ck-i-composer{order:3}
  .ck-i-status{order:5}
  .ck-i-offers{order:6}
  .ck-i-menu{order:7}

  .ck-card{background:#fff;border-radius:24px;padding:20px;min-width:0;
    box-shadow:0 10px 28px rgba(120,70,30,.08)}
  .ck-card-head{display:flex;flex-wrap:wrap;align-items:center;
    justify-content:space-between;gap:10px}
  .ck-title{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0}
  .ck-chip{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;
    font-size:12px;font-weight:700;background:#E8A030;color:#2A211C}
  .ck-outline{display:inline-flex;align-items:center;justify-content:center;
    min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid #B4472B;
    background:#fff;color:#B4472B;font-size:13px;font-weight:600;cursor:pointer;
    text-decoration:none}
  .ck-outline:disabled{opacity:.55;cursor:not-allowed}
  .ck-outline:focus-visible,.ck-solid:focus-visible{outline:2px solid #B4472B;outline-offset:3px}
  .ck-solid{display:inline-flex;align-items:center;justify-content:center;gap:6px;
    min-height:46px;padding:0 22px;border:0;border-radius:999px;background:#B4472B;
    color:#fff;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}
  .ck-solid:disabled{opacity:.55;cursor:not-allowed}

  .ck-req-list{list-style:none;margin:14px 0 0;padding:0}
  .ck-req{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;padding:18px 0;
    border-top:1px solid rgba(42,33,28,.1)}
  .ck-req-main{flex:1 1 220px;min-width:0}
  .ck-req-side{flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;
    justify-content:space-between;gap:10px}
  .ck-date{flex:none;width:58px;border-radius:14px;background:#FBE6CC;text-align:center;
    padding:7px 0;display:flex;flex-direction:column;line-height:1.1}
  .ck-date span{font-size:10.5px;font-weight:700;letter-spacing:.1em;color:#7A4A00}
  .ck-date b{font-size:22px;font-weight:500;color:#2A211C}
  .ck-req details{flex:1 1 100%}
  .ck-req summary{cursor:pointer;min-height:40px;display:flex;align-items:center;
    font-size:13px;font-weight:600;color:#B4472B}
  .ck-req summary:focus-visible{outline:2px solid #B4472B;outline-offset:2px}

  .ck-menu-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:14px 0 0;
    padding:0;list-style:none}
  .ck-menu-tile{height:100%;min-height:96px;border-radius:16px;padding:14px;
    background:linear-gradient(135deg,#F9E9D3,#EDCB9B);display:flex;
    flex-direction:column;justify-content:space-between;gap:8px}

  .ck-status{display:flex;align-items:flex-start;gap:10px;border-radius:14px;
    padding:12px 14px;background:#E8F2E4;margin-top:12px}
  .ck-status.is-paused{background:#FBEFD6}
  .ck-status i{flex:none;width:9px;height:9px;margin-top:6px;border-radius:50%;background:#2F7D4F}
  .ck-status.is-paused i{background:#E8A030}

  .ck-urgent-card{border:1.5px solid #B4472B;border-radius:24px;background:#fff;padding:20px}
  .ck-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
  .ck-pair div{background:#FAF5EF;border-radius:14px;padding:10px 14px;min-width:0}
  .ck-pair div:last-child{background:#FBE6CC}
  .ck-pair small{display:block;font-size:11px;line-height:1.3;color:#6B5E55}
  .ck-pair b{font-size:24px;line-height:1.2;color:#2A211C}
  .ck-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
  .ck-offer-row{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 12px;
    padding:14px 0;border-top:1px solid rgba(42,33,28,.1)}

  @media (min-width:640px){
    .ck-wrap{padding:24px 24px 40px}
    .ck-hero{padding:24px 28px 28px}
    .ck-hero-bg::after{width:280px;height:280px;right:-70px;top:-70px}
    .ck-h1{font-size:40px}
    .ck-menu-grid{grid-template-columns:repeat(4,1fr)}
    .ck-card{padding:24px}
  }
  @media (min-width:1024px){
    .ck-side-nav{display:flex;flex-direction:column;gap:24px;position:fixed;top:0;bottom:0;
      left:0;width:15rem;z-index:30;padding:20px 16px 24px;background:#FFFDF9;
      border-right:1px solid rgba(42,33,28,.1);overflow-y:auto}
    .ck-mhead,.ck-mnav{display:none}
    .ck-content{padding-left:15rem;padding-bottom:0}
    .ck-top{display:flex;position:absolute;top:16px;right:32px;z-index:40;
      align-items:center;gap:14px}
    .ck-wrap{padding:24px 32px 48px}
    .ck-hero-bg::after{width:340px;height:340px;right:-70px;top:-90px}
    .ck-hero-actions{display:flex;align-items:center;gap:16px}
    .ck-hero-body{grid-template-columns:1fr auto;align-items:end}
    .ck-tiles{grid-template-columns:repeat(3,128px)}
    .ck-req-side{flex:0 0 auto;flex-direction:column;align-items:flex-end;text-align:right}
  }
  @media (min-width:1280px){
    .ck-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;align-items:start}
    .ck-main,.ck-side{display:flex;flex-direction:column;gap:24px;min-width:0}
    .ck-grid [class*="ck-i-"]{order:0!important}
  }

  /* Account sits in a white pill with an amber avatar, so it stays readable
     over the terracotta circle */
  .ck-hero-actions .acct-btn{background:#fff;border-radius:999px;
    padding:4px 16px 4px 4px;box-shadow:0 6px 16px rgba(120,70,30,.12)}
  .ck-hero-actions .acct-avatar{background:#E8A030;color:#2A211C}

  /* Bell restyled as a white circle, matching the customer pages */
  .ck-hero-actions details>summary,.ck-top details>summary{width:48px;height:48px;
    border-radius:999px;border-color:transparent;background:#fff;
    box-shadow:0 6px 16px rgba(120,70,30,.12)}
`;

export default function CookShell({
  children,
  desktopActions = true,
}: {
  children: ReactNode;
  /** Floating bell and account menu (top right, desktop). Pages that place
      these inside their own banner pass false. */
  desktopActions?: boolean;
}) {
  const pathname = usePathname();

  function isActive(destination: (typeof destinations)[number]) {
    return destination.exact
      ? pathname === destination.href
      : pathname === destination.href ||
          pathname.startsWith(`${destination.href}/`);
  }

  return (
    <>
      <style>{cookStyles}</style>

      {/* Desktop sidebar */}
      <aside className="ck-side-nav" aria-label="Cook sidebar">
        <Link
          href="/cook"
          aria-label="StewRun cook home"
          className="inline-flex min-h-12 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
        >
          <BrandLogo className="h-[42px] w-[150px]" />
        </Link>

        <nav
          aria-label="Cook navigation"
          style={{ display: "flex", flexDirection: "column", gap: 6 }}
        >
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <Link
                key={destination.href}
                href={destination.href}
                aria-current={isActive(destination) ? "page" : undefined}
                className="ck-link"
              >
                <Icon aria-hidden="true" className="size-5" />
                {destination.label}
              </Link>
            );
          })}
        </nav>

        <div className="ck-tag">
          <p
            className={`${script.className} text-ink-900`}
            style={{ fontSize: 30, lineHeight: 1.05, margin: 0, color: "#B4472B" }}
          >
            Cook.
            <br />
            Serve.
            <br />
            Grow.
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-900/75">
            Your kitchen, your prices.
          </p>
        </div>
      </aside>

      {/* Mobile and tablet header */}
      <header className="ck-mhead border-b border-ink-900/10 bg-cream-50">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/cook"
            aria-label="StewRun cook home"
            className="inline-flex min-h-12 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
          >
            <BrandLogo className="h-[42px] w-[150px]" />
          </Link>
          <NotificationBell />
        </div>
      </header>

      {/* Mobile and tablet bottom navigation */}
      <nav
        aria-label="Cook navigation"
        className="ck-mnav border-t border-ink-900/10 bg-cream-50 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {destinations.map((destination) => {
            const Icon = destination.icon;
            const active = isActive(destination);
            return (
              <Link
                key={destination.href}
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 border-b-2 border-transparent px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 ${
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
          })}
          <AccountSignOut compact />
        </div>
      </nav>

      <div className="ck-content">
        {desktopActions && (
          <div className="ck-top">
            <NotificationBell />
            <AccountMenu links={cookAccountLinks} />
          </div>
        )}
        {children}
      </div>
    </>
  );
}
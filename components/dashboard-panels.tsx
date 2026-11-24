
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin } from "lucide-react";

import AccountSignOut from "@/components/account-sign-out";
import NotificationBell from "@/components/notification-bell";
import type { CustomerOrder } from "@/lib/orders-client";
import {
  formatPickupClock,
  formatPickupDay,
  formatUsdAmount,
  type ActivityItem,
  type DashboardSummary,
} from "@/lib/customer-activity-client";

/* ── Styles (scoped, so layout never depends on new Tailwind utilities) ── */

const CLAY = "var(--color-clay-500, #B4472B)";

export function DashboardStyles() {
  return (
    <style>{`
      .dash-wrap{max-width:1280px;margin:0 auto;padding:16px 16px 32px;position:relative}
      .dash-grid{display:grid;gap:24px}
      .dash-main,.dash-side{display:flex;flex-direction:column;gap:24px;min-width:0}

      .dash-acct{display:none}
      .dash-acct-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;
        padding:0 6px;border:0;background:none;cursor:pointer;font-size:15px;color:#2A211C}
      .dash-acct-btn:focus-visible{outline:2px solid ${CLAY};outline-offset:2px;border-radius:8px}
      .dash-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:50;min-width:190px;
        display:flex;flex-direction:column;gap:4px;padding:8px;background:#fff;
        border-radius:16px;box-shadow:0 12px 30px rgba(42,33,28,.18)}
      .dash-menu-link{display:flex;align-items:center;min-height:44px;padding:0 14px;
        border-radius:10px;font-size:14px;font-weight:600;color:#2A211C;text-decoration:none}
      .dash-menu-link:hover{background:#FDF4E9}

      .dash-hero{position:relative;overflow:hidden;border-radius:24px;
        padding:24px 20px;background:linear-gradient(120deg,#FDF4E9 0%,#FBE6CC 100%);
        box-shadow:0 18px 40px rgba(120,70,30,.12)}
      .dash-hero-photo{display:none}
      .dash-hero-body{position:relative;z-index:1;min-width:0}
      .dash-form{display:flex;flex-direction:column;gap:14px;margin-top:22px}
      .dash-pill{display:flex;align-items:center;gap:8px;background:#fff;
        border:1.5px solid rgba(42,33,28,.12);border-radius:999px;padding:6px;
        box-shadow:0 8px 20px rgba(120,70,30,.10)}
      .dash-pill:focus-within{border-color:${CLAY};box-shadow:0 0 0 3px rgba(180,71,43,.2)}
      .dash-input{flex:1;min-width:0;min-height:48px;border:0;background:transparent;
        padding:0 12px 0 16px;font-size:16px;color:#2A211C}
      .dash-input::placeholder{color:rgba(42,33,28,.5)}
      .dash-input:focus{outline:none}
      .dash-ask{display:inline-flex!important;flex:none;width:auto!important;
        min-height:48px!important;align-items:center;justify-content:center;gap:8px;
        padding:0 22px!important;border-radius:999px!important;
        font-size:15px!important;font-weight:600!important;white-space:nowrap}
      .dash-chips{display:flex;flex-wrap:wrap;gap:8px}
      .dash-chip{min-height:40px;padding:0 16px;border-radius:999px;border:0;
        background:rgba(255,255,255,.9);font-size:14px;font-weight:600;color:#2A211C;
        cursor:pointer;box-shadow:0 2px 8px rgba(120,70,30,.08)}
      .dash-chip:hover{background:#fff;box-shadow:0 0 0 1.5px ${CLAY}}
      .dash-chip:focus-visible{outline:2px solid ${CLAY};outline-offset:2px}
      .dash-panel{background:#fff;border-radius:20px;padding:20px;margin-top:20px}

      .dash-pick{display:flex;flex-direction:column;gap:16px;border-radius:24px;padding:20px}
      .dash-pick-code{font-size:32px;line-height:1;letter-spacing:.12em;color:#E8A030}

      .dash-pop{display:flex;gap:14px;list-style:none;margin:0 -16px;
        padding:4px 16px 12px;overflow-x:auto;scroll-snap-type:x mandatory;
        -webkit-overflow-scrolling:touch}
      .dash-pop>li{flex:0 0 min(78%,280px);scroll-snap-align:start}
      .dash-pcard{display:flex;flex-direction:column;height:100%;background:#fff;
        border-radius:20px;overflow:hidden;box-shadow:0 8px 20px rgba(120,70,30,.10)}
      .dash-pimg{position:relative;height:128px;background:linear-gradient(135deg,#E9C9A0,#B98A5E)}
      .dash-ptag{position:absolute;left:12px;top:12px;padding:5px 10px;border-radius:999px;
        background:#FAF5EF;font-size:11px;font-weight:700;letter-spacing:.06em;
        text-transform:uppercase;color:#2A211C}
      .dash-pbody{display:flex;flex:1;flex-direction:column;gap:4px;padding:14px 16px 16px}
      .dash-pbtn{margin-top:auto;align-self:flex-start;min-height:44px;padding:0;border:0;
        background:none;font-size:14px;font-weight:600;color:${CLAY};cursor:pointer}
      .dash-pbtn:focus-visible{outline:2px solid ${CLAY};outline-offset:2px;border-radius:4px}

      .dash-card{background:#FDF4E9;border-radius:24px;padding:18px}
      .dash-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      .dash-stat{display:flex;align-items:center;gap:12px;background:#fff;
        border-radius:16px;padding:12px 14px;min-width:0}
      .dash-stat-num{min-width:30px;font-size:28px;line-height:1;color:${CLAY}}
      .dash-btn{display:flex;align-items:center;justify-content:center;gap:8px;
        min-height:52px;padding:0 20px;border-radius:999px;border:2px solid transparent;
        font-size:15px;font-weight:600;text-decoration:none;cursor:pointer}
      .dash-btn:focus-visible{outline:2px solid ${CLAY};outline-offset:3px}
      .dash-btn-solid{background:${CLAY};color:#fff}
      .dash-btn-outline{border-color:${CLAY};color:${CLAY};background:transparent}
      .dash-tl{position:relative;display:flex;flex-direction:column;gap:16px;
        margin:14px 0 0;padding:0 0 0 28px;list-style:none}
      .dash-tl::before{content:"";position:absolute;left:8px;top:8px;bottom:8px;
        border-left:2px dashed #E3B77A}
      .dash-dot{position:absolute;left:-26px;top:4px;width:12px;height:12px;
        border-radius:50%;border:2px solid #fff}

      @media (min-width:640px){
        .dash-wrap{padding:24px 24px 40px}
        .dash-hero{padding:36px;border-radius:30px}
        .dash-pick{flex-direction:row;align-items:center;justify-content:space-between;padding:20px 26px}
      }
      @media (min-width:768px){
        .dash-hero-photo{display:block;position:absolute;top:0;bottom:0;right:0;width:36%;
          -webkit-mask-image:linear-gradient(to right,transparent,#000 45%);
          mask-image:linear-gradient(to right,transparent,#000 45%)}
        .dash-hero-body{max-width:min(64%,620px)}
        .dash-hero.is-wide .dash-hero-photo{display:none}
        .dash-hero.is-wide .dash-hero-body{max-width:none}
        .dash-pop{display:grid;grid-template-columns:repeat(3,1fr);margin:0;padding:0;overflow:visible}
        .dash-pop>li{flex:none}
        .dash-side{display:grid;grid-template-columns:1fr 1fr;align-items:start}
      }
      @media (min-width:1024px){
        .dash-wrap{padding:24px 32px 48px}
        .dash-acct{display:flex;align-items:center;justify-content:flex-end;gap:14px;
          min-height:48px;margin-bottom:16px}
      }
      @media (min-width:1280px){
        .dash-grid{grid-template-columns:minmax(0,1fr) 300px;gap:28px;align-items:start}
        .dash-acct{position:absolute;top:24px;right:32px;width:300px;margin:0}
        .dash-side{display:flex;flex-direction:column;align-items:stretch;padding-top:64px}
        .dash-stats{grid-template-columns:1fr}
      }
    `}</style>
  );
}

/* ── Bell + "Welcome back, Name ▾" (desktop only) ─────────────────────── */

export function DashAccount({ firstName }: { firstName: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dash-acct">
      <NotificationBell />
      <div ref={ref} style={{ position: "relative" }}>
        <button
          type="button"
          className="dash-acct-btn"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((value) => !value)}
        >
          <span>
            Welcome back
            {firstName ? (
              <>
                , <strong>{firstName}</strong>
              </>
            ) : null}
          </span>
          <ChevronDown aria-hidden="true" style={{ width: 16, height: 16 }} />
        </button>
        {open && (
          <div className="dash-menu">
            <Link href="/profile" className="dash-menu-link">
              Profile
            </Link>
            <AccountSignOut />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Images that quietly disappear if the file is missing ─────────────── */

export function SafeImage({
  src,
  sizes,
  className,
}: {
  src: string | null;
  sizes: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

/* ── Next pickup (real order data only) ───────────────────────────────── */

export function NextPickupCard({
  order,
  moreCount,
}: {
  order: CustomerOrder;
  moreCount: number;
}) {
  const ready = order.status === "ready";
  const showCode = ready && Boolean(order.pickup_code);
  const itemNames = order.items?.map((item) => item.name).join(", ");

  return (
    <section
      aria-label="Your next pickup"
      className="dash-pick bg-ink-900 text-cream-50"
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-500">
          <MapPin aria-hidden="true" className="size-3.5" />
          {ready ? "Ready for pickup" : "Your next pickup"}
        </p>
        <h2
          className="mt-1.5 font-display text-xl leading-snug sm:text-2xl"
          style={{ overflowWrap: "anywhere" }}
        >
          {order.hub || "Hub pending"} · {formatPickupDay(order.pickup_date)} ·{" "}
          {formatPickupClock(order.pickup_time)}
        </h2>
        {itemNames && (
          <p className="mt-1 text-sm text-cream-50/80">{itemNames}</p>
        )}
        <p className="mt-1 text-sm text-cream-50/80">
          {order.cash_payment_status === "paid"
            ? "Cash payment recorded."
            : `Pay ${formatUsdAmount(order.total)} in cash to your cook when you collect.`}
        </p>
        {moreCount > 0 && (
          <p className="mt-1 text-xs text-cream-50/65">
            +{moreCount} more active {moreCount === 1 ? "order" : "orders"} in My
            Lunch
          </p>
        )}
      </div>

      {showCode ? (
        <div style={{ textAlign: "center" }}>
          <p className="text-[11px] uppercase tracking-[0.1em] text-cream-50/70">
            Pickup code
          </p>
          <p className="dash-pick-code mt-1 font-mono font-bold">
            {order.pickup_code}
          </p>
        </div>
      ) : (
        <p className="max-w-[16rem] text-xs leading-5 text-cream-50/70">
          Your pickup code appears here when your cook marks the order ready.
        </p>
      )}

      <Link
        href="/my-requests"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-saffron-500 px-6 text-sm font-semibold text-ink-900 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50"
      >
        View in My Lunch
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

/* ── Popular lunch choices (curated inspiration, no invented figures) ─── */

export const popularMeals = [
  {
    name: "Sadza with beef stew",
    blurb: "A familiar, filling lunch.",
    tag: "Traditional",
    image: "/images/sadza-beef-stew.jpg",
    prompt: "I want sadza with beef stew.",
  },
  {
    name: "Chicken and rice",
    blurb: "A convenient lunch option.",
    tag: "Chicken",
    image: "/images/grilled-chicken-rice.jpg",
    prompt: "I want chicken and rice for lunch.",
  },
  {
    name: "Sadza with muriwo",
    blurb: "A vegetable-based favourite.",
    tag: "Vegetarian",
    image: null,
    prompt: "I would like sadza with muriwo and no meat.",
  },
];

export function PopularChoices({
  onRequest,
}: {
  onRequest: (prompt: string) => void;
}) {
  return (
    <section aria-labelledby="popular-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="popular-heading"
          className="font-display text-2xl tracking-tight text-ink-900 sm:text-3xl"
        >
          Popular lunch choices
        </h2>
        <p className="text-xs text-ink-900/60">Illustrative photos</p>
      </div>

      <ul className="dash-pop mt-4">
        {popularMeals.map((meal) => (
          <li key={meal.name}>
            <div className="dash-pcard">
              <div className="dash-pimg">
                <SafeImage
                  src={meal.image}
                  sizes="(min-width: 768px) 260px, 280px"
                  className="object-cover"
                />
                <span className="dash-ptag">{meal.tag}</span>
              </div>
              <div className="dash-pbody">
                <h3 className="font-display text-lg leading-snug text-ink-900">
                  {meal.name}
                </h3>
                <p className="text-sm leading-5 text-ink-900/70">{meal.blurb}</p>
                <button
                  type="button"
                  className="dash-pbtn"
                  onClick={() => onRequest(meal.prompt)}
                  aria-label={`Request this meal: ${meal.name}`}
                >
                  Request this meal →
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs leading-5 text-ink-900/60">
        Meal ideas to get you started. Prices and availability come from cooks’
        offers.
      </p>
    </section>
  );
}

/* ── Statistics ───────────────────────────────────────────────────────── */

export function StatsPanel({
  loading,
  ordersFailed,
  requestsFailed,
  summary,
}: {
  loading: boolean;
  ordersFailed: boolean;
  requestsFailed: boolean;
  summary: DashboardSummary;
}) {
  const show = (value: number, failed: boolean) =>
    loading || failed ? "–" : String(value);

  const stats = [
    { label: "Active orders", value: show(summary.activeOrders, ordersFailed) },
    { label: "Open requests", value: show(summary.openRequests, requestsFailed) },
    { label: "Offers to review", value: show(summary.offersToReview, requestsFailed) },
    { label: "Collected meals", value: show(summary.collected, ordersFailed) },
  ];

  return (
    <section className="dash-card" aria-labelledby="stats-heading">
      <h2 id="stats-heading" className="font-display text-xl text-ink-900">
        Your lunch
      </h2>
      <div className="dash-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="dash-stat">
            <span className="dash-stat-num font-display">{stat.value}</span>
            <span className="text-sm leading-tight text-ink-900/75">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
      {(ordersFailed || requestsFailed) && !loading && (
        <p role="status" className="mt-3 text-xs leading-5 text-ink-900/65">
          Some of your activity could not be loaded. Refresh the page to try
          again.
        </p>
      )}
    </section>
  );
}

/* ── Recent activity ──────────────────────────────────────────────────── */

const toneColor: Record<ActivityItem["tone"], string> = {
  offer: "#E8A030",
  order: "#B4472B",
  done: "#5B7157",
  muted: "#C9BDB1",
};

export function ActivityPanel({
  items,
  loading,
}: {
  items: ActivityItem[];
  loading: boolean;
}) {
  return (
    <section
      className="dash-card"
      style={{ background: "#fff" }}
      aria-labelledby="activity-heading"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="activity-heading" className="font-display text-xl text-ink-900">
          Recent activity
        </h2>
        <Link
          href="/my-requests"
          className="inline-flex min-h-10 items-center text-sm font-semibold text-clay-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
        >
          See all →
        </Link>
      </div>

      {loading ? (
        <p role="status" className="mt-3 text-sm text-ink-900/60">
          Loading your activity…
        </p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-ink-900/70">
          Nothing here yet. Ask Ziva for your first lunch and your requests and
          orders will appear here.
        </p>
      ) : (
        <ul className="dash-tl">
          {items.map((item) => (
            <li key={item.id} className="relative text-sm">
              <span
                aria-hidden="true"
                className="dash-dot"
                style={{ background: toneColor[item.tone] }}
              />
              <p className="font-semibold text-ink-900">{item.title}</p>
              <p
                className="text-xs leading-5 text-ink-900/65"
                style={{ overflowWrap: "anywhere" }}
              >
                {item.detail}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

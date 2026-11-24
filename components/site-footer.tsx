import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const links = [
  { href: "#marketplace", label: "Browse meals" },
  { href: "/register?role=cook", label: "I\u2019m a cook" },
  { href: "/login", label: "Sign in" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-cream-50">
      <style>{`
        .foot{display:flex;flex-wrap:wrap;align-items:center;
          justify-content:space-between;gap:20px 32px}
        .foot-brand{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px}
        .foot-sep{width:1px;height:32px;background:rgba(42,33,28,.2)}
        .foot-nav{display:flex;flex-wrap:wrap;gap:4px 24px}
        @media (max-width:639px){.foot-sep{display:none}}
      `}</style>

      <div className="mx-auto max-w-7xl border-t border-ink-900/10 px-5 py-8 sm:px-8">
        <div className="foot">
          <div className="foot-brand">
            <Link
              href="/"
              aria-label="StewRun home"
              className="inline-flex min-h-11 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
            >
              <BrandLogo className="h-[42px] w-[150px]" />
            </Link>
            <span aria-hidden="true" className="foot-sep" />
            <p className="text-sm text-ink-900/75">
              Scheduled lunch pre-orders and hub collection.
            </p>
          </div>

          <nav aria-label="Footer" className="foot-nav">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-sm text-sm font-semibold text-ink-900 transition-colors hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-ink-900/60">StewRun · Harare</p>
        </div>
      </div>
    </footer>
  );
}

import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* Drop your photo at public/images/local-cook.jpg.
   Until it exists, a warm placeholder is shown instead, so the
   page never renders a broken image. */
const PHOTO_SRC = "/images/local-cook.jpg";
const PHOTO_ALT = "A cook plating a freshly prepared lunch"; // update to describe the real photo

const highlights = [
  "Respond to requests",
  "Set your own prices",
   "Your kitchen, your business",
];

export default function LocalCooks() {
  const hasPhoto = existsSync(
    path.join(process.cwd(), "public", PHOTO_SRC.replace(/^\//, "")),
  );

  return (
    <section
      id="local-cooks"
      aria-labelledby="local-cooks-heading"
      className="bg-cream-50"
    >
      {/* Scoped layout rules: spacing, overlap and caption do not depend on
          Tailwind generating new utility classes. */}
      <style>{`
        .cooks-photo{position:relative;overflow:hidden;min-height:400px;
          border-radius:28px 28px 28px 80px;
          background:linear-gradient(160deg,#9A6A45 0%,#5A341D 60%,#2E1A0E 100%);
          box-shadow:0 24px 48px rgba(90,52,29,.25)}
        .cooks-caption{position:absolute;left:36px;right:24px;bottom:40px}
        .cooks-title{margin:0;font-size:26px;line-height:1.1;color:#FFF7EF}
        .cooks-rule{display:block;width:64px;height:4px;border-radius:999px;
          background:#E8A030;margin-top:16px}
        .cooks-panel{position:relative;z-index:2;margin:-48px 16px 0;padding:32px 24px;
          border-radius:30px;background:#FDF4E9}
        .cooks-pills{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0 0;
          padding:0;list-style:none}
        .cooks-actions{display:flex;flex-wrap:wrap;align-items:center;
          gap:14px 28px;margin-top:32px}
        @media (min-width:640px){
          .cooks-panel{padding:48px 44px}
          .cooks-photo{min-height:460px}
          .cooks-title{font-size:30px}
        }
        @media (min-width:1024px){
          .cooks-photo{height:540px;min-height:0;border-radius:36px 36px 36px 140px}
          .cooks-caption{left:72px;right:32px;bottom:48px}
          .cooks-title{font-size:32px}
          .cooks-panel{margin:0 0 0 -72px;padding:56px 52px;min-height:600px;
            display:flex;flex-direction:column;justify-content:center}
        }
      `}</style>

      <div className="mx-auto grid max-w-7xl items-center px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.15fr]">
        {/* Photo */}
        <div className="cooks-photo">
          {hasPhoto && (
            <Image
              src={PHOTO_SRC}
              alt={PHOTO_ALT}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-[50%_30%]"
            />
          )}

          {/* Legibility gradient for the caption */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#30180a]/95 via-[#30180a]/55 via-35% to-transparent to-65%"
          />

          <div
            className="absolute inline-flex items-center gap-2.5 rounded-full bg-cream-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-900 shadow-md sm:text-xs"
            style={{ top: 24, left: 24 }}
          >
            <span
              aria-hidden="true"
              className="size-3 rounded-full bg-saffron-500"
            />
            Made in Harare
          </div>

          <div className="cooks-caption">
            <p className="cooks-title font-display">
              Cooked by people
              <br />
              who <span className="text-saffron-500">know the plate.</span>
            </p>
            <span aria-hidden="true" className="cooks-rule" />
          </div>
        </div>

        {/* Panel, overlapping the photo */}
        <div className="cooks-panel shadow-xl">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="h-0.5 w-12 bg-ink-900/70 sm:w-[70px]"
            />
            <p className="text-sm font-bold uppercase tracking-[0.07em] text-sage-500">
              Local cooks
            </p>
          </div>

          <h2
            id="local-cooks-heading"
            className="mt-5 font-display text-4xl leading-[1.06] tracking-tight text-ink-900 sm:text-5xl"
          >
            Local cooks,
            <span className="block text-clay-500">your way.</span>
          </h2>
          <span
            aria-hidden="true"
            className="mt-6 block h-1 w-[102px] rounded-full bg-saffron-500"
          />

          <p className="mt-6 max-w-[540px] text-base leading-7 text-ink-900/75">
            Local home cooks and small caterers can join StewRun, respond to
            lunch requests, and set their own meal prices. You compare their
            offers and choose the one that works for your lunch plans.
          </p>

          <ul className="cooks-pills">
            {highlights.map((item) => (
              <li
                key={item}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900"
              >
                {item}
              </li>
            ))}
          </ul>

          <div className="cooks-actions">
            <Link
              href="/register?role=cook"
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-saffron-500 px-7 text-sm font-semibold text-ink-900 transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
            >
              I&apos;m a cook
            </Link>
            <Link
              href="#marketplace"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold text-clay-500 transition-colors hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              Browse cooks&apos; meals
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

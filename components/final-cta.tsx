import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Caveat } from "next/font/google";

const script = Caveat({ subsets: ["latin"], weight: "600", display: "swap" });

/* Add a dedicated plate photo at public/images/final-cta-plate.jpg.
   Until it exists, the hero lunch photo is used. */
const PLATE_SRC = "/images/final-cta-plate.jpg";
const FALLBACK_SRC = "/images/sadza-final-cta.jpg";

export default function FinalCta() {
  const imageSrc = existsSync(
    path.join(process.cwd(), "public", PLATE_SRC.replace(/^\//, "")),
  )
    ? PLATE_SRC
    : FALLBACK_SRC;

  return (
    <section
      aria-labelledby="final-cta-heading"
      className="bg-cream-50 px-4 pb-10 pt-4 sm:px-8"
    >
      {/* Scoped styles: layout, padding and the plate crop do not depend on
          Tailwind generating new utility classes. */}
      <style>{`
        .cta-panel{position:relative;overflow:hidden;isolation:isolate;
          max-width:1216px;margin:0 auto;border-radius:28px;
          padding:36px 24px 24px;display:grid;gap:8px}
        .cta-copy{position:relative;z-index:2}
        .cta-p{margin:20px 0 0;max-width:520px}
        .cta-actions{display:flex;flex-wrap:wrap;align-items:center;
          gap:16px 28px;margin-top:32px}
        .cta-btn{padding:0 32px;min-height:56px}
        .cta-art{position:relative;min-height:280px}
        .cta-swoosh{position:absolute;z-index:0;right:-80px;top:-40px;
          width:300px;color:#B4472B;opacity:.9}
        .cta-plate{position:absolute;z-index:1;left:50%;top:56%;
          width:min(86%,320px);aspect-ratio:3/2;
          transform:translate(-50%,-50%);border-radius:50%;overflow:hidden;
          box-shadow:0 30px 50px rgba(0,0,0,.5)}
        .cta-script{position:absolute;z-index:2;right:4px;top:6px;
          transform:rotate(-6deg);font-size:28px;line-height:1.05;color:#FFF7EF}
        .cta-script i{display:block;height:3px;border-radius:2px;
          background:#E8A030;margin-top:4px}
        @media (min-width:640px){
          .cta-panel{padding:52px 48px 32px}
        }
        @media (min-width:1024px){
          .cta-panel{grid-template-columns:1.1fr 1fr;align-items:center;
            padding:56px;gap:0}
          .cta-art{min-height:340px}
          .cta-swoosh{right:-60px;top:-110px;width:440px}
          .cta-plate{width:min(88%,420px)}
          .cta-script{font-size:36px}
        }
      `}</style>

      <div className="cta-panel bg-ink-900 text-cream-50 shadow-xl">
        <div className="cta-copy">
          <p className="inline-flex items-center rounded-full border border-saffron-500 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-saffron-500">
            Plan your next lunch
          </p>

          <h2
            id="final-cta-heading"
            className="mt-5 font-display text-4xl leading-[1.06] tracking-tight sm:text-5xl"
          >
            Your next lunch starts
            <span className="block">
              with <span className="text-saffron-500">what you want.</span>
            </span>
          </h2>

          <p className="cta-p text-base leading-7 text-cream-50/85">
            Create an account to describe your meal and review cook offers.
          </p>

          <div className="cta-actions">
            <Link
              href="/register?role=customer"
              className="cta-btn inline-flex items-center justify-center gap-2 rounded-full bg-clay-500 text-sm font-semibold text-white transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream-50"
            >
              Create account
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <p className="text-sm text-cream-50/85">
              Already have an account?{" "}
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center gap-1 font-semibold text-saffron-500 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50"
              >
                Sign in
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </p>
          </div>
        </div>

        {/* Plate artwork: swoosh behind, elliptical plate photo, script on top */}
        <div className="cta-art" aria-hidden="true">
          <svg viewBox="0 0 330 220" className="cta-swoosh">
            <path
              d="M2 208 C-4 110 48 18 150 4 C235 -6 310 22 322 42 C220 48 130 84 92 150 C70 190 50 214 2 208 Z"
              fill="currentColor"
            />
          </svg>

          <div className="cta-plate">
            <Image
              src={imageSrc}
              alt=""
              fill
              sizes="420px"
              className="object-cover object-[68%_58%]"
            />
          </div>

          <p className={`cta-script ${script.className}`}>
            Eat Local.
            <br />
            Enjoy Harare.
            <i />
          </p>
        </div>
      </div>
    </section>
  );
}

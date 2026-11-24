import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleHelp,
  Clock3,
  Coins,
  Wallet,
  MapPin,
} from "lucide-react";
import PublicMarketplace from "@/components/public-marketplace";
import { BrandLogo } from "@/components/brand-logo";
import HowItWorks from "@/components/how-it-works";
import BudgetChoice from "@/components/budget-choice";
import LocalCooks from "@/components/local-cooks";
import PickupHubs from "@/components/pickup-hubs";
import FinalCta from "@/components/final-cta";
import SiteFooter from "@/components/site-footer";


const officeProblems = [
  {
    number: "01",
    icon: Clock3,
    iconClass: "text-clay-500",
    title: "Time lost in queues",
    description: "Queues and searching eat into the time you should rest.",
  },
  {
    number: "02",
    icon: Coins,
    iconClass: "text-saffron-500",
    title: "Budget pressure",
    description:
      "Finding a satisfying meal at a price that works for you isn’t easy.",
  },
  {
    number: "03",
    icon: CircleHelp,
    iconClass: "text-clay-500",
    title: "Uncertainty",
    description:
      "You don’t always know what’s available or what it will cost.",
  },
];

const stewrunBenefits = [
  { icon: CalendarDays, lines: ["Plan", "ahead"] },
  { icon: Wallet, lines: ["Know your", "budget"] },
  { icon: MapPin, lines: ["Collect", "with ease"] },
];

function Brand() {
  return (
    <Link
      href="/"
      aria-label="StewRun home"
      className="inline-flex min-h-11 shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
    >
      <BrandLogo className="h-[42px] w-[150px]" />
    </Link>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      <header className="relative z-10 border-b border-ink-900/10 bg-cream-50">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8">
          <Brand />

          <nav
            aria-label="Main navigation"
            className="flex shrink-0 items-center gap-2 sm:gap-4"
          >
            <Link
              href="#marketplace"
              className="hidden min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink-900 transition-colors hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 min-[400px]:inline-flex"
            >
              Browse meals
            </Link>

            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-clay-500 px-5 text-sm font-semibold text-cream-50 transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate flex min-h-[620px] items-center overflow-hidden bg-ink-900 sm:min-h-[680px] lg:min-h-[720px]">
        <Image
          src="/images/stewrun-hero-lunch.webp"
          alt="A plate of sadza, beef stew, leafy greens, and tomato salad."
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-ink-900/65"
        />

        <div className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-saffron-500 sm:text-sm">
              A pre-order lunch marketplace for Harare
            </p>

            <h1 className="mt-6 max-w-3xl font-display text-4xl leading-[1.08] tracking-tight text-cream-50 sm:text-5xl md:text-6xl lg:text-display">
              Choose your lunch.
              <br />
              <span className="text-saffron-500">Choose your price.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-cream-50/85 sm:text-lg sm:leading-8">
            Set a budget per plate. Tell Ziva what you&apos;re craving in English or Shona, compare independent offers from Harare cooks, and pay in cash when you collect your lunch
            </p>

            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
              <Link
                href="/register?role=customer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-clay-500 px-7 text-sm font-semibold text-cream-50 transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream-50"
              >
                Start a lunch request
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>

              <Link
                href="/register?role=cook"
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-saffron-500 px-7 text-sm font-semibold text-ink-900 transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream-50"
              >
                I&apos;m a cook
              </Link>
            </div>

            <p className="mt-5 flex flex-row items-center gap-2 text-sm leading-6 text-cream-50/75">
              <MapPin
                aria-hidden="true"
                className="size-4 shrink-0 text-saffron-500"
              />
              <span>Plan ahead for lunch and collect at a selected hub.</span>
            </p>
          </div>
        </div>
      </section>

      <PublicMarketplace />

      {/* ───────────── The Office Lunch Challenge ───────────── */}
      <section
        aria-labelledby="office-lunch-heading"
        className="relative isolate overflow-hidden border-y border-ink-900/10 bg-[#FDF4E9]"
      >
        {/* Harare skyline: sits on the right edge and fades out to the left, top and bottom */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[48%]"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, #000 55%)",
            maskImage: "linear-gradient(to right, transparent 0%, #000 55%)",
          }}
        >
          <div
            className="absolute inset-x-0 bottom-[8%] top-[14%] bg-[url('/images/harare-cbd-background.jpg')] bg-cover bg-[position:85%_bottom] opacity-[0.32]"
            style={{
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0%, #000 30%, #000 60%, transparent 100%)",
              maskImage:
                "linear-gradient(to bottom, transparent 0%, #000 30%, #000 60%, transparent 100%)",
            }}
          />
        </div>

        {/* Top-right decorative circles */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-36 size-80 rounded-full border border-clay-500/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-24 size-52 rounded-full bg-gradient-to-br from-saffron-500/20 to-clay-500/10"
        />

        {/* Organic photo shape */}
        <svg
          width="0"
          height="0"
          aria-hidden="true"
          focusable="false"
          className="absolute"
        >
          <defs>
            <clipPath id="office-photo-blob" clipPathUnits="objectBoundingBox">
              <path d="M0 .1842 C0 .1053 .0775 .0526 .2171 .0395 C.4341 .0132 .6202 0 .7442 .0066 C.8992 .0197 .9922 .1974 1 .3947 C1 .5526 .9612 .6842 .938 .7895 C.8992 .9211 .7752 .9803 .5891 .9934 C.4341 1 .2016 1 .093 .9737 C.0155 .9474 0 .8553 0 .7895 Z" />
            </clipPath>
          </defs>
        </svg>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          {/* Left: photo composition */}
          <div className="relative mx-auto w-full max-w-lg px-[6%] lg:max-w-none">
            <div
              className="relative aspect-[645/760]"
              style={{ containerType: "inline-size" }}
            >
              {/* Terracotta swoosh behind the photo */}
              <svg
                aria-hidden="true"
                viewBox="0 0 330 220"
                className="absolute -left-[6%] -top-[3%] w-[51%] overflow-visible text-clay-500"
              >
                <path
                  d="M2 208 C-4 110 48 18 150 4 C235 -6 310 22 322 42 C220 48 130 84 92 150 C70 190 50 214 2 208 Z"
                  fill="currentColor"
                />
              </svg>

              {/* Soft shadow under the photo */}
              <div
                aria-hidden="true"
                className="absolute inset-x-[10%] -bottom-[3%] h-[7%] rounded-full bg-clay-500/25 blur-2xl"
              />

              {/* Photo, clipped to the organic shape */}
              <div
                className="absolute inset-0 overflow-hidden bg-[#6b5546]"
                style={{ clipPath: "url(#office-photo-blob)" }}
              >
                <Image
                  src="/images/office-lunch-worker.jpg"
                  alt="Office professional resting her chin on her hand at her laptop during the workday"
                  fill
                  sizes="(min-width: 1024px) 45vw, 90vw"
                  className="object-cover object-[35%_0%]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#30180a]/95 via-[#30180a]/70 via-20% to-transparent to-50%"
                />
              </div>

              {/* Your midday moment label */}
              <div className="absolute left-[3%] top-[7%] inline-flex items-center gap-2.5 rounded-full bg-cream-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-900 shadow-md sm:text-xs">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full bg-saffron-500"
                />
                Your midday moment
              </div>

              {/* Caption */}
              <div className="absolute bottom-[5.5%] left-[7.75%]">
                <p
                  className="whitespace-nowrap font-display text-2xl leading-[1.04] text-cream-50 sm:text-3xl"
                  style={{ fontSize: "7.6cqw" }}
                >
                  Make your lunch
                  <br />
                  break <span className="text-saffron-500">count.</span>
                </p>
                <span
                  aria-hidden="true"
                  className="block rounded-full bg-saffron-500"
                  style={{
                    marginTop: "2.4cqw",
                    width: "15.8cqw",
                    height: "0.7cqw",
                    minHeight: 3,
                  }}
                />
              </div>

              {/* 01 Lunch first badge */}
              <div
                aria-hidden="true"
                className="absolute left-[80%] top-[82%] flex aspect-square w-[24%] min-w-[84px] flex-col items-center justify-center rounded-full border-[5px] border-cream-50 bg-clay-500 text-center text-white shadow-lg"
              >
                <span className="font-display text-3xl leading-none sm:text-5xl">
                  01
                </span>
                <span className="mt-1 text-[9px] font-bold uppercase leading-tight tracking-[0.1em] sm:text-xs">
                  Lunch
                  <br />
                  first
                </span>
              </div>
            </div>
          </div>

          {/* Right: problem + StewRun solution */}
          <div className="max-w-2xl lg:max-w-none">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="h-0.5 w-12 bg-ink-900/70 sm:w-[70px]"
              />
              <p className="text-sm font-bold uppercase tracking-[0.07em] text-sage-500">
                The office lunch challenge
              </p>
            </div>

            <h2
              id="office-lunch-heading"
              className="mt-5 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl"
            >
              Your workday is busy.
              <span className="block text-clay-500">
                Lunch shouldn&apos;t be.
              </span>
            </h2>
            <span
              aria-hidden="true"
              className="mt-6 block h-1 w-[102px] rounded-full bg-saffron-500"
            />

            <p className="mt-6 max-w-[620px] text-base leading-7 text-ink-900/75">
              Finding a good lunch in Harare shouldn&apos;t mean wasting your
              break, overspending or settling for less. You deserve a better
              way to enjoy your midday meal.
            </p>

            <ol className="mt-8 divide-y divide-ink-900/10">
              {officeProblems.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.number}
                    className="flex items-center gap-4 py-5 sm:gap-5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-clay-500 font-display text-base font-semibold text-white">
                      {item.number}
                    </span>
                    <span
                      aria-hidden="true"
                      className="hidden h-12 w-px bg-ink-900/15 sm:block"
                    />
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.5}
                      className={`size-10 shrink-0 sm:size-12 ${item.iconClass}`}
                    />
                    <div className="sm:pl-2">
                      <h3 className="font-display text-xl tracking-tight text-ink-900 sm:text-2xl">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-sm leading-6 text-ink-900/75 sm:text-base">
                        {item.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* StewRun solution panel */}
            <div className="mt-8 grid gap-5 rounded-[26px] bg-ink-900 px-6 py-6 text-cream-50 shadow-xl sm:px-7 xl:grid-cols-[1fr_auto] xl:items-center xl:gap-6">
              <div className="min-w-0">
                <p className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-500">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full bg-saffron-500"
                  />
                  A better way to lunch
                </p>
                <h3 className="mt-2.5 font-display text-xl leading-tight tracking-tight sm:text-2xl">
                  That&apos;s why we built{" "}
                  <span className="whitespace-nowrap text-saffron-500">
                    StewRun.
                  </span>
                </h3>
                <p className="mt-1.5 text-sm leading-5 text-cream-50/85">
                  Plan ahead. Compare meals. Collect with ease.
                </p>
              </div>

              <ul className="grid grid-cols-3 divide-x divide-cream-50/20 border-t border-cream-50/20 pt-4 xl:flex xl:border-l xl:border-t-0 xl:pt-0">
                {stewrunBenefits.map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <li
                      key={benefit.lines.join(" ")}
                      className="flex flex-col items-center gap-1.5 px-2 text-center xl:w-[88px]"
                    >
                      <Icon
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-6 text-saffron-500"
                      />
                      <span className="font-display text-[13px] leading-tight">
                        {benefit.lines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

       <HowItWorks />
       <BudgetChoice />
      <LocalCooks />

 <PickupHubs />
<FinalCta />
<SiteFooter />
    </main>
  );
}

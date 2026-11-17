import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  CookingPot,
  DollarSign,
  MapPin,
  MessageSquareText,
} from "lucide-react";
import PublicMarketplace from "@/components/public-marketplace";

const steps = [
  {
    number: "01",
    icon: MessageSquareText,
    title: "Name your meal and budget",
    description:
      "Choose plates, a pickup hub and time, then set a budget per plate.",
  },
  {
    number: "02",
    icon: ClipboardList,
    title: "Compare and choose",
    description:
      "Cooks set their own prices. Compare each meal and total, then choose.",
  },
  {
    number: "03",
    icon: MapPin,
    title: "Collect and pay in cash",
    description:
      "Show your pickup code and pay the cook directly when you collect.",
  },
];

const pickupHubs = [
  "Joina City Mall",
  "Eastgate Mall",
  "Avondale Shopping Centre",
];

function Brand() {
  return (
    <Link
      href="/"
      aria-label="StewRun home"
      className="inline-flex min-h-11 items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-clay-500"
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
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream-50 text-ink-900">
      <header className="border-b border-ink-900/10">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-2 px-5 sm:gap-4 sm:px-8">
          <Brand />
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-0 sm:gap-4"
          >
            <Link
              href="#marketplace"
              className="hidden min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink-900 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:inline-flex"
            >
              Browse meals
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md px-1.5 text-sm font-semibold text-ink-900 hover:text-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:px-3"
            >
              Sign In
            </Link>
            <Link
              href="/start"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-clay-500 px-2 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500 sm:px-4"
            >
              Plan a lunch
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 lg:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
            A pre-order lunch marketplace for Harare
          </p>
          <h1 className="mt-4 font-display text-5xl leading-[1.04] tracking-tight text-ink-900 sm:text-6xl">
            Choose your lunch. Choose your price.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-900/75 sm:text-lg sm:leading-8">
            Set a budget per plate. Compare independent offers from Harare cooks.
            Choose the meal you want, then pay the cook in cash when you collect it.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/start"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-clay-500 px-6 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              Start a lunch request
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href="/register?role=cook"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-ink-900/20 bg-white px-6 text-sm font-semibold text-ink-900 hover:bg-ink-900/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              I&apos;m a cook
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-ink-900/20 bg-white px-6 text-sm font-semibold text-ink-900 hover:bg-ink-900/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
            >
              How It Works
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-ink-900/65">
            Plan ahead for lunch and collect at a selected hub.
          </p>
          <Link
            href="#marketplace"
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-semibold text-clay-700 underline decoration-clay-500/40 underline-offset-4 hover:decoration-clay-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
          >
            Browse meals <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <figure className="w-full">
          <div className="relative aspect-[3/2] overflow-hidden rounded-md bg-white">
            <Image
              src="/images/stewrun-hero-lunch.webp"
              alt="A plate of sadza, beef stew, leafy greens, and tomato salad."
              fill
              sizes="(max-width: 1023px) 100vw, 58vw"
              preload
              className="object-cover"
            />
          </div>
          <figcaption className="mt-3 flex items-center gap-2 text-xs leading-5 text-ink-900/60">
            <MapPin aria-hidden="true" className="size-4 text-clay-500" />
            Scheduled pre-order lunch, collected at an approved hub
          </figcaption>
        </figure>
      </section>

      <PublicMarketplace />

      <section className="border-y border-ink-900/10 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[0.8fr_1.2fr] md:gap-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              The office lunch challenge
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
              A lunch break is too short for guesswork.
            </h2>
          </div>
          <div className="max-w-2xl">
            <p className="text-base leading-7 text-ink-900/75">
              Balancing lunch cost, queues, and uncertainty about what will be
              available can make a workday break harder to plan.
            </p>
            <p className="mt-4 text-base leading-7 text-ink-900/75">
              StewRun offers a practical way to plan ahead: describe what you
              want, see independent cook offers before deciding, and choose
              where to collect your meal.
            </p>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="how-it-works-heading"
        className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16"
      >
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
            A clear way to plan
          </p>
          <h2
            id="how-it-works-heading"
            className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
          >
            From your idea to pickup.
          </h2>
        </div>
        <ol className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map(({ number, icon: Icon, title, description }) => (
            <li key={number} className="border-t border-ink-900/15 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-clay-500">
                  {number}
                </span>
                <Icon aria-hidden="true" className="size-5 text-sage-500" />
              </div>
              <h3 className="mt-4 font-display text-xl tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-ink-900/70">
                {description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-ink-900/10 bg-[#f1e7d8]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[auto_1fr] md:items-start md:gap-10">
          <div className="flex size-12 items-center justify-center rounded-md bg-white text-clay-500">
            <DollarSign aria-hidden="true" className="size-6" />
          </div>
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Your budget, your choice
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
              Set a target. Decide when you see the offers.
            </h2>
            <p className="mt-4 text-base leading-7 text-ink-900/75">
              You set a target budget per plate to show what you have in mind.
              Cooks independently choose the prices in their offers, so the
              price may be above or below your target. Compare the offers and
              decide which, if any, you want to accept.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[0.7fr_1.3fr] md:items-center md:gap-12">
        <div className="flex items-center gap-4">
          <CookingPot
            aria-hidden="true"
            className="size-9 shrink-0 text-clay-500"
          />
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Local cooks, your way.
          </h2>
        </div>
        <p className="max-w-2xl text-base leading-7 text-ink-900/75">
          Approved home cooks and small caterers can respond to customer
          requests with their own meal offers. You choose whether an offer
          suits your lunch plans.
        </p>
      </section>

      <section
        aria-labelledby="pickup-hubs-heading"
        className="border-y border-ink-900/10 bg-white"
      >
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sage-500">
              Pick up on your schedule
            </p>
            <h2
              id="pickup-hubs-heading"
              className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
            >
              Approved pickup hubs in Harare.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-ink-900/70">
              Choose a hub for scheduled collection. StewRun is pre-order and
              pickup, not doorstep delivery.
            </p>
          </div>
          <ul className="divide-y divide-ink-900/10 border-y border-ink-900/10">
            {pickupHubs.map((hub) => (
              <li
                key={hub}
                className="flex min-h-14 items-center gap-3 py-3"
              >
                <MapPin
                  aria-hidden="true"
                  className="size-5 shrink-0 text-clay-500"
                />
                <span className="text-sm font-semibold">{hub}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-ink-900 text-cream-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-14 sm:px-8 sm:py-16 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-clay-300">
              Plan your next lunch
            </p>
            <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
              Your next lunch starts with what you want.
            </h2>
            <p className="mt-3 text-sm leading-6 text-cream-50/75">
              Create an account to describe your meal and review cook offers.
            </p>
          </div>
          <Link
            href="/start"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-clay-500 px-6 text-sm font-semibold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50"
          >
            Start a lunch request
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-900/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-ink-900/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>StewRun · Harare</span>
          <span>Scheduled lunch pre-orders and hub collection.</span>
        </div>
      </footer>
    </main>
  );
}

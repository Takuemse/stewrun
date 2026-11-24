import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  MapPin,
  MessageCircle,
  Columns2,
} from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageCircle,
    title: "Tell Ziva",
    description:
      "Describe your meal in English or Shona and set a target budget per plate.",
  },
  {
    number: "02",
    icon: Columns2,
    title: "Compare offers",
    description:
      "Cooks send their own offers and set their own prices. Compare each plate side by side.",
  },
  {
    number: "03",
    icon: CircleCheck,
    title: "Choose your plate",
    description:
      "Accept the offer you like, if any, and pre-order so lunch is planned before your break.",
  },
  {
    number: "04",
    icon: MapPin,
    title: "Collect and pay cash",
    description:
      "Pick up at your selected hub and pay in cash. That’s the whole lunch.",
  },
];

const hubs = ["Joina City Mall", "Eastgate Mall", "Avondale Shopping Centre"];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="border-b border-ink-900/10 bg-cream-50"
    >
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        {/* Heading row */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="h-0.5 w-12 bg-ink-900/70 sm:w-[70px]"
              />
              <p className="text-sm font-bold uppercase tracking-[0.07em] text-sage-500">
                How it works
              </p>
            </div>
            <h2
              id="how-it-works-heading"
              className="mt-5 font-display text-4xl leading-[1.05] tracking-tight text-ink-900 sm:text-5xl"
            >
              Four steps.
              <span className="block text-clay-500">One better lunch.</span>
            </h2>
            <span
              aria-hidden="true"
              className="mt-6 block h-1 w-[102px] rounded-full bg-saffron-500"
            />
          </div>

          <p className="max-w-md text-base leading-7 text-ink-900/75">
            Plan ahead, set your budget and let Harare cooks come to you. No
            queues, no guessing, and you pay in cash when you collect.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mt-14 sm:mt-16">
          <div
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-9 hidden border-t-2 border-dashed border-saffron-500/50 lg:block"
          />

          <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;

              return (
                <li
                  key={step.number}
                  className={
                    isLast
                      ? "flex flex-col gap-4 rounded-3xl bg-clay-500 px-6 pb-7 pt-3 text-cream-50 shadow-xl lg:-mt-3"
                      : "flex flex-col gap-4"
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-[72px] items-center justify-center rounded-full border-2 border-saffron-500 shadow-md ${
                      isLast ? "mt-3 bg-cream-50" : "bg-white"
                    }`}
                  >
                    <Icon
                      strokeWidth={1.5}
                      className="size-8 text-clay-500"
                    />
                  </span>

                  <span
                    aria-hidden="true"
                    className={`font-display text-6xl leading-none ${
                      isLast ? "text-cream-50/50" : "text-clay-500/25"
                    }`}
                  >
                    {step.number}
                  </span>

                  <h3 className="font-display text-2xl tracking-tight">
                    {step.title}
                  </h3>
                  <p
                    className={`text-sm leading-6 sm:text-base ${
                      isLast ? "text-cream-50/90" : "text-ink-900/75"
                    }`}
                  >
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Dark closing strip, echoing the Office Lunch Challenge panel */}
        <div className="mt-14 grid gap-6 rounded-[26px] bg-ink-900 px-6 py-7 text-cream-50 shadow-xl sm:px-9 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10">
          <div>
            <p className="flex items-center gap-2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] text-saffron-500">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full bg-saffron-500"
              />
              Pickup hubs
            </p>
            <p className="mt-2 font-display text-2xl leading-tight tracking-tight">
              Lunch, <span className="text-saffron-500">ready where you are.</span>
            </p>
          </div>

          <ul className="flex flex-wrap gap-2.5">
            {hubs.map((hub) => (
              <li
                key={hub}
                className="rounded-full bg-cream-50/10 px-4 py-2.5 text-sm text-cream-50"
              >
                {hub}
              </li>
            ))}
          </ul>

          <Link
            href="/register?role=customer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-saffron-500 px-6 text-sm font-semibold text-ink-900 transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream-50"
          >
            Start a lunch request
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

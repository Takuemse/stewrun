"use client";

import { useId, useState } from "react";

/* All money is handled in cents to avoid floating-point drift. */
const MIN = 150;
const MAX = 500;
const STEP = 10;
const STANDARD = 350;
const DEFAULT_TARGET = 250;

/* Theme tokens with fallbacks, so the slider looks right even if a
   Tailwind utility has not been generated yet. */
const CLAY = "var(--color-clay-500, #C0563C)";
const SAFFRON = "var(--color-saffron-500, #E8A33D)";
const SAGE = "var(--color-sage-500, #6B8A6F)";

const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

type ExampleOffer = {
  id: string;
  cook: string;
  meal: string;
  price: number;
};

/* Illustrative offers only. Real prices are set by each cook. */
const exampleOffers: ExampleOffer[] = [
  { id: "a", cook: "Tanya’s Kitchen", meal: "Beef stew & sadza", price: 240 },
  { id: "b", cook: "Chef Chenai", meal: "Chicken curry & rice", price: 280 },
  { id: "c", cook: "Mai Rugare", meal: "Vegetarian plate", price: 220 },
  { id: "d", cook: "Test Cook", meal: "Grilled chicken & veg", price: 300 },
];

const roles = [
  { top: "You set", bottom: "the target", accent: false },
  { top: "Cooks set", bottom: "the price", accent: false },
  { top: "You decide", bottom: "what to accept", accent: true },
];

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const pct = (cents: number) => ((cents - MIN) / (MAX - MIN)) * 100;

function getOfferComparison(price: number, target: number) {
  const difference = Math.abs(price - target);

  if (price < target) {
    return {
      label: `Below target · ${money(difference)} less`,
      background: tint(SAGE, 20),
    };
  }

  if (price > target) {
    return {
      label: `Above target · ${money(difference)} more`,
      background: tint(SAFFRON, 30),
    };
  }

  return {
    label: "At target",
    background: tint(CLAY, 15),
  };
}

export default function BudgetChoice() {
  const sliderId = useId();
  const [target, setTarget] = useState(DEFAULT_TARGET);
  const [focused, setFocused] = useState(false);

  const fill = pct(target);

  return (
    <section
      id="budget"
      aria-labelledby="budget-heading"
      className="border-y border-ink-900/10 bg-[#f1e7d8]"
    >
      <style>{`
        .budget-range{-webkit-appearance:none;appearance:none;background:transparent;margin:0}
        .budget-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:26px;height:26px;border-radius:50%}
        .budget-range::-moz-range-thumb{width:26px;height:26px;border:0;border-radius:50%}
        .budget-range::-webkit-slider-runnable-track{background:transparent}
        .budget-range::-moz-range-track{background:transparent}
      `}</style>

      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        {/* Left: copy */}
        <div>
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="h-0.5 w-12 bg-ink-900/70 sm:w-[70px]"
            />
            <p className="text-sm font-bold uppercase tracking-[0.07em] text-sage-500">
              Your budget, your choice
            </p>
          </div>

          <h2
            id="budget-heading"
            className="mt-5 font-display text-4xl leading-[1.08] tracking-tight text-ink-900 sm:text-5xl"
          >
            Set your budget.
            <span className="block text-clay-500">
              Decide when you see the offers.
            </span>
          </h2>

          <span
            aria-hidden="true"
            className="mt-6 block h-1 w-[102px] rounded-full bg-saffron-500"
          />

          <p className="mt-6 max-w-[540px] text-base leading-7 text-ink-900/75">
            You set a target budget per plate to guide your choices. Cooks
            independently set their prices, which may be above or below your
            target. Compare the offers and decide which, if any, works for you.
          </p>

          <ul className="mt-8 flex max-w-lg flex-col gap-4 sm:flex-row sm:gap-0">
            {roles.map((role, i) => (
              <li
                key={role.top}
                className="sm:px-5 sm:first:pl-0"
                style={
                  i > 0
                    ? { borderLeft: "1px solid rgba(42,33,28,0.15)" }
                    : undefined
                }
              >
                <span
                  className={`block font-display text-xl tracking-tight ${
                    role.accent ? "text-clay-500" : "text-ink-900"
                  }`}
                >
                  {role.top}
                </span>
                <span className="text-sm text-ink-900/70">
                  {role.bottom}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: working preview */}
        <div
          className="rounded-[28px] p-4 shadow-xl sm:p-7"
          style={{ background: "#FDF4E9" }}
        >
          {/* Slider card */}
          <div
            className="rounded-[20px] px-5 pb-5 pt-5 sm:px-6"
            style={{ background: "#fff" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                htmlFor={sliderId}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                style={{ background: CLAY }}
              >
                Your budget per plate
              </label>

              <output
                htmlFor={sliderId}
                className="rounded-full px-5 py-0.5 font-display text-3xl text-ink-900 sm:text-4xl"
                style={{ background: tint(SAFFRON, 25) }}
              >
                {money(target)}
              </output>
            </div>

            <div style={{ position: "relative", height: 32, marginTop: 32 }}>
              <input
                id={sliderId}
                className="budget-range"
                type="range"
                min={MIN}
                max={MAX}
                step={STEP}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-valuetext={`${money(target)} per plate`}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                  zIndex: 2,
                }}
              />

              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 13,
                  right: 13,
                  top: 0,
                  bottom: 0,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "50%",
                    height: 10,
                    transform: "translateY(-50%)",
                    borderRadius: 999,
                    background: "rgba(42,33,28,0.12)",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "50%",
                    height: 10,
                    width: `${fill}%`,
                    transform: "translateY(-50%)",
                    borderRadius: 999,
                    background: CLAY,
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: `${fill}%`,
                    width: 26,
                    height: 26,
                    transform: "translate(-50%, -50%)",
                    borderRadius: "50%",
                    background: SAFFRON,
                    border: "4px solid #fff",
                    boxSizing: "border-box",
                    boxShadow: focused
                      ? `0 0 0 2px #fff, 0 0 0 4px ${CLAY}`
                      : "0 2px 8px rgba(0,0,0,0.25)",
                  }}
                />
              </div>
            </div>

            {/* Price levels */}
            <div
              className="text-sm text-ink-900"
              style={{ position: "relative", height: 44, marginTop: 12 }}
            >
              <button
                type="button"
                onClick={() => setTarget(MIN)}
                className="rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                style={{ position: "absolute", left: 0 }}
              >
                <span className="block font-semibold">Budget</span>
                {money(MIN)}
              </button>

              <button
                type="button"
                onClick={() => setTarget(STANDARD)}
                className="rounded-sm text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                style={{
                  position: "absolute",
                  left: `${pct(STANDARD)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <span className="block font-semibold">Standard</span>
                {money(STANDARD)}
              </button>

              <button
                type="button"
                onClick={() => setTarget(MAX)}
                className="rounded-sm text-right focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                style={{ position: "absolute", right: 0 }}
              >
                <span className="block font-semibold">Premium</span>
                {money(MAX)}+
              </button>
            </div>
          </div>

          {/* Illustrative cook offers */}
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {exampleOffers.map((offer) => {
              const comparison = getOfferComparison(offer.price, target);

              return (
                <li
                  key={offer.id}
                  className="flex flex-col gap-2 rounded-[18px] p-5 shadow-sm"
                  style={{
                    background: "#fff",
                    border: "2px solid transparent",
                  }}
                >
                  <p className="font-display text-lg leading-snug tracking-tight text-ink-900">
                    {offer.cook}
                    <span className="block text-base text-ink-900/70">
                      {offer.meal}
                    </span>
                  </p>

                  <p className="font-display text-2xl text-ink-900">
                    {money(offer.price)}
                    <span className="ml-1 text-sm text-ink-900/60">
                      / plate
                    </span>
                  </p>

                  <span
                    className="self-start rounded-full px-3 py-1 text-xs font-semibold text-ink-900"
                    style={{ background: comparison.background }}
                  >
                    {comparison.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 text-center text-xs text-ink-900/60">
            Example offers shown for illustration. Real prices are set by each
            cook.
          </p>

          <p className="sr-only" aria-live="polite">
            Your target is {money(target)} per plate.{" "}
            {exampleOffers
              .map(
                (offer) =>
                  `${offer.cook} offers ${offer.meal} at ${money(offer.price)} per plate.`
              )
              .join(" ")}
          </p>
        </div>
      </div>
    </section>
  );
}

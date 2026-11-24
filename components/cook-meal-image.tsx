
"use client";

import { useState } from "react";
import { getMealImage } from "@/lib/meal-image";

export function pickMealImage(name: string): string | null {
  return getMealImage(name)?.src ?? null;
}

type OfferingImageProps = {
  name: string;
  description?: string;
  className?: string;
  // true: render nothing when there is no matching photo (used on the add form).
  hideIfNone?: boolean;
};

function PlainTile({ className = "" }: { className?: string }) {
  return (
    <div className={`mn-img none ${className}`.trim()} aria-hidden="true">
      <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#8E6A3F"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="13" r="7" />
        <circle cx="12" cy="13" r="3.5" />
        <path d="M4 4v5M6 4v5M5 9v6M19 4c-1.5 1.5-1.5 4.5 0 6v5" />
      </svg>
      <span className="mn-tag">Illustrative photo</span>
    </div>
  );
}

export default function OfferingImage({
  name,
  hideIfNone = false,
  className = "",
}: OfferingImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Image matching currently uses the meal name only.
  const image = getMealImage(name);
  const src = image?.src ?? null;

  if (!src || src === failedSrc) {
    return hideIfNone ? null : <PlainTile className={className} />;
  }

  return (
    <div className={`mn-img ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={image?.alt ?? `Illustrative photo for ${name}`}
        loading="lazy"
        onError={() => setFailedSrc(src)}
      />
      <span className="mn-tag">Illustrative photo</span>
    </div>
  );
}

import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/images/stewrun-logo.svg"
      alt=""
      aria-hidden="true"
      width={150}
      height={42}
      unoptimized
      className={className}
    />
  );
}

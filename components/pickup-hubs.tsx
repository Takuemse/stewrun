import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

/* Add real hub photos at public/images/hubs/<file>. Until a file exists,
   a warm placeholder tile is shown. Leave `area` out until confirmed. */
const hubs: { name: string; area?: string; photo: string }[] = [
  {
    name: "Joina City Mall",
    area: "Harare CBD",
    photo: "/images/hubs/joina-city.jpg",
  },
  { name: "Eastgate Mall", photo: "/images/hubs/eastgate.jpg" },
  {
    name: "Avondale Shopping Centre",
    area: "Avondale",
    photo: "/images/hubs/avondale.jpg",
  },
];

const steps = ["1 · Pre-order", "2 · Pick your hub", "3 · Collect"];

const hasFile = (src: string) =>
  existsSync(path.join(process.cwd(), "public", src.replace(/^\//, "")));

export default function PickupHubs() {
  return (
    <section
      id="pickup-hubs"
      aria-labelledby="pickup-hubs-heading"
      className="relative isolate overflow-hidden border-t border-ink-900/10 bg-cream-50"
    >
      <style>{`
        .hubs-grid{display:grid;gap:40px;align-items:center}
        .hubs-route{position:relative;display:flex;flex-direction:column;gap:20px}
        .hubs-line{position:absolute;left:21px;top:40px;bottom:40px;
          border-left:2px dashed rgba(232,160,48,.55)}
        .hubs-row{position:relative;display:flex;align-items:center;gap:14px}
        .hubs-node{flex:none;width:44px;height:44px;border-radius:50%;
          background:#FDF4E9;border:2px solid #E8A030;display:flex;
          align-items:center;justify-content:center;z-index:1}
        .hubs-card{flex:1;min-width:0;display:flex;align-items:center;gap:14px;
          background:#fff;border-radius:20px;padding:12px 14px 12px 12px;
          box-shadow:0 8px 20px rgba(120,70,30,.10);transition:box-shadow .2s}
        .hubs-card:hover{box-shadow:0 12px 28px rgba(120,70,30,.18)}
        .hubs-photo{position:relative;flex:none;width:72px;height:60px;
          border-radius:12px;overflow:hidden;
          background:linear-gradient(135deg,#E9C9A0,#B98A5E);
          display:flex;align-items:center;justify-content:center}
        .hubs-arrow{flex:none;width:40px;height:40px;border-radius:50%;
          background:#F1E7D8;display:flex;align-items:center;justify-content:center}
        .hubs-pills{display:flex;flex-wrap:wrap;gap:10px;margin:28px 0 0;
          padding:0;list-style:none}
        .hubs-sky{position:absolute;top:0;bottom:0;right:0;width:100%;z-index:-1;
          pointer-events:none;
          -webkit-mask-image:linear-gradient(to right,transparent 0%,#000 60%);
          mask-image:linear-gradient(to right,transparent 0%,#000 60%)}
        .hubs-sky-img{position:absolute;left:0;right:0;bottom:0;top:18%;
          background-image:url('/images/harare-cbd-background.jpg');
          background-size:cover;background-position:85% bottom;
          background-repeat:no-repeat;opacity:.3;
          -webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 35%,#000 100%);
          mask-image:linear-gradient(to bottom,transparent 0%,#000 35%,#000 100%)}
        @media (min-width:640px){
          .hubs-photo{width:84px;height:64px}
          .hubs-card{gap:16px;padding:14px 18px 14px 14px}
          .hubs-row{gap:16px}
        }
        @media (min-width:1024px){
          .hubs-grid{grid-template-columns:1fr 1.05fr;gap:64px}
          .hubs-sky{width:48%}
        }
      `}</style>

      {/* Harare skyline, fading in from the right (same treatment as the
          Office Lunch Challenge section) */}
      <div aria-hidden="true" className="hubs-sky">
        <div className="hubs-sky-img" />
      </div>

      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="hubs-grid">
          {/* Copy */}
          <div>
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="h-0.5 w-12 bg-ink-900/70 sm:w-[70px]"
              />
              <p className="text-sm font-bold uppercase tracking-[0.07em] text-sage-500">
                Pick up on your schedule
              </p>
            </div>

            <h2
              id="pickup-hubs-heading"
              className="mt-5 font-display text-4xl leading-[1.06] tracking-tight text-ink-900 sm:text-5xl"
            >
              Approved pickup
              <span className="block">
                hubs in <span className="text-clay-500">Harare.</span>
              </span>
            </h2>
            <span
              aria-hidden="true"
              className="mt-6 block h-1 w-[102px] rounded-full bg-saffron-500"
            />

            <p className="mt-6 max-w-md text-base leading-7 text-ink-900/75">
              Choose a hub for scheduled collection. StewRun is pre-order and
              pickup, not doorstep delivery.
            </p>

            <ol className="hubs-pills">
              {steps.map((step) => (
                <li
                  key={step}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900"
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Pickup route */}
          <div className="hubs-route">
            <span aria-hidden="true" className="hubs-line" />
            {hubs.map((hub) => (
              <div key={hub.name} className="hubs-row">
                <span aria-hidden="true" className="hubs-node">
                  <MapPin className="size-5 text-clay-500" strokeWidth={1.8} />
                </span>
                <Link
                  href="#marketplace"
                  className="hubs-card text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay-500"
                >
                  <span className="hubs-photo">
                    {hasFile(hub.photo) ? (
                      <Image
                        src={hub.photo}
                        alt={`${hub.name} building`}
                        fill
                        sizes="84px"
                        className="object-cover"
                      />
                    ) : (
                      <MapPin
                        aria-hidden="true"
                        className="size-6 text-[#5A341D]/60"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg leading-tight tracking-tight sm:text-xl">
                      {hub.name}
                    </span>
                    {hub.area && (
                      <span className="mt-0.5 block text-sm text-ink-900/70">
                        {hub.area}
                      </span>
                    )}
                  </span>
                  <span aria-hidden="true" className="hubs-arrow">
                    <ArrowRight className="size-[18px] text-ink-900" />
                  </span>
                  <span className="sr-only">Browse meals for pickup</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

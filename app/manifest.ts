import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StewRun — Harare lunch marketplace",
    short_name: "StewRun",
    description:
      "Discover local cooks, compare lunch offers and collect your meal at a Harare hub.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F0",
    theme_color: "#FBF7F0",
    icons: [
      {
        src: "/icons/stewrun-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/stewrun-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

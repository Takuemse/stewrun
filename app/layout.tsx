import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, JetBrains_Mono } from "next/font/google";
import PwaRegistration from "@/components/pwa-registration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StewRun | Home-cooked meals, made local",
  description:
    "Discover local cooks, compare lunch offers and pay your cook in cash at pickup with StewRun.",
  applicationName: "StewRun",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "StewRun",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}

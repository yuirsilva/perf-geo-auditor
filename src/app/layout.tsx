import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { preload } from "react-dom";
import { SkeletonSuspense, SkulletProvider, type SkulletConfig } from "skullet/react";
import { UserNav, UserNavView } from "@/components/user-nav";
import { GlazePortalProvider } from "@/lib/glaze/portal";
import { SAMPLE_EMAIL } from "@/lib/sample-data";
import "./globals.css";
import "@/components/glaze/styles.css";

export const metadata: Metadata = {
  title: "Perf & GEO Auditor",
  description:
    "AI-powered Core Web Vitals and GEO audits: real-user data, Lighthouse, and root-cause fixes you can ship.",
};

// Glaze only goes dark with data-theme="dark"; it ignores the OS setting on its own. This sets it from
// prefers-color-scheme before first paint and follows changes, so the app keeps matching the system.
const themeScript = `(()=>{const m=matchMedia("(prefers-color-scheme: dark)");const s=()=>{document.documentElement.dataset.theme=m.matches?"dark":"light"};s();m.addEventListener("change",s)})()`;

// Skullet measures each skeleton from the real view rendered with sample data, so it takes exactly the content's
// space. Themed to Glaze's own skeleton (field fill, tag corner) and held still: Glaze allows no pulse or shimmer
// on a skeleton. Glaze's tokens already swap for dark mode, so one set of colours serves both.
const fill = { base: "var(--field)", highlight: "var(--field)" };
const SKULLET: SkulletConfig = {
  theme: { light: fill, dark: fill, radius: "var(--radius-tag)", animation: "none" },
  mode: "light",
  // A plain crossfade: Glaze has no staged entrances. Skullet holds it still under reduced motion.
  reveal: "together",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // One variable file holds every upright weight, so fetch it with the HTML.
  preload("/fonts/inter/Inter-latin.woff2", { as: "font", type: "font/woff2", crossOrigin: "" });

  return (
    // The theme script sets data-theme before React hydrates, so the attribute differs from the server's.
    <html lang="en" suppressHydrationWarning>
      <body className="glaze">
        <Script id="glaze-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <GlazePortalProvider>
          <SkulletProvider {...SKULLET}>
          <div className="flex min-h-dvh flex-col bg-page text-text-1">
            <header className="sticky top-0 z-(--z-sticky) border-b border-line-faint bg-page">
              <div className="mx-auto flex w-full max-w-224 items-center justify-between gap-3 px-4 py-2">
                <Link href="/" className="type-label">
                  Perf & GEO Auditor
                </Link>
                {/* Reads the session, so it streams in behind its own boundary */}
                <SkeletonSuspense skeleton={<UserNavView email={SAMPLE_EMAIL} />} label="Loading account">
                  <UserNav />
                </SkeletonSuspense>
              </div>
            </header>
            <main className="mx-auto w-full max-w-224 flex-1 px-4 py-8">{children}</main>
          </div>
          </SkulletProvider>
        </GlazePortalProvider>
      </body>
    </html>
  );
}

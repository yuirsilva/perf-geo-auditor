import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { UserNav } from "@/components/user-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Perf & GEO Auditor",
  description:
    "AI-powered Core Web Vitals and GEO audits: real-user data, Lighthouse, and root-cause fixes you can ship.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Sticky translucent material: long reports scroll under it and home stays one click away.
            globals.css makes it solid for prefers-reduced-transparency. */}
        <header className="header-material sticky top-0 z-10 border-b border-border bg-background/75 backdrop-blur-md backdrop-saturate-150">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              Perf & GEO Auditor
            </Link>
            {/* Reads the session, so it streams in behind its own boundary */}
            <Suspense fallback={<span className="text-sm text-muted">…</span>}>
              <UserNav />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}

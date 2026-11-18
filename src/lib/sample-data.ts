import type { Audit } from "@/db/schema";

/**
 * Stand-in data for skeletons. Skullet renders the real view with these, unseen, and measures it into the skeleton,
 * so the values only need realistic lengths: a skeleton takes exactly the space the real content will.
 */

const created = new Date("2026-11-17T20:47:00Z");

export const SAMPLE_AUDIT_ROWS = [
  { id: "sample-1", url: "https://www.theguardian.com/", status: "done", createdAt: created, collectMs: 33000, diagnoseMs: 36000, costUsd: 0.005 },
  { id: "sample-2", url: "https://www.nytimes.com/", status: "failed", createdAt: created, collectMs: null, diagnoseMs: null, costUsd: null },
  { id: "sample-3", url: "https://example.com/", status: "done", createdAt: created, collectMs: 32000, diagnoseMs: 35000, costUsd: 0.005 },
] satisfies Pick<Audit, "id" | "url" | "status" | "createdAt" | "collectMs" | "diagnoseMs" | "costUsd">[];

export const SAMPLE_EMAIL = "aleksandra.wisniewska@northwind.example";

const fieldMetric = (p75: number) => ({ p75, category: "FAST" });
const labMetric = (value: number, display: string) => ({ value, display });

export const SAMPLE_AUDIT: Audit = {
  id: "sample",
  userId: "sample",
  url: "https://www.theguardian.com/",
  status: "done",
  error: null,
  psi: {
    strategy: "mobile",
    fetchedAt: created.toISOString(),
    finalUrl: "https://www.theguardian.com/",
    lighthouseVersion: "13.6.0",
    categories: { performance: 92, accessibility: 96, "best-practices": 100, seo: 92 },
    field: {
      scope: "url",
      lcpMs: fieldMetric(1800),
      inpMs: fieldMetric(120),
      cls: fieldMetric(0.04),
      fcpMs: fieldMetric(1200),
      ttfbMs: fieldMetric(600),
      overall: "FAST",
    },
    lab: {
      lcp: labMetric(2100, "2.1 s"),
      cls: labMetric(0.02, "0.02"),
      tbt: labMetric(180, "180 ms"),
      fcp: labMetric(1300, "1.3 s"),
      speedIndex: labMetric(2400, "2.4 s"),
      ttfb: labMetric(600, "600 ms"),
    },
    failingAudits: [],
  },
  crawl: null,
  diagnosis: {
    summary:
      "The page is fast for real users and passes all three Core Web Vitals. The lab run is slower on mobile because the hero image loads late; preloading it is the most useful fix.",
    fieldVsLab:
      "Real users see a faster LCP than the lab run, which throttles to a slow phone on a slow network. Both agree that layout shift is not a problem.",
    issues: [
      {
        title: "Hero image is discovered late",
        category: "performance",
        metric: "LCP",
        severity: "high",
        evidence: "The LCP element is the hero image, requested 900 ms after the HTML arrives.",
        rootCause: "The image is set from CSS, so the browser finds it only after the stylesheet loads.",
        fix: "Preload the hero image and give it fetchpriority high.",
        codeSnippet: "",
        estimatedImpact: "About 400 ms faster LCP on mobile.",
      },
      {
        title: "Page has no meta description",
        category: "seo",
        metric: "none",
        severity: "medium",
        evidence: "No meta name=description tag in the head.",
        rootCause: "The template leaves the description empty on section fronts.",
        fix: "Write a one-sentence description for each section front.",
        codeSnippet: "",
        estimatedImpact: "Better snippets in search and AI answers.",
      },
    ],
    structuredData: { assessment: "The page has valid Organization data and no WebSite data.", recommendedJsonLd: "" },
    aiCrawlers: { assessment: "AI crawlers can reach the page; llms.txt is missing.", recommendations: ["Add an llms.txt."] },
  },
  model: "claude-haiku-5-5",
  inputTokens: 9000,
  outputTokens: 2400,
  costUsd: 0.005,
  collectMs: 33000,
  diagnoseMs: 36000,
  createdAt: created,
  updatedAt: created,
};

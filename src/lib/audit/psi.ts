import "server-only";

/**
 * PageSpeed Insights API v5: one call returns BOTH
 *  - Lighthouse lab data (lighthouseResult), and
 *  - CrUX real-user field data (loadingExperience / originLoadingExperience).
 * It runs Lighthouse on Google's infra, so no headless Chrome is needed here
 * (which also keeps this deployable on serverless).
 */

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

export type FieldMetric = { p75: number; category: string } | null;

export type FieldData = {
  scope: "url" | "origin";
  lcpMs: FieldMetric;
  inpMs: FieldMetric;
  cls: FieldMetric; // CrUX reports CLS x100 as an integer; we convert back
  fcpMs: FieldMetric;
  ttfbMs: FieldMetric;
  overall: string | null;
} | null;

export type LabMetric = { value: number; display: string } | null;

export type AuditDetail = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue: string | null;
  savingsMs: Record<string, number> | null;
  /** First rows of the audit's details table, with long strings truncated */
  items: unknown[];
};

export type PsiSummary = {
  strategy: "mobile" | "desktop";
  fetchedAt: string;
  finalUrl: string;
  lighthouseVersion: string;
  categories: Record<string, number | null>; // 0–100
  field: FieldData;
  lab: {
    lcp: LabMetric;
    cls: LabMetric;
    tbt: LabMetric;
    fcp: LabMetric;
    speedIndex: LabMetric;
    ttfb: LabMetric;
  };
  /** Failing / non-perfect audits, most impactful first. Claude can pull details by id. */
  failingAudits: AuditDetail[];
};

// --- minimal shapes of the PSI response we read -----------------------------

type CruxMetric = { percentile: number; category: string };
type LoadingExperience = {
  id?: string;
  overall_category?: string;
  metrics?: Record<string, CruxMetric | undefined>;
};
type LhAudit = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  metricSavings?: Record<string, number>;
  details?: { type?: string; items?: unknown[] };
};
type PsiResponse = {
  loadingExperience?: LoadingExperience;
  originLoadingExperience?: LoadingExperience;
  lighthouseResult?: {
    finalDisplayedUrl?: string;
    finalUrl?: string;
    lighthouseVersion: string;
    categories: Record<string, { score: number | null }>;
    audits: Record<string, LhAudit>;
  };
  error?: { message: string };
};

// ---------------------------------------------------------------------------

function field(exp: LoadingExperience | undefined, scope: "url" | "origin"): FieldData {
  const m = exp?.metrics;
  if (!m || Object.keys(m).length === 0) return null;
  const pick = (key: string, scale = 1): FieldMetric =>
    m[key] ? { p75: m[key]!.percentile / scale, category: m[key]!.category } : null;
  return {
    scope,
    lcpMs: pick("LARGEST_CONTENTFUL_PAINT_MS"),
    inpMs: pick("INTERACTION_TO_NEXT_PAINT"),
    cls: pick("CUMULATIVE_LAYOUT_SHIFT_SCORE", 100),
    fcpMs: pick("FIRST_CONTENTFUL_PAINT_MS"),
    ttfbMs: pick("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
    overall: exp?.overall_category ?? null,
  };
}

function truncateDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => truncateDeep(v, depth + 1));
  if (value && typeof value === "object") {
    if (depth > 4) return "[…]";
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, truncateDeep(v, depth + 1)]),
    );
  }
  return value;
}

function lab(audits: Record<string, LhAudit>, id: string): LabMetric {
  const a = audits[id];
  return a?.numericValue != null ? { value: a.numericValue, display: a.displayValue ?? "" } : null;
}

const IGNORED_MODES = new Set(["notApplicable", "manual", "informative"]);

export async function runPsi(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PsiSummary> {
  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", c);
  }
  if (process.env.PAGESPEED_API_KEY) params.set("key", process.env.PAGESPEED_API_KEY);

  const res = await fetch(`${ENDPOINT}?${params}`, {
    signal: AbortSignal.timeout(150_000), // Lighthouse runs on heavy pages can take 2+ minutes
    cache: "no-store",
  });
  const json = (await res.json()) as PsiResponse;
  if (!res.ok || !json.lighthouseResult) {
    throw new Error(`PageSpeed Insights failed: ${json.error?.message ?? res.statusText}`);
  }

  const lh = json.lighthouseResult;
  const audits = lh.audits;

  const failingAudits = Object.values(audits)
    .filter((a) => a.score !== null && a.score < 0.9 && !IGNORED_MODES.has(a.scoreDisplayMode))
    .map<AuditDetail>((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      score: a.score,
      displayValue: a.displayValue ?? null,
      savingsMs: a.metricSavings ?? null,
      items: (truncateDeep(a.details?.items ?? []) as unknown[]) ?? [],
    }))
    .sort((x, y) => {
      const sx = Object.values(x.savingsMs ?? {}).reduce((s, n) => s + n, 0);
      const sy = Object.values(y.savingsMs ?? {}).reduce((s, n) => s + n, 0);
      return sy - sx || (x.score ?? 0) - (y.score ?? 0);
    })
    .slice(0, 40);

  return {
    strategy,
    fetchedAt: new Date().toISOString(),
    finalUrl: lh.finalDisplayedUrl ?? lh.finalUrl ?? url,
    lighthouseVersion: lh.lighthouseVersion,
    categories: Object.fromEntries(
      Object.entries(lh.categories).map(([k, v]) => [
        k,
        v.score == null ? null : Math.round(v.score * 100),
      ]),
    ),
    // Prefer page-level CrUX; fall back to origin-level when the page has too little traffic.
    field: field(json.loadingExperience, "url") ?? field(json.originLoadingExperience, "origin"),
    lab: {
      lcp: lab(audits, "largest-contentful-paint"),
      cls: lab(audits, "cumulative-layout-shift"),
      tbt: lab(audits, "total-blocking-time"),
      fcp: lab(audits, "first-contentful-paint"),
      speedIndex: lab(audits, "speed-index"),
      ttfb: lab(audits, "server-response-time"),
    },
    failingAudits,
  };
}

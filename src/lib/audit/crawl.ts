import "server-only";
import * as cheerio from "cheerio";
import { readTextCapped, safeFetch } from "./url-guard";

/** AI crawlers worth checking in robots.txt (GEO = being citable by AI search). */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
] as const;

export type CrawlResult = {
  finalUrl: string;
  status: number;
  htmlBytes: number;
  headers: {
    contentType: string | null;
    cacheControl: string | null;
    contentEncoding: string | null;
    xRobotsTag: string | null;
    server: string | null;
  };
  meta: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    lang: string | null;
    robots: string | null;
    viewport: string | null;
    openGraph: Record<string, string>;
  };
  headings: { level: number; text: string }[];
  h1Count: number;
  images: {
    total: number;
    missingAlt: number;
    missingDimensions: number;
    lazy: number;
    /** First few <img> in document order — the LCP image is usually among them */
    firstImages: { src: string; alt: string | null; loading: string | null; fetchpriority: string | null; width: string | null; height: string | null }[];
  };
  head: {
    blockingStylesheets: number;
    blockingScripts: number;
    preloads: { href: string; as: string | null }[];
    preconnects: string[];
  };
  scripts: { total: number; external: number; thirdPartyHosts: string[] };
  structuredData: {
    jsonLdBlocks: number;
    types: string[];
    invalidBlocks: number;
    raw: string[]; // truncated, for Claude to inspect
  };
  aiCrawlers: {
    robotsTxtFound: boolean;
    blocked: string[];
    allowed: string[];
    llmsTxtFound: boolean;
  };
  textSample: string; // first ~1500 chars of visible text
};

// --- robots.txt -------------------------------------------------------------

type RobotsGroup = { agents: string[]; disallow: string[]; allow: string[] };

function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    const k = key.toLowerCase();
    if (k === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!current) continue;
      if (k === "disallow" && value) current.disallow.push(value);
      if (k === "allow" && value) current.allow.push(value);
    }
  }
  return groups;
}

/** Simplified check: is the site root blocked for this bot? */
function isRootBlocked(groups: RobotsGroup[], bot: string): boolean {
  const b = bot.toLowerCase();
  const group =
    groups.find((g) => g.agents.includes(b)) ?? groups.find((g) => g.agents.includes("*"));
  if (!group) return false;
  return group.disallow.includes("/") && !group.allow.includes("/");
}

async function checkAiCrawlers(origin: string): Promise<CrawlResult["aiCrawlers"]> {
  const [robotsRes, llmsRes] = await Promise.allSettled([
    safeFetch(`${origin}/robots.txt`, { timeoutMs: 8_000 }),
    safeFetch(`${origin}/llms.txt`, { timeoutMs: 8_000 }),
  ]);

  let groups: RobotsGroup[] = [];
  let robotsTxtFound = false;
  if (robotsRes.status === "fulfilled" && robotsRes.value.ok) {
    robotsTxtFound = true;
    groups = parseRobots(await readTextCapped(robotsRes.value, 500_000));
  }

  const blocked = AI_BOTS.filter((bot) => isRootBlocked(groups, bot));
  return {
    robotsTxtFound,
    blocked,
    allowed: AI_BOTS.filter((bot) => !blocked.includes(bot)),
    llmsTxtFound:
      llmsRes.status === "fulfilled" &&
      llmsRes.value.ok &&
      !(llmsRes.value.headers.get("content-type") ?? "").includes("text/html"),
  };
}

// --- page ----------------------------------------------------------------

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function crawlPage(url: string): Promise<CrawlResult> {
  const res = await safeFetch(url, { headers: { accept: "text/html" } });
  const html = await readTextCapped(res);
  const $ = cheerio.load(html);
  const finalUrl = res.url || url;
  const origin = new URL(finalUrl).origin;

  const attr = (sel: string, name: string) => $(sel).first().attr(name)?.trim() || null;

  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr("property");
    const c = $(el).attr("content");
    if (p && c) openGraph[p] = clip(c, 200);
  });

  const headings = $("h1, h2, h3")
    .toArray()
    .slice(0, 40)
    .map((el) => ({ level: Number(el.tagName[1]), text: clip($(el).text().trim(), 120) }));

  const imgs = $("img").toArray();
  const firstImages = imgs.slice(0, 8).map((el) => {
    const $el = $(el);
    return {
      src: clip($el.attr("src") ?? $el.attr("data-src") ?? "", 200),
      alt: $el.attr("alt") ?? null,
      loading: $el.attr("loading") ?? null,
      fetchpriority: $el.attr("fetchpriority") ?? null,
      width: $el.attr("width") ?? null,
      height: $el.attr("height") ?? null,
    };
  });

  const scripts = $("script[src]").toArray();
  const thirdPartyHosts = new Set<string>();
  for (const el of scripts) {
    try {
      const host = new URL($(el).attr("src")!, finalUrl).host;
      if (host !== new URL(finalUrl).host) thirdPartyHosts.add(host);
    } catch {}
  }

  const jsonLd = $('script[type="application/ld+json"]').toArray().map((el) => $(el).text());
  const types = new Set<string>();
  let invalidBlocks = 0;
  const collectTypes = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(collectTypes);
    if (node && typeof node === "object") {
      const t = (node as Record<string, unknown>)["@type"];
      if (typeof t === "string") types.add(t);
      if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
      const graph = (node as Record<string, unknown>)["@graph"];
      if (graph) collectTypes(graph);
    }
  };
  for (const block of jsonLd) {
    try {
      collectTypes(JSON.parse(block));
    } catch {
      invalidBlocks++;
    }
  }

  $("script, style, noscript, svg").remove();
  const textSample = clip($("body").text().replace(/\s+/g, " ").trim(), 1500);

  return {
    finalUrl,
    status: res.status,
    htmlBytes: Buffer.byteLength(html),
    headers: {
      contentType: res.headers.get("content-type"),
      cacheControl: res.headers.get("cache-control"),
      contentEncoding: res.headers.get("content-encoding"),
      xRobotsTag: res.headers.get("x-robots-tag"),
      server: res.headers.get("server"),
    },
    meta: {
      title: $("title").first().text().trim() || null,
      description: attr('meta[name="description"]', "content"),
      canonical: attr('link[rel="canonical"]', "href"),
      lang: attr("html", "lang"),
      robots: attr('meta[name="robots"]', "content"),
      viewport: attr('meta[name="viewport"]', "content"),
      openGraph,
    },
    headings,
    h1Count: headings.filter((h) => h.level === 1).length,
    images: {
      total: imgs.length,
      missingAlt: imgs.filter((el) => $(el).attr("alt") === undefined).length,
      missingDimensions: imgs.filter((el) => !$(el).attr("width") || !$(el).attr("height")).length,
      lazy: imgs.filter((el) => $(el).attr("loading") === "lazy").length,
      firstImages,
    },
    head: {
      blockingStylesheets: $('head link[rel="stylesheet"]:not([media="print"])').length,
      blockingScripts: $("head script[src]:not([async]):not([defer]):not([type='module'])").length,
      preloads: $('link[rel="preload"]')
        .toArray()
        .slice(0, 10)
        .map((el) => ({ href: clip($(el).attr("href") ?? "", 200), as: $(el).attr("as") ?? null })),
      preconnects: $('link[rel="preconnect"]')
        .toArray()
        .map((el) => $(el).attr("href") ?? "")
        .slice(0, 10),
    },
    scripts: {
      total: $("script").length,
      external: scripts.length,
      thirdPartyHosts: [...thirdPartyHosts].slice(0, 20),
    },
    structuredData: {
      jsonLdBlocks: jsonLd.length,
      types: [...types],
      invalidBlocks,
      raw: jsonLd.slice(0, 5).map((b) => clip(b, 2000)),
    },
    aiCrawlers: await checkAiCrawlers(origin),
    textSample,
  };
}

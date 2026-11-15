/** The metrics an expectation can name. */
export type Metric = "LCP" | "INP" | "CLS" | "TTFB" | "FCP";

/** What a correct diagnosis of one fixture must (and must not) contain. */
export type Expected = {
    /**
     * Metric of Claude's #1 issue. A list means any of them is acceptable.
     * Leave it out when there's no clear top issue (e.g. a site with headroom everywhere).
     * A list can't be empty: an empty list would make every run fail.
     */
    topIssueMetric?: Metric | [Metric, ...Metric[]];
    /** Findings the diagnosis has to mention. The LLM judge checks each one. */
    mustFind: string[];
    /** Metrics Claude must not report as a problem. */
    mustNotFlag: Metric[];
    /** For humans only. The grader ignores it. */
    notes?: string;
};

export type DatasetCase = {
    /** File name in evals/fixtures/, without .json. */
    fixture: string;
    expected: Expected;
};

export const dataset: DatasetCase[] =
[
    {
        fixture: 'aese',
        expected: {
            mustFind: [
                "Real users pass all Core Web Vitals",
                "Real-user TTFB (715ms) is Good but the closest metric to its limit (800ms), and about 3x the lab value (240ms)",
                "Render-blocking CSS/JS delays the first paint"
            ],
            mustNotFlag: ["CLS"],
            notes: "Passing site: every field metric is Good, so there's no top issue. TTFB has the least headroom (715ms vs 800ms). CLS is 0, so there's no CLS issue."
        }
    },
    {
        fixture: 'awwwards',
        expected: {
            topIssueMetric: "CLS",
            mustFind: [
                "Real users doesn't pass all Core Web Vitals",
                "Server response is slow for real users (TTFB 1515ms vs 410ms in the lab)",
                "Ships ~1.3 MB of unused JavaScript",
                "Almost all the CLS is one shift in the Nominees section, caused by a media element without an explicit size"
            ],
            mustNotFlag: ["INP"],
            notes: "Not passing site."
        }
    },
    {
        fixture: 'bbc',
        expected: {
            mustFind: [
                "Real users pass all Core Web Vitals",
                "JS execution time is increasing main-thread block time (TBT at 2560ms in the lab)",
                "Lab LCP (7.7s) is much worse than real users (1.2s), so LCP isn't a real-user problem",
                "robots.txt blocks AI crawlers (GPTBot, ClaudeBot, PerplexityBot...), so the page can't appear in AI answers",
            ],
            mustNotFlag: [],
            notes: "Passing site. INP has the least headroom (107ms vs 200ms), followed by CLS (0.05 vs 0.1)."
        }
    },
    {
        fixture: 'buzzvel',
        expected: {
            topIssueMetric: "TTFB",
            mustFind: [
                "LCP and CLS are Good for real users; INP has no field data, so a full pass can't be confirmed",
                "Render-blocking CSS/JS delays the first paint",
                "Server response is slow for real users (TTFB 988ms vs 30ms in the lab)",
            ],
            mustNotFlag: ["CLS"],
            notes: "Passing site. TTFB is beyond the max for FAST (with 988ms against 800ms). CLS is 0, so there's no CLS issue."
        }
    },
    {
        fixture: 'cosmos',
        expected: {
            topIssueMetric: "INP",
            mustFind: [
                "Real users doesn't pass all Core Web Vitals",
                "Render-blocking CSS/JS delays the first paint (est. savings of 900ms)",
                "JS execution time is increasing main-thread block time (INP at 460ms), against the FAST limit of 200ms. TBT at 600ms in the lab.",
                "TTFB is slow for real users, above the 800ms recommended, at 1111ms"
            ],
            mustNotFlag: ["CLS"],
            notes: "Not passing site. CLS is 0.01, so there's no CLS issue."
        }
    },
    {
        fixture: 'godly',
        expected: {
            topIssueMetric: ["TTFB", "CLS"],
            mustFind: [
                "Real users doesn't pass all Core Web Vitals",
                "Ships ~115 KB of unused JavaScript",
                "Server response is slow for real users (TTFB 1853ms vs 10ms in the lab)",
                "Layout shift is almost at POOR (0.2 for real users, 0.17 in the lab), from the main content feed moving",
                "Clicks are slow for real users (INP 332ms - AVERAGE), though the lab shows little blocking (TBT 130ms), so the slowness is likely in interactions after load",
                "robots.txt blocks AI training bot crawlers (GPTBot, ClaudeBot and CCBot)",
                "No llms.txt present to help AI agents understand key content",
                "No structured data (JSON-LD) to help search engines (SEO) and AI agents (GEO)"
            ],
            mustNotFlag: [],
            notes: "Not passing site. Cause of layout shift isn't in the data, Claude shouldn't claim one."
        }
    },
    {
        fixture: 'kw-portugal',
        expected: {
            topIssueMetric: "CLS",
            mustFind: [
                "Real users doesn't pass all Core Web Vitals",
                "Layout shift is beyond POOR (SLOW - 0.89), but 0 in the lab, because the lab doesn't scroll or interact",
                "Ships ~430 KB of unused JavaScript",
                "Server response is slow for real users (TTFB 882ms vs 10ms in the lab)",
                "JS execution time is increasing main-thread block time (INP at 319ms), against the FAST limit of 200ms. TBT at 350ms in the lab.",
            ],
            mustNotFlag: ["FCP"],
            notes: "Not passing site."
        }
    },
    {
        fixture: 'nytimes',
        expected: {
            topIssueMetric: "CLS",
            mustFind: [
                "Real users doesn't pass all Core Web Vitals",
                "Layout shift for real users (CLS 0.21), almost all from one media element without an explicit size",
                "Ships ~1.4 MB of unused JavaScript",
                "JS blocks the main thread for a long time in the lab (TBT 3.7s, 9.5s of main-thread work)",
                "robots.txt blocks AI crawlers (GPTBot, ClaudeBot, PerplexityBot...), so the page can't appear in AI answers",
                "Lab LCP (27.1s) is much worse than real users (1.4s), so LCP isn't a real-user problem",
            ],
            mustNotFlag: ["TTFB"],
            notes: "Not passing site."
        }
    },
    {
        fixture: 'portugalhomes',
        expected: {
            topIssueMetric: ["LCP", "TTFB"],
            mustFind: [
                "Real users doesn't pass all Core Web Vitals",
                "Ships ~600 KB of unused JavaScript",
                "JS blocks the main thread for a long time in the lab (TBT 970ms, 4.9s of main-thread work)",
                "Server response is slow for real users (1711ms, almost POOR; 30ms in the lab due to Lighthouse), likely no CDN or HTML caching. Almost 1.7s of the 3.0s LCP is spent waiting for the server"
            ],
            mustNotFlag: ["CLS"],
            notes: "Not passing site. CLS is 0.01, so there's no CLS issue."
        }
    },
    {
        fixture: 'raro',
        expected: {
            mustFind: [
                "Real users pass all Core Web Vitals",
                "Render-blocking CSS/JS delays the first paint (est. savings of 1110ms)",
            ],
            mustNotFlag: ["TTFB"],
            notes: "Passing site."
        }
    },
]
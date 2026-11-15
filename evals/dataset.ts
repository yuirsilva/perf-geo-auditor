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
        fixture: 'airbnb',
        expected: {
            topIssueMetric: "INP",
            mustFind: [
                "Real users fail Core Web Vitals",
                "Real user interaction is slow (INP 374ms) on a first interaction (TBT 940ms in the lab)",
                "Ships 1.06MB of unused JS",
                "Layout shift is not Good (0.13 > 0.1) for real users, while at 0 in the lab (the lab doesn't scroll or interact)",
                "Blocks AI crawler training bots (GPTBot, ClaudeBot, Applebot-Extended)",
                "Does not ship a llms.txt, document that helps AI agents with page summaries",
                "One image is missing an alternative text"
            ],
            mustNotFlag: ["TTFB", "FCP"],
            notes: "Not passing site. CLS cause is unknown, Claude shouldn't claim one."
        }
    },
    {
        fixture: 'amazon',
        expected: {
            topIssueMetric: "INP",
            mustFind: [
                "Real users fail Core Web Vitals",
                "Real user interaction is slow (INP 231ms) on a first interaction (TBT 140ms in the lab)",
                "Server response is slow for real users (TTFB 873ms; 450ms in the lab), likely missing CDN",
                "One image is missing a required alternative text",
                "Blocks most AI crawler bots (GPTBot, ClaudeBot, PerplexityBot, ...)",
                "Does not ship a llms.txt, document that helps AI agents with page summaries",
            ],
            mustNotFlag: ["CLS"],
            notes: "Not passing site. CLS is 0 for real users, but 0.034 in the lab, not a real issue."
        }
    },
    {
        fixture: 'apple',
        expected: {
            mustFind: [
                "Real users pass all Core Web Vitals",
                "Largest Contentful Paint is FAST for real users (1659ms), but 8.9s in the lab, not a real issue",
                "Does not ship a llms.txt, document that helps AI agents with page summaries",
            ],
            mustNotFlag: ["CLS"],
            notes: "Passing site. CLS is 0.01 for real users, but 0.168 in the lab, not a real issue."
        }
    },
    {
        fixture: 'cnn',
        expected: {
            mustFind: [
                "Real users pass all Core Web Vitals",
                "Ships 2.43MB of unused JS",
                "Largest Contentful Paint is FAST for real users (1905ms), but 26.5s in the lab, not a real issue",
                "Does not ship a llms.txt, document that helps AI agents with page summaries",
                "Blocks AI crawlers (GPTBot, ClaudeBot, PerplexityBot, ...)",
            ],
            mustNotFlag: ["CLS"],
            notes: "Passing site. CLS is 0.04 for real users, but 0.197 in the lab, not a real issue."
        }
    },
    {
        fixture: 'nike',
        expected: {
            topIssueMetric: 'LCP',
            mustFind: [
                "Real users fail Core Web Vitals",
                "Ships 0.86MB of unused JS",
                "Does not ship a llms.txt, document that helps AI agents with page summaries",
                "Server response is slow for real users (TTFB 1175ms; 50ms in the lab), also affecting LCP and FCP",
                "nike-one-video-player.min.js is bringing the render blocking request up"
            ],
            mustNotFlag: [],
            notes: "Not passing site."
        }
    },
    {
        fixture: 'nytimes',
        expected: {
            topIssueMetric: "CLS",
            mustFind: [
                "Real users fail Core Web Vitals",
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
        fixture: 'shopify-fall2026',
        expected: {
            topIssueMetric: "TTFB",
            mustFind: [
                "Real users fail Core Web Vitals",
                "Slow server response for real users (TTFB 1797ms; 30ms in the lab)",
                "Ships a llms.txt",
                "No structured data (JSON-LD) to help search engines (SEO) and AI agents (GEO)",
                "INP above the Good value (264ms) due to JS blocking the main thread (TBT 160ms; the lab does not interact/scroll)",
                "Render blocking CSS/JS delays the first paint (FCP 2767ms for real users)"
            ],
            mustNotFlag: ["CLS"],
            notes: "Not passing site."
        }
    },
    {
        fixture: 'theguardian',
        expected: {
            mustFind: [
                "Real users pass all Core Web Vitals",
                "Ships 0.66MB of unused JS",
                "robots.txt blocks specifically all Claude bots (training, search), plus PerplexityBot and Applebot-Extended",
                "Does not ship a llms.txt to help AI understand the content",
                "No structured data (JSON-LD) to help search engines (SEO) and AI agents (GEO)",
            ],
            mustNotFlag: ["CLS", "INP"],
            notes: "Passing site. Even though the TBT is at 1590ms, it's not a problem for real users."
        }
    },
    {
        fixture: 'walmart',
        expected: {
            topIssueMetric: ["INP", "CLS"],
            mustFind: [
                "Real users fail Core Web Vitals",
                "Ships 1.675MB of unused JS",
                "INP above the Good value (339ms) due to JS blocking the main thread (TBT 1660ms; the lab does not interact/scroll)",
                "Render blocking CSS/JS delays the first paint (FCP 2635ms for real users)",
                "Does not ship a llms.txt to help AI understand the content",
                "Layout shift is present for real users (0.16) while at 0 in the lab, because the lab doesn't scroll or interact. The candidates are 12 images with unset width/height"
            ],
            mustNotFlag: ["TTFB"],
            notes: "Not passing site. TTFB does not have much headroom but it's still in the Good range. CLS cause is unknown, so Claude shouldn't claim one."
        }
    },
    {
        fixture: 'zara',
        expected: {
            topIssueMetric: ["FCP", "LCP"],
            mustFind: [
                "Real users fail Core Web Vitals",
                "Ships 1.38MB of unused JS",
                "INP above the Good value by a really small value (203ms) due to JS blocking the main thread (TBT 1610ms; the lab does not interact/scroll)",
                "Render blocking CSS/JS delays the first paint (FCP - SLOW 3718ms for real users; 5.5s in the lab)",
                "Real-user LCP (3892ms) fails, mainly because render-blocking CSS/JS delays the first paint",
                "Crawling failed with 403 (Forbidden), so there's no crawl data (which includes: JSON-LD, llms.txt, robots.txt)",
                "AI crawlers may be blocked by the same protection, and you'd confirm it by requesting the page with their user agents"
            ],
            mustNotFlag: ["CLS"],
            notes: "Not passing site. CLS is at 0.01 for real users, and 0 in the lab, not really an issue. Claude should not guess data."
        }
    },
]
import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard: this app fetches user-supplied URLs from the server, so refuse
 * anything that isn't public http(s) — localhost, private ranges, cloud metadata, etc.
 */
export class UnsafeUrlError extends Error {}

export function normalizeUrl(input: string): URL {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new UnsafeUrlError("That isn't a web address. Enter a page's address, like https://example.com.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed.");
  }
  url.hash = "";
  return url;
}

function isPrivateIPv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique local
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

/** Throws UnsafeUrlError unless every address the host resolves to is public. */
export async function assertPublicUrl(input: string | URL): Promise<URL> {
  const url = typeof input === "string" ? normalizeUrl(input) : input;
  const host = url.hostname.replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UnsafeUrlError("Local addresses can't be audited.");
  }

  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true }).catch(() => {
        throw new UnsafeUrlError(`Couldn't resolve ${host}.`);
      });

  for (const { address, family } of addresses) {
    if (family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address)) {
      throw new UnsafeUrlError("Private or local network addresses can't be audited.");
    }
  }
  return url;
}

/**
 * fetch() that re-checks every redirect hop against the guard,
 * with a timeout and a cap on how much of the body is read.
 */
export async function safeFetch(
  input: string | URL,
  init: RequestInit & { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<Response> {
  const { timeoutMs = 15_000, maxRedirects = 5, ...rest } = init;
  let current = await assertPublicUrl(input);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, {
      ...rest,
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "PerfAuditorBot/0.1 (+https://github.com/)",
        ...rest.headers,
      },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = await assertPublicUrl(new URL(location, current));
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Too many redirects.");
}

/** Reads at most maxBytes of a response body as text. */
export async function readTextCapped(res: Response, maxBytes = 3_000_000): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maxBytes));
}

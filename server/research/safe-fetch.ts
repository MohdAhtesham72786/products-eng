import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { randomUUID } from "node:crypto";
import ipaddr from "ipaddr.js";
import * as cheerio from "cheerio";
import type { Source } from "../../shared/contracts.js";
export function isPublicAddress(ip: string): boolean {
  try {
    let address = ipaddr.parse(ip);
    if (
      address.kind() === "ipv6" &&
      (address as ipaddr.IPv6).isIPv4MappedAddress()
    )
      address = (address as ipaddr.IPv6).toIPv4Address();
    return address.range() === "unicast";
  } catch {
    return false;
  }
}
function validateUrl(input: string): URL {
  const u = new URL(input);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new Error("UNSAFE_WEBSITE");
  if (!u.hostname.includes(".") && !u.hostname.includes(":"))
    throw new Error("UNSAFE_WEBSITE");
  return u;
}
export function normalizeWebsite(input: string): string {
  const u = validateUrl(
    /^[a-z]+:/i.test(input.trim()) ? input.trim() : `https://${input.trim()}`,
  );
  return u.origin;
}
export function parseBatch(input: string) {
  const urls: string[] = [],
    errors: { row: number; input: string; error: string }[] = [];
  let duplicates = 0;
  const rows = input.split(/\r?\n/).filter((x) => x.trim());
  if (rows.length > 21) throw new Error("BATCH_TOO_LARGE");
  rows.forEach((row, i) => {
    const first = row.split(",")[0].trim().replace(/^"|"$/g, "");
    if (i === 0 && /^(website|url|domain)$/i.test(first)) return;
    try {
      const url = normalizeWebsite(first);
      if (urls.includes(url)) duplicates++;
      else urls.push(url);
    } catch {
      errors.push({
        row: i + 1,
        input: first,
        error:
          "Enter a public HTTP(S) website without credentials or custom ports.",
      });
    }
  });
  if (urls.length > 20) throw new Error("BATCH_TOO_LARGE");
  return { urls, errors, duplicates };
}
export async function resolvePublic(host: string) {
  const addresses = await dns.lookup(host.replace(/^\[|\]$/g, ""), {
    all: true,
  });
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a.address)))
    throw new Error("UNSAFE_DESTINATION");
  return addresses[0];
}
async function fetchPinned(
  url: string,
  redirects = 0,
): Promise<{ url: string; html: string }> {
  const u = validateUrl(url),
    ip = await resolvePublic(u.hostname);
  return new Promise((resolve, reject) => {
    const transport = u.protocol === "https:" ? https : http;
    const req = transport.get(
      u,
      {
        headers: {
          "user-agent": "SignalDesk/1.0 public company research",
          accept: "text/html,text/plain",
        },
        lookup: ((_host: any, options: any, cb: any) =>
          options.all
            ? cb(null, [ip])
            : cb(null, ip.address, ip.family)) as any,
        agent: false,
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
          res.resume();
          if (redirects >= 3 || !res.headers.location)
            return reject(new Error("REDIRECT_LIMIT"));
          fetchPinned(
            new URL(res.headers.location, u).href,
            redirects + 1,
          ).then(resolve, reject);
          return;
        }
        if ((res.statusCode || 500) >= 400) {
          res.resume();
          return reject(new Error(`SOURCE_HTTP_${res.statusCode}`));
        }
        if (
          !/^(text\/html|text\/plain)/i.test(
            String(res.headers["content-type"]),
          )
        ) {
          res.resume();
          return reject(new Error("UNSUPPORTED_CONTENT_TYPE"));
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > 1_500_000) {
            req.destroy(new Error("SOURCE_TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            url: u.href,
            html: Buffer.concat(chunks).toString("utf8"),
          }),
        );
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("SOURCE_TIMEOUT")),
      12000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
  });
}
export async function fetchPublicPage(url: string): Promise<Source> {
  const page = await fetchPinned(url);
  const $ = cheerio.load(page.html);
  $("script,style,nav,footer,header,noscript,svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 30000);
  if (!text) throw new Error("SOURCE_EMPTY");
  return {
    id: randomUUID(),
    url: page.url,
    publisher: new URL(page.url).hostname,
    retrievedAt: new Date().toISOString(),
    publishedAt: null,
    type: "primary",
    text,
    demo: false,
  };
}
export async function researchWebsite(website: string): Promise<Source[]> {
  const sources = [await fetchPublicPage(website)];
  for (const path of ["/about", "/careers"]) {
    try {
      sources.push(await fetchPublicPage(website + path));
    } catch {
      /* Optional pages may not exist; homepage failures are surfaced. */
    }
  }
  return sources;
}

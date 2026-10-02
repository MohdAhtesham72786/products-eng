import { afterEach, it, expect, vi } from "vitest";
import dns from "node:dns/promises";
import https from "node:https";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import {
  resolvePublic,
  fetchPublicPage,
} from "../../server/research/safe-fetch.js";
import { config } from "../../server/config.js";
import { geminiStructured } from "../../server/research/providers.js";
import { z } from "zod";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  config.GEMINI_API_KEY = undefined;
});
it("rejects mixed DNS answers and prevents any HTTP connection", async () => {
  vi.spyOn(dns, "lookup").mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ] as any);
  await expect(resolvePublic("company.com")).rejects.toThrow(
    "UNSAFE_DESTINATION",
  );
});
it("pins a validated DNS resolution and revalidates a redirect target", async () => {
  let lookups = 0;
  vi.spyOn(dns, "lookup").mockImplementation(async () =>
    ++lookups === 1
      ? [{ address: "8.8.8.8", family: 4 }]
      : ([{ address: "169.254.169.254", family: 4 }] as any),
  );
  let pinned = "";
  vi.spyOn(https, "get").mockImplementation(
    (url: any, options: any, callback: any) => {
      options.lookup(
        url.hostname,
        { all: false },
        (_err: any, address: string) => {
          pinned = address;
        },
      );
      const req = new EventEmitter() as any;
      req.destroy = () => {};
      queueMicrotask(() => {
        const res = Readable.from([]) as any;
        res.statusCode = 302;
        res.headers = { location: "https://metadata.company.com/" };
        callback(res);
        req.emit("close");
      });
      return req;
    },
  );
  await expect(fetchPublicPage("https://company.com")).rejects.toThrow(
    "UNSAFE_DESTINATION",
  );
  expect(pinned).toBe("8.8.8.8");
});
it("caps body size instead of processing oversized research", async () => {
  vi.spyOn(dns, "lookup").mockResolvedValue([
    { address: "8.8.8.8", family: 4 },
  ] as any);
  vi.spyOn(https, "get").mockImplementation(
    (_url: any, _options: any, callback: any) => {
      const req = new EventEmitter() as any;
      req.destroy = (error: Error) => {
        req.emit("error", error);
        req.emit("close");
      };
      queueMicrotask(() => {
        const res = Readable.from([Buffer.alloc(1_600_000)]) as any;
        res.statusCode = 200;
        res.headers = { "content-type": "text/html" };
        callback(res);
      });
      return req;
    },
  );
  await expect(fetchPublicPage("https://company.com")).rejects.toThrow(
    "SOURCE_TOO_LARGE",
  );
});
it("retries transient AI errors and accounts for validated output tokens", async () => {
  config.GEMINI_API_KEY = "test-key-never-used-on-network";
  let calls = 0;
  vi.stubGlobal("fetch", async (_url: string, options: any) => {
    const body = JSON.parse(options.body);
    expect(body.systemInstruction.parts[0].text).toContain("untrusted data");
    expect(body.generationConfig.responseJsonSchema.type).toBe("object");
    calls++;
    return calls === 1
      ? new Response("", { status: 503 })
      : new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"value":"supported"}' }] } },
            ],
            usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5 },
          }),
          { status: 200 },
        );
  });
  const r = await geminiStructured(
    z.object({ value: z.string() }),
    "Research context",
  );
  expect(r.data.value).toBe("supported");
  expect(r.usage).toEqual({ inputTokens: 20, outputTokens: 5 });
  expect(calls).toBe(2);
});
it("rejects malformed AI output without returning demo data", async () => {
  config.GEMINI_API_KEY = "test-key";
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"wrong":true}' }] } }],
        }),
        { status: 200 },
      ),
  );
  await expect(
    geminiStructured(z.object({ value: z.string() }), "context"),
  ).rejects.toThrow("AI_SCHEMA_INVALID");
});

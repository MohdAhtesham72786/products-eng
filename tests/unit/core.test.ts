import { describe, it, expect } from "vitest";
import { scoreOpportunity, rankActions } from "../../shared/scoring.js";
import { resolveClaims } from "../../shared/reliability.js";
import { compareSnapshots } from "../../shared/triggers.js";
import {
  isPublicAddress,
  normalizeWebsite,
  parseBatch,
} from "../../server/research/safe-fetch.js";
import { validateEvidence } from "../../server/research/evidence.js";
import { sellerContextKey } from "../../shared/scoring.js";
import { sellerSchema } from "../../shared/contracts.js";
const source = {
  id: "s1",
  url: "https://acme.example/about",
  publisher: "acme.example",
  retrievedAt: "2026-10-02T00:00:00Z",
  publishedAt: null,
  type: "primary" as const,
  text: "Acme builds logistics software. Hiring operations engineers.",
  demo: false,
};
const claim = {
  field: "offering",
  value: "logistics software",
  sourceIds: ["s1"],
  excerpt: "Acme builds logistics software.",
  confidence: 90,
};
const analysis = {
  name: "Acme",
  claims: [claim],
  needs: [{ text: "Operations automation", sourceIds: ["s1"] }],
  developments: [
    {
      kind: "hiring",
      text: "Hiring operations engineers.",
      sourceIds: ["s1"],
      eventDate: null,
    },
  ],
  contact: {
    kind: "persona",
    name: null,
    role: "Operations lead",
    reason: "Relevant to operations",
    sourceIds: [],
  },
  components: {
    fit: { value: 80, reason: "Fit", sourceIds: ["s1"] },
    need: { value: 60, reason: "Need", sourceIds: ["s1"] },
    timing: { value: 100, reason: "Hiring", sourceIds: ["s1"] },
    approachability: { value: 40, reason: "Persona", sourceIds: ["s1"] },
  },
  uncertainties: ["Company size unknown"],
  approach: "Discuss automation",
};
describe("opportunity policy", () => {
  it("does not qualify zero-fit or disqualified companies despite high other components", () => {
    const a = structuredClone(analysis);
    a.components.fit.value = 0;
    for (const k of ["need", "timing", "approachability"] as const)
      a.components[k].value = 100;
    expect(scoreOpportunity(a as any, true).score).toBe(65);
    expect(scoreOpportunity(a as any, true).qualified).toBe(false);
  });
  it("uses weighted components and keeps confidence separate", () => {
    const r = scoreOpportunity(analysis as any, true);
    expect(r.score).toBe(74);
    expect(r.confidence).toBe(90);
    expect(r.policyVersion).toBe("v1");
  });
  it("never qualifies incomplete seller context", () =>
    expect(scoreOpportunity(analysis as any, false).qualified).toBe(false));
  it("does not turn unsupported component values into qualified opportunities", () => {
    const bad = structuredClone(analysis);
    bad.components.fit.sourceIds = [];
    expect(scoreOpportunity(bad as any, true).qualified).toBe(false);
  });
  it("ranks five unique actionable companies without padding", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      companyId: String(i),
      score: 90 - i,
      confidence: 80,
      qualified: true,
      status: "open",
      snoozeUntil: null,
      triggerRelevance: 1,
      observedAt: "2026-10-02T00:00:00Z",
    }));
    rows[0].status = "done";
    const r = rankActions(
      [...rows, { ...rows[1], id: "duplicate" }],
      5,
      new Date("2026-10-02T01:00:00Z"),
    );
    expect(r.map((x) => x.companyId)).toEqual(["1", "2", "3", "4", "5"]);
  });
  it("expires snooze at the UTC boundary and handles stable ties", () => {
    const a = {
      id: "b",
      companyId: "b",
      score: 80,
      confidence: 80,
      qualified: true,
      status: "snoozed",
      snoozeUntil: "2026-10-02T00:00:00Z",
      observedAt: "2026-10-01T00:00:00Z",
      triggerRelevance: 0,
    };
    expect(
      rankActions(
        [a, { ...a, id: "a", companyId: "a" }],
        5,
        new Date("2026-10-02T00:00:00Z"),
      ).map((x) => x.id),
    ).toEqual(["a", "b"]);
  });
});
describe("source reliability", () => {
  it("does not conceal equally credible conflicts behind duplicate agreeing claims", () => {
    const r = resolveClaims(
      [claim, { ...claim }, { ...claim, value: "retail" }],
      [source],
    );
    expect(r[0].status).toBe("unresolved_conflict");
    expect(r[0].selected).toBeNull();
  });
  it("retains conflicting alternatives while preferring primary evidence", () => {
    const r = resolveClaims(
      [
        { ...claim, value: "logistics" },
        { ...claim, value: "retail", sourceIds: ["s2"] },
      ],
      [source, { ...source, id: "s2", type: "secondary" }] as any,
    );
    expect(r[0].selected?.value).toBe("logistics");
    expect(r[0].alternatives).toHaveLength(2);
    expect(r[0].status).toBe("resolved_conflict");
  });
  it("withholds equally credible conflicting values", () => {
    const r = resolveClaims([claim, { ...claim, value: "retail" }], [source]);
    expect(r[0].selected).toBeNull();
    expect(r[0].status).toBe("unresolved_conflict");
  });
  it("prefers fresh published evidence over stale equally authoritative evidence", () => {
    const r = resolveClaims(
      [
        { ...claim, value: "logistics" },
        { ...claim, value: "retail", sourceIds: ["s2"] },
      ],
      [
        { ...source, publishedAt: "2020-01-01T00:00:00Z" },
        { ...source, id: "s2", publishedAt: new Date().toISOString() },
      ],
    );
    expect(r[0].selected?.value).toBe("retail");
  });
});
it("changing daily limit preserves seller context, but changing offering invalidates it", () => {
  const a = sellerSchema.parse({ offering: "Automation", actionLimit: 5 });
  expect(sellerContextKey(a)).toBe(sellerContextKey({ ...a, actionLimit: 3 }));
  expect(sellerContextKey(a)).not.toBe(
    sellerContextKey({ ...a, offering: "Office furniture" }),
  );
});
describe("historical changes", () => {
  it("requires two snapshots and ignores unchanged semantic evidence", () => {
    expect(compareSnapshots(null, { analysis } as any)).toEqual([]);
    expect(
      compareSnapshots(
        { analysis } as any,
        {
          analysis: {
            ...analysis,
            claims: [
              {
                ...claim,
                excerpt: "Acme builds logistics software. Copyright 2026",
              },
            ],
          },
        } as any,
      ),
    ).toEqual([]);
  });
  it("shows evidenced meaningful development with observation distinct from event date", () => {
    const result = compareSnapshots(
      { analysis: { ...analysis, developments: [] } } as any,
      { analysis, createdAt: "2026-10-02T00:00:00Z" } as any,
    );
    expect(result[0].kind).toBe("hiring");
    expect(result[0].eventDate).toBeNull();
    expect(result[0].afterSourceIds).toEqual(["s1"]);
  });
});
describe("research security and evidence", () => {
  it("limits a headerless batch to twenty distinct company websites", () =>
    expect(() =>
      parseBatch(
        Array.from({ length: 21 }, (_, i) => `company-${i}.com`).join("\n"),
      ),
    ).toThrow());
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "2001:db8::1",
    "100.64.1.1",
  ])("rejects %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
  it("accepts public IPv4/IPv6", () => {
    expect(isPublicAddress("8.8.8.8")).toBe(true);
    expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
  });
  it("normalizes websites and rejects credentials, unsafe ports and protocols", () => {
    expect(normalizeWebsite("acme.com/about#team")).toBe("https://acme.com");
    expect(() => normalizeWebsite("http://user:pass@acme.com")).toThrow();
    expect(() => normalizeWebsite("http://acme.com:8080")).toThrow();
    expect(() => normalizeWebsite("file:///etc/passwd")).toThrow();
  });
  it("reports invalid batch rows and duplicates", () => {
    const r = parseBatch(
      "website\nacme.com\nhttps://acme.com\nfile:///x\nother.com",
    );
    expect(r.urls).toEqual(["https://acme.com", "https://other.com"]);
    expect(r.duplicates).toBe(1);
    expect(r.errors).toHaveLength(1);
  });
  it("rejects unknown source references and ungrounded excerpts", () => {
    expect(() =>
      validateEvidence(
        { ...analysis, claims: [{ ...claim, sourceIds: ["fake"] }] } as any,
        [source],
      ),
    ).toThrow();
    expect(() =>
      validateEvidence(
        {
          ...analysis,
          claims: [{ ...claim, excerpt: "Acme raised 100 million" }],
        } as any,
        [source],
      ),
    ).toThrow();
  });
  it("rejects factual values and developments unsupported by their excerpts", () => {
    expect(() =>
      validateEvidence(
        {
          ...analysis,
          claims: [{ ...claim, value: "100 million annual revenue" }],
        } as any,
        [source],
      ),
    ).toThrow();
    expect(() =>
      validateEvidence(
        {
          ...analysis,
          developments: [
            {
              kind: "funding",
              text: "Acme raised 100 million",
              sourceIds: ["s1"],
              eventDate: null,
            },
          ],
        } as any,
        [source],
      ),
    ).toThrow();
  });
});

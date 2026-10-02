import { it, expect } from "vitest";
import { demoResearch, demoAnalysis } from "../../server/research/demo.js";
import { generateDraft } from "../../server/research/providers.js";
import { sellerSchema } from "../../shared/contracts.js";
import { validateEvidence } from "../../server/research/evidence.js";
const sources = demoResearch("https://atlas-freight.example", 0);
const seller = sellerSchema.parse({
  offering: "Operations workflow automation",
  personas: ["COO"],
  industries: ["logistics"],
  geography: ["India"],
});
it("does not assign a strong seller fit to an unrelated offering in demo mode", () => {
  expect(
    demoAnalysis(sources, { ...seller, offering: "Office furniture" })
      .components.fit.value,
  ).toBeLessThan(30);
});
it("honors explicit industry disqualifiers in demo prioritization", () => {
  expect(
    demoAnalysis(sources, { ...seller, disqualifiers: ["logistics"] })
      .components.fit.value,
  ).toBe(0);
});
it("creates a bounded professional-network message with configured formal tone", async () => {
  const result = await generateDraft(
    demoAnalysis(sources, seller),
    sources,
    { ...seller, style: "formal" },
    "network",
    true,
  );
  expect(result.message.startsWith("Dear")).toBe(true);
  expect(result.message.length).toBeLessThanOrEqual(700);
});
it("rejects a named person with a role unsupported by public evidence", () => {
  const a = demoAnalysis(sources, seller);
  a.contact = {
    kind: "person",
    name: "Atlas Freight",
    role: "Chief Financial Officer",
    reason: "Invented role",
    sourceIds: [sources[0].id],
  };
  expect(() => validateEvidence(a, sources)).toThrow();
});

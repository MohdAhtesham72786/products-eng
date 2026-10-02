import { it, expect } from "vitest";
import { actionFingerprint } from "../../server/worker/fingerprint.js";
import { demoResearch, demoAnalysis } from "../../server/research/demo.js";
import { sellerSchema } from "../../shared/contracts.js";
it("preserves action identity when source ids/timestamps and generated wording change", () => {
  const a = demoResearch("https://atlas-freight.example", 0),
    b = demoResearch("https://atlas-freight.example", 0);
  const analysis = demoAnalysis(
    a,
    sellerSchema.parse({ offering: "Automation" }),
  );
  const reworded = {
    ...analysis,
    approach: "A different generated phrase",
    needs: [{ text: "Equivalent reworded need", sourceIds: [b[0].id] }],
  };
  expect(reworded.approach).not.toBe(analysis.approach);
  expect(actionFingerprint("company", a)).toBe(actionFingerprint("company", b));
});
it("distinguishes materially changed evidence while ignoring copyright and whitespace noise", () => {
  const a = demoResearch("https://atlas-freight.example", 0),
    b = demoResearch("https://atlas-freight.example", 1);
  expect(actionFingerprint("company", a)).not.toBe(
    actionFingerprint("company", b),
  );
  expect(actionFingerprint("company", a)).toBe(
    actionFingerprint(
      "company",
      a.map((s) => ({ ...s, text: s.text + " Copyright 2026   " })),
    ),
  );
});

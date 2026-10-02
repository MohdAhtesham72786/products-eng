import type { Claim, Source, Resolution } from "./contracts.js";
export function resolveClaims(
  claims: Claim[],
  sources: Source[],
): Resolution[] {
  const groups = new Map<string, Claim[]>();
  for (const c of claims)
    groups.set(c.field, [...(groups.get(c.field) || []), c]);
  const quality = (c: Claim) => {
    const s = sources.filter((s) => c.sourceIds.includes(s.id));
    const primary = s.some((s) => s.type === "primary") ? 100 : 0;
    const newest = Math.max(
      0,
      ...s.map((s) => Date.parse(s.publishedAt || s.retrievedAt)),
    );
    const independentPublishers = new Set(
      s.map((source) => source.publisher.toLowerCase()),
    );
    return (
      primary + Math.min(20, independentPublishers.size * 5) + newest / 1e13
    );
  };
  return [...groups].map(([field, alternatives]) => {
    const distinctValues = new Map<string, Claim[]>();
    for (const claim of alternatives) {
      const key = claim.value.toLowerCase().trim();
      distinctValues.set(key, [...(distinctValues.get(key) || []), claim]);
    }
    const ranked = [...distinctValues.values()]
      .map((matching) => ({
        ...matching.sort((a, b) => quality(b) - quality(a))[0],
        sourceIds: [...new Set(matching.flatMap((c) => c.sourceIds))],
      }))
      .sort((a, b) => quality(b) - quality(a));
    const values = new Set(ranked.map((c) => c.value.toLowerCase().trim()));
    const unresolved =
      values.size > 1 &&
      ranked[0].value !== ranked[1].value &&
      Math.abs(quality(ranked[0]) - quality(ranked[1])) < 0.01;
    return {
      field,
      status: unresolved
        ? "unresolved_conflict"
        : values.size > 1
          ? "resolved_conflict"
          : "supported",
      selected: unresolved ? null : ranked[0],
      alternatives,
      reason: unresolved
        ? "Equally credible evidence disagrees; value withheld."
        : values.size > 1
          ? "Preferred direct primary evidence, corroboration and freshness. Conflicting alternatives retained."
          : "Supported by the cited public evidence.",
    };
  });
}

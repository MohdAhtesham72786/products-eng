import type { Snapshot, Trigger } from "./contracts.js";
const normalized = (s: string) =>
  s
    .toLowerCase()
    .replace(/copyright\s*\d{4}/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function compareSnapshots(
  before: Pick<Snapshot, "analysis"> | null,
  after: Pick<Snapshot, "analysis"> & { createdAt?: string },
): Trigger[] {
  if (!before) return [];
  return after.analysis.developments
    .filter(
      (d) =>
        !before.analysis.developments.some(
          (b) => b.kind === d.kind && normalized(b.text) === normalized(d.text),
        ),
    )
    .map((d) => ({
      kind: d.kind,
      text: d.text,
      beforeSourceIds: before.analysis.developments
        .filter((b) => b.kind === d.kind)
        .flatMap((b) => b.sourceIds),
      afterSourceIds: d.sourceIds,
      eventDate: d.eventDate,
      observedAt: after.createdAt || new Date().toISOString(),
      significance: `New ${d.kind} evidence may create an opening for the configured offering.`,
      confidence: Math.min(
        90,
        ...after.analysis.claims.map((c) => c.confidence),
      ),
      suggestedAction: after.analysis.approach,
    }));
}

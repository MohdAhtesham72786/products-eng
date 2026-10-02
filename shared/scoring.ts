import type {
  Analysis,
  Assessment,
  Action,
  SellerSettings,
} from "./contracts.js";
export function sellerContextKey(seller: SellerSettings) {
  return JSON.stringify([
    seller.offering,
    seller.industries,
    seller.geography,
    seller.size,
    seller.personas,
    seller.disqualifiers,
    seller.style,
  ]);
}
export function scoreOpportunity(
  analysis: Analysis,
  configured: boolean,
): Assessment {
  const weights = {
    fit: 0.35,
    need: 0.25,
    timing: 0.25,
    approachability: 0.15,
  };
  const entries = Object.entries(analysis.components) as [
    keyof typeof weights,
    Analysis["components"]["fit"],
  ][];
  const missing = entries
    .filter(([, v]) => !v.sourceIds.length)
    .map(([k]) => `${k}: insufficient evidence`);
  const score = Math.round(
    entries.reduce((n, [k, v]) => n + v.value * weights[k], 0),
  );
  const confidence = analysis.claims.length
    ? Math.round(
        analysis.claims.reduce((n, c) => n + c.confidence, 0) /
          analysis.claims.length,
      )
    : 0;
  const qualified =
    configured &&
    analysis.components.fit.value > 0 &&
    score >= 55 &&
    confidence >= 65 &&
    missing.length === 0 &&
    analysis.claims.length >= 1;
  return {
    score,
    confidence,
    qualified,
    policyVersion: "v1",
    components: analysis.components,
    missing,
    provisional: !configured,
    reasons: [
      ...(!configured ? ["Configure your offering before prioritizing."] : []),
      ...missing,
      ...(confidence < 65 ? ["Evidence confidence is below 65%."] : []),
      ...(score < 55 ? ["Opportunity score is below 55."] : []),
      ...(analysis.components.fit.value === 0
        ? ["Zero seller fit or a seller disqualifier excludes this company."]
        : []),
    ],
  };
}
export function rankActions<T extends Action>(
  rows: T[],
  limit: number,
  now: Date,
): T[] {
  const sorted = rows
    .filter(
      (x) =>
        x.qualified &&
        x.status !== "done" &&
        x.status !== "dismissed" &&
        (x.status !== "snoozed" ||
          (!!x.snoozeUntil && Date.parse(x.snoozeUntil) <= now.getTime())),
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.triggerRelevance - a.triggerRelevance ||
        Date.parse(b.observedAt) - Date.parse(a.observedAt) ||
        b.confidence - a.confidence ||
        a.id.localeCompare(b.id),
    );
  const seen = new Set<string>();
  return sorted
    .filter((x) => {
      if (seen.has(x.companyId)) return false;
      seen.add(x.companyId);
      return true;
    })
    .slice(0, limit);
}

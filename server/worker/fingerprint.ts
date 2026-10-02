import { createHash } from "node:crypto";
import type { Source } from "../../shared/contracts.js";
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/copyright\s*\d{4}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function actionFingerprint(companyId: string, sources: Source[]) {
  const evidence = sources
    .map((s) => ({ url: s.url, text: normalize(s.text) }))
    .sort((a, b) => a.url.localeCompare(b.url));
  return createHash("sha256")
    .update(JSON.stringify({ companyId, type: "approach", evidence }))
    .digest("hex");
}

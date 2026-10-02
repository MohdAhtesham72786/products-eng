import {
  analysisSchema,
  type Analysis,
  type Source,
} from "../../shared/contracts.js";
const normalized = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export function validateEvidence(input: unknown, sources: Source[]): Analysis {
  const a = analysisSchema.parse(input);
  const known = new Map(sources.map((s) => [s.id, s]));
  const ref = (ids: string[]) => {
    if (ids.some((id) => !known.has(id)))
      throw new Error("AI_EVIDENCE_INVALID");
  };
  for (const c of a.claims) {
    ref(c.sourceIds);
    if (
      !c.sourceIds.some((id) =>
        normalized(known.get(id)!.text).includes(normalized(c.excerpt)),
      )
    )
      throw new Error("AI_EXCERPT_UNSUPPORTED");
    if (!normalized(c.excerpt).includes(normalized(c.value)))
      throw new Error("AI_VALUE_UNSUPPORTED");
  }
  for (const n of a.needs) ref(n.sourceIds);
  for (const d of a.developments) {
    ref(d.sourceIds);
    if (
      !d.sourceIds.some((id) =>
        normalized(known.get(id)!.text).includes(normalized(d.text)),
      )
    )
      throw new Error("AI_DEVELOPMENT_UNSUPPORTED");
    if (
      d.eventDate &&
      !d.sourceIds.some((id) => known.get(id)!.text.includes(d.eventDate!))
    )
      throw new Error("AI_EVENT_DATE_UNSUPPORTED");
  }
  for (const c of Object.values(a.components)) ref(c.sourceIds);
  ref(a.contact.sourceIds);
  if (
    a.contact.kind === "person" &&
    (!a.contact.name ||
      !a.contact.sourceIds.length ||
      !a.contact.sourceIds.some(
        (id) =>
          normalized(known.get(id)!.text).includes(
            normalized(a.contact.name!),
          ) &&
          normalized(known.get(id)!.text).includes(normalized(a.contact.role)),
      ))
  )
    throw new Error("AI_CONTACT_UNSUPPORTED");
  if (a.contact.kind === "persona" && a.contact.name !== null)
    throw new Error("AI_PERSONA_NAME_INVALID");
  return a;
}

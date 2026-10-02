import { z } from "zod";
const text = z.string().trim().min(1).max(4000);
const refs = z.array(z.string()).max(20);
export const sellerSchema = z.object({
  offering: z.string().max(2000).default(""),
  industries: z.array(text).max(30).default([]),
  geography: z.array(text).max(30).default([]),
  size: z.string().max(200).default(""),
  personas: z.array(text).max(20).default([]),
  disqualifiers: z.array(text).max(30).default([]),
  style: z.enum(["concise", "warm", "formal"]).default("concise"),
  actionLimit: z.number().int().min(1).max(20).default(5),
});
export type SellerSettings = z.infer<typeof sellerSchema>;
export const sourceSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  publisher: z.string(),
  retrievedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  type: z.enum(["primary", "secondary"]),
  text: z.string(),
  demo: z.boolean(),
});
export type Source = z.infer<typeof sourceSchema>;
export const claimSchema = z.object({
  field: text,
  value: text,
  sourceIds: refs.min(1),
  excerpt: text,
  confidence: z.number().min(0).max(100),
});
export type Claim = z.infer<typeof claimSchema>;
const component = z.object({
  value: z.number().min(0).max(100),
  reason: text,
  sourceIds: refs,
});
export const analysisSchema = z.object({
  name: text,
  claims: z.array(claimSchema).max(50),
  needs: z.array(z.object({ text, sourceIds: refs.min(1) })).max(15),
  developments: z
    .array(
      z.object({
        kind: z.enum([
          "launch",
          "expansion",
          "hiring",
          "leadership",
          "funding",
        ]),
        text,
        sourceIds: refs.min(1),
        eventDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
      }),
    )
    .max(20),
  contact: z.object({
    kind: z.enum(["person", "persona"]),
    name: z.string().nullable(),
    role: text,
    reason: text,
    sourceIds: refs,
    confidence: z.number().min(0).max(100).optional(),
  }),
  components: z.object({
    fit: component,
    need: component,
    timing: component,
    approachability: component,
  }),
  uncertainties: z.array(text).max(20),
  approach: text,
});
export type Analysis = z.infer<typeof analysisSchema>;
export type Assessment = {
  score: number;
  confidence: number;
  qualified: boolean;
  policyVersion: string;
  components: Analysis["components"];
  missing: string[];
  provisional: boolean;
  reasons: string[];
  sellerContext?: SellerSettings;
};
export type Resolution = {
  field: string;
  status: "supported" | "resolved_conflict" | "unresolved_conflict";
  selected: Claim | null;
  alternatives: Claim[];
  reason: string;
};
export type Trigger = {
  kind: string;
  text: string;
  beforeSourceIds: string[];
  afterSourceIds: string[];
  eventDate: string | null;
  observedAt: string;
  significance: string;
  confidence: number;
  suggestedAction: string;
};
export type Snapshot = {
  id: string;
  companyId: string;
  createdAt: string;
  analysis: Analysis;
  assessment: Assessment;
  resolutions: Resolution[];
  triggers: Trigger[];
  demo: boolean;
};
export type Action = {
  id: string;
  companyId: string;
  score: number;
  confidence: number;
  qualified: boolean;
  status: string;
  snoozeUntil: string | null;
  triggerRelevance: number;
  observedAt: string;
  [key: string]: unknown;
};
export const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((x) => x.toLowerCase()),
  password: z.string().min(12).max(200),
  name: z.string().trim().min(1).max(100).optional(),
});
export const modeSchema = z.enum(["demo", "live"]);
export const uuid = z.uuid();

import { randomUUID } from "node:crypto";
import type {
  Source,
  Analysis,
  SellerSettings,
} from "../../shared/contracts.js";
export const demoDomains = [
  "atlas-freight.example",
  "northstar-retail.example",
  "meridian-health.example",
  "orbit-manufacturing.example",
  "cedar-finance.example",
  "harbor-logistics.example",
  "lumen-energy.example",
  "summit-software.example",
  "evergreen-foods.example",
  "prism-education.example",
  "vertex-mobility.example",
  "apex-industrial.example",
];
export function demoResearch(website: string, revision: number): Source[] {
  const domain = new URL(website).hostname;
  const name = domain
    .replace(".example", "")
    .split("-")
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .join(" ");
  const changed =
    revision > 0
      ? "The company launched a new regional operations center."
      : "The company is hiring operations engineers.";
  return [
    {
      id: randomUUID(),
      url: website + "/about",
      publisher: domain,
      retrievedAt: new Date().toISOString(),
      publishedAt: null,
      type: "primary",
      demo: true,
      text: `FICTIONAL DEMO DATA. ${name} provides logistics and operations software for growing businesses. Location: Bengaluru, India. The business serves mid-market operations teams. Business model: subscription software. ${changed} Public contact route: company contact form. Headcount and revenue are not disclosed.`,
    },
    {
      id: randomUUID(),
      url: website + "/news",
      publisher: domain,
      retrievedAt: new Date().toISOString(),
      publishedAt: null,
      type: "primary",
      demo: true,
      text: `FICTIONAL DEMO DATA. ${name}: ${changed} Leadership names have not been verified. The organization is evaluating workflow efficiency.`,
    },
  ];
}
export function demoAnalysis(
  sources: Source[],
  seller: SellerSettings,
): Analysis {
  const s = sources[0],
    name = s.text.split("FICTIONAL DEMO DATA. ")[1].split(" provides")[0];
  const expansion = s.text.includes("launched");
  const ids = [s.id];
  const disqualified = seller.disqualifiers.some((d) =>
    s.text.toLowerCase().includes(d.toLowerCase()),
  );
  const related = /operations|workflow|automation|logistics|software/i.test(
    seller.offering,
  );
  const industryMatch =
    !seller.industries.length ||
    seller.industries.some((i) =>
      s.text.toLowerCase().includes(i.toLowerCase()),
    );
  const geographyMatch =
    !seller.geography.length ||
    seller.geography.some((g) =>
      s.text.toLowerCase().includes(g.toLowerCase()),
    );
  const fit = disqualified
    ? 0
    : related && industryMatch && geographyMatch
      ? Math.max(55, 90 - (name.length % 6) * 4)
      : 20;
  const configured = !!seller.offering.trim();
  return {
    name,
    claims: [
      {
        field: "offering",
        value: "Logistics and operations software",
        sourceIds: ids,
        excerpt: `${name} provides logistics and operations software for growing businesses.`,
        confidence: 90,
      },
      {
        field: "location",
        value: "Bengaluru, India",
        sourceIds: ids,
        excerpt: "Location: Bengaluru, India.",
        confidence: 90,
      },
      {
        field: "market",
        value: "Mid-market operations teams",
        sourceIds: ids,
        excerpt: "The business serves mid-market operations teams.",
        confidence: 85,
      },
      {
        field: "business_model",
        value: "Subscription software",
        sourceIds: ids,
        excerpt: "Business model: subscription software.",
        confidence: 90,
      },
    ],
    needs: [
      { text: "Workflow efficiency during growth", sourceIds: [sources[1].id] },
    ],
    developments: [
      {
        kind: expansion ? "expansion" : "hiring",
        text: expansion
          ? "The company launched a new regional operations center."
          : "The company is hiring operations engineers.",
        sourceIds: ids,
        eventDate: null,
      },
    ],
    contact: {
      confidence: 60,
      kind: "persona",
      name: null,
      role: seller.personas[0] || "Operations lead",
      reason:
        "Owns operational efficiency and workflow tooling. A named person has not been verified.",
      sourceIds: [],
    },
    components: {
      fit: {
        value: configured ? fit : 0,
        reason:
          "Fictional operations business matches the demo seller offering; adapt seller settings for your actual market.",
        sourceIds: ids,
      },
      need: {
        value: 80,
        reason:
          "Workflow efficiency evaluation is explicit in the fictional news page.",
        sourceIds: [sources[1].id],
      },
      timing: {
        value: expansion ? 90 : 75,
        reason: expansion
          ? "Regional expansion creates new processes."
          : "Operations hiring suggests investment.",
        sourceIds: ids,
      },
      approachability: {
        value: 60,
        reason:
          "Company contact form is available; named buyer remains unknown.",
        sourceIds: ids,
      },
    },
    uncertainties: [
      "All sources are fictional demonstration fixtures.",
      "Headcount and revenue unknown.",
      "No named buyer verified.",
      "Event date unknown; timestamp is the research observation time.",
    ],
    approach: `Discuss whether ${seller.offering || "your offering"} can help the operations team with its current growth.`,
  };
}

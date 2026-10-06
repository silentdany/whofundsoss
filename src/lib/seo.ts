import { collectedLabel, money } from "@/lib/format";
import { namedProjects, type CompanyDetail } from "@/lib/indexing";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  formatTitle,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_TYPE,
  OG_IMAGE_WIDTH,
  REPO_URL,
  SITE_ALT_NAME,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";
import { SOURCE_LABEL, SOURCE_ORDER, type CompanyRow, type Meta } from "@/lib/types";

export const ROBOTS_INDEX = "index,follow";
export const ROBOTS_NOINDEX = "noindex,follow";

type MetaTag = Record<string, unknown>;
type LinkTag = { rel: string; href: string; [key: string]: string };

export type PageHeadInput = {
  /** Path on the site, e.g. "/ranking". */
  path: string;
  /** Full document title (already templated). */
  title: string;
  description?: string;
  robots?: string;
  ogType?: "website" | "article";
  jsonLd?: Record<string, unknown>[];
};

/** Route `head()` payload: title, description, robots, canonical, OG/Twitter, JSON-LD. */
export function pageHead(input: PageHeadInput): { meta: MetaTag[]; links: LinkTag[] } {
  const url = absoluteUrl(input.path);
  const image = absoluteUrl(OG_IMAGE_PATH);
  const description = input.description ?? "";
  const meta: MetaTag[] = [
    { title: input.title },
    { name: "robots", content: input.robots ?? ROBOTS_INDEX },
  ];
  if (description) meta.push({ name: "description", content: description });
  meta.push(
    { property: "og:title", content: input.title },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: input.ogType ?? "website" },
    { property: "og:image", content: image },
    { property: "og:image:type", content: OG_IMAGE_TYPE },
    { property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
    { property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
    { property: "og:image:alt", content: OG_IMAGE_ALT },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: input.title },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: OG_IMAGE_ALT },
  );
  if (description) {
    meta.push(
      { property: "og:description", content: description },
      { name: "twitter:description", content: description },
    );
  }
  for (const block of input.jsonLd ?? []) meta.push({ "script:ld+json": block });
  return { meta, links: [{ rel: "canonical", href: url }] };
}

/** 404 head: no description, noindex, HTTP status stays 404. */
export function notFoundHead(): { meta: MetaTag[] } {
  return {
    meta: [{ title: formatTitle("Page not found") }, { name: "robots", content: "noindex" }],
  };
}

/** Cut at a word boundary to at most `max` chars, ending on a period. */
export function clampDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > 60 ? cut.slice(0, at) : cut).replace(/[\s,;:.(·]+$/, "")}.`;
}

// ---------------------------------------------------------------- JSON-LD

const ORG_ID = `${SITE_URL}/#organization`;

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/icon-512.png"),
    sameAs: [REPO_URL],
  };
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: SITE_ALT_NAME,
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
  };
}

export function datasetJsonLd(meta: Meta): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "WhoFundsOSS public open source funding dataset",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    isAccessibleForFree: true,
    dateModified: meta.collectedAt,
    creator: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME, url: SITE_URL },
    variableMeasured: ["public USD funding", "named projects", "platform"],
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// ---------------------------------------------------------- /company/[slug]

export { companyIndexable, namedProjects, type CompanyDetail } from "@/lib/indexing";

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function companyTitle(row: CompanyRow): string {
  const withAmount =
    row.publicUsd > 0
      ? formatTitle(`${row.name} open source funding: ${money(row.publicUsd)} public`)
      : formatTitle(`${row.name} open source funding`);
  if (withAmount.length <= 70) return withAmount;
  const plain = formatTitle(`${row.name} open source funding`);
  if (plain.length <= 70) return plain;
  return formatTitle(row.name.length > 48 ? `${row.name.slice(0, 47).trimEnd()}…` : row.name);
}

export function companyDescription(row: CompanyRow, detail: CompanyDetail | undefined, meta: Meta): string {
  // Project names for the teaser: real beneficiaries only (no pledge / own-program lines).
  const names = namedProjects(detail)
    .filter((item) => item.source === "oc" || item.source === "gh")
    .sort((a, b) => (b.amountUsd ?? -1) - (a.amountUsd ?? -1))
    .map((item) => item.project);
  const sourceList = SOURCE_ORDER.filter((key) => row.sources.includes(key)).map((key) =>
    key === "own" ? "own program" : SOURCE_LABEL[key],
  );
  const amount = row.publicUsd > 0 ? `${money(row.publicUsd)} public` : "Amount undisclosed";
  const sources = sourceList.length ? ` Sources: ${joinList(sourceList)}.` : "";
  const date = collectedLabel(meta.collectedAt);
  const n = row.projects;
  const lead = (top: string[]) =>
    n === 0 || row.unitemized
      ? `${row.name} declares open source funding and names no project.`
      : `${row.name} funds ${n} open source project${n === 1 ? "" : "s"}${top.length ? ` (${top.join(", ")})` : ""}.`;
  // Longest variant that fits 160 chars, dropping detail instead of cutting a sentence.
  const variants = [
    `${lead(names.slice(0, 3))} ${amount}.${sources} Public sources only, collected ${date}.`,
    `${lead(names.slice(0, 3))} ${amount}.${sources} Collected ${date}.`,
    `${lead(names.slice(0, 2))} ${amount}.${sources} Collected ${date}.`,
    `${lead(names.slice(0, 1))} ${amount}.${sources} Collected ${date}.`,
    `${lead([])} ${amount}.${sources} Collected ${date}.`,
  ];
  return variants.find((text) => text.length <= 160) ?? clampDescription(variants[variants.length - 1]!);
}

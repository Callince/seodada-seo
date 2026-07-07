/** Shape of one extracted page in the content catalog (see
 *  backend/scripts/extract_content.py). The raw/*.json files match this. */
export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og_image: string;
  og_type: string;
}

export interface Heading {
  level: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  text: string;
}

/** One node in the ordered content stream — a heading or a prose block. */
export type FlowNode =
  | { type: "heading"; level: Heading["level"]; text: string }
  | { type: "text"; text: string };

export interface PageContent {
  slug: string;
  source: string;
  seo: PageSeo;
  headings: Heading[];
  text_blocks: string[];
  flow: FlowNode[];
  links: { href: string; text: string }[];
  images: { src: string; alt: string }[];
  counts: Record<string, number>;
}

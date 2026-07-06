import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const MAX_CHARS = 14_000; // token/cost guard before sending to Claude
const WORDS_PER_MIN = 225;
const FETCH_TIMEOUT_MS = 8_000;
const UA =
  "Mozilla/5.0 (compatible; LayrrrdBot/1.0; +https://app.layrrrd.com)";

export interface ExtractedContent {
  title: string;
  description: string;
  image: string;
  text: string;
  wordCount: number;
  readingTime: number; // minutes
  /** True when readable article extraction failed and we used meta fallbacks. */
  degraded: boolean;
}

function metaTag(doc: Document, selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const content = el?.getAttribute("content") ?? el?.textContent ?? "";
    if (content && content.trim()) return content.trim();
  }
  return "";
}

/**
 * Fetch a URL and extract readable article text. Never throws for content
 * reasons — on paywalled / JS-heavy / thin pages it degrades to meta tags and
 * flags `degraded: true` so the caller can still complete the item.
 */
export async function extractContent(url: string): Promise<ExtractedContent> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: controller.signal,
      redirect: "follow",
    });
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const { document } = parseHTML(html);

  const metaTitle =
    metaTag(document, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
    document.querySelector("title")?.textContent?.trim() ||
    "";
  const description = metaTag(document, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);
  const image = metaTag(document, [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ]);

  let text = "";
  let title = metaTitle;
  let degraded = true;

  try {
    // Readability mutates the document, so parse a fresh clone for it.
    const { document: clone } = parseHTML(html);
    const article = new Readability(clone as unknown as Document).parse();
    if (article?.textContent && article.textContent.trim().length > 400) {
      text = article.textContent.replace(/\s+/g, " ").trim();
      title = article.title?.trim() || metaTitle;
      degraded = false;
    }
  } catch {
    // fall through to degraded meta-only path
  }

  if (!text) {
    // Degraded: use whatever descriptive text we have.
    text = [metaTitle, description].filter(Boolean).join(". ").trim();
  }

  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);

  const wordCount = text ? text.split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.round(wordCount / WORDS_PER_MIN));

  return {
    title: title || url,
    description,
    image,
    text,
    wordCount,
    readingTime,
    degraded,
  };
}

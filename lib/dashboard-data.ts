import type { SummarySection } from "@/lib/types/knowledge-item";

export type Resource = {
  id: string;
  title: string;
  description: string;
  category: string[];
  contentType: string;
  source: string;
  readingTime: number; // minutes
  publishedDate: string; // ISO date
  savedDate?: string; // ISO date, bookmarks only
  url: string;
  read?: boolean;
  image?: string; // preview thumbnail (og:image / video thumbnail)
  // Full AI detail (present on real saved items; optional so mock data still fits).
  summary?: string;
  sections?: SummarySection[];
  takeaways?: string[];
  keyPoints?: string[];
  keywords?: string[];
  difficulty?: string;
  sentiment?: string;
  status?: "pending" | "processing" | "completed" | "failed";
  // Recommendation-only: why it's suggested + how many people saved it.
  reason?: string;
  savers?: number;
  // The topic the reason cites — what "Hide this topic" mutes.
  reasonTopic?: string;
  // "match" = shares a topic the user already cares about; "discover" = a nudge
  // toward a topic they haven't picked yet (`discoveryTopic` is that new
  // topic); "web" = a public article pulled from an external feed.
  kind?: "match" | "discover" | "web";
  discoveryTopic?: string;
};

export type WeeklyIssue = {
  id: string;
  weekNumber: number;
  title: string;
  publishDate: string; // ISO date
  resourceCount: number;
  url: string;
};

export const bookmarks: Resource[] = [
  {
    id: "b1",
    title: "The Grid System That Actually Scales",
    description:
      "A breakdown of how modern design systems handle responsive grids without breaking at the edges.",
    category: ["Design Systems", "UI Design"],
    contentType: "Article",
    source: "Smashing Magazine",
    readingTime: 8,
    publishedDate: "2026-06-12",
    savedDate: "2026-07-04",
    url: "#",
    read: false,
  },
  {
    id: "b2",
    title: "Figma's New Variables API",
    description:
      "A tool walkthrough of the latest variables API and how it changes token management.",
    category: ["Product Design", "Design Systems"],
    contentType: "Tool",
    source: "Figma Blog",
    readingTime: 4,
    publishedDate: "2026-06-28",
    savedDate: "2026-07-05",
    url: "#",
    read: true,
  },
  {
    id: "b3",
    title: "Case Study: Rebuilding Linear's Onboarding",
    description:
      "How Linear cut onboarding drop-off in half with three small interaction changes.",
    category: ["UX Design"],
    contentType: "Case Study",
    source: "UX Collective",
    readingTime: 12,
    publishedDate: "2026-05-30",
    savedDate: "2026-06-20",
    url: "#",
    read: false,
  },
  {
    id: "b4",
    title: "Motion Principles for Interface Designers",
    description:
      "A primer on easing, duration, and choreography for anyone new to motion design.",
    category: ["Motion Design"],
    contentType: "Resource",
    source: "Dribbble",
    readingTime: 6,
    publishedDate: "2026-04-18",
    savedDate: "2026-06-01",
    url: "#",
    read: false,
  },
  {
    id: "b5",
    title: "Config 2026: What Designers Should Watch",
    description:
      "A rundown of the sessions worth your time from this year's biggest design conference.",
    category: ["Product Design"],
    contentType: "Event",
    source: "Figma",
    readingTime: 3,
    publishedDate: "2026-03-02",
    savedDate: "2026-03-10",
    url: "#",
    read: true,
  },
  {
    id: "b6",
    title: "Typography for Data-Dense Interfaces",
    description:
      "Choosing type scales and weights when your UI needs to show a lot of numbers at once.",
    category: ["Typography", "UI Design"],
    contentType: "Article",
    source: "A List Apart",
    readingTime: 15,
    publishedDate: "2026-02-14",
    savedDate: "2026-02-20",
    url: "#",
    read: false,
  },
];

export const recommendations: Resource[] = [
  {
    id: "r1",
    title: "Designing With AI Co-Pilots",
    description:
      "What changes in the design process once generation is part of every tool you use.",
    category: ["AI", "Product Design"],
    contentType: "Article",
    source: "Every Design",
    readingTime: 9,
    publishedDate: "2026-07-01",
    url: "#",
  },
  {
    id: "r2",
    title: "The Anatomy of a Great Design Critique",
    description:
      "A framework for giving feedback that improves the work instead of just the ego.",
    category: ["UX Design", "Research"],
    contentType: "Resource",
    source: "Julie Zhuo",
    readingTime: 7,
    publishedDate: "2026-06-25",
    url: "#",
  },
  {
    id: "r3",
    title: "Branding Beyond the Logo",
    description:
      "How motion, sound, and micro-interaction are becoming part of brand identity systems.",
    category: ["Branding", "Motion Design"],
    contentType: "Case Study",
    source: "It's Nice That",
    readingTime: 11,
    publishedDate: "2026-06-18",
    url: "#",
  },
  {
    id: "r4",
    title: "A Field Guide to Design Tokens",
    description:
      "Everything you need to migrate a component library to a token-based architecture.",
    category: ["Design Systems"],
    contentType: "Resource",
    source: "Design Systems Collective",
    readingTime: 18,
    publishedDate: "2026-06-05",
    url: "#",
  },
];

export const weeklyIssues: WeeklyIssue[] = [
  {
    id: "w29",
    weekNumber: 29,
    title: "AI co-pilots, critique culture, and grid systems that scale",
    publishDate: "2026-07-01",
    resourceCount: 12,
    url: "#",
  },
  {
    id: "w28",
    weekNumber: 28,
    title: "Branding beyond the logo, plus Config 2026 recap",
    publishDate: "2026-06-24",
    resourceCount: 9,
    url: "#",
  },
  {
    id: "w27",
    weekNumber: 27,
    title: "Design tokens, motion primers, and onboarding teardown",
    publishDate: "2026-06-17",
    resourceCount: 14,
    url: "#",
  },
  {
    id: "w26",
    weekNumber: 26,
    title: "Typography for dense UI and the state of design tooling",
    publishDate: "2026-06-10",
    resourceCount: 10,
    url: "#",
  },
];

export function matchesReadingTime(minutes: number, bucket: string) {
  switch (bucket) {
    case "Under 5 min":
      return minutes < 5;
    case "5–10 min":
      return minutes >= 5 && minutes <= 10;
    case "10–20 min":
      return minutes > 10 && minutes <= 20;
    case "20+ min":
      return minutes > 20;
    default:
      return true;
  }
}

export function matchesDateSaved(savedDate: string | undefined, bucket: string) {
  if (!savedDate) return bucket === "All Time";
  if (bucket === "All Time") return true;

  const saved = new Date(savedDate).getTime();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = (now - saved) / dayMs;

  if (bucket === "Today") return diffDays < 1;
  if (bucket === "This Week") return diffDays < 7;
  if (bucket === "This Month") return diffDays < 30;
  return true;
}

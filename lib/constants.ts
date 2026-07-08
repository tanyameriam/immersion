export const PROFESSIONS = ["Designer"];

export const DESIGN_ROLES = [
  "Product Designer",
  "UX Designer",
  "UI Designer",
  "Visual Designer",
  "Graphic Designer",
  "Brand Designer",
  "Motion Designer",
  "Interaction Designer",
  "Design Student",
  "Other",
];

/** Interest topics grouped for skimmable picking (onboarding + profile).
 * Groups are display-only — the profile stores a flat topic list, so
 * regrouping or adding topics never breaks existing selections. */
export const INTEREST_GROUPS: { label: string; topics: string[] }[] = [
  {
    label: "Design",
    topics: [
      "Product Design",
      "UX Design",
      "UI Design",
      "Graphic Design",
      "Branding",
      "Motion Design",
      "Design Systems",
      "Typography",
      "Illustration",
      "Web Design",
    ],
  },
  {
    label: "Research & Craft",
    topics: [
      "UX Research",
      "Accessibility",
      "Case Studies",
      "Design Leadership",
      "Career & Portfolio",
    ],
  },
  {
    label: "Tech & Tools",
    topics: ["AI", "No-Code", "Web Development", "Figma", "Prototyping"],
  },
  {
    label: "Business",
    topics: [
      "Startups",
      "Product Management",
      "Marketing",
      "Freelancing",
      "Entrepreneurship",
    ],
  },
  {
    label: "Beyond the Screen",
    topics: [
      "Architecture",
      "Industrial Design",
      "Photography",
      "Writing",
      "Psychology",
      "Productivity",
    ],
  },
];

/** Flat list of all pickable interests, derived from the groups. */
export const RECOMMENDATION_INTERESTS = INTEREST_GROUPS.flatMap(
  (g) => g.topics,
);

export const CATEGORIES = [
  "AI",
  "Product Design",
  "UX Design",
  "UI Design",
  "Graphic Design",
  "Branding",
  "Motion Design",
  "Design Systems",
  "Typography",
  "Architecture",
  "Research",
  "Other",
];

export const CONTENT_TYPES = [
  "Tool",
  "Article",
  "Case Study",
  "Resource",
  "Event",
  "Newsletter",
];

export const READING_TIME_BUCKETS = [
  "Under 5 min",
  "5–10 min",
  "10–20 min",
  "20+ min",
];

export const DATE_SAVED_BUCKETS = ["Today", "This Week", "This Month", "All Time"];

export function slugify(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-");
}

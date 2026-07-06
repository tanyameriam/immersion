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

export const RECOMMENDATION_INTERESTS = [
  "Product Design",
  "UX Design",
  "UI Design",
  "Graphic Design",
  "Branding",
  "Motion Design",
  "Design Systems",
  "AI",
  "No-Code",
  "Web Design",
  "Typography",
  "Accessibility",
  "UX Research",
  "Architecture",
  "Industrial Design",
  "Startups",
  "Case Studies",
];

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

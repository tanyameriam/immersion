import { AI_MODEL, claude } from "@/lib/ai/claude";
import { AiAnalysisSchema, type AiAnalysis } from "@/lib/types/knowledge-item";

const TOOL_NAME = "record_analysis";

const INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description:
        "A 1-3 sentence lead: what the content is, and its core argument " +
        "or purpose. Plain prose, no markdown, no 'this article...' framing.",
    },
    sections: {
      type: "array",
      description:
        "2-5 titled sections mirroring the content's own structure, in its " +
        "order. Together with the takeaways they must replace reading the " +
        "original: capture the important arguments, findings, steps, " +
        "numbers, and conclusions — not just what the content is about. " +
        "Plain prose throughout, no markdown.",
      items: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description:
              "Short, specific section heading (2-6 words), e.g. 'The core " +
              "reframe' or '5 challenges nobody warns you about'.",
          },
          body: {
            type: "string",
            description:
              "Optional 1-3 sentence paragraph carrying this section's " +
              "substance. Omit when the points say it all.",
          },
          points: {
            type: "array",
            description:
              "Optional 2-6 points for this section. Use for lists, steps, " +
              "criteria, or parallel ideas.",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description:
                    "Optional short lead-in naming the point (3-8 words), " +
                    "shown bold before the body.",
                },
                body: {
                  type: "string",
                  description:
                    "1-2 complete, self-contained sentences of substance — " +
                    "specific enough to stand in for the original passage.",
                },
              },
              required: ["body"],
              additionalProperties: false,
            },
          },
        },
        required: ["heading"],
        additionalProperties: false,
      },
    },
    takeaways: {
      type: "array",
      items: { type: "string" },
      description:
        "3-5 one-line takeaways: the actionable or memorable conclusions " +
        "a reader should leave with.",
    },
    tldr: {
      type: "string",
      description: "A single-sentence TL;DR.",
    },
    topics: {
      type: "array",
      items: { type: "string" },
      description: "3-6 broad topic labels (e.g. 'Design Systems', 'AI').",
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "5-10 specific keywords or phrases.",
    },
    difficulty: {
      type: "string",
      enum: ["Beginner", "Intermediate", "Advanced"],
    },
    sentiment: {
      type: "string",
      enum: ["Positive", "Neutral", "Negative"],
    },
  },
  required: [
    "summary",
    "sections",
    "takeaways",
    "tldr",
    "topics",
    "keywords",
    "difficulty",
    "sentiment",
  ],
  additionalProperties: false,
};

/**
 * Analyze extracted article text with Claude, returning validated structured
 * fields. Throws if the model output fails schema validation (the caller marks
 * the item `failed` so the cron/process-on-open sweep retries it).
 */
export async function analyzeContent(input: {
  title: string;
  text: string;
}): Promise<AiAnalysis> {
  const message = await claude().messages.create({
    model: AI_MODEL,
    max_tokens: 3072,
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the structured analysis of the article.",
        input_schema: INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content:
          `Analyze this saved web content and record structured metadata. ` +
          `The summary, sections, and takeaways together must stand in for ` +
          `the original: someone who reads only them should come away with ` +
          `the substance of the content, not just what it is about.\n\n` +
          `Title: ${input.title}\n\n` +
          `Content:\n${input.text}`,
      },
    ],
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return structured analysis");
  }

  return AiAnalysisSchema.parse(toolUse.input);
}

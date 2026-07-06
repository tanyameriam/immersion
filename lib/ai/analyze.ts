import { AI_MODEL, claude } from "@/lib/ai/claude";
import { AiAnalysisSchema, type AiAnalysis } from "@/lib/types/knowledge-item";

const TOOL_NAME = "record_analysis";

const INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: {
      type: "string",
      description: "A concise 2-4 sentence summary of the content.",
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
  required: ["summary", "tldr", "topics", "keywords", "difficulty", "sentiment"],
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
    max_tokens: 1024,
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
          `Analyze this saved web content and record structured metadata.\n\n` +
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

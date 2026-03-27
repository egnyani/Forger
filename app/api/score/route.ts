import OpenAI from "openai";

import { SCORE_PROMPT } from "@/lib/prompts";
import type { ATSScore } from "@/lib/types";

export const runtime = "nodejs";

const client = new OpenAI();

function isATSScore(value: unknown): value is ATSScore {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ATSScore>;

  return (
    typeof candidate.score === "number" &&
    Array.isArray(candidate.matched_keywords) &&
    Array.isArray(candidate.missing_keywords) &&
    Array.isArray(candidate.suggestions)
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      resumeText?: string;
      jobDescription?: string;
    };
    const resumeText = body.resumeText?.trim();
    const jobDescription = body.jobDescription?.trim();

    if (!resumeText || !jobDescription) {
      return new Response(
        JSON.stringify({ error: "resumeText and jobDescription are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are an ATS analyzer. You return only valid JSON.",
        },
        {
          role: "user",
          content: SCORE_PROMPT(resumeText, jobDescription),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = raw
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    const atsScore = JSON.parse(cleaned) as ATSScore;

    if (!isATSScore(atsScore)) {
      return new Response(
        JSON.stringify({ error: "Invalid score response shape", raw }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ score: atsScore }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import OpenAI from "openai";

import { KEYWORD_EXTRACTION_PROMPT } from "@/lib/engine/prompts";

export const runtime = "nodejs";

const client = new OpenAI();

function isKeywordArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((k) => typeof k === "string");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobDescription?: string };
    const jobDescription = body.jobDescription?.trim();

    if (!jobDescription) {
      return new Response(
        JSON.stringify({ error: "jobDescription is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 1200,
      // No response_format: json_object here — that mode requires a JSON object,
      // not a bare array. The prompt asks for a raw array; we strip fences below.
      messages: [
        {
          role: "system",
          content:
            "You extract ATS keywords from job descriptions. Return only a valid JSON array of strings — no wrapper object.",
        },
        {
          role: "user",
          content: KEYWORD_EXTRACTION_PROMPT(jobDescription),
        },
      ],
    });

    const raw =
      completion.choices[0]?.message?.content
        ?.replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim() ?? "";

    const parsed = JSON.parse(raw) as unknown;

    if (!isKeywordArray(parsed)) {
      return new Response(
        JSON.stringify({ error: "Invalid keyword extraction response", raw }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const keywords = parsed
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    return new Response(JSON.stringify({ keywords }), {
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

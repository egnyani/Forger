import OpenAI from "openai";

import { extractJobDescriptionSignals } from "@/lib/jobDescriptionSignals";
import { TAILOR_PROMPT } from "@/lib/prompts";
import { loadSourceResumeContext } from "@/lib/sourceResume";
import type { ResumeData } from "@/lib/types";

export const runtime = "nodejs";

const client = new OpenAI();

function isResumeData(value: unknown): value is ResumeData {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ResumeData>;

  return (
    !!candidate.contact &&
    Array.isArray(candidate.summary) &&
    Array.isArray(candidate.experience) &&
    Array.isArray(candidate.education) &&
    !!candidate.skills &&
    typeof candidate.skills === "object" &&
    Array.isArray(candidate.projects)
  );
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

    const context = await loadSourceResumeContext();
    const jdSignals = extractJobDescriptionSignals(
      jobDescription,
      context.sourceData,
    );

    const prompt = TAILOR_PROMPT({
      sourceResumeJson: JSON.stringify(context.sourceData, null, 2),
      sourceResumeText: context.sourceText,
      evidenceModelJson: JSON.stringify(context.evidenceModel, null, 2),
      jobSignalsJson: JSON.stringify(jdSignals, null, 2),
      jobDescription,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an expert resume writer. You return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const raw =
      completion.choices[0]?.message?.content
        ?.replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim() ?? "";

    try {
      const tailoredResume = JSON.parse(raw) as ResumeData;

      if (!isResumeData(tailoredResume)) {
        return new Response(
          JSON.stringify({ error: "OpenAI returned invalid JSON", raw }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify({ data: tailoredResume }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: "OpenAI returned invalid JSON", raw }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import OpenAI from "openai";

import { TECH_LEAD_SCORE_PROMPT } from "@/lib/engine/prompts";
import { scoreDeterministic } from "@/lib/engine/scoreTechLead";
import type { ResumeData } from "@/lib/types";

export const runtime = "nodejs";

const client = new OpenAI();

type LLMFlag = {
  dimension: "semantic" | "voice";
  bullet: string;
  issue: string;
};

type LLMScoreResult = {
  semanticScore: number;
  voiceScore: number;
  flags: LLMFlag[];
};

export type TechLeadScoreResponse = {
  total: number;
  breakdown: {
    openerUniqueness: number;
    metricPreservation: number;
    semanticAccuracy: number;
    naturalVoice: number;
  };
  flags: string[];
  verdict: "passes" | "minor fixes" | "ai tells" | "rejection risk";
};

function extractBullets(data: ResumeData): string[] {
  return data.experience.flatMap((r) => r.bullets as string[]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      original?: ResumeData;
      tailored?: ResumeData;
    };
    const { original, tailored } = body;

    if (!original || !tailored) {
      return new Response(
        JSON.stringify({
          error: "original and tailored resume data are required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Deterministic checks (opener uniqueness + metric preservation) ──────
    const {
      openerScore,
      metricScore,
      flags: detFlags,
    } = scoreDeterministic(original, tailored);

    // ── LLM scoring (semantic accuracy + natural voice) ──────────────────────
    const originalBullets = extractBullets(original);
    const rewrittenBullets = extractBullets(tailored);
    const summary = tailored.summary;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You score resume rewrites for a tech lead. Return only valid JSON.",
        },
        {
          role: "user",
          content: TECH_LEAD_SCORE_PROMPT({
            originalBullets,
            rewrittenBullets,
            summary,
          }),
        },
      ],
    });

    const raw =
      completion.choices[0]?.message?.content
        ?.replace(/^```json\n?/, "")
        .replace(/\n?```$/, "")
        .trim() ?? "{}";

    const {
      semanticScore = 12,
      voiceScore = 12,
      flags: llmFlags = [],
    } = JSON.parse(raw) as Partial<LLMScoreResult>;

    const safeSemanticScore = clamp(semanticScore, 0, 25);
    const safeVoiceScore = clamp(voiceScore, 0, 25);

    const total = openerScore + metricScore + safeSemanticScore + safeVoiceScore;

    // Normalize LLM flags to display strings matching the deterministic format
    const normalizedLLMFlags = (llmFlags as LLMFlag[]).map(
      (f) => `"${f.bullet}" — ${f.issue}`,
    );

    const verdict: TechLeadScoreResponse["verdict"] =
      total >= 90
        ? "passes"
        : total >= 75
          ? "minor fixes"
          : total >= 50
            ? "ai tells"
            : "rejection risk";

    const response: TechLeadScoreResponse = {
      total,
      breakdown: {
        openerUniqueness: openerScore,
        metricPreservation: metricScore,
        semanticAccuracy: safeSemanticScore,
        naturalVoice: safeVoiceScore,
      },
      flags: [...detFlags, ...normalizedLLMFlags],
      verdict,
    };

    return new Response(JSON.stringify(response), {
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

import { scoreResumeAgainstKeywords } from "@/lib/engine/keywordUtils";
import type { ATSScore } from "@/lib/types";

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
      keywords?: string[];
    };
    const resumeText = body.resumeText?.trim();
    const keywords = body.keywords?.filter(
      (keyword): keyword is string =>
        typeof keyword === "string" && keyword.trim().length > 0,
    );

    if (!resumeText || !keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({ error: "resumeText and keywords are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    const atsScore = scoreResumeAgainstKeywords(
      resumeText,
      keywords,
    ) as ATSScore;

    if (!isATSScore(atsScore)) {
      return new Response(
        JSON.stringify({ error: "Invalid score response shape" }),
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

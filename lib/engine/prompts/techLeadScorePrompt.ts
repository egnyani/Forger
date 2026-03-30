export const TECH_LEAD_SCORE_PROMPT = ({
  originalBullets,
  rewrittenBullets,
  summary,
}: {
  originalBullets: string[];
  rewrittenBullets: string[];
  summary: string[];
}): string => `
You are a senior software engineering tech lead reviewing a rewritten resume.
Score two dimensions, each out of 25. Return only valid JSON.

DIMENSION 1 — Semantic accuracy (0-25):
Does the JD vocabulary inserted into each bullet honestly describe what the work actually was?
Deduct:
  -8 for each false mapping (e.g. RAG described as "AI training", CI/CD described as
     "live-site reliability", a single web API called "distributed systems")
  -3 for each questionable or stretched mapping
  -0 for accurate mappings

DIMENSION 2 — Natural voice (0-25):
Do the rewritten bullets read like the candidate wrote them, or like JD requirements
stapled to accomplishments?
Deduct:
  -4 for each bullet where a JD phrase is used verbatim as an opening prefix
     (e.g. "Designed and built high-quality systems for X by doing Y")
  -4 for each bullet where a JD phrase is appended after the final metric
  -6 if the summary contains "I " as the grammatical subject or "As a [job title]"
  -3 if the summary contains hollow filler like "embodying", "demonstrating",
     "showcasing", "passionate about", "proven track record"

For each deduction, name the specific bullet (first 8 words) and the specific problem.

Return ONLY valid JSON:
{
  "semanticScore": <0-25>,
  "voiceScore": <0-25>,
  "flags": [
    { "dimension": "semantic" | "voice", "bullet": "<first 8 words>", "issue": "<specific problem>" }
  ]
}

ORIGINAL BULLETS:
${originalBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

REWRITTEN BULLETS:
${rewrittenBullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

SUMMARY:
${summary.join("\n")}
`;

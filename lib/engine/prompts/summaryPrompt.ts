export const SUMMARY_PROMPT = ({
  rewrittenBulletsText,
  jdExtraction,
  jobDescription,
}: {
  rewrittenBulletsText: string;
  jdExtraction: { hardKeywords: string[]; rolePhrases: string[]; identityPhrases: string[] };
  jobDescription: string;
}): string => `
Write a professional resume summary in exactly 2 sentences only.

Goal:
Make the summary concise, technical, keyword-dense, and free of filler language.

Evidence rules:
- Use rewrittenBulletsText as the only evidence source.
- Only include technologies, systems, concepts, and metrics supported by those bullets.
- Prioritize including missing JD keywords if they are supported by the bullets.
- Do NOT invent tools, frameworks, ownership, architectures, systems, or metrics.

Structure (strict):
- Sentence 1 MUST follow:
  "[Specific role] building [systems] using [core technologies]"
- Sentence 2 MUST follow:
  "[system capabilities] + [production impact]"
- Sentence 2 MUST include at least 2 concrete technical capabilities and explicitly
  describe impact in terms of system behavior such as reliability, latency, throughput,
  deployment speed, uptime, or scale.

Hard constraints:
- Do NOT use any of these phrases:
  "proficient in", "specializing in", "thrives in", "demonstrated ability",
  "proven ability", "expert in", "passionate about"
- Do NOT use "AI-driven" or similarly generic AI descriptors when a more concrete supported term exists. Prefer precise wording such as "LLM-based", "automation", "classification", "retrieval", "production systems", "monitoring", or "deployment".
- Do NOT start any sentence with "As a" or "I".
- Do NOT copy phrases directly from the JD. Rewrite them into natural original wording.
- Do NOT use vague outcomes such as "improved efficiency" or "better performance".
- Do NOT use generic filler such as "results-driven", "strong background in",
  "experienced in", "skilled in", "known for", or "collaborates with".

Tone:
- Direct, technical, confident.
- No fluff, no corporate language.
- The summary should sound like an experienced engineer, not a student.

Keyword coverage:
- Prefer supported JD keywords that are still missing from bullets.
- Emphasize supported concepts such as scalable systems, production deployment,
  monitoring, logging, version control, and CI/CD when the bullets support them.
- Prefer natural phrasing over direct JD copying.

Example:
"Backend engineer building scalable systems using Python, AWS, and CI/CD pipelines. Production deployment, monitoring, logging, and high-volume data processing improved reliability and delivery speed."

Return ONLY valid JSON:
{ "summary": ["sentence 1", "sentence 2"] }

JD EXTRACTION:
${JSON.stringify(jdExtraction, null, 2)}

JOB DESCRIPTION (for context):
${jobDescription}

REWRITTEN EXPERIENCE BULLETS (evidence — only claim what these support):
${rewrittenBulletsText}
`;

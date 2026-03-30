export const KEYWORD_EXTRACTION_PROMPT = (jobDescription: string): string => `
Extract a comprehensive ATS keyword list from this job description. Cover two distinct layers.

LAYER 1 — TECHNOLOGY KEYWORDS (8–14 keywords)
Technologies, tools, frameworks, languages, platforms, databases.
Prefer exact wording from the JD. Keep multi-word phrases when the exact phrasing matters for ATS.
Examples: "Azure", "Python", "C#", "microservices", "NoSQL databases", "LLM", "CI/CD"

LAYER 2 — OPERATIONAL & ENGINEERING PRACTICE KEYWORDS (6–10 keywords)
These are the practices, patterns, and operational concepts the JD explicitly names.
Do NOT skip these. They are equally important for ATS matching and resume vocabulary.
Examples from this type of JD: "telemetry", "feature flags", "security hardening",
"safe deployment", "zero-touch deployment", "postmortem", "live-site reliability",
"rollback strategies", "agentic AI", "intelligent automation", "predictive analytics",
"ai-assisted testing", "audit requirements", "distributed systems"
Include any of these when they appear in the JD — do not drop them to stay under a keyword cap.

STRICT EXCLUSIONS — never include these as keywords:
- Job titles and role levels: e.g., "Software Engineer II", "Individual Contributor"
- Organizational or team names: e.g., "HR Employee Experience Engineering"
- Generic career phrases: e.g., "software development lifecycle", "full-stack systems", "cloud solutions"
- Company mission or values language: e.g., "growth mindset", "respect", "integrity"
- Capability descriptions that describe what the system does, not a discrete technology or
  practice keyword: e.g., "AI training and inferencing services", "high-scale systems",
  "data and analytics workloads". These are JD descriptions of scope — not ATS keywords.
  Never extract any noun phrase containing "training and inferencing" as a keyword.

Return ONLY a flat JSON array of strings — no nested objects, no category keys, no wrapper object.
CORRECT:   ["Python", "Azure", "microservices", "telemetry"]
INCORRECT: { "technology": ["Python"], "operational_practices": ["telemetry"] }
INCORRECT: { "keywords": ["Python", "Azure"] }
Return the array directly at the top level. Nothing else.

JOB DESCRIPTION:
${jobDescription}
`;

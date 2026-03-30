export const JD_EXTRACTION_PROMPT = (jobDescription: string): string => `
Extract three things from this job description, separately and precisely.

(a) ATS HARD KEYWORDS
Technologies, languages, platforms, frameworks, tools — the exact terms an ATS scanner
looks for word-for-word. Do not include job titles, team names, or generic phrases.

(b) ROLE DESCRIPTION PHRASES
What the job actually involves day-to-day. Extract 5–8 short phrases that describe
the engineering work itself — not keywords. These are what make bullets feel real to
a tech lead who knows the role.
Examples: "embed intelligent automation", "surface the right information at the right time",
"streamline routine tasks", "security hardening across solutions",
"automate reporting", "ad-hoc access to large datasets"

ROLE PHRASE RULES — apply before extracting:
- Role phrases must be generic and reusable — they describe the type of work, not a specific company's context.
- Do NOT include company names, product names, vendor names, or any proper nouns from the JD.
- Do NOT copy JD sentences verbatim if they contain branded entities.
- Generalize: replace named products or platforms with a plain domain description.
  BAD:  "deliver backend features for the Jack Henry Intercept fraud-detection product"
  GOOD: "deliver backend features for a fraud-detection platform"
  BAD:  "maintain services on the Azure Cognitive Search pipeline"
  GOOD: "maintain production search services"

(c) IDENTITY PHRASES
What kind of engineer they want: ownership style, collaboration, operational mindset.
Extract 3–5 phrases directly from the JD.
Examples: "independently use AI tools", "directly responsible individual (DRI)",
"collaborate with architects and designers", "communicate across stakeholder groups",
"act as DRI managing incidents"

Return ONLY valid JSON:
{
  "hardKeywords": ["..."],
  "rolePhrases": ["..."],
  "identityPhrases": ["..."]
}

JOB DESCRIPTION:
${jobDescription}
`;

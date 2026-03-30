export const GAP_AUDIT_PROMPT = ({
  rewrittenResumeText,
  keywords,
  sourceSkillCategories,
}: {
  rewrittenResumeText: string;
  keywords: string[];
  sourceSkillCategories: string[];
}): string => `
Audit keyword coverage in this resume against the keyword list.
Then do a dedicated skills section pass to maximize ATS coverage.

STEP 1 — For each keyword, assign one status:
  NATURAL    — appears in the resume naturally from the original or rewritten bullets
  ADDED      — woven into a bullet during rewriting; confirm it is present
  SKILLS_ONLY — not in any bullet; add it to the most relevant skills category
  MISSING    — cannot add honestly; zero evidence in the resume for this

STEP 2 — SKILLS SECTION PASS (run this after auditing all keywords):
The skills section exists purely for ATS coverage. For every keyword with status
SKILLS_ONLY, add it to the most relevant existing category.

Routing guidance:
  Operational/process terms ("logging", "monitoring", "security hardening", "incident response")
      → route to the most semantically relevant existing category
  Architectural concepts ("distributed systems", "microservices", "serverless")
      → Cloud Platforms or Backend Technologies
  AI/ML practices ("predictive analytics", "LLM", "AI tools", "RAG")
      → AI / ML Integration
  Data terms ("data models", "NoSQL", "ETL")
      → Database Management
  Engineering practices ("CI/CD", "test strategy", "agile", "scrum")
      → Testing and Automation

SKILLS SECTION RULES:
- You may ONLY use these existing category names — never create a new one:
  ${JSON.stringify(sourceSkillCategories)}
- Expand each skills row to include operational and architectural terms from the JD,
  not just technology names. "Audit logging", "access controls", "reliability" are
  valid skills entries if they appear in the JD.
- Prefer SKILLS_ONLY over MISSING when there is any honest connection. The skills
  section exists to capture keywords that don't fit naturally into bullets.

Return ONLY valid JSON:
{
  "audit": [
    {
      "keyword": "...",
      "status": "NATURAL" | "ADDED" | "SKILLS_ONLY" | "MISSING",
      "skillsCategory": "..."
    }
  ]
}
skillsCategory is required for SKILLS_ONLY, omit for all other statuses.

KEYWORDS TO AUDIT:
${JSON.stringify(keywords, null, 2)}

REWRITTEN RESUME TEXT:
${rewrittenResumeText}
`;

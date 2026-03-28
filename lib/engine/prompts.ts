// ─── 5-Phase Tailoring Prompts ────────────────────────────────────────────────

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

export const BULLET_CLASSIFICATION_PROMPT = ({
  bullets,
  jdExtraction,
}: {
  bullets: Array<{ id: string; text: string }>;
  jdExtraction: { hardKeywords: string[]; rolePhrases: string[]; identityPhrases: string[] };
}): string => `
You are classifying resume bullets for relevance to a target role.

For each bullet, decide:
  KEEP    — directly relevant; strong as-is or needs only light wording adjustment
  REFRAME — the underlying work is relevant but framing doesn't show it.
             When assigning jdVocabulary to a REFRAME bullet, only list phrases
             that map semantically to what the work ACTUALLY was.

             Ask: "If a tech lead asked the candidate about this bullet in an
             interview, could they defend this vocabulary choice in 30 seconds?"
             If yes → include the phrase.
             If no  → exclude it, even if it appears in the JD.

             Maximum 2 jdVocabulary phrases per bullet. More than 2 means the
             rewriter will try to force too many concepts into one sentence.

             THE JD DECIDES THE VOCABULARY:
             Only assign jdVocabulary phrases drawn from the JD EXTRACTION provided above.
             Do NOT use vocabulary from prior examples or memory.

             If a phrase does not appear in or cannot be directly inferred from the JD,
             do not assign it.

             Examples of disallowed carryover vocabulary unless present in the JD:
             "agentic AI patterns", "intelligent automation", "zero-touch deployment", "DRI"

             HARD FORBIDDEN — never assign these as jdVocabulary under any circumstances:

             "AI training" / "AI training and inferencing" / "model training"
               → RAG, embeddings, vector search, and LLM API calls are RETRIEVAL
                 and INFERENCE patterns — not training. The candidate cannot answer
                 "walk me through your model training pipeline" in an interview.
                 Use "intelligent automation" or "agentic AI patterns" instead.

             "distributed systems"
               → only assign if the bullet explicitly describes multi-service or
                 multi-region architecture. A single API + database is not a
                 distributed system.

             "microservices"
               → only assign if the bullet explicitly describes independently
                 deployable services. A monolith Django or Flask app is not
                 microservices.

             "live-site reliability" / "operating and improving live-site reliability"
               → only assign to bullets about incident response, on-call ownership,
                 or uptime monitoring. CI/CD pipeline setup and deployment time
                 reduction are NOT live-site reliability.

             "test strategy and automation" / "drove test strategy"
               → only assign to bullets explicitly about writing tests,
                 test frameworks, or QA automation. LLM classification
                 pipelines, data extraction, and ML inference workflows
                 are NOT test strategy — they are data engineering or
                 AI/ML work. Use "intelligent automation" instead.

             "collaborated with internal and external teams"
               → only assign to bullets that explicitly describe
                 cross-team or cross-org coordination. Do not assign
                 to solo engineering work (building a prototype,
                 implementing a pipeline, architecting a system).

  DROP    — genuinely unrelated; no honest reframing maps this to the role
             (note: even DROP bullets will be kept in the resume, just not forced into JD framing)

Return ONLY valid JSON — an array with one entry per bullet:
[
  {
    "id": "<bullet id>",
    "decision": "KEEP" | "REFRAME" | "DROP",
    "jdVocabulary": ["phrase 1", "phrase 2"]
  }
]
jdVocabulary is required for REFRAME, empty array for KEEP and DROP.

JD EXTRACTION:
${JSON.stringify(jdExtraction, null, 2)}

BULLETS TO CLASSIFY:
${JSON.stringify(bullets, null, 2)}
`;

export const BULLET_REWRITE_PROMPT = ({
  bullets,
  classification,
  jdExtraction,
}: {
  bullets: Array<{ id: string; text: string }>;
  classification: Array<{ id: string; decision: string; jdVocabulary?: string[] }>;
  jdExtraction: { hardKeywords: string[]; rolePhrases: string[]; identityPhrases: string[] };
}): string => `
Rewrite resume bullets using the JD vocabulary provided.

RULES — apply to every bullet:

KEEP bullets: improve phrasing with JD language; keep meaning identical.
REFRAME bullets: use the specified jdVocabulary to shift the framing. The underlying
  work stays the same — change how it is described, not what was done.
DROP bullets: return the original text unchanged. Do not force JD language onto unrelated work.

FOR ALL REWRITES:
✓ Preserve every number, percentage, and time measurement exactly (same value, same unit).
✓ Preserve all technology names used in the original bullet.
✓ Use role description phrases and identity phrases — not just the hard keywords.
✓ Weave vocabulary INTO the body of the sentence — not appended at the end, not bolted on as a prefix.
✓ Each bullet must end at the last concrete technical detail or hard metric.
✓ The bullet must read like something the candidate wrote about their own work — not like a JD requirement stapled to an accomplishment.

SAFE KEYWORD ENRICHMENT RULE — for KEEP bullets, light natural expansion is allowed
when a required keyword is clearly implied by the work but not explicitly stated.

Conditions — ALL must be true:
  (1) The keyword is semantically supported by what the bullet already describes.
  (2) No new tools, technologies, or systems are introduced.
  (3) The meaning and all metrics are preserved exactly.
  (4) The expansion reads as natural engineering language, not marketing copy.

If these conditions are met, add the keyword as a natural adjective, noun, or
brief clause — not as a prefix, suffix, or standalone sentence.

  Original: "Built backend APIs using Python and AWS"
  Improved: "Built scalable backend APIs using Python and AWS for production workflows"

  Original: "Built deployment pipelines using GitHub Actions and AWS"
  Improved: "Built deployment automation pipelines using GitHub Actions and AWS for production releases"

  Original: "Integrated APIs with core platform services on AWS"
  Improved: "Integrated RESTful APIs with core platform services on AWS, enforcing access controls and maintaining stable latency"

If the conditions are NOT met, return the bullet unchanged. A clean original is better
than a forced enrichment.

VOCABULARY INJECTION RULE — how to structurally rewrite a bullet:

The goal is to make the JD vocabulary the SUBJECT or VERB of the sentence — not a descriptor bolted onto the original structure.

PATTERN A — swap the opening verb and object to use JD framing:
  Original: "Added production monitoring using CloudWatch, lowering errors by 18%"
  Bad:      "Added production monitoring using CloudWatch, operating and improving live-site reliability by lowering errors by 18%"
  Good:     "Owned live-site reliability for AI services using CloudWatch telemetry and confidence thresholds, reducing incorrect suggestions by 18% during peak tax filing"

PATTERN B — replace a generic verb with the JD's more specific concept:
  Original: "Set up automated deployment using GitHub Actions, cutting time from 30 to 10 min"
  Bad:      "Set up automated deployment using GitHub Actions, operating and improving live-site reliability by cutting time from 30 to 10 min"
  Good:     "Built zero-touch deployment pipelines using GitHub Actions and AWS with automated rollback, cutting deployment time from 30 minutes to under 10 minutes"

PATTERN C — restructure around the JD concept when the original verb is too generic:
  Original: "Implemented LLM-driven classification pipelines in Python through AWS Lambda"
  Bad:      "Implemented LLM-driven pipelines, independently using AI tools orchestrated through AWS Lambda"
  Good:     "Built intelligent automation pipelines using Python and AWS Lambda to classify and extract data from tax documents, cutting manual review by 32% at peak load"

THE TEST: Cover the last 30% of the bullet with your hand.
Does the remaining sentence still sound like it was written by the candidate?
If yes, the vocabulary is woven in. If no, it was bolted on.

PATTERN D — when the jdVocabulary phrase describes what the JD WANTS rather than what
the candidate DID, do not use it as an opener. Drop it and lead with the actual action instead.

  Wrong:   "Contributed to scalable software solutions by designing backend APIs in Python..."
  Correct: "Designed backend APIs in Python..."

  Wrong:   "Assisted with troubleshooting issues by implementing monitoring using CloudWatch..."
  Correct: "Implemented production monitoring using CloudWatch..."

  Wrong:   "Designed and developed application features using Python (Django)..."
  Correct: "Delivered modular enterprise applications using Python (Django)..."

THE OPENER RULE — every bullet MUST start with a strong past-tense action verb that
describes what the candidate actually did. No exceptions.

  ✗ NEVER start with:
    "Assisted with..."           (passive compliance framing)
    "Contributed to..."          (vague, JD-requirement framing)
    "Responsible for..."         (job description language, not achievement language)
    "Designed and developed..."  (JD-style compound that sounds like a requirement)
    "Helped to..."               (diminishing framing)

  ✓ ALWAYS start with a single strong verb:
    "Built", "Designed", "Developed", "Implemented", "Delivered", "Architected",
    "Reworked", "Integrated", "Deployed", "Established", "Owned", "Led"

SEMANTIC ACCURACY CHECK — before using any JD phrase, verify it maps honestly to what the work actually was:

VALID mappings (use these freely):
  "CloudWatch metrics / monitoring"  →  "telemetry", "observability"
  "GitHub Actions deployment"        →  "zero-touch deployment", "safe deployment", "automated rollback"
  "IAM access controls"              →  "security hardening", "security invariants"
  "RAG / LangChain pipelines"        →  "agentic AI patterns", "intelligent automation"
  "multi-region / cross-service"     →  "distributed systems"
  "Node.js + Django APIs"            →  "microservices"
  "incident response / on-call"      →  "DRI", "live-site reliability"

INVALID mappings (never use these):
  "CI/CD pipeline setup"             ≠  "live-site reliability" (CI/CD is delivery, not ops)
  "deployment time reduction"        ≠  "operating live-site reliability"
  "building a web app"               ≠  "distributed systems"
  "any LLM work"                     ≠  "Microsoft Copilot" or "Agent Framework"
  "RAG / embeddings / vector search
   / LLM API calls"                  ≠  "AI training and inferencing" or "AI training and
                                        inferencing services" (these are retrieval and
                                        inference — the candidate never trained a model)
  "CI/CD setup / deployment
   pipelines / deployment time
   reduction"                        ≠  "live-site reliability" (live-site = incident response,
                                        on-call ownership, uptime monitoring — not delivery speed)

If no valid mapping exists for a jdVocabulary phrase, leave the bullet closer to the original.
A well-written original is better than a semantically wrong rewrite.

FORBIDDEN patterns — these will be stripped by post-processing anyway:
✗ REPETITION: Ensure no two bullets in your final output array share the same
  first four words. This is a property of the completed array — verify it before
  returning. If any two openers match, restructure the later one using a different
  pattern from the VOCABULARY INJECTION examples above.
✗ AI TRAINING FALSE MAPPING: Never use "AI training", "AI training and inferencing",
  "AI training and inferencing services", or "model training" in any bullet. This
  includes any variant of these phrases with additional words appended. RAG systems,
  embedding pipelines, vector search, and LLM API calls are retrieval and inference —
  not training. Use "intelligent automation", "agentic AI patterns", or "LLM-driven"
  instead.
✗ Opening with a JD phrase as a prefix: "Designed scalable microservices by...", "Delivered high-quality solutions by..."
✗ "...reducing time by 40%, enabling intelligent automation."
✗ "...cutting effort by 32%, leveraging predictive analytics."
✗ Any clause after the final metric that describes a quality or practice.
✗ Swapping only the opening verb with all other words unchanged.
✗ Inventing systems, clients, or metrics not in the original bullet.
✗ COMPOUND VERBS: Never combine two verbs with "and" in the opener.
  BAD:  "Designed and developed APIs..."
  BAD:  "Built and implemented monitoring..."
  BAD:  "Designed and deployed pipelines..."
  If the original bullet already starts with a single strong verb ("Developed", "Built",
  "Implemented", "Delivered"), KEEP that verb. Do not convert it into a compound.
  Use exactly ONE strong verb. Pick the one that best describes the primary action.
  GOOD: "Built APIs..." / "Developed APIs..."
✗ PRODUCTION SIGNAL OVERRIDE: If a bullet contains metrics (%, time reduction,
  scale), system usage counts, or performance impact, it describes a production system.
  Remove all of these words from such bullets: "prototype", "early", "initial".
  Rewrite as a shipped, production system.
  BAD:  "Architected an early prototype using Python and vector search, lowering support follow-ups by 25%."
  GOOD: "Designed a RAG-based retrieval system using Python and vector search, lowering support follow-ups by 25%."
✗ OVER-REWRITING STRONG BULLETS: If a bullet already contains ALL of these:
  (1) a required keyword from the JD (e.g. PostgreSQL, enterprise applications, REST APIs)
  (2) a concrete metric (e.g. 100K+ monthly transactions, 99.95% uptime, 45 → 7 minutes)
  (3) a clear description of backend or system work
  → DO NOT restructure it. Only light wording tightening is allowed.
  A bullet that already reads like a strong engineering achievement should be returned
  nearly verbatim, not rebuilt into a JD-compliance structure.

STRICT OPENER ENFORCEMENT — before returning, scan every bullet you have written.
If any bullet starts with one of these exact phrases, it is INVALID and must be rewritten:
  - "Contributed to"
  - "Assisted with"
  - "Responsible for"
  - "Designed and developed"
  - "Designed and deployed"
  - "Helped to"
  - "Worked on"

These are JD-compliance phrases, not engineering achievements. They make the bullet sound
like the candidate is describing a job requirement, not their own work.

Fix: replace the opening phrase with a single strong past-tense verb.
  BAD:  "Contributed to scalable software solutions by implementing REST APIs..."
  BAD:  "Designed and developed backend APIs using Python and PostgreSQL..."
  GOOD: "Built REST APIs using Django REST Framework and Node.js..."
  GOOD: "Implemented backend APIs in Python with PostgreSQL..."
  GOOD: "Delivered enterprise applications using Python (Django) and PostgreSQL..."

Run this check on every bullet in your output array before returning. No exceptions.

Return ONLY valid JSON — an array with one entry per bullet:
[{ "id": "<bullet id>", "text": "<rewritten or original text>" }]

JD EXTRACTION:
${JSON.stringify(jdExtraction, null, 2)}

CLASSIFICATION:
${JSON.stringify(classification, null, 2)}

ORIGINAL BULLETS:
${JSON.stringify(bullets, null, 2)}
`;

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

export const SUMMARY_PROMPT = ({
  rewrittenBulletsText,
  jdExtraction,
  jobDescription,
}: {
  rewrittenBulletsText: string;
  jdExtraction: { hardKeywords: string[]; rolePhrases: string[]; identityPhrases: string[] };
  jobDescription: string;
}): string => `
Write a professional summary for this resume. 2–3 sentences only. No bullet points.

The summary must declare a specific professional identity that matches this JD.
A tech lead reading it should immediately think: "this person has been doing this work."

STRUCTURE — cover these themes across 2–3 flowing sentences:
  Sentence 1 — IDENTITY + AI/ML DEPTH: who this engineer is in the JD's language,
    plus their strongest production AI story (what they built, what it automated, at what scale).
    Ground every claim in the actual bullets below — do not invent.
  Sentence 2 — PLATFORM & RELIABILITY: cloud, security, monitoring, and deployment story.
    Reference real technologies from the bullets. Use role phrases from the JD extraction.
  Sentence 3 (optional) — PERSONA FIT: connect to identity phrases from the JD.
    Ownership, collaboration style, operational mindset — grounded in real experience.
    Omit if the first two sentences already cover it naturally.

RULES:
- Return 2 or 3 sentences. Never 4. Never a list.
- Do NOT return the same text as any prior source summary.
- Do NOT use generic filler: "passionate about", "proven track record", "results-driven".
- Do NOT claim expertise in a technology that has no backing in the bullets below.
- Each sentence must be specific and credible — not a generic overview of the candidate.
- Use JD role phrases and identity phrases — not just hard keywords.
- Do NOT start any sentence with "As a [job title]" or "I [verb]" — summaries are written in third-person implied voice, no subject pronoun.
- Lead with the candidate's STRONGEST and most technically impressive story — not the most recent. If an earlier role involved more scale, lead with that.
- Do NOT use the JD's job title as a self-description ("Software Engineer II specializing in...") — this reads as if the candidate is claiming the role they're applying for.
- The first sentence must name: what kind of systems they build + the production AI/ML work + one scale signal (record count, uptime, user volume, or transaction volume).

SUMMARY MUST BE CONCRETE — additional hard rules:
- NEVER use: "proficient in", "known for", "experienced in", "collaborates with",
  "familiarity with", "skilled in", "expertise in". These are resume-filler phrases.
- STRUCTURE: Sentence 1 = role + core stack. Sentence 2 = 2-3 technical areas with
  one measurable impact. Sentence 3 (optional) = delivery method / environment fit.
- The summary must read like a paragraph written by the candidate, not a keyword list.

  TARGET FORM (adapt to actual JD and bullets — do not copy verbatim):
  "Software engineer building backend systems and APIs using Python, Node.js, and
  PostgreSQL, with production experience in React frontends and cloud deployments on AWS.
  Built AI-driven data pipelines processing millions of records and reduced manual
  review effort by 32%; designed CI/CD workflows cutting deployment time from 45 to 7
  minutes. Delivered projects in Agile/Scrum environments, maintaining 99.95% uptime
  on production systems."

Return ONLY valid JSON:
{ "summary": ["sentence 1", "sentence 2"] }
or
{ "summary": ["sentence 1", "sentence 2", "sentence 3"] }

JD EXTRACTION:
${JSON.stringify(jdExtraction, null, 2)}

JOB DESCRIPTION (for context):
${jobDescription}

REWRITTEN EXPERIENCE BULLETS (evidence — only claim what these support):
${rewrittenBulletsText}
`;

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

// ─── Legacy single-prompt (kept for reference, replaced by 5-phase above) ────
export const TAILOR_PROMPT = ({
  resumeJson,
  jobDescription,
  fixedKeywordList,
  mustKeepKeywords,
  mustAddKeywords,
  zeroEvidenceKeywords,
}: {
  resumeJson: string;
  jobDescription: string;
  fixedKeywordList: string[];
  mustKeepKeywords: string[];
  mustAddKeywords: string[];
  zeroEvidenceKeywords: string[];
}): string => `
You are an expert resume engineer. Your job is to transform a resume so it passes ATS
screening AND reads as compelling and credible to the tech lead who reviews it next.

CRITICAL OUTPUT RULE — READ FIRST:
You will follow a 5-phase algorithm below. Phases 1–4 are your INTERNAL REASONING only.
Do NOT include phase annotations, classifications, keyword audits, or any intermediate
analysis in your output. The only thing you output is the final tailored resume as a
valid JSON object with exactly these top-level keys:
  contact, summary, experience, education, skills, projects
No other keys. No phase keys. No reasoning keys. Just the resume JSON.

You will follow a strict 5-phase algorithm. Execute each phase in order internally, then
output ONLY the final resume JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — JD DECOMPOSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Read the JD carefully. Before touching the resume, extract three layers:

LAYER 1 — HARD KEYWORDS (ATS exact matches)
  Already provided below in FIXED_KEYWORD_LIST. These are the words the ATS scans for.
  Your job is to make them appear in the resume.

LAYER 2 — SOFT PHRASES (what the role actually does day-to-day)
  These are NOT keywords — they are the phrases a tech lead uses to describe the work.
  Extract 5–8 phrases from the JD that describe the actual engineering problems.
  Examples: "embed intelligent automation", "surface the right information at the right time",
  "streamline routine tasks", "scalable microservices", "security hardening across solutions"
  These phrases become the framing vocabulary for bullet rewrites — they make bullets
  feel real to a tech lead even when the underlying work is from a different domain.

LAYER 3 — PERSONA SIGNALS (what kind of engineer they want)
  Extract 3–5 signals about working style, collaboration, and engineering mindset.
  Examples: "independently use AI tools", "collaborate with architects and designers",
  "DRI for incidents", "communicate across stakeholder groups"
  These go into summary bullets and light behavior signals in experience.

ROLE IDENTITY — synthesize all three layers into one phrase (5–7 words):
  This is the lens for every bullet rewrite in Phase 3.
  Example: "SWE II embedding AI into enterprise HR platform"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — RESUME DECOMPOSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Read the source resume. For each experience bullet, answer three questions:

  CATEGORY: What kind of engineering work is this?
    (API design | data pipeline | AI/ML integration | frontend | monitoring/reliability |
     security/compliance | deployment/CI-CD | distributed systems | data processing)

  REMAPPABLE: Does this work map to the ROLE IDENTITY from Phase 1?
    YES     — the work directly addresses the role's engineering problems
    PARTIAL — the work is adjacent; the JD-relevant angle exists but isn't foregrounded
    NO      — the work is genuinely unrelated; force-fitting it would be dishonest

  DECISION:
    YES     → REFRAME HEAVILY: rewrite using JD vocabulary to make the connection explicit
    PARTIAL → REFRAME: adjust framing to surface the JD-relevant angle
    NO      → KEEP FACTUAL: do not apply JD language; preserve the bullet's real value

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — REFRAME EACH BULLET (THE CORE ALGORITHM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For every bullet marked REFRAME HEAVILY or REFRAME:

  ASK: "What is the [ROLE IDENTITY] interpretation of this work?"
  The underlying facts don't change. The framing shifts to make the JD-relevant
  angle visible — using Layer 1 keywords AND Layer 2 soft phrases.

  REWRITE RULES:
  ✓ Change the subject, verb, OR framing — not just the verb.
  ✓ Weave 1–2 keywords/phrases into the body of the sentence (not appended at the end).
  ✓ Preserve the EXACT original metric (same number, same unit, same comparison).
  ✓ The bullet must be denser and more specific after rewriting, never vaguer.

  ✗ Do NOT swap verbs only ("Developed" → "Engineered"). This is not a rewrite.
  ✗ Do NOT append a keyword after the metric. ("...by 40%, leveraging AI tools.") FORBIDDEN.
  ✗ Do NOT drop a metric. A dropped metric invalidates the entire bullet.
  ✗ Do NOT invent systems, clients, or products not in the source.

─── WORKED EXAMPLE ─────────────────────────────────────────────
Source:
  "Implemented LLM-driven classification and data extraction pipelines in Python,
   orchestrated through AWS Lambda and SQS, reducing manual review effort for tax
   operations teams by 32% during peak periods."

Role Identity: "SWE II embedding AI into enterprise HR platform"
Layer 2 soft phrase available: "streamline routine tasks", "intelligent automation"

✗ WRONG — verb swap only:
  "Developed LLM-driven classification and data extraction pipelines..."

✗ WRONG — trailing append:
  "...reducing manual review effort by 32% during peak periods, enabling intelligent automation."

✓ CORRECT — framing changed, keyword woven into body, metric preserved:
  "Built intelligent automation pipelines using LLM-driven classification in Python,
   orchestrated via AWS Lambda and SQS to streamline tax document review, cutting
   manual effort for operations teams by 32% during peak filing periods."
─── END EXAMPLE ─────────────────────────────────────────────────

METRIC PRESERVATION CHECKLIST — run this before moving to Phase 4:
List every number, percentage, and time measurement from the source JSON.
Verify each appears in your rewritten bullets. If any is missing, fix that bullet now.
A missing metric is a fatal error — worse than leaving the bullet unchanged.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — KEYWORD COVERAGE AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Go through MUST_ADD_KEYWORDS one by one. For each keyword, choose ONE action:

  WOVEN INTO BULLET  — already injected in Phase 3 → mark done
  FIT IN A BULLET    — it fits a specific bullet naturally → go back and add it
  ABSTRACT CONCEPT   — it's a practice/quality/methodology → route to existing skills category
  CANNOT ADD HONESTLY — skip (already handled: these are in ZERO_EVIDENCE_KEYWORDS)

SKILLS CATEGORY ROUTING (NEVER create a new category — only existing ones):
  "maintainability", "performance", "software development lifecycle", "engineering practices"
      → Testing and Automation

  "distributed systems", "microservices", "AI training and inferencing services"
      → Cloud Platforms

  "AI-driven architectural patterns", "AI-enabled empowerment", "predictive analytics",
  "large language model (LLM)", "AI tools"
      → AI / ML Integration

  "data models", "NoSQL databases"
      → Database Management

  "full-stack systems"
      → Backend Technologies

SKILLS SECTION RULES:
  - ONLY use category names that exist in the source. NEVER invent a new category.
    Forbidden: "Additional Skills", "Engineering Practices", "Other Skills", or any catch-all.
  - Do NOT add job titles, team names, or organizational labels (e.g., "Software Engineer II").
  - Do NOT promote a technology to the front of a category if it has no experience bullet backing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5 — NARRATIVE CHECK & SUMMARY (write this LAST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After all bullets are written, write the 4 summary bullets.
The summary declares the candidate's identity in the JD's terms.
Every experience bullet must be evidence for the first summary sentence.

WRITE THE SUMMARY USING THIS STRUCTURE:
  Bullet 1 — IDENTITY: Who is this engineer in the JD's language?
    (Stack, years, type of systems, scale — using Layer 1 + Layer 2 language)
  Bullet 2 — AI/ML DEPTH: What is their strongest AI/ML production story?
    (LLM, RAG, inferencing, classification — what they actually built and shipped)
  Bullet 3 — PLATFORM & RELIABILITY: What does their infrastructure story look like?
    (Cloud platforms, security, monitoring, compliance, deployment practices)
  Bullet 4 — PERSONA FIT: What makes them the kind of engineer this role wants?
    (From Layer 3: self-driven, collaborative, communicates across stakeholders, etc.)

SUMMARY RULES:
  - Do NOT return the source summary unchanged. Identical = FAILURE.
  - Do NOT claim expertise in a technology that has no experience bullet backing.
  - Do NOT use generic filler ("passionate about", "proven track record").
  - Each bullet must be a specific, believable statement about real work done.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HARD CONSTRAINTS (apply across all phases)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HALLUCINATION GUARD — ZERO TOLERANCE:
Never insert a company name, client name, product name, or brand not in the source.
If the source says "core platform APIs" → output must say "core platform APIs", not
"core AWS platforms" or "core Intuit APIs". Generic in → generic out.

TRAILING PHRASE RULE — THE #1 FAILURE MODE:
Any clause appended AFTER the last hard metric that describes a quality or practice is FORBIDDEN.
  ✗ "...reducing time by 40%, enabling intelligent automation."
  ✗ "...cutting review effort by 32%, leveraging predictive analytics."
  ✗ "...improving uptime to 99.95%, ensuring reliability."
The bullet ends at the last concrete technical detail or hard metric. Period.
Before returning, read every bullet right-to-left. If the last clause is abstract, delete it.

PRE-RETURN SELF-CHECK:
  1. Are MUST_KEEP_KEYWORDS still present in the output? (Never remove them.)
  2. Is every source metric present in the output?
  3. Does every MUST_ADD_KEYWORD appear somewhere (bullet or skills)?
  4. Is every bullet different from its source version?
  5. Is the summary different from the source summary?
  6. Are there any new skills categories not in the source?
Fix any failure before returning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT — THIS IS WHAT YOU RETURN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid raw JSON. No markdown. No explanation. No phase annotations.
The JSON must have exactly these top-level keys matching the source schema:
  contact, summary, experience, education, skills, projects

Do NOT include keys like "PHASE_1", "PHASE_2", "analysis", "reasoning", "bullets_classified",
"keyword_coverage", or anything that is not part of the resume data schema.
Any extra key will cause a validation failure and break the application.

  - summary: array of exactly 4 strings
  - experience[].bullets: array of strings
  - skills: object where every key must be a category name from the SOURCE resume only
  - education: copied exactly from source
  - projects: copied from source (include if it overlaps the JD, otherwise empty array)

FIXED KEYWORD LIST:
${JSON.stringify(fixedKeywordList, null, 2)}

MUST_KEEP_KEYWORDS:
${JSON.stringify(mustKeepKeywords, null, 2)}

MUST_ADD_KEYWORDS:
${JSON.stringify(mustAddKeywords, null, 2)}

ZERO_EVIDENCE_KEYWORDS — DO NOT INJECT:
${JSON.stringify(zeroEvidenceKeywords, null, 2)}

These keywords have no backing in the candidate's actual work history — not even adjacent
or transferable experience. Injecting them creates interview traps where the candidate
will be asked about technology they have never used.
- DO NOT inject these into skills, summary, or experience bullets.
- DO NOT create a new skills category to house them.
- DO NOT reference them anywhere in the output.
- Omit them entirely. A missing keyword loses 1 ATS point. An interview trap ends the process.

MASTER RESUME JSON:
${resumeJson}

JOB DESCRIPTION:
${jobDescription}
`;

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

export const SCORE_PROMPT = (
  resumeText: string,
  jobDescription: string,
): string => `
You are an ATS (Applicant Tracking System) analyzer.

Compare the resume text against the job description and return a JSON object 
with exactly this shape:
{
  "score": <number 0–100>,
  "matched_keywords": [<string>, ...],
  "missing_keywords": [<string>, ...],
  "suggestions": [<string>, ...]
}

- score: overall ATS match percentage as an integer
- matched_keywords: important keywords/phrases from the JD present in the resume
- missing_keywords: important keywords/phrases from the JD absent from the resume
- suggestions: exactly 3 specific actionable suggestions to improve the score

Return ONLY valid JSON. No markdown fences, no explanation. Raw JSON only.

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}
`;

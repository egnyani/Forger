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

KEEP bullets: return the bullet unchanged. Do not add vocabulary, restructure, or alter phrasing.
  A KEEP bullet is already strong and aligned. Any change risks weakening it.

LIGHT_REFRAME bullets: make the smallest possible JD-aligned change only.
  The output must be recognizably the original bullet with light enrichment — not a rewrite.

  ALLOWED:
  ✓ Add 1–2 jdVocabulary terms as natural adjectives, nouns, or short prepositional clauses.
  ✓ Make an implied technology explicit if it is semantically supported by the existing text.
  ✓ Replace a weak compound opener (e.g. "Designed and developed", "Built and implemented")
    with one strong past-tense verb. Keep everything else in the sentence identical.
  ✓ Remove a single non-transferring domain word only if meaning stays identical.

  FORBIDDEN:
  ✗ No sentence restructuring or clause reordering.
  ✗ No new tools, products, systems, or domains not present in the original.
  ✗ No removing existing technologies.
  ✗ No JD phrase as opener or prefix.
  ✗ Do not apply Patterns A, B, or C — those are REFRAME patterns only.
  ✗ Metrics must remain verbatim (same number, same unit, same comparison).
  ✗ Do not change the subject or verb of the sentence unless fixing a compound opener.

  LIGHT_REFRAME EXAMPLES:
    Original: "Set up automated build and deployment using GitHub Actions + AWS, cutting manual deploy time by 73%."
    Good:     "Set up automated build and deployment using GitHub Actions + AWS and Git, cutting manual deploy time by 73%."
    (adds "Git" naturally, metric preserved, structure identical)

    Original: "Integrated AI services with core platform APIs using REST APIs deployed on AWS (Lambda, DynamoDB)."
    Good:     "Integrated AI services with core platform REST APIs deployed on AWS (Lambda, DynamoDB)."
    (makes REST API explicit in a natural position, no restructure)

    If no jdVocabulary term fits naturally without altering the sentence structure → return the original unchanged.

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

REWRITE ENHANCEMENT ADDENDUM — optimize for technical depth, clarity, and JD alignment
without sacrificing believability:

BULLET STRUCTURE:
- Prefer this structure when appropriate:
  [Strong action verb] + [technical task/tool] + [context/scale] + [result]
- Do NOT force this structure if the original bullet is already strong.

TECHNICAL SPECIFICITY:
- Replace vague wording with more precise technical language when the original bullet
  already supports it.
- Prefer explicit tools, systems, and engineering concepts already present in the
  original bullet or clearly named elsewhere in the source resume.
- Do NOT introduce new tools, frameworks, architectures, or responsibilities.

JD ALIGNMENT:
- When supported by the evidence, align wording to JD intent:
  * design      → architecture, APIs, data modeling
  * scale       → throughput, large-scale processing, latency, traffic, data volume
  * maintain    → monitoring, logging, stability, deployment quality
- Do NOT force JD themes onto unsupported bullets.

KEYWORD COVERAGE OBJECTIVE:
- Maximize JD keyword coverage using only supported resume evidence.
- Do NOT skip a supported keyword just because a bullet already sounds strong.
- Prefer distributing supported keywords across different bullets rather than stacking
  multiple keywords into one bullet.
- If a supported keyword cannot fit naturally into the bullet body, leave the bullet
  clean and let summary / skills layers surface it later.

SAFE CATEGORY MAPPINGS:
- PostgreSQL / MySQL               → SQL databases
- Git / GitHub Actions            → version control
- CloudWatch / metrics            → monitoring
- audit logging                   → logging
- deployment / CI/CD              → production deployment
- high-traffic / large-scale      → scalable software systems
- Only use these mappings when the source evidence clearly supports them.

METRICS AND SCALE:
- Never invent, estimate, round, or upgrade a metric.
- If the original bullet contains a metric or scale signal, preserve it exactly.
- If there is no metric, keep the statement factual rather than inflating it.

VERB CONTROL:
- Use one strong, accurate action verb.
- Do NOT inflate ownership. Avoid "Architected" unless the original bullet clearly
  supports architecture-level ownership.
- Prefer grounded verbs such as: Built, Developed, Designed, Implemented, Delivered,
  Reworked, Integrated, Deployed, Established.

STRONG BULLET PROTECTION:
- If a bullet already contains:
  * clear technical detail
  * metrics or scale
  * good JD alignment
  then protect it. Only make minimal changes if needed for keyword visibility.

TONE:
- Keep writing concise, technical, and professional.
- Avoid filler like: "passionate", "thrives in", "significant experience",
  "results-driven", "proven track record".

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

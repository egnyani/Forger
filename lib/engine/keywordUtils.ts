import type { ATSScore, ResumeData } from "@/lib/types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "or",
  "the",
  "of",
  "to",
  "for",
  "in",
  "on",
  "with",
  "using",
  "by",
  "at",
  "from",
  "into",
  "through",
  "based",
  "role",
]);

const KEYWORD_ALIASES: Record<string, string[]> = {
  react: ["react", "reactjs", "react.js"],
  reactjs: ["react", "reactjs", "react.js"],
  "node.js": ["node.js", "nodejs", "node"],
  nodejs: ["node.js", "nodejs", "node"],
  aws: ["aws", "amazon web services"],
  "ci/cd": ["ci/cd", "continuous integration", "continuous delivery", "github actions", "jenkins"],
  devops: ["devops", "deployment", "release validation", "ci/cd"],
  scrum: ["scrum", "agile scrum", "agile/scrum"],
  agile: ["agile", "scrum", "agile/scrum"],
  debugging: ["debugging", "debugged", "troubleshooting", "resolved"],
  collaboration: ["collaboration", "collaborated", "cross-functional", "team"],
  reliability: ["reliability", "reliable", "uptime", "observability", "monitoring"],
  scalability: ["scalability", "scalable", "scaling"],
  "serverless solutions": ["serverless solutions", "serverless", "aws lambda", "api gateway"],
  "javascript (es2015+)": ["javascript (es2015+)", "javascript", "es2015"],
  // "logging" in a JD maps to CloudWatch, audit logging, monitoring, telemetry —
  // all legitimate rephrases the LLM may use when rewriting security/ops bullets.
  logging: ["logging", "logs", "audit logging", "audit log", "cloudwatch", "telemetry", "log monitoring"],
  // "monitoring" covers CloudWatch, observability, and alerting constructs
  monitoring: ["monitoring", "cloudwatch", "observability", "alerting", "telemetry"],
  // "telemetry" is often expressed via CloudWatch or monitoring language
  telemetry: ["telemetry", "cloudwatch", "monitoring", "metrics", "observability"],
  // "security" covers IAM, access controls, compliance, hardening
  security: ["security", "iam", "access control", "compliance", "hardening", "audit"],

  // ── Concept-level aliases for enterprise/cloud JDs ────────────────────────
  // "distributed systems" matches when resume describes multi-service cloud architecture
  "distributed systems": [
    "distributed systems", "microservices", "serverless", "aws lambda",
    "api gateway", "distributed", "multi-region", "event-driven",
  ],
  // "microservices" matches when resume uses Lambda/SQS/REST API patterns
  microservices: [
    "microservices", "serverless", "aws lambda", "node.js", "rest apis",
    "api gateway", "services", "event-driven",
  ],
  // "agentic ai" / "agentic ai patterns" — RAG, LangChain, LLM pipelines are evidence
  "agentic ai": ["agentic ai", "rag", "langchain", "llm", "retrieval-augmented", "autonomous", "agent"],
  "agentic ai patterns": ["agentic ai patterns", "rag", "langchain", "llm apis", "retrieval-augmented generation"],
  // "intelligent automation" — LLM-driven pipelines and classification are this
  "intelligent automation": [
    "intelligent automation", "llm", "classification", "automation",
    "ai pipeline", "langchain", "rag",
  ],
  // "predictive analytics" — ML, classification, and LLM inference are evidence
  "predictive analytics": [
    "predictive analytics", "analytics", "ml", "llm", "classification",
    "inference", "insights", "pytorch",
  ],
  // "ai tools" — LLM APIs, LangChain, copilot-style assistants
  "ai tools": ["ai tools", "llm", "ai-assisted", "llm apis", "langchain", "chatgpt", "rag"],
  // "ai-assisted testing" — automated tests, LLM-driven validation
  "ai-assisted testing": [
    "ai-assisted testing", "llm", "automated testing", "unit testing",
    "integration testing", "end-to-end testing",
  ],
  // "feature flags" — experimentation and safe deployment
  "feature flags": [
    "feature flags", "feature flag", "flags", "a/b testing",
    "experimentation", "canary", "rollout",
  ],
  // "safe deployment" / "zero-touch deployment" — CI/CD pipeline automation
  "safe deployment": ["safe deployment", "ci/cd", "github actions", "deployment", "release", "automated"],
  "zero-touch deployment": [
    "zero-touch deployment", "ci/cd", "automated deployment",
    "github actions", "jenkins", "ecs",
  ],
  // "live-site reliability" / DRI patterns
  "live-site reliability": [
    "live-site reliability", "uptime", "reliability", "monitoring",
    "observability", "cloudwatch", "99.95",
  ],
  // "postmortem" — incident response, reliability practices
  postmortem: ["postmortem", "post-mortem", "incident", "retrospective", "oncall"],
  dri: ["dri", "directly responsible individual", "incident response", "oncall", "on-call"],
  // "security hardening" — IAM, compliance, audit logging
  "security hardening": [
    "security hardening", "iam", "security", "compliance",
    "access control", "hardening", "audit logging",
  ],
  // "nosql databases" — DynamoDB, MongoDB, Redis are all NoSQL
  "nosql databases": ["nosql databases", "nosql", "dynamodb", "mongodb", "redis"],
  nosql: ["nosql", "dynamodb", "mongodb", "redis"],
  // "data models" — schema design, data modeling
  "data models": ["data models", "data modeling", "schema", "database design"],
  // "rollback" — deployment safety
  rollback: ["rollback", "rollback strategy", "revert", "deployment", "blue-green"],
};

export function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#/. -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const key = normalizeKeyword(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(value.trim());
  });

  return result;
}

function tokenize(value: string): string[] {
  return normalizeKeyword(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token && !STOP_WORDS.has(token));
}

function buildKeywordVariants(keyword: string): string[] {
  const normalized = normalizeKeyword(keyword);
  const aliases = KEYWORD_ALIASES[normalized] ?? [];
  return unique([keyword, normalized, ...aliases]);
}

export function keywordMatchesText(keyword: string, text: string): boolean {
  const normalizedText = normalizeKeyword(text);
  const variants = buildKeywordVariants(keyword).map(normalizeKeyword);

  if (variants.some((variant) => variant && normalizedText.includes(variant))) {
    return true;
  }

  const keywordTokens = unique(variants.flatMap((variant) => tokenize(variant)));
  if (keywordTokens.length === 0) return false;

  return keywordTokens.every((token) => normalizedText.includes(token));
}

export function extractMatchedKeywords(
  resumeText: string,
  keywords: string[],
): string[] {
  return unique(
    keywords.filter((keyword) => keywordMatchesText(keyword, resumeText)),
  );
}

export function buildKeywordAnchors(resumeText: string, keywords: string[]) {
  const mustKeepKeywords = extractMatchedKeywords(resumeText, keywords);
  const keepSet = new Set(mustKeepKeywords.map(normalizeKeyword));

  return {
    mustKeepKeywords,
    mustAddKeywords: unique(
      keywords.filter((keyword) => !keepSet.has(normalizeKeyword(keyword))),
    ),
  };
}

/**
 * Finds mid-sentence capitalized words in tailoredText that do not appear
 * in sourceText or allowedKeywords. These are candidates for hallucinated
 * proper nouns (company names, product names, brand names).
 *
 * Skips the first word of each sentence (always capitalized) so only genuinely
 * mid-sentence capitalized words are checked.
 */
export function findHallucinatedProperNouns(
  sourceText: string,
  tailoredText: string,
  allowedKeywords: string[],
): string[] {
  const sourceLower = sourceText.toLowerCase();

  // Build a word-level allowlist from the keyword list
  const allowedWordSet = new Set(
    allowedKeywords
      .flatMap((k) => k.toLowerCase().split(/[\s,()\[\]/]+/))
      .filter((w) => w.length > 2),
  );

  // Split tailored text into sentences. Newlines act as sentence boundaries
  // since each bullet starts a new "sentence".
  const sentences = tailoredText
    .replace(/\n+/g, "\n")
    .split(/(?<=[.!?\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  const hallucinated: string[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    // Skip index 0 — first word of every sentence is legitimately capitalized
    for (let i = 1; i < words.length; i++) {
      // Strip leading/trailing punctuation but preserve internal structure
      const clean = words[i].replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
      if (clean.length < 3) continue;
      if (!/^[A-Z]/.test(clean)) continue;

      const lower = clean.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);

      // Allow if the word appears anywhere in the source text
      if (sourceLower.includes(lower)) continue;

      // Allow if covered by the keyword list
      if (allowedWordSet.has(lower)) continue;

      hallucinated.push(clean);
    }
  }

  return hallucinated;
}

/**
 * Determines whether a skill string looks like a concrete technology name
 * (tool, framework, language, platform) as opposed to an abstract behavioral
 * keyword (process, practice, soft skill).
 *
 * Concrete tech skills start with an uppercase letter or contain tech symbols
 * (+, #, /). Abstract keywords are lowercase multi-word phrases.
 *
 * Examples:
 *   "Azure Cloud"   → true  (uppercase start → technology)
 *   "Apache Hadoop" → true  (uppercase start → technology)
 *   "C++"           → true  (contains +)
 *   "security standards"          → false (lowercase phrase → abstract)
 *   "deployment and release excellence" → false (lowercase phrase → abstract)
 */
function isConcreteTechSkill(skill: string): boolean {
  const trimmed = skill.trim();
  return /^[A-Z]/.test(trimmed) || /[+#]/.test(trimmed);
}

/**
 * Finds skills in tailoredData that are:
 *   (a) in a brand-new category not present in the source, OR
 *   (b) concrete technology names (uppercase/symbols) added to existing
 *       categories that don't appear anywhere in the source resume.
 *
 * Abstract behavioral keywords ("security standards", "test strategy") are
 * intentionally allowed — the prompt directs the model to add them to skills.
 */
export function findFabricatedSkills(
  sourceData: ResumeData,
  tailoredData: ResumeData,
): string[] {
  const sourceSkillSet = new Set(
    Object.values(sourceData.skills)
      .flat()
      .map((s) => normalizeKeyword(s)),
  );

  const sourceBulletText = sourceData.experience
    .flatMap((role) =>
      role.bullets.map((b) =>
        typeof b === "string" ? b : (b as { text?: string }).text ?? "",
      ),
    )
    .join(" ")
    .toLowerCase();

  const fabricated: string[] = [];

  for (const [category, skills] of Object.entries(tailoredData.skills)) {
    if (!(category in sourceData.skills)) {
      // Entire new category — always reject. The prompt forbids creating new categories.
      fabricated.push(`[new category: "${category}"]`);
      continue;
    }
    // Within an existing category — only flag concrete tech skills not in source
    for (const skill of skills as string[]) {
      if (!isConcreteTechSkill(skill)) continue;
      const normalized = normalizeKeyword(skill);
      if (!sourceSkillSet.has(normalized) && !sourceBulletText.includes(normalized)) {
        fabricated.push(skill);
      }
    }
  }

  return unique(fabricated);
}

/**
 * Concept keywords that are always injectable regardless of the proper-noun test.
 *
 * These are transferable engineering concepts — not proprietary products.
 * Even though some contain capitalized words (e.g. "Agentic", "LLM", "AI"),
 * they describe work the candidate can legitimately claim when they have
 * adjacent or foundational experience (RAG, LangChain, LLM pipelines, etc.).
 *
 * Contrast with true zero-evidence cases: "Microsoft Copilot", "D365",
 * "Power Platform" — these are specific Microsoft products the candidate
 * has not worked with and would face interview questions about.
 */
/**
 * Keywords that are ALWAYS zero-evidence regardless of source resume content.
 * These describe work the candidate demonstrably has not done and cannot claim
 * in an interview. They bypass the injectable-concepts allowlist.
 *
 * "AI training" / "model training" / "fine-tuning" — RAG, embeddings, vector
 * search, and LLM API calls are RETRIEVAL and INFERENCE patterns, not training.
 * Injecting training vocabulary creates an interview trap: "Walk me through your
 * model training pipeline" — the candidate cannot answer.
 */
export const ALWAYS_BLOCKED_CONCEPTS = new Set([
  "ai training",
  "ai training and inferencing",
  "ai training and inferencing services",
  "ai inferencing",
  "model training",
  "fine-tuning",
]);

const ALWAYS_INJECTABLE_CONCEPTS = new Set([
  "agentic ai",
  "agentic ai patterns",
  "intelligent automation",
  "predictive analytics",
  "distributed systems",
  "microservices",
  "ai tools",
  "ai-assisted testing",
  "ai-driven architectural patterns",
  // NOTE: "ai training and inferencing services" intentionally removed.
  // RAG/embeddings/vector search are retrieval+inference, not training.
  // This phrase is now in ALWAYS_BLOCKED_CONCEPTS instead.
  "feature flags",
  "safe deployment",
  "safe deployment frameworks",
  "zero-touch deployment",
  "live-site reliability",
  "rollback strategies",
  "postmortem",
  "security hardening",
  "audit requirements",
  "nosql databases",
  "data models",
  "telemetry",
  "logging",
  "monitoring",
  "reliability",
  "scalability",
]);

/**
 * Identifies keywords in mustAddKeywords that represent specific proprietary
 * products, platforms, or frameworks the candidate has no experience with.
 *
 * The test: if the keyword contains a proper noun (capitalized word, 4+ chars)
 * that does NOT appear anywhere in the source resume text, it is zero-evidence.
 * Examples: "Microsoft Copilot", "Agent Framework", "D365 Customer Service",
 * "Power Platform".
 *
 * Exception: keywords in ALWAYS_INJECTABLE_CONCEPTS bypass the proper-noun test.
 * These are transferable engineering concepts, not brand-specific technologies.
 *
 * Generic engineering concepts (all-lowercase multi-word phrases like
 * "distributed systems", "predictive analytics", "AI tools") are never flagged
 * because they describe transferable work the candidate can legitimately claim.
 *
 * Single-word keywords are never flagged — they can appear in skills without
 * a dedicated bullet.
 */
export function findZeroEvidenceKeywords(
  sourceText: string,
  mustAddKeywords: string[],
): string[] {
  const sourceLower = sourceText.toLowerCase();

  return mustAddKeywords.filter((keyword) => {
    const trimmed = keyword.trim();

    // Hard-blocked concepts are always zero-evidence — no source text can override this.
    // These describe work the candidate has not done (e.g. model training vs. inference).
    if (ALWAYS_BLOCKED_CONCEPTS.has(normalizeKeyword(trimmed))) return true;

    // Single-word keywords are always safe to add to skills
    if (!trimmed.includes(" ") && !trimmed.includes("-")) return false;

    // Concept keywords bypass the proper-noun test entirely
    if (ALWAYS_INJECTABLE_CONCEPTS.has(normalizeKeyword(trimmed))) return false;

    // Split on whitespace and common delimiters, preserving original casing
    const tokens = trimmed
      .split(/[\s\-_/()[\],]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4);

    // Proper noun tokens = start with an uppercase letter (brand/product names)
    const properNounTokens = tokens.filter((t) => /^[A-Z]/.test(t));

    // No proper nouns → this is a generic engineering concept (e.g.,
    // "distributed systems", "predictive analytics") → always injectable
    if (properNounTokens.length === 0) return false;

    // Zero evidence: the FIRST proper noun token (the brand/product identifier,
    // which is almost always the first word) is absent from the source.
    // Using the first token — not any/all — avoids false positives from generic
    // second words like "Models" in "Data Models" or "Service" in "D365 Customer Service".
    const firstProperNoun = properNounTokens[0];
    return !sourceLower.includes(firstProperNoun.toLowerCase());
  });
}

/**
 * Removes zero-evidence keywords from the tailored resume's skills sections.
 * This is a deterministic post-processor that enforces the zero-evidence rule
 * even when the LLM ignores the prompt instruction.
 *
 * A skill entry is removed if it exactly matches (case-insensitive) a
 * zero-evidence keyword. Empty categories are removed entirely.
 */
export function stripZeroEvidenceSkills(
  resume: ResumeData,
  zeroEvidenceKeywords: string[],
): ResumeData {
  if (zeroEvidenceKeywords.length === 0) return resume;

  const zeroSet = new Set(zeroEvidenceKeywords.map(normalizeKeyword));

  const cleanedSkills: Record<string, string[]> = {};
  for (const [category, skills] of Object.entries(resume.skills)) {
    const filtered = (skills as string[]).filter(
      (skill) => !zeroSet.has(normalizeKeyword(skill)),
    );
    if (filtered.length > 0) {
      cleanedSkills[category] = filtered;
    }
  }

  return { ...resume, skills: cleanedSkills };
}

/**
 * Removes any skills category that was not present in the source resume.
 * This is a hard enforcement of the "no new categories" rule.
 *
 * The LLM frequently creates catch-all categories ("Engineering Practices",
 * "Additional Skills") to dump abstract keywords rather than placing them in
 * existing categories. This deterministic post-processor strips them entirely.
 *
 * Skills that were only in the fabricated category are lost — which is
 * preferable to letting a keyword-dump category reach the final PDF.
 */
export function stripFabricatedSkillCategories(
  resume: ResumeData,
  sourceData: ResumeData,
): ResumeData {
  const sourceCategories = new Set(Object.keys(sourceData.skills));
  const cleanedSkills: Record<string, string[]> = {};

  for (const [category, skills] of Object.entries(resume.skills)) {
    if (sourceCategories.has(category)) {
      cleanedSkills[category] = skills as string[];
    }
    // Categories not in source are silently dropped
  }

  return { ...resume, skills: cleanedSkills };
}

/**
 * Finds numeric metrics present in the source resume that are missing from the
 * tailored resume. Metrics are numbers with meaningful units or context:
 * percentages (40%), times (300 ms, 10 minutes), scales (100K+, 15+), ratios.
 *
 * Used as a warning signal — a dropped metric is a critical quality failure
 * that requires the caller to log or surface to the user.
 */
export function findDroppedMetrics(
  sourceData: ResumeData,
  tailoredData: ResumeData,
): string[] {
  // Extract all bullets from source
  const sourceBullets = sourceData.experience.flatMap((r) => r.bullets as string[]);
  const tailoredText = tailoredData.experience
    .flatMap((r) => r.bullets as string[])
    .join(" ")
    .toLowerCase();

  // Match numbers with meaningful units or scale indicators
  const METRIC_PATTERN =
    /\d[\d,]*\.?\d*\s*(%|ms|K\+|\+\s*(?:countries|hours|minutes|seconds|transactions)|[\s-]+(?:minutes?|seconds?|hours?|countries?|transactions?|client))/gi;

  const dropped: string[] = [];
  const seen = new Set<string>();

  for (const bullet of sourceBullets) {
    const matches = Array.from(bullet.matchAll(METRIC_PATTERN));
    for (const m of matches) {
      const raw = m[0].trim().replace(/\s+/g, " ");
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (!tailoredText.includes(key)) {
        dropped.push(raw);
      }
    }
  }

  return dropped;
}

export function scoreResumeAgainstKeywords(
  resumeText: string,
  keywords: string[],
): ATSScore {
  const fixedKeywords = unique(keywords);
  const matched_keywords = extractMatchedKeywords(resumeText, fixedKeywords);
  const matchedSet = new Set(matched_keywords.map(normalizeKeyword));
  const missing_keywords = fixedKeywords.filter(
    (keyword) => !matchedSet.has(normalizeKeyword(keyword)),
  );

  const score =
    fixedKeywords.length === 0
      ? 0
      : Math.round((matched_keywords.length / fixedKeywords.length) * 100);

  const suggestions = missing_keywords
    .slice(0, 3)
    .map(
      (keyword) =>
        `Make "${keyword}" more explicit in an existing supported bullet or summary line without changing the underlying work.`,
    );

  while (suggestions.length < 3) {
    suggestions.push(
      "Keep metrics and technologies visible while improving exact keyword visibility in the most relevant bullets.",
    );
  }

  return {
    score,
    matched_keywords,
    missing_keywords,
    suggestions: suggestions.slice(0, 3),
  };
}

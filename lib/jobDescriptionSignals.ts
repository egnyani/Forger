import type { ResumeData } from "@/lib/types";

// ─── Stop Words ───────────────────────────────────────────────────────────────
// These are filtered out during dynamic JD term extraction.
// Generic words that appear in every JD and carry no signal.

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "that", "this", "these", "those", "it", "its", "we", "our", "you",
  "your", "they", "their", "who", "which", "what", "when", "where", "how",
  "all", "each", "every", "both", "other", "such", "more", "most", "also",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "including", "not", "no", "nor", "so", "yet", "if", "while",
  "about", "against", "up", "any", "per", "etc", "e.g", "i.e",
  "position", "role", "team", "work", "working", "required", "preferred",
  "experience", "years", "ability", "strong", "must", "candidates",
  "company", "organization", "employee", "employees", "business",
  "responsible", "responsibilities", "qualifications", "requirements",
  "opportunity", "looking", "seek", "seeking", "join", "ensure",
  "provide", "support", "help", "make", "use", "using", "used", "based",
  "across", "within", "without", "well", "including", "related",
  "relevant", "new", "existing", "current", "multiple", "various",
  "like", "key", "highly", "own", "lead", "leading", "drive", "driving",
  "take", "apply", "build", "building", "develop", "developing",
  "create", "creating", "implement", "implementing", "manage", "managing",
  "deliver", "delivering", "improve", "improving", "maintain", "maintaining",
]);

// ─── Universal Aliases ────────────────────────────────────────────────────────
// Maps JD terms → equivalent resume terms (and vice versa).
// This handles the vocabulary gap between how JDs describe things
// and how engineers write about them on resumes.
// EXPAND THIS as you see new JDs come in.

const ALIASES: Record<string, string[]> = {
  // Languages / frameworks
  react: ["react", "reactjs", "react.js"],
  reactjs: ["react", "reactjs", "react.js"],
  "node.js": ["node.js", "node", "express", "express.js"],
  python: ["python", "django", "flask", "fastapi"],
  javascript: ["javascript", "js", "typescript", "node.js"],
  typescript: ["typescript", "ts", "javascript"],
  "c#": ["c#", ".net", "dotnet", "asp.net"],
  java: ["java", "spring", "maven"],

  // Cloud
  aws: ["aws", "amazon web services", "lambda", "ecs", "s3", "sqs", "ec2"],
  azure: ["azure", "microsoft azure", "azure devops", "azure functions"],
  "cloud-native": ["cloud-native", "cloud native", "serverless", "aws", "azure", "gcp"],
  serverless: ["serverless", "lambda", "azure functions", "cloud functions"],

  // Data
  "nosql databases": ["nosql", "dynamodb", "mongodb", "redis", "nosql databases"],
  "data models": ["data models", "data modeling", "schema", "database design"],
  postgresql: ["postgresql", "postgres", "sql"],
  sql: ["sql", "postgresql", "mysql", "database queries"],

  // Architecture
  microservices: ["microservices", "microservice", "distributed services", "service-oriented"],
  "distributed systems": ["distributed systems", "distributed", "microservices", "multi-region"],
  "full-stack": ["full-stack", "full stack", "frontend", "backend", "react", "node.js"],
  "rest apis": ["rest apis", "rest", "api", "restful", "api gateway"],
  graphql: ["graphql", "graph ql"],

  // Ops / reliability
  "ci/cd": ["ci/cd", "continuous integration", "continuous delivery", "github actions", "jenkins"],
  devops: ["devops", "ci/cd", "github actions", "release", "deployment"],
  telemetry: ["telemetry", "observability", "monitoring", "cloudwatch", "metrics", "logging"],
  "feature flags": ["feature flags", "feature toggles", "staged rollout", "canary"],
  "rollback strategies": ["rollback", "rollback strategies", "deployment recovery"],
  postmortem: ["postmortem", "post-mortem", "incident review", "root cause analysis"],
  "live-site reliability": ["live-site reliability", "site reliability", "uptime", "on-call", "incident management"],
  "safe deployment": ["safe deployment", "zero-touch deployment", "automated deployment", "github actions"],
  "zero-touch deployment": ["zero-touch deployment", "automated deployment", "ci/cd", "github actions"],
  "incident management": ["incident management", "incident response", "on-call", "dri"],
  dri: ["dri", "directly responsible", "incident management", "on-call"],

  // Security
  "security hardening": ["security hardening", "iam", "access controls", "audit logging", "compliance"],
  "security invariants": ["security invariants", "iam", "security", "access control"],
  "privacy": ["privacy", "compliance", "audit logging", "data governance"],
  "accessibility": ["accessibility", "section 508", "a11y", "wcag"],

  // AI / ML
  "large language model": ["large language model", "llm", "llm apis", "gpt", "openai"],
  llm: ["llm", "large language model", "llm apis", "gpt"],
  "agentic ai": ["agentic ai", "agentic", "agent framework", "langchain", "rag", "autonomous agents"],
  "agent framework": ["agent framework", "langchain", "rag", "agentic ai", "autonomous"],
  "microsoft copilot": ["microsoft copilot", "copilot", "agent framework"],
  "predictive analytics": ["predictive analytics", "ml", "machine learning", "feature engineering"],
  "intelligent automation": ["intelligent automation", "llm", "ai-driven", "rag"],
  "ai-assisted testing": ["ai-assisted testing", "automated testing", "test automation"],

  // Process / collaboration
  agile: ["agile", "scrum", "agile/scrum", "sprint"],
  scrum: ["scrum", "agile", "sprint", "jira"],
  "code reviews": ["code reviews", "peer reviews", "code review"],
  "cross-functional": ["cross-functional", "collaboration", "partner teams", "stakeholders"],
  scalable: ["scalable", "scale", "scaling", "high-scale", "latency-sensitive", "high-traffic"],
  reliable: ["reliable", "reliability", "uptime", "99.95", "observability"],
  secure: ["secure", "security", "iam", "audit logging", "compliance"],
  performant: ["performant", "performance", "latency", "response time", "throughput"],

  // Power Platform (Microsoft-specific — honest if you have exposure)
  "power platform": ["power platform", "d365", "dynamics 365", "power apps", "power automate"],
  d365: ["d365", "dynamics 365", "power platform", "crm"],
};

// ─── Noise phrases to never extract from JDs ─────────────────────────────────
// Company-specific, legal boilerplate, and location terms that are not
// resume-relevant keywords. Extend per employer.

const UNIVERSAL_DO_NOT_EXTRACT = new Set([
  // Legal / HR boilerplate
  "equal opportunity employer", "authorization to work", "disability",
  "veteran status", "reasonable accommodation", "background check",
  "drug test", "visa sponsorship", "employment type", "full-time",
  "part-time", "travel", "relocation",
  // Location
  "redmond", "seattle", "new york", "san francisco", "remote", "hybrid",
  "in-office", "reston", "nyc", "washington",
  // Company-specific context (not transferable skills)
  "college board", "microsoft mission", "millions of students", "institutions",
  "learner needs", "mission-driven", "public responsibility",
  "empower every person", "growth mindset",
  // Salary / comp
  "base pay", "base salary", "compensation", "benefits", "401k", "pto",
  "sign-on", "equity", "rsu",
]);

// ─── Utility: normalize ───────────────────────────────────────────────────────

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#/. -]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}

// ─── Dynamic JD term extractor ───────────────────────────────────────────────
// This is the key function that was MISSING before.
// Instead of matching against a hard-coded list, this extracts
// candidate terms directly from whatever JD is pasted in.
//
// Strategy:
//   1. Extract 1-gram, 2-gram, and 3-gram phrases
//   2. Filter out stop words and boilerplate
//   3. Keep only terms that look like skills / technologies / practices
//   4. Deduplicate

function extractJdTerms(jd: string): string[] {
  const normalized = normalize(jd);
  const words = normalized.split(/\s+/);
  const candidates: string[] = [];

  // 1-grams: single words that are not stop words and look technical
  words.forEach((word) => {
    const w = word.trim().replace(/[,;:()]/g, "");
    if (!w || STOP_WORDS.has(w)) return;
    if (w.length < 2) return;
    // Boost: words with special chars are almost always tech terms
    const hasTechChar = /[.+#/]/.test(w);
    // Boost: capitalized in original usually = proper noun / tech name
    const seemsTechnical = hasTechChar || w.length >= 4;
    if (seemsTechnical) candidates.push(w);
  });

  // 2-grams: pairs of adjacent non-stop words
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i].replace(/[,;:()]/g, "");
    const b = words[i + 1].replace(/[,;:()]/g, "");
    if (!a || !b || STOP_WORDS.has(a) || STOP_WORDS.has(b)) continue;
    if (a.length < 2 || b.length < 2) continue;
    candidates.push(`${a} ${b}`);
  }

  // 3-grams: triplets — catches phrases like "large language model",
  // "safe deployment frameworks", "zero-touch deployment"
  for (let i = 0; i < words.length - 2; i++) {
    const a = words[i].replace(/[,;:()]/g, "");
    const b = words[i + 1].replace(/[,;:()]/g, "");
    const c = words[i + 2].replace(/[,;:()]/g, "");
    if (!a || !b || !c) continue;
    if (STOP_WORDS.has(a) || STOP_WORDS.has(c)) continue;
    if (a.length < 2 || c.length < 2) continue;
    candidates.push(`${a} ${b} ${c}`);
  }

  // Filter boilerplate
  return unique(
    candidates.filter(
      (c) => !Array.from(UNIVERSAL_DO_NOT_EXTRACT).some((noise) => c.includes(noise))
    )
  );
}

// ─── Resume source terms builder ─────────────────────────────────────────────
// Reads all resume content and expands with aliases so matching is fuzzy.

function buildSourceTerms(data: ResumeData): string[] {
  return unique([
    ...Object.values(data.skills).flat(),
    ...data.summary,
    ...data.experience.flatMap((role) => role.bullets),
    ...data.projects.flatMap((project) => [project.name, ...project.tags, ...project.bullets]),
  ]).flatMap((term) => {
    const n = normalize(term);
    return [n, ...(ALIASES[n] ?? []).map(normalize)];
  });
}

// ─── Term matching ────────────────────────────────────────────────────────────
// Checks if a JD term is supported by any resume source term (with alias expansion).

function sourceSupports(term: string, sourceTerms: string[]): boolean {
  const normalizedTerm = normalize(term);
  const aliases = [normalizedTerm, ...(ALIASES[normalizedTerm] ?? []).map(normalize)];
  return aliases.some((alias) =>
    sourceTerms.some(
      (sourceTerm) =>
        sourceTerm === alias ||
        sourceTerm.includes(alias) ||
        alias.includes(sourceTerm)
    )
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export interface JobDescriptionSignals {
  must_surface_if_supported: string[];
  good_to_surface_if_supported: string[];
  do_not_force: string[];
  /** NEW: all terms extracted from the JD (for match % calculation) */
  all_jd_terms: string[];
  /** NEW: match percentage = must_surface_if_supported.length / all meaningful JD terms */
  match_percentage: number;
}

export function extractJobDescriptionSignals(
  jobDescription: string,
  sourceData: ResumeData,
): JobDescriptionSignals {
  const sourceTerms = buildSourceTerms(sourceData);

  // Dynamically extract ALL terms from the actual JD text
  const allJdTerms = extractJdTerms(jobDescription);

  const matched: string[] = [];
  const unmatched: string[] = [];

  allJdTerms.forEach((term) => {
    if (sourceSupports(term, sourceTerms)) {
      matched.push(term);
    } else {
      unmatched.push(term);
    }
  });

  // Separate matched terms by signal strength:
  // "must" = single-word tech terms or known critical phrases
  // "good" = multi-word descriptive phrases
  const must = matched.filter((t) => {
    const n = normalize(t);
    return n.split(" ").length <= 2 || Object.keys(ALIASES).includes(n);
  });
  const good = matched.filter((t) => {
    const n = normalize(t);
    return n.split(" ").length > 2 && !Object.keys(ALIASES).includes(n);
  });

  const matchPct = allJdTerms.length > 0
    ? Math.round((matched.length / allJdTerms.length) * 100)
    : 0;

  return {
    must_surface_if_supported: unique(must),
    good_to_surface_if_supported: unique(good),
    do_not_force: unique(unmatched),
    all_jd_terms: allJdTerms,
    match_percentage: matchPct,
  };
}

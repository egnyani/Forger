/**
* Tailoring pipeline service module.
*
* Contains all orchestration logic, helper functions, intermediate types,
* and the 5-phase OpenAI pipeline that was previously embedded in
* `app/api/tailor/route.ts`. The route is now a thin HTTP wrapper that calls
* `runTailoringPipeline()` and translates the result to a Response.
*
* Nothing in this file was changed in behavior relative to the original route —
* this is a structural extraction only.
*/

import OpenAI from "openai";

import {
  JD_EXTRACTION_PROMPT,
  BULLET_CLASSIFICATION_PROMPT,
  BULLET_REWRITE_PROMPT,
  GAP_AUDIT_PROMPT,
  SUMMARY_PROMPT,
} from "@/lib/engine/prompts";
import {
  ALWAYS_BLOCKED_CONCEPTS,
  buildKeywordAnchors,
  findDroppedMetrics,
  findFabricatedSkills,
  findHallucinatedProperNouns,
  findZeroEvidenceKeywords,
  keywordMatchesText,
  normalizeKeyword,
  scoreResumeAgainstKeywords,
  stripFabricatedSkillCategories,
  stripZeroEvidenceSkills,
} from "@/lib/engine/keywordUtils";
import { resumeToText } from "@/lib/engine/resumeToText";
import { loadSourceResumeContext } from "@/lib/engine/sourceResume";
import type { ResumeData } from "@/lib/types";

const client = new OpenAI();

// ─── Intermediate types for 5-phase pipeline ─────────────────────────────────

type JDExtraction = {
  hardKeywords: string[];
  rolePhrases: string[];
  identityPhrases: string[];
};

type BulletItem = { id: string; text: string };

type BulletClassification = {
  id: string;
  decision: "KEEP" | "LIGHT_REFRAME" | "REFRAME" | "DROP";
  jdVocabulary?: string[];
};

export type AuditEntry = {
  keyword: string;
  status: "NATURAL" | "ADDED" | "SKILLS_ONLY" | "MISSING";
  skillsCategory?: string;
};

// ─── Pipeline boundary types ──────────────────────────────────────────────────

export type TailoringInput = {
  jobDescription: string;
  keywords: string[];
};

export type TailoringSuccess = {
  ok: true;
  data: ResumeData;
  meta: {
    classification: Array<{ id: string; decision: string }>;
    gapAudit: AuditEntry[];
    zeroEvidenceKeywords: string[];
    coverageScore: number;
    targetedEnrichment: Array<{
      keyword: string;
      location: "summary" | "bullet";
      target: string;
    }>;
    finalCoverageSweep: Array<{
      keyword: string;
      location: "summary" | "bullet" | "skills";
      target: string;
      reason: string;
    }>;
  };
  warnings?: {
    hallucinatedNouns?: string[];
    fabricatedSkills?: string[];
    droppedMetrics?: string[];
  };
};

export type TailoringError =
  | {
    ok: false;
    status: 422;
    error: "BLOCKED_PHRASE_DETECTED";
    phrase: string;
    message: string;
  }
  | {
    ok: false;
    status: 500;
    error: string;
    missingAnchoredKeywords?: string[];
    sourceScore?: number;
    tailoredScore?: number;
  };

export type TailoringResult = TailoringSuccess | TailoringError;

// ─── Trailing-phrase post-processor ──────────────────────────────────────────

// Hollow trailing phrases the LLM appends after the last real metric or
// technical detail. These add no information and must be stripped.
//
// IMPORTANT — keep these narrow. Only match genuinely empty connectors.
// Do NOT strip:
//   "…using telemetry-driven validation and feature flag controls"  ← technical
//   "…ensuring zero-downtime deployments via rollback automation"   ← technical
//   "…driving postmortem-based improvements to on-call processes"   ← technical
// DO strip:
//   "…ensuring reliability."
//   "…leveraging intelligent automation."
//   "…enabling AI-enabled empowerment."
//   "…driving better outcomes."
const TRAILING_PATTERNS: RegExp[] = [
  // Abstract quality claims appended after a metric: "…ensuring reliability."
  /[,\s]+ensuring\s+(?:reliability|compliance|security|scalability|performance|quality|maintainability)[.,!]?$/i,
  // Hollow "leveraging / utilizing" tails
  /[,\s]+(?:leveraging|utilizing)\s+(?:intelligent automation|predictive analytics|AI tools?|LLM|AI-enabled empowerment|ai-driven insights)[.,!]?$/i,
  // Hollow "enabling" tails
  /[,\s]+enabling\s+(?:intelligent automation|scalable solutions|better outcomes|ai-enabled empowerment|seamless collaboration)[.,!]?$/i,
  // Hollow "driving" tails with abstract nouns
  /[,\s]+driving\s+(?:better outcomes|scalable solutions|team efficiency|empowerment|insights)[.,!]?$/i,
  // "…through AI/LLM" with nothing specific after it
  /\s+through\s+(?:AI|LLM)\s*[.,!]?$/i,
  // "…using predictive analytics" or "…using AI tools" with nothing after
  /[,\s]+using\s+(?:predictive analytics|AI tools?|LLM)\s*[.,!]?$/i,
  // "…for predictive analytics" with nothing after
  /[,\s]+for\s+predictive analytics\s*[.,!]?$/i,
  // Hollow "with a focus on X" tails
  /[,\s]+with\s+a\s+focus\s+on\s+(?:reliability|security|scalability|maintainability|performance)\s*[.,!]?$/i,
];

const DANGLING_CONJUNCTION = /\s+\b(and|or|but|while|as|which)\b[.,]?$/i;

function stripTrailingAppend(text: string): string {
  let result = text.trim();
  for (const pattern of TRAILING_PATTERNS) {
    const stripped = result.replace(pattern, "");
    if (stripped.length < result.length) {
      result =
        stripped
          .trimEnd()
          .replace(DANGLING_CONJUNCTION, "")
          .trimEnd()
          .replace(/[,\s]+$/, "") + ".";
      break;
    }
  }
  result = result.replace(/\s+\b(and|or|but|while|as|which)\b[.,]+$/, ".");
  return result;
}

function cleanTrailingAppends(resume: ResumeData): ResumeData {
  return {
    ...resume,
    summary: resume.summary.map(stripTrailingAppend),
    experience: resume.experience.map((role) => ({
      ...role,
      bullets: role.bullets.map(stripTrailingAppend),
    })),
  };
}

// ─── Resume schema validator ──────────────────────────────────────────────────

function isResumeData(value: unknown): value is ResumeData {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<ResumeData>;
  return (
    !!c.contact &&
    Array.isArray(c.summary) &&
    Array.isArray(c.experience) &&
    Array.isArray(c.education) &&
    !!c.skills &&
    typeof c.skills === "object" &&
    Array.isArray(c.projects)
  );
}

// ─── Bullet extraction / assembly helpers ─────────────────────────────────────

function extractBulletsWithIds(data: ResumeData): BulletItem[] {
  return data.experience.flatMap((role) =>
    (role.bullets as string[]).map((text, idx) => ({
      id: `${role.id}-${idx}`,
      text,
    })),
  );
}

function assembleBullets(
  source: ResumeData,
  rewritten: BulletItem[],
): ResumeData {
  const map = new Map(rewritten.map((b) => [b.id, b.text]));
  return {
    ...source,
    experience: source.experience.map((role) => ({
      ...role,
      bullets: (role.bullets as string[]).map(
        (original, idx) => map.get(`${role.id}-${idx}`) ?? original,
      ),
    })),
  };
}

function applySkillsAudit(
  resume: ResumeData,
  audit: AuditEntry[],
): ResumeData {
  const additions = audit.filter((e) => e.status === "SKILLS_ONLY" && e.skillsCategory);
  if (additions.length === 0) return resume;

  const updatedSkills = { ...resume.skills } as Record<string, string[]>;
  for (const entry of additions) {
    const cat = entry.skillsCategory!;
    if (cat in updatedSkills) {
      const existing = updatedSkills[cat];
      if (!existing.includes(entry.keyword)) {
        updatedSkills[cat] = [...existing, entry.keyword];
      }
    }
  }
  return { ...resume, skills: updatedSkills };
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

/**
 * Replaces blocked phrases in the raw jobDescription string before it is
 * passed to Phase 5. Phase 5 receives the raw JD for context (not sanitized
 * via jdExtraction) so this is the only guard on that channel.
 */
function sanitizeJobDescription(jd: string): string {
  const BLOCKED_PHRASES = [
    /AI training and inferencing services/gi,
    /AI training and inferencing/gi,
    /AI training/gi,
    /model training/gi,
  ];
  let result = jd;
  for (const pattern of BLOCKED_PHRASES) {
    result = result.replace(pattern, "AI inferencing");
  }
  return result;
}

/**
 * Removes blocked concepts from jdExtraction fields before they are
 * passed to Phase 2 (classifier) or Phase 3 (rewriter).
 */
function sanitizeJdExtraction(jdExtraction: JDExtraction): JDExtraction {
  const blockedNormalized = new Set(
    Array.from(ALWAYS_BLOCKED_CONCEPTS).map(normalizeKeyword),
  );
  const isClean = (phrase: string) =>
    !blockedNormalized.has(normalizeKeyword(phrase)) &&
    !Array.from(blockedNormalized).some((blocked) =>
      normalizeKeyword(phrase).includes(blocked),
    );
  return {
    hardKeywords: jdExtraction.hardKeywords.filter(isClean),
    rolePhrases: jdExtraction.rolePhrases.filter(isClean),
    identityPhrases: jdExtraction.identityPhrases.filter(isClean),
  };
}

// ─── Opener deduplication post-processor ─────────────────────────────────────
//
// Detects bullets where the LLM used the same first four words as an earlier
// bullet (the REPETITION rule in BULLET_REWRITE_PROMPT is prompt-only and is
// sometimes ignored). For known JD-phrase prefixes, strips the prefix so the
// bullet reverts to its natural opening verb. For other repeated openers the
// bullet is returned unchanged — only the second occurrence is affected.

function deduplicateOpeners(data: ResumeData): ResumeData {
  const usedOpeners = new Set<string>();
  function getOpener(bullet: string): string {
    return bullet.trim().split(/\s+/).slice(0, 4).join(" ").toLowerCase();
  }
  // These are known JD-phrase openers that the model
  // repeats. When seen more than once, strip the prefix
  // back to the original verb.
  const STRIPPABLE_PREFIXES = [
    /^Collaborated with internal and external teams to /i,
    /^Designed and built high-quality systems for /i,
    /^Operated and improved live-site reliability by /i,
    /^Owned deployment and release excellence by /i,
    /^Ensured secure and compliant delivery by /i,
    /^Drove test strategy and automation by /i,
  ];
  function stripPrefix(bullet: string): string {
    for (const prefix of STRIPPABLE_PREFIXES) {
      const stripped = bullet.replace(prefix, "");
      if (stripped !== bullet) {
        // Capitalize the new first letter
        return stripped.charAt(0).toUpperCase() + stripped.slice(1);
      }
    }
    // Structural guard: strip JD-compliance prefixes of the form
    //   "Contributed to X by ...", "Assisted with X by ...", etc.
    // Non-greedy .+? captures text up to the FIRST "by", so the real
    // action verb (captured in group 1) is preserved intact.
    // The letter-start guard prevents leaving a bare metric fragment
    // ("30 minutes") when "by" appears inside a measurement clause.
    const JD_COMPLIANCE_PREFIX =
      /^(?:Contributed to|Assisted with|Responsible for|Helped to)\s+.+?\sby\s+(.+)$/i;
    const complianceMatch = bullet.match(JD_COMPLIANCE_PREFIX);
    if (complianceMatch && complianceMatch[1] && /^[a-zA-Z]/.test(complianceMatch[1])) {
      const remainder = complianceMatch[1];
      return remainder.charAt(0).toUpperCase() + remainder.slice(1);
    }
    return bullet;
  }
  const deduplicatedExperience = data.experience.map((role) => ({
    ...role,
    bullets: role.bullets.map((bullet) => {
      const opener = getOpener(bullet);
      if (usedOpeners.has(opener)) {
        // This opener was already used — strip the prefix
        // so the bullet reverts to its natural form
        return stripPrefix(bullet);
      }
      usedOpeners.add(opener);
      return bullet;
    }),
  }));
  return {
    ...data,
    experience: deduplicatedExperience,
  };
}

// ─── Post-classification guard ────────────────────────────────────────────────

/**
 * Deterministic sanitizer applied to Phase 2 output before Phase 3 runs.
 * Only touches LIGHT_REFRAME entries. All other decisions pass through unchanged.
 *
 * For each LIGHT_REFRAME bullet it:
 *   1. Drops any jdVocabulary term that is not in jdExtraction.hardKeywords.
 *   2. Drops any jdVocabulary term already present in the bullet text
 *      (using keywordMatchesText, which handles plurals, substrings, and aliases —
 *       e.g. "REST API" matches "REST APIs", "Git" matches "Git-based" / "GitHub Actions").
 *   3. If no valid terms remain, demotes the decision to KEEP.
 */
function sanitizeLightReframeClassification(
  classification: BulletClassification[],
  bullets: BulletItem[],
  jdExtraction: JDExtraction,
): BulletClassification[] {
  const hardKeywordNormalized = new Set(
    jdExtraction.hardKeywords.map((k) => normalizeKeyword(k)),
  );

  return classification.map((entry) => {
    if (entry.decision !== "LIGHT_REFRAME") return entry;

    const bulletText = bullets.find((b) => b.id === entry.id)?.text ?? "";

    const validVocab = (entry.jdVocabulary ?? []).filter((term) => {
      // Rule 1 — must be a hardKeyword
      if (!hardKeywordNormalized.has(normalizeKeyword(term))) return false;
      // Rule 2 — must not already be present in the bullet (includes plurals / aliases)
      if (keywordMatchesText(term, bulletText)) return false;
      return true;
    });

    if (validVocab.length === 0) {
      return { id: entry.id, decision: "KEEP" as const, jdVocabulary: [] };
    }

    return { ...entry, jdVocabulary: validVocab };
  });
}

// ─── Deterministic targeted enrichment (post-Phase 3) ───────────────────────

type EnrichmentLog = {
  keyword: string;
  location: "summary" | "bullet";
  target: string;
};

const CONTROLLED_ENRICHMENT_KEYWORDS = [
  "SQL databases",
  "version control",
  "monitoring",
  "logging",
  "production deployment",
  "scalable software systems",
] as const;

function getControlledMissingKeywords(
  resume: ResumeData,
  fixedKeywordList: string[],
): Set<string> {
  const controlled = new Set(
    CONTROLLED_ENRICHMENT_KEYWORDS.map((keyword) => normalizeKeyword(keyword)),
  );
  const relevantKeywords = fixedKeywordList.filter((keyword) =>
    controlled.has(normalizeKeyword(keyword)),
  );
  const score = scoreResumeAgainstKeywords(resumeToText(resume), relevantKeywords);
  return new Set(score.missing_keywords.map((keyword) => normalizeKeyword(keyword)));
}

function sourceSupportsControlledKeyword(
  keyword: string,
  sourceResumeText: string,
): boolean {
  const lower = sourceResumeText.toLowerCase();

  switch (normalizeKeyword(keyword)) {
  case "sql databases":
    return /\bpostgresql\b|\bmysql\b/i.test(lower);
  case "version control":
    return /\bgit\b|github/i.test(lower);
  case "monitoring":
    return /cloudwatch|metrics?/i.test(lower);
  case "logging":
    return /audit logging/i.test(lower);
  case "production deployment":
    return /deployment|ci\/cd/i.test(lower);
  case "scalable software systems":
    return /high-traffic|large-scale/i.test(lower);
  default:
    return false;
  }
}

function replaceFirst(
  text: string,
  pattern: RegExp,
  replacement: string,
): string | null {
  if (!pattern.test(text)) return null;
  const next = text.replace(pattern, replacement);
  return next === text ? null : next;
}

function enrichBulletText(
  bullet: string,
  keyword: string,
): string | null {
  switch (normalizeKeyword(keyword)) {
  case "version control":
    return (
      replaceFirst(
        bullet,
        /Git-based CI\/CD/i,
        "Git-based version control and CI/CD",
      ) ??
      replaceFirst(
        bullet,
        /\bGit\b/i,
        "Git version control",
      )
    );
  case "monitoring":
    return replaceFirst(
      bullet,
      /CloudWatch metrics/i,
      "CloudWatch monitoring metrics",
    );
  case "logging":
    return replaceFirst(
      bullet,
      /audit logging/i,
      "logging and audit logging",
    );
  case "production deployment":
    return (
      replaceFirst(
        bullet,
        /build and deployment/i,
        "build and production deployment",
      ) ??
      replaceFirst(
        bullet,
        /\bdeployments\b/i,
        "production deployments",
      ) ??
      replaceFirst(
        bullet,
        /\bdeployment\b/i,
        "production deployment",
      )
    );
  default:
    return null;
  }
}

function applyTargetedEnrichmentToBullets(
  resume: ResumeData,
  sourceResumeText: string,
  fixedKeywordList: string[],
): { resume: ResumeData; logs: EnrichmentLog[] } {
  const missingKeywords = getControlledMissingKeywords(resume, fixedKeywordList);
  if (missingKeywords.size === 0) {
    return { resume, logs: [] };
  }

  const logs: EnrichmentLog[] = [];
  const usedBulletIds = new Set<string>();
  const remainingMissing = new Set(missingKeywords);

  const enrichedExperience = resume.experience.map((role) => ({
    ...role,
    bullets: role.bullets.map((bullet, idx) => {
      const bulletId = `${role.id}-${idx}`;
      if (usedBulletIds.has(bulletId)) return bullet;

      const candidates = [
        "version control",
        "monitoring",
        "logging",
        "production deployment",
      ].filter((keyword) => remainingMissing.has(normalizeKeyword(keyword)));

      for (const keyword of candidates) {
        if (!sourceSupportsControlledKeyword(keyword, sourceResumeText)) continue;
        const enriched = enrichBulletText(bullet, keyword);
        if (!enriched || keywordMatchesText(keyword, bullet)) continue;

        usedBulletIds.add(bulletId);
        remainingMissing.delete(normalizeKeyword(keyword));
        logs.push({
          keyword,
          location: "bullet",
          target: bulletId,
        });
        return enriched;
      }

      return bullet;
    }),
  }));

  return {
    resume: {
      ...resume,
      experience: enrichedExperience,
    },
    logs,
  };
}

function enrichSummarySentence(
  sentence: string,
  keyword: string,
): string | null {
  switch (normalizeKeyword(keyword)) {
  case "sql databases":
    return replaceFirst(
      sentence,
      /PostgreSQL,?\s*/i,
      "PostgreSQL, SQL databases, ",
    );
  case "monitoring":
    return replaceFirst(
      sentence,
      /cloud deployment,\s*/i,
      "cloud deployment, monitoring, ",
    );
  case "production deployment":
    return (
      replaceFirst(
        sentence,
        /cloud deployment/i,
        "production deployment",
      ) ??
      replaceFirst(
        sentence,
        /CI\/CD automation/i,
        "CI/CD automation and production deployment",
      )
    );
  case "scalable software systems":
    return replaceFirst(
      sentence,
      /high-traffic,\s*latency-sensitive applications/i,
      "high-traffic, latency-sensitive scalable software systems",
    );
  default:
    return null;
  }
}

function applyTargetedEnrichmentToSummary(
  resume: ResumeData,
  sourceResumeText: string,
  fixedKeywordList: string[],
): { resume: ResumeData; logs: EnrichmentLog[] } {
  const missingKeywords = getControlledMissingKeywords(resume, fixedKeywordList);
  if (missingKeywords.size === 0) {
    return { resume, logs: [] };
  }

  const logs: EnrichmentLog[] = [];
  const controlledSummaryKeywords = [
    "SQL databases",
    "monitoring",
    "production deployment",
    "scalable software systems",
  ];
  const remainingMissing = new Set(missingKeywords);
  const nextSummary = [...resume.summary];

  for (let index = 0; index < nextSummary.length; index += 1) {
    let sentence = nextSummary[index];

    for (const keyword of controlledSummaryKeywords) {
      if (!remainingMissing.has(normalizeKeyword(keyword))) continue;
      if (!sourceSupportsControlledKeyword(keyword, sourceResumeText)) continue;
      if (keywordMatchesText(keyword, sentence)) {
        remainingMissing.delete(normalizeKeyword(keyword));
        continue;
      }

      const enriched = enrichSummarySentence(sentence, keyword);
      if (!enriched) continue;

      sentence = enriched;
      remainingMissing.delete(normalizeKeyword(keyword));
      logs.push({
        keyword,
        location: "summary",
        target: `summary-${index}`,
      });
    }

    nextSummary[index] = sentence;
  }

  return {
    resume: {
      ...resume,
      summary: nextSummary,
    },
    logs,
  };
}

// ─── Final coverage sweep (deterministic, post-assembly) ────────────────────

type SweepRule = {
  supports: (sourceResumeText: string) => boolean;
  tryBullet: (bullet: string) => string | null;
  trySummary: (sentence: string) => string | null;
  supportsBullet: (bullet: string) => boolean;
  supportsSummary: (sentence: string) => boolean;
  skillsCategory?: string;
};

const FINAL_COVERAGE_SWEEP_RULES: Record<string, SweepRule> = {
  "sql databases": {
    supports: (source) => /\bpostgresql\b|\bmysql\b/i.test(source),
    supportsBullet: (bullet) => /\bPostgreSQL\b|\bMySQL\b/i.test(bullet),
    supportsSummary: (sentence) => /\bPostgreSQL\b|\bMySQL\b/i.test(sentence),
    tryBullet: (bullet) =>
      replaceFirst(
        bullet,
        /\bPostgreSQL\b/i,
        "PostgreSQL-backed SQL databases",
      ) ??
      replaceFirst(
        bullet,
        /\bMySQL\b/i,
        "MySQL-backed SQL databases",
      ),
    trySummary: (sentence) =>
      replaceFirst(
        sentence,
        /\bPostgreSQL\b/i,
        "PostgreSQL and SQL databases",
      ),
    skillsCategory: "Database Management",
  },
  "version control": {
    supports: (source) => /\bgit\b|github actions/i.test(source),
    supportsBullet: (bullet) => /\bGit\b|GitHub Actions/i.test(bullet),
    supportsSummary: (sentence) => /GitHub Actions|\bGit\b/i.test(sentence),
    tryBullet: (bullet) =>
      replaceFirst(
        bullet,
        /Git-based CI\/CD/i,
        "Git-based version control and CI/CD",
      ) ??
      replaceFirst(
        bullet,
        /GitHub Actions \+ AWS/i,
        "GitHub Actions, version control, and AWS",
      ),
    trySummary: (sentence) =>
      replaceFirst(
        sentence,
        /GitHub Actions/i,
        "GitHub Actions and version control",
      ),
    skillsCategory: "Testing and Automation",
  },
  monitoring: {
    supports: (source) => /cloudwatch|metrics?/i.test(source),
    supportsBullet: (bullet) => /CloudWatch|metrics?/i.test(bullet),
    supportsSummary: (sentence) => /\bmonitoring\b|CloudWatch/i.test(sentence),
    tryBullet: (bullet) =>
      replaceFirst(
        bullet,
        /CloudWatch metrics/i,
        "CloudWatch monitoring metrics",
      ),
    trySummary: (sentence) =>
      replaceFirst(
        sentence,
        /\bmonitoring\b/i,
        "production monitoring",
      ) ??
      replaceFirst(
        sentence,
        /deployment and monitoring/i,
        "deployment and production monitoring",
      ),
    skillsCategory: "Cloud Platforms",
  },
  logging: {
    supports: (source) => /audit logging/i.test(source),
    supportsBullet: (bullet) => /audit logging/i.test(bullet),
    supportsSummary: (sentence) => /\blogging\b|audit logging/i.test(sentence),
    tryBullet: (bullet) =>
      replaceFirst(
        bullet,
        /audit logging/i,
        "logging and audit logging",
      ),
    trySummary: (sentence) =>
      replaceFirst(
        sentence,
        /IAM-based access controls/i,
        "IAM-based access controls and logging",
      ),
    skillsCategory: "Cloud Platforms",
  },
  "production deployment": {
    supports: (source) => /deployment|ci\/cd/i.test(source),
    supportsBullet: (bullet) => /deployment|ci\/cd/i.test(bullet),
    supportsSummary: (sentence) => /deployment|ci\/cd/i.test(sentence),
    tryBullet: (bullet) =>
      replaceFirst(
        bullet,
        /build and deployment/i,
        "build and production deployment",
      ) ??
      replaceFirst(
        bullet,
        /\bdeployment\b/i,
        "production deployment",
      ),
    trySummary: (sentence) =>
      replaceFirst(
        sentence,
        /cloud-based deployment/i,
        "cloud-based production deployment",
      ) ??
      replaceFirst(
        sentence,
        /deployment time/i,
        "production deployment time",
      ),
    skillsCategory: "Cloud Platforms",
  },
  "scalable software systems": {
    supports: (source) => /high-traffic|large-scale/i.test(source),
    supportsBullet: (bullet) => /high-traffic|large-scale|millions of records/i.test(bullet),
    supportsSummary: (sentence) => /high-traffic|large-scale|backend systems/i.test(sentence),
    tryBullet: (bullet) =>
      replaceFirst(
        bullet,
        /large-scale tax and financial documents/i,
        "large-scale scalable software systems for tax and financial documents",
      ) ??
      replaceFirst(
        bullet,
        /high-traffic,\s*latency-sensitive applications/i,
        "high-traffic, latency-sensitive scalable software systems",
      ),
    trySummary: (sentence) =>
      replaceFirst(
        sentence,
        /backend systems/i,
        "scalable software systems",
      ) ??
      replaceFirst(
        sentence,
        /high service quality/i,
        "scalable software systems quality",
      ),
    skillsCategory: "Backend Technologies",
  },
};

function applyFinalCoverageSweep(
  resume: ResumeData,
  sourceResumeText: string,
  fixedKeywordList: string[],
): {
  resume: ResumeData;
  logs: Array<{
    keyword: string;
    location: "summary" | "bullet" | "skills";
    target: string;
    reason: string;
  }>;
} {
  const score = scoreResumeAgainstKeywords(resumeToText(resume), fixedKeywordList);
  const missingKeywords = score.missing_keywords;
  if (missingKeywords.length === 0) {
    return { resume, logs: [] };
  }

  const logs: Array<{
    keyword: string;
    location: "summary" | "bullet" | "skills";
    target: string;
    reason: string;
  }> = [];
  const usedBulletIds = new Set<string>();
  const nextResume: ResumeData = {
    ...resume,
    summary: [...resume.summary],
    experience: resume.experience.map((role) => ({
      ...role,
      bullets: [...role.bullets],
    })),
    skills: Object.fromEntries(
      Object.entries(resume.skills).map(([category, skills]) => [category, [...skills]]),
    ),
  };

  for (const keyword of missingKeywords) {
    const normalized = normalizeKeyword(keyword);
    const rule = FINAL_COVERAGE_SWEEP_RULES[normalized];
    if (!rule) continue;
    if (!rule.supports(sourceResumeText)) continue;

    let applied = false;

    const bulletCandidates: Array<{
      roleIndex: number;
      bulletIndex: number;
      bulletId: string;
    }> = [];

    nextResume.experience.forEach((role, roleIndex) => {
      role.bullets.forEach((bullet, bulletIndex) => {
        const bulletId = `${role.id}-${bulletIndex}`;
        if (usedBulletIds.has(bulletId)) return;
        if (keywordMatchesText(keyword, bullet)) return;
        if (!rule.supportsBullet(bullet)) return;
        if (!rule.tryBullet(bullet)) return;
        bulletCandidates.push({ roleIndex, bulletIndex, bulletId });
      });
    });

    if (bulletCandidates.length === 1) {
      const candidate = bulletCandidates[0];
      const role = nextResume.experience[candidate.roleIndex];
      const bullet = role.bullets[candidate.bulletIndex];
      const enriched = rule.tryBullet(bullet);
      if (enriched) {
        role.bullets[candidate.bulletIndex] = enriched;
        usedBulletIds.add(candidate.bulletId);
        logs.push({
          keyword,
          location: "bullet",
          target: candidate.bulletId,
          reason: "single strong supporting bullet anchor",
        });
        applied = true;
      }
    }

    if (!applied && bulletCandidates.length > 1) {
      for (let summaryIndex = 0; summaryIndex < nextResume.summary.length && !applied; summaryIndex += 1) {
        const sentence = nextResume.summary[summaryIndex];
        if (keywordMatchesText(keyword, sentence)) {
          applied = true;
          break;
        }
        if (!rule.supportsSummary(sentence)) continue;
        const enriched = rule.trySummary(sentence);
        if (!enriched) continue;

        nextResume.summary[summaryIndex] = enriched;
        logs.push({
          keyword,
          location: "summary",
          target: `summary-${summaryIndex}`,
          reason: "multiple bullets support keyword, so summary is the cleanest high-impact location",
        });
        applied = true;
      }
    }

    if (!applied && rule.skillsCategory) {
      const existingSkills = nextResume.skills[rule.skillsCategory] ?? [];
      if (!existingSkills.some((skill) => normalizeKeyword(skill) === normalized)) {
        nextResume.skills[rule.skillsCategory] = [...existingSkills, keyword];
        logs.push({
          keyword,
          location: "skills",
          target: rule.skillsCategory,
          reason: "no single strong bullet anchor; keyword added to the most relevant existing skills category",
        });
        applied = true;
      }
    }
  }

  return { resume: nextResume, logs };
}

// ─── 5-Phase pipeline ─────────────────────────────────────────────────────────

async function phase1_extractJD(jobDescription: string): Promise<JDExtraction> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You extract structured information from job descriptions. Return only valid JSON." },
      { role: "user", content: JD_EXTRACTION_PROMPT(jobDescription) },
    ],
  });
  return parseJSON<JDExtraction>(completion.choices[0]?.message?.content ?? "{}");
}

async function phase2_classifyBullets(
  bullets: BulletItem[],
  jdExtraction: JDExtraction,
): Promise<BulletClassification[]> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You classify resume bullets. Return only valid JSON with a top-level 'classifications' array." },
      {
        role: "user",
        content:
          BULLET_CLASSIFICATION_PROMPT({ bullets, jdExtraction }) +
          "\n\nIMPORTANT: wrap the array in a JSON object: { \"classifications\": [...] }",
      },
    ],
  });
  const parsed = parseJSON<{ classifications?: BulletClassification[] }>(
    completion.choices[0]?.message?.content ?? "{}",
  );
  return parsed.classifications ?? [];
}

async function phase3_rewriteBullets(
  bullets: BulletItem[],
  classification: BulletClassification[],
  jdExtraction: JDExtraction,
): Promise<BulletItem[]> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.2,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You rewrite resume bullets. Return only valid JSON with a top-level 'bullets' array." },
      {
        role: "user",
        content:
          BULLET_REWRITE_PROMPT({ bullets, classification, jdExtraction }) +
          "\n\nIMPORTANT: wrap the array in a JSON object: { \"bullets\": [...] }",
      },
    ],
  });
  const parsed = parseJSON<{ bullets?: BulletItem[] }>(
    completion.choices[0]?.message?.content ?? "{}",
  );
  return parsed.bullets ?? bullets;
}

async function phase4_auditGaps(
  rewrittenResumeText: string,
  keywords: string[],
  sourceSkillCategories: string[],
): Promise<AuditEntry[]> {
  if (keywords.length === 0) return [];
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You audit keyword coverage in resumes. Return only valid JSON." },
      {
        role: "user",
        content: GAP_AUDIT_PROMPT({ rewrittenResumeText, keywords, sourceSkillCategories }),
      },
    ],
  });
  const parsed = parseJSON<{ audit?: AuditEntry[] }>(
    completion.choices[0]?.message?.content ?? "{}",
  );
  return parsed.audit ?? [];
}

async function phase5_writeSummary(
  rewrittenBulletsText: string,
  jdExtraction: JDExtraction,
  jobDescription: string,
): Promise<string[]> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You write professional resume summaries. Return only valid JSON." },
      {
        role: "user",
        content: SUMMARY_PROMPT({ rewrittenBulletsText, jdExtraction, jobDescription }),
      },
    ],
  });
  const parsed = parseJSON<{ summary?: string[] }>(
    completion.choices[0]?.message?.content ?? "{}",
  );
  return parsed.summary ?? [];
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Runs the full 5-phase tailoring pipeline against the source resume.
 * Assumes input has already been validated (non-empty jobDescription and keywords).
 *
 * Returns a discriminated TailoringResult:
 *   { ok: true,  data, meta, warnings? }  on success
 *   { ok: false, status, error, ...  }    on pipeline-level failure
 */
export async function runTailoringPipeline(
  input: TailoringInput,
): Promise<TailoringResult> {
  const { jobDescription, keywords: fixedKeywordList } = input;

  const context = await loadSourceResumeContext();
  const sourceResumeText = resumeToText(context.sourceData);
  const sourceSkillCategories = Object.keys(context.sourceData.skills);

  // Keyword bucketing (used for audit and validation)
  const { mustKeepKeywords, mustAddKeywords } = buildKeywordAnchors(
    sourceResumeText,
    fixedKeywordList,
  );
  const zeroEvidenceKeywords = findZeroEvidenceKeywords(sourceResumeText, mustAddKeywords);
  const safeAddKeywords = mustAddKeywords.filter((k) => !zeroEvidenceKeywords.includes(k));

  // ── Phase 1: Extract JD vocabulary ──────────────────────────────────────
  const rawJdExtraction = await phase1_extractJD(jobDescription);
  const jdExtraction = sanitizeJdExtraction(rawJdExtraction);

  // ── Phase 2: Classify bullets ────────────────────────────────────────────
  const bullets = extractBulletsWithIds(context.sourceData);
  const rawClassification = await phase2_classifyBullets(bullets, jdExtraction);
  const classification = sanitizeLightReframeClassification(rawClassification, bullets, jdExtraction);

  // ── Phase 3: Rewrite bullets ─────────────────────────────────────────────
  const rewrittenBullets = await phase3_rewriteBullets(bullets, classification, jdExtraction);

  // Assemble intermediate resume with rewritten bullets
  const intermediateResume = assembleBullets(context.sourceData, rewrittenBullets);

  // ── Phase 2.5: Deterministic targeted enrichment (bullets only) ─────────
  const bulletEnrichment = applyTargetedEnrichmentToBullets(
    intermediateResume,
    sourceResumeText,
    fixedKeywordList,
  );
  const enrichedIntermediateResume = bulletEnrichment.resume;
  const intermediateText = resumeToText(enrichedIntermediateResume);

  // ── Phase 4: Gap audit ───────────────────────────────────────────────────
  const gapAudit = await phase4_auditGaps(intermediateText, safeAddKeywords, sourceSkillCategories);

  // ── Phase 5: Summary ─────────────────────────────────────────────────────
  const rewrittenBulletsText = enrichedIntermediateResume.experience
    .flatMap((role) => role.bullets)
    .map((text) => `- ${text}`)
    .join("\n");
  const cleanJobDescription = sanitizeJobDescription(jobDescription);
  const summary = await phase5_writeSummary(rewrittenBulletsText, jdExtraction, cleanJobDescription);

  // ── Assembly: combine all phase outputs into final resume JSON ───────────
  const assembled: ResumeData = {
    ...enrichedIntermediateResume,
    summary: summary.length >= 2 && summary.length <= 3 ? summary : context.sourceData.summary,
  };
  const withSkills = applySkillsAudit(assembled, gapAudit);

  // ── Phase 2.5b: Deterministic targeted enrichment (summary only) ────────
  const summaryEnrichment = applyTargetedEnrichmentToSummary(
    withSkills,
    sourceResumeText,
    fixedKeywordList,
  );

  // ── Post-processing: enforce hard rules deterministically ────────────────
  const cleaned = cleanTrailingAppends(summaryEnrichment.resume);
  const deduplicated = deduplicateOpeners(cleaned);
  const noNewCategories = stripFabricatedSkillCategories(deduplicated, context.sourceData);
  const tailoredResumePreSweep = stripZeroEvidenceSkills(noNewCategories, zeroEvidenceKeywords);

  // ── Final coverage sweep: deterministic last-pass keyword surfacing ──────
  const finalCoverageSweep = applyFinalCoverageSweep(
    tailoredResumePreSweep,
    sourceResumeText,
    fixedKeywordList,
  );
  const tailoredResume = finalCoverageSweep.resume;

  if (!isResumeData(tailoredResume)) {
    return {
      ok: false,
      status: 500,
      error: "Assembly produced invalid resume schema",
    };
  }

  // ── Blocked phrase gate ───────────────────────────────────────────────────
  // Reject and return 422 if any hard-blocked substring survived all upstream
  // guards. The caller is expected to retry once; a retry at the same
  // temperature will almost always produce a clean output.
  const HARD_BLOCKED_SUBSTRINGS = [
    "training and inferencing",
    "model training",
  ];

  const containsBlockedPhrase = (data: ResumeData): string | null => {
    const allText = [
      ...data.summary,
      ...data.experience.flatMap((r) => r.bullets as string[]),
    ];
    for (const text of allText) {
      for (const phrase of HARD_BLOCKED_SUBSTRINGS) {
        if (text.toLowerCase().includes(phrase.toLowerCase())) {
          return phrase;
        }
      }
    }
    return null;
  };

  const blockedPhrase = containsBlockedPhrase(tailoredResume);
  if (blockedPhrase) {
    return {
      ok: false,
      status: 422,
      error: "BLOCKED_PHRASE_DETECTED",
      phrase: blockedPhrase,
      message: "Resume contains a blocked phrase. Please retry.",
    };
  }

  // ── Validation ───────────────────────────────────────────────────────────
  const tailoredText = resumeToText(tailoredResume);
  const sourceScore = scoreResumeAgainstKeywords(sourceResumeText, fixedKeywordList);
  const tailoredScore = scoreResumeAgainstKeywords(tailoredText, fixedKeywordList);
  const missingAnchoredKeywords = mustKeepKeywords.filter(
    (kw) => !keywordMatchesText(kw, tailoredText),
  );
  const targetedEnrichment = [
    ...bulletEnrichment.logs,
    ...summaryEnrichment.logs,
  ];

  if (targetedEnrichment.length > 0) {
    console.info(
      "[Targeted Enrichment]",
      JSON.stringify(
        {
          enrichedKeywords: targetedEnrichment.map((entry) => entry.keyword),
          insertions: targetedEnrichment,
        },
        null,
        2,
      ),
    );
  }

  if (finalCoverageSweep.logs.length > 0) {
    console.info(
      "[Final Coverage Sweep]",
      JSON.stringify(
        {
          injectedKeywords: finalCoverageSweep.logs.map((entry) => entry.keyword),
          insertions: finalCoverageSweep.logs,
        },
        null,
        2,
      ),
    );
  }

  if (missingAnchoredKeywords.length > 0 || tailoredScore.score < sourceScore.score) {
    return {
      ok: false,
      status: 500,
      error: "Tailored resume failed keyword anchoring validation",
      missingAnchoredKeywords,
      sourceScore: sourceScore.score,
      tailoredScore: tailoredScore.score,
    };
  }

  // ── Warnings ─────────────────────────────────────────────────────────────
  const hallucinatedNouns = findHallucinatedProperNouns(sourceResumeText, tailoredText, fixedKeywordList);
  const fabricatedSkills = findFabricatedSkills(context.sourceData, tailoredResume);
  const droppedMetrics = findDroppedMetrics(context.sourceData, tailoredResume);

  return {
    ok: true,
    data: tailoredResume,
    meta: {
      classification: classification.map((c) => ({ id: c.id, decision: c.decision })),
      gapAudit,
      zeroEvidenceKeywords,
      coverageScore: tailoredScore.score,
      targetedEnrichment,
      finalCoverageSweep: finalCoverageSweep.logs,
    },
    ...((hallucinatedNouns.length > 0 || fabricatedSkills.length > 0 || droppedMetrics.length > 0) && {
      warnings: {
        ...(hallucinatedNouns.length > 0 && { hallucinatedNouns }),
        ...(fabricatedSkills.length > 0 && { fabricatedSkills }),
        ...(droppedMetrics.length > 0 && { droppedMetrics }),
      },
    }),
  };
}

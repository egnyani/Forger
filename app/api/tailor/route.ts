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

export const runtime = "nodejs";

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
  decision: "KEEP" | "REFRAME" | "DROP";
  jdVocabulary?: string[];
};

type AuditEntry = {
  keyword: string;
  status: "NATURAL" | "ADDED" | "SKILLS_ONLY" | "MISSING";
  skillsCategory?: string;
};

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
 * Removes blocked concepts from jdExtraction.hardKeywords before they are
 * passed to Phase 2 (classifier) or Phase 3 (rewriter).
 *
 * Phase 1 (gpt-4o-mini) extracts keywords verbatim from the JD and has no
 * awareness of blocked concepts. Phrases like "AI training and inferencing
 * services" appear in the JD's Preferred Qualifications and will be extracted
 * as hard keywords — but they describe work the candidate has not done and
 * must never be injected into the resume. Without this filter, the phrase
 * travels downstream as an officially endorsed hardKeyword, causing the
 * classifier and rewriter to use it despite their FORBIDDEN rules.
 */
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

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      jobDescription?: string;
      keywords?: string[];
    };
    const jobDescription = body.jobDescription?.trim();
    const fixedKeywordList = body.keywords?.filter(
      (k): k is string => typeof k === "string" && k.trim().length > 0,
    );

    if (!jobDescription) {
      return new Response(JSON.stringify({ error: "jobDescription is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!fixedKeywordList || fixedKeywordList.length === 0) {
      return new Response(JSON.stringify({ error: "keywords are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

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
    const classification = await phase2_classifyBullets(bullets, jdExtraction);

    // ── Phase 3: Rewrite bullets ─────────────────────────────────────────────
    const rewrittenBullets = await phase3_rewriteBullets(bullets, classification, jdExtraction);

    // Assemble intermediate resume with rewritten bullets
    const intermediateResume = assembleBullets(context.sourceData, rewrittenBullets);
    const intermediateText = resumeToText(intermediateResume);

    // ── Phase 4: Gap audit ───────────────────────────────────────────────────
    const gapAudit = await phase4_auditGaps(intermediateText, safeAddKeywords, sourceSkillCategories);

    // ── Phase 5: Summary ─────────────────────────────────────────────────────
    const rewrittenBulletsText = rewrittenBullets.map((b) => `- ${b.text}`).join("\n");
    const cleanJobDescription = sanitizeJobDescription(jobDescription);
    const summary = await phase5_writeSummary(rewrittenBulletsText, jdExtraction, cleanJobDescription);

    // ── Assembly: combine all phase outputs into final resume JSON ───────────
    const assembled: ResumeData = {
      ...intermediateResume,
      summary: summary.length >= 2 && summary.length <= 3 ? summary : context.sourceData.summary,
    };
    const withSkills = applySkillsAudit(assembled, gapAudit);

    // ── Post-processing: enforce hard rules deterministically ────────────────
    const cleaned = cleanTrailingAppends(withSkills);
    const deduplicated = deduplicateOpeners(cleaned);
    const noNewCategories = stripFabricatedSkillCategories(deduplicated, context.sourceData);
    const tailoredResume = stripZeroEvidenceSkills(noNewCategories, zeroEvidenceKeywords);

    if (!isResumeData(tailoredResume)) {
      return new Response(
        JSON.stringify({ error: "Assembly produced invalid resume schema" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
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
      return new Response(
        JSON.stringify({
          error: "BLOCKED_PHRASE_DETECTED",
          phrase: blockedPhrase,
          message: "Resume contains a blocked phrase. Please retry.",
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Validation ───────────────────────────────────────────────────────────
    const tailoredText = resumeToText(tailoredResume);
    const sourceScore = scoreResumeAgainstKeywords(sourceResumeText, fixedKeywordList);
    const tailoredScore = scoreResumeAgainstKeywords(tailoredText, fixedKeywordList);
    const missingAnchoredKeywords = mustKeepKeywords.filter(
      (kw) => !keywordMatchesText(kw, tailoredText),
    );

    if (missingAnchoredKeywords.length > 0 || tailoredScore.score < sourceScore.score) {
      return new Response(
        JSON.stringify({
          error: "Tailored resume failed keyword anchoring validation",
          missingAnchoredKeywords,
          sourceScore: sourceScore.score,
          tailoredScore: tailoredScore.score,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── Warnings ─────────────────────────────────────────────────────────────
    const hallucinatedNouns = findHallucinatedProperNouns(sourceResumeText, tailoredText, fixedKeywordList);
    const fabricatedSkills = findFabricatedSkills(context.sourceData, tailoredResume);
    const droppedMetrics = findDroppedMetrics(context.sourceData, tailoredResume);

    return new Response(
      JSON.stringify({
        data: tailoredResume,
        meta: {
          classification: classification.map((c) => ({ id: c.id, decision: c.decision })),
          gapAudit,
          zeroEvidenceKeywords,
        },
        ...((hallucinatedNouns.length > 0 || fabricatedSkills.length > 0 || droppedMetrics.length > 0) && {
          warnings: {
            ...(hallucinatedNouns.length > 0 && { hallucinatedNouns }),
            ...(fabricatedSkills.length > 0 && { fabricatedSkills }),
            ...(droppedMetrics.length > 0 && { droppedMetrics }),
          },
        }),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

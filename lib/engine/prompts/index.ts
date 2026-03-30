// ─── Prompt re-exports ────────────────────────────────────────────────────────
// All consumers import from "@/lib/engine/prompts" — this index satisfies that
// path for both the old monolith import and the new per-file structure.

export { JD_EXTRACTION_PROMPT } from "./extractionPrompt";
export { BULLET_CLASSIFICATION_PROMPT } from "./classificationPrompt";
export { BULLET_REWRITE_PROMPT } from "./rewritePrompt";
export { GAP_AUDIT_PROMPT } from "./gapAuditPrompt";
export { SUMMARY_PROMPT } from "./summaryPrompt";
export { TECH_LEAD_SCORE_PROMPT } from "./techLeadScorePrompt";
export { KEYWORD_EXTRACTION_PROMPT } from "./keywordExtractionPrompt";
export { SCORE_PROMPT } from "./scorePrompt";

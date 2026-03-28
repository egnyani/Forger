/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                   PERMANENTLY LOCKED RESUME LAYOUT SYSTEM                  ║
 * ║                                                                            ║
 * ║  This file is the SINGLE SOURCE OF TRUTH for the approved resume layout.   ║
 * ║  It defines every visual property: fonts, sizes, colors, spacing,          ║
 * ║  section styling, page padding, and PDF export dimensions.                 ║
 * ║                                                                            ║
 * ║  ██  DO NOT MODIFY THIS FILE.  ██                                          ║
 * ║                                                                            ║
 * ║  The layout has been approved and is now permanent. All future work        ║
 * ║  must only improve CONTENT — not layout, typography, or spacing.           ║
 * ║                                                                            ║
 * ║  CONTENT files (safe to edit):                                             ║
 * ║    lib/prompts.ts              — tailoring instructions to the AI          ║
 * ║    lib/sourceResume.ts         — base resume data loader                   ║
 * ║    lib/jobDescriptionSignals.ts — JD signal extraction                     ║
 * ║    lib/resume.json             — source resume content only                ║
 * ║                                                                            ║
 * ║  LAYOUT files (do not touch):                                              ║
 * ║    lib/resumeLayout.tsx        — THIS FILE — all visual constants          ║
 * ║    components/ResumeTemplate.tsx — pure JSX renderer (no styles)          ║
 * ║    lib/renderResumeHtml.tsx    — HTML shell for PDF rendering              ║
 * ║    app/api/export-pdf/route.ts — PDF export dimensions + measurement       ║
 * ║                                                                            ║
 * ║  Layout permanently locked: March 2026                                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

import type { CSSProperties, ReactNode } from "react";

// ─── Page Padding ─────────────────────────────────────────────────────────────
// Single source of truth for all four page margins (in px).
// All sides are intentionally equal so the resume sits inside one clean
// rectangular content area with no asymmetric spacing.
//
// PDF height formula:
//   pdfHeight = document.body.scrollHeight
//             = PAGE_PADDING + renderedContentHeight + PAGE_PADDING
//
// No extra height buffer is added anywhere — bottom whitespace equals
// PAGE_PADDING exactly, the same as top, left, and right.

export const PAGE_PADDING = 32; // px — uniform on all four sides

// ─── PDF Export Configuration ────────────────────────────────────────────────
// Used by app/api/export-pdf/route.ts when rendering the resume to PDF via
// Puppeteer. These values produce a single continuous page at US letter width.
// Height is NOT defined here — it is calculated in route.ts as:
//   pdf height = document.body.scrollHeight
// scrollHeight already includes the full CSS padding (top + content + bottom),
// so no extra height offset is needed or added.

export const PDF_CONFIG = {
  /** US letter width */
  width: "8.5in",
  /** Zero Puppeteer margins — all spacing is handled by PAGE_PADDING via pageStyle */
  margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
  /** Render background colors and images */
  printBackground: true,
} as const;

// ─── HTML Reset CSS ──────────────────────────────────────────────────────────
// Injected into the standalone HTML document used for PDF rendering.

export const HTML_RESET_CSS = `* { margin: 0; padding: 0; box-sizing: border-box; } body { background: white; }`;

// ─── Inline Bold Parser ─────────────────────────────────────────────────────
// Converts **text** markers (added by the AI tailoring prompt) into <strong>
// elements. Falls back to a plain string when no markers are present.

export function renderInlineBold(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE CONSTANTS — every CSSProperties object used by ResumeTemplate.tsx
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Page Container ──────────────────────────────────────────────────────────
// Font sizes use `pt` units so Puppeteer renders them at the correct print
// size. 11pt in CSS = 11pt in the exported PDF.

export const pageStyle: CSSProperties = {
  width: "100%",
  maxWidth: "750px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  padding: `${PAGE_PADDING}px`,
  boxSizing: "border-box",
  fontFamily: "'Times New Roman', Times, Georgia, serif",
  fontSize: "11pt",
  lineHeight: 1.35,
  color: "#000000",
};

// ─── Name ────────────────────────────────────────────────────────────────────

export const nameStyle: CSSProperties = {
  fontSize: "18pt",
  fontWeight: 700,
  textAlign: "center",
  color: "#000000",
  margin: "0 0 3px 0",
  letterSpacing: "0.5px",
};

// ─── Contact Row ─────────────────────────────────────────────────────────────

export const contactRowStyle: CSSProperties = {
  fontSize: "10pt",
  color: "#457885",
  textAlign: "center",
  margin: "0 0 6px 0",
  letterSpacing: "0.1px",
};

// ─── Section Headers (Summary, Experience, Technical Skills, Education) ──────

export const sectionHeaderStyle: CSSProperties = {
  fontSize: "10.5pt",
  fontWeight: 700,
  fontVariant: "small-caps",
  letterSpacing: "0.5px",
  color: "#000000",
  borderBottom: "1px solid #000000",
  paddingBottom: "1px",
  margin: "7px 0 3px 0",
  textTransform: "uppercase",
};

// ─── Summary ─────────────────────────────────────────────────────────────────

export const summaryListStyle: CSSProperties = {
  listStyleType: "disc",
  marginLeft: "20px",
  marginTop: "0",
  padding: "0",
};

export const summaryItemStyle: CSSProperties = {
  fontSize: "11pt",
  lineHeight: "1.45",
  color: "#000000",
  marginBottom: "2px",
  textAlign: "justify",
};

// ─── Experience ──────────────────────────────────────────────────────────────

export const roleBlockStyle: CSSProperties = {
  marginBottom: "6px",
};

/** Company name LEFT + date RIGHT on the same flex row */
export const companyDateRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  marginBottom: "0px",
};

export const companyNameStyle: CSSProperties = {
  fontSize: "10.5pt",
  fontWeight: 700,
  color: "#000000",
};

export const dateStyle: CSSProperties = {
  fontSize: "11pt",
  color: "#000000",
  whiteSpace: "nowrap",
  fontWeight: 400,
};

/** Title on its own line below the company row */
export const roleTitleStyle: CSSProperties = {
  fontSize: "11pt",
  fontStyle: "italic",
  fontWeight: 400,
  color: "#000000",
  marginBottom: "1px",
};

export const bulletListStyle: CSSProperties = {
  listStyleType: "disc",
  marginLeft: "20px",
  padding: "0",
  marginTop: "1px",
};

export const bulletItemStyle: CSSProperties = {
  fontSize: "11pt",
  lineHeight: "1.45",
  marginBottom: "2px",
  textAlign: "justify",
};

// ─── Skills ──────────────────────────────────────────────────────────────────

export const skillRowStyle: CSSProperties = {
  fontSize: "11pt",
  lineHeight: "1.55",
  marginBottom: "1px",
};

export const skillLabelStyle: CSSProperties = {
  fontWeight: 700,
  color: "#000000",
};

export const skillValuesStyle: CSSProperties = {
  fontWeight: 400,
  color: "#000000",
};

// ─── Education ───────────────────────────────────────────────────────────────

export const eduBlockStyle: CSSProperties = {
  marginBottom: "4px",
};

export const eduSchoolRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

export const eduSchoolStyle: CSSProperties = {
  fontSize: "10.5pt",
  fontWeight: 700,
  color: "#000000",
};

export const eduDegreeRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

export const eduDegreeStyle: CSSProperties = {
  fontSize: "11pt",
  color: "#000000",
};

export const eduLocationStyle: CSSProperties = {
  fontSize: "11pt",
  color: "#555555",
  whiteSpace: "nowrap",
};

// ─── Projects ────────────────────────────────────────────────────────────────

export const projectBlockStyle: CSSProperties = {
  marginBottom: "6px",
};

export const projectHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

export const projectNameStyle: CSSProperties = {
  fontSize: "10.5pt",
  fontWeight: 700,
  color: "#000000",
};

// ─── Links ───────────────────────────────────────────────────────────────────

export const linkStyle: CSSProperties = {
  color: "#457885",
  textDecoration: "none",
};

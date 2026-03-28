# ResumeForge — Locked Layout Rules

> **These rules are permanent. Do not change layout, typography, spacing, or PDF
> rendering logic while working on content quality improvements.**
>
> All rules below are enforced by `lib/resumeLayout.tsx`, which is the single
> source of truth for every visual property in the resume.

---

## Architecture

| Layer | Files | Rule |
|---|---|---|
| **Layout** (locked) | `lib/resumeLayout.tsx`, `components/ResumeTemplate.tsx`, `lib/renderResumeHtml.tsx`, `app/api/export-pdf/route.ts` | Do not modify |
| **Content** (safe to improve) | `lib/prompts.ts`, `lib/sourceResume.ts`, `lib/jobDescriptionSignals.ts`, `lib/resume.json` | Improve freely |

`ResumeTemplate.tsx` is a **pure renderer** — it contains only JSX structure and
imports every style from `resumeLayout.tsx`. It has zero inline styles of its own.

---

## Page & PDF

| Property | Value |
|---|---|
| Page width | `8.5in` (US letter) |
| Page padding (all four sides) | `32px` uniform |
| Font family | `'Times New Roman', Times, Georgia, serif` |
| Base font size | `11pt` |
| Line height | `1.35` |
| Background | `#ffffff` |
| PDF margins (Puppeteer) | `0px` on all sides — spacing handled entirely by CSS padding |
| PDF height formula | `container.getBoundingClientRect().height` — measured from the page container element, includes all CSS padding |

---

## Typography & Colors

| Element | Size | Weight | Color | Notes |
|---|---|---|---|---|
| Name | `18pt` | 700 | `#000000` | Centered, letter-spacing 0.5px |
| Contact row | `10pt` | 400 | `#457885` | Centered, LinkedIn + Github as hyperlinks |
| Section headers | `10.5pt` | 700 | `#000000` | Small-caps + uppercase, border-bottom 1px solid black |
| Company / university names | `10.5pt` | 700 | `#000000` | |
| Project names | `10.5pt` | 700 | `#000000` | Same size as company/university names |
| Job title (role) | `11pt` | 400 | `#000000` | Italic |
| Date ranges | `11pt` | 400 | `#000000` | Right-aligned, no wrapping |
| Bullet text | `11pt` | 400 | `#000000` | Justified, line-height 1.45 |
| Summary bullets | `11pt` | 400 | `#000000` | Justified, line-height 1.45 |
| Degree names | `11pt` | 400 | `#000000` | **Not italic** |
| Location (education) | `11pt` | 400 | `#555555` | Right-aligned |
| Skill category label | `11pt` | 700 | `#000000` | Bold label, normal values |
| Link color (LinkedIn/Github) | — | — | `#457885` | No underline |

---

## Section Order

1. Name + Contact
2. Summary
3. Experience
4. Technical Skills
5. Education
6. Projects *(only rendered if data contains projects)*

---

## Section Header Style

- `font-variant: small-caps`
- `text-transform: uppercase`
- `border-bottom: 1px solid #000000`
- `padding-bottom: 1px`
- `margin: 7px 0 3px 0`

---

## Layout Spacing

| Element | Spacing |
|---|---|
| Role block bottom margin | `6px` |
| Education block bottom margin | `4px` |
| Project block bottom margin | `6px` |
| Bullet list left margin | `20px` |
| Bullet item bottom margin | `2px` |
| Section header top/bottom margin | `7px 0 3px 0` |

---

## Inline Bold Formatting

Bullet strings may contain `**double asterisk**` markers. These are parsed by
`renderInlineBold()` in `resumeLayout.tsx` and converted to `<strong>` elements.
This is the only permitted inline formatting in bullet text.

---

## What Must Not Change

- Font family or font sizes
- Page padding or section spacing
- Section order
- Color values
- Section header border style
- PDF width or height calculation method
- Degree names must not be italic
- Job titles remain italic
- Company/university/project names remain `10.5pt bold`
- Contact row renders LinkedIn and Github as hyperlinks, not raw URLs

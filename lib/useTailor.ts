'use client'

/**
 * useTailor — custom hook that owns all tailoring-related state, async
 * orchestration, and derived display data.
 *
 * Extracted from app/page.tsx (R2 refactor). Zero logic changes — purely
 * a structural move. The page component is now a thin rendering wrapper
 * that calls this hook and wires the returned values to JSX.
 */

import { useEffect, useRef, useState } from 'react'

import resumeJson from '@/lib/engine/resume.json'
import { resumeToText } from '@/lib/engine/resumeToText'
import type { ATSScore, ResumeData } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────
// Exported so page.tsx can use them for UI component prop signatures.

export type KeywordFilter = 'all' | 'gained' | 'present' | 'missing'

export type KeywordItem = {
  keyword: string
  before: boolean
  after: boolean
  status: Exclude<KeywordFilter, 'all'>
}

export type RewrittenBullet = {
  id: string
  roleLabel: string
  before: string
  after: string
  gainedCount: number
}

export type TechLeadScore = {
  total: number
  breakdown: {
    openerUniqueness: number
    metricPreservation: number
    semanticAccuracy: number
    naturalVoice: number
  }
  flags: string[]
  verdict: 'passes' | 'minor fixes' | 'ai tells' | 'rejection risk'
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Exported so LoadingPanel in page.tsx can reference the same array for display.

export const LOADING_STEPS = [
  'Analyzing your base resume...',
  'Extracting ATS keywords from the job description...',
  'Tailoring supported bullets to the target role...',
  'Scoring the optimized resume against the JD...',
  'Preparing keyword and rewrite insights...',
]

// ─── Module-level constants ───────────────────────────────────────────────────

const sourceResumeData = resumeJson as ResumeData

// ─── Private utilities ────────────────────────────────────────────────────────
// These are the same functions that lived in page.tsx.
//
// NOTE: normalizeKeyword here is the simplified page-local version
// (trim + lowercase only). Do NOT replace with or import from
// keywordUtils.ts until behavioral equivalence is confirmed (R2 constraint).

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase()
}

function extractBulletText(bullet: unknown) {
  if (typeof bullet === 'string') return bullet
  if (bullet && typeof bullet === 'object' && 'text' in bullet) {
    const value = (bullet as { text?: unknown }).text
    return typeof value === 'string' ? value : ''
  }
  return ''
}

function buildKeywordItems(
  beforeScore: ATSScore | null,
  afterScore: ATSScore | null,
): KeywordItem[] {
  if (!afterScore) return []

  const beforeMatched = new Set(
    (beforeScore?.matched_keywords ?? []).map(normalizeKeyword),
  )
  const items = new Map<string, KeywordItem>()

  afterScore.matched_keywords.forEach((keyword) => {
    const normalized = normalizeKeyword(keyword)
    items.set(normalized, {
      keyword,
      before: beforeMatched.has(normalized),
      after: true,
      status: beforeMatched.has(normalized) ? 'present' : 'gained',
    })
  })

  afterScore.missing_keywords.forEach((keyword) => {
    const normalized = normalizeKeyword(keyword)
    if (items.has(normalized)) return
    items.set(normalized, {
      keyword,
      before: false,
      after: false,
      status: 'missing',
    })
  })

  return Array.from(items.values())
}

function buildRewrittenBullets(
  source: ResumeData,
  tailored: ResumeData | null,
  gainedKeywords: string[],
) {
  if (!tailored) return [] as RewrittenBullet[]

  const normalizedGained = gainedKeywords.map(normalizeKeyword)
  const changes: RewrittenBullet[] = []

  source.experience.forEach((role, roleIndex) => {
    const tailoredRole = tailored.experience[roleIndex]
    if (!tailoredRole) return

    role.bullets.forEach((beforeBullet, bulletIndex) => {
      const beforeText = extractBulletText(beforeBullet)
      const afterText = extractBulletText(tailoredRole.bullets[bulletIndex])
      if (!afterText || beforeText.trim() === afterText.trim()) return

      const gainedCount = normalizedGained.filter((keyword) =>
        normalizeKeyword(afterText).includes(keyword),
      ).length

      changes.push({
        id: `${role.id}-${bulletIndex}`,
        roleLabel: `${role.company || 'Experience'} — ${role.title || 'Role'}`,
        before: beforeText,
        after: afterText,
        gainedCount,
      })
    })
  })

  return changes
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTailor() {
  const [jobDescription, setJobDescription] = useState('')
  const [tailoredData, setTailoredData] = useState<ResumeData | null>(null)
  const [fixedKeywords, setFixedKeywords] = useState<string[]>([])
  const [beforeScore, setBeforeScore] = useState<ATSScore | null>(null)
  const [afterScore, setAfterScore] = useState<ATSScore | null>(null)
  const [techLeadScore, setTechLeadScore] = useState<TechLeadScore | null>(null)
  const [techLeadLoading, setTechLeadLoading] = useState(false)
  const [techLeadError, setTechLeadError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [keywordFilter, setKeywordFilter] = useState<KeywordFilter>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startSteps() {
    let index = 0
    setStepIdx(0)
    timerRef.current = setInterval(() => {
      index = Math.min(index + 1, LOADING_STEPS.length - 1)
      setStepIdx(index)
    }, 7500)
  }

  function stopSteps() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function scoreTechLeadApi(
    original: ResumeData,
    tailored: ResumeData,
  ): Promise<TechLeadScore> {
    const response = await fetch('/api/score-tech-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original, tailored }),
    })
    if (!response.ok) {
      throw new Error(await response.text())
    }
    return (await response.json()) as TechLeadScore
  }

  async function scoreResume(resumeData: ResumeData, keywords: string[]) {
    const resumeText = resumeToText(resumeData)
    const response = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, keywords }),
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const { score } = await response.json()
    return score as ATSScore
  }

  // Replaces the inline textarea onChange resets: encapsulates the state
  // flush that happens whenever the user edits the job description.
  function handleJobDescriptionChange(value: string) {
    setJobDescription(value)
    setTailoredData(null)
    setFixedKeywords([])
    setBeforeScore(null)
    setAfterScore(null)
    setTechLeadScore(null)
    setTechLeadLoading(false)
    setError(null)
    setKeywordFilter('all')
  }

  async function handleGenerate() {
    if (!jobDescription.trim()) {
      setError('Please paste the job description text.')
      return
    }

    setError(null)
    setTailoredData(null)
    setFixedKeywords([])
    setBeforeScore(null)
    setAfterScore(null)
    setTechLeadScore(null)
    setTechLeadLoading(false)
    setTechLeadError(false)
    setRetrying(false)
    setKeywordFilter('all')
    setLoading(true)
    startSteps()

    let tailoredResult: ResumeData | null = null

    try {
      const keywordRes = await fetch('/api/extract-keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      })

      if (!keywordRes.ok) {
        throw new Error(await keywordRes.text())
      }

      const { keywords } = (await keywordRes.json()) as { keywords: string[] }
      setFixedKeywords(keywords)

      const baseScore = await scoreResume(sourceResumeData, keywords)
      setBeforeScore(baseScore)

      // Tailor — with one automatic retry on 422 BLOCKED_PHRASE_DETECTED
      const callTailor = async (): Promise<Response> =>
        fetch('/api/tailor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription, keywords }),
        })

      let tailorRes = await callTailor()

      if (tailorRes.status === 422) {
        const body = await tailorRes.json() as { error?: string }
        if (body.error === 'BLOCKED_PHRASE_DETECTED') {
          // First attempt contained a blocked phrase — retry once automatically
          setRetrying(true)
          tailorRes = await callTailor()
          setRetrying(false)
          if (tailorRes.status === 422) {
            // Second attempt also blocked — surface best-effort result with warning
            const retryBody = await tailorRes.json() as { error?: string; phrase?: string }
            throw new Error(
              `Unable to fully optimize this resume for this JD.\nThe generated output contained restricted content ("${retryBody.phrase ?? 'blocked phrase'}") on both attempts.\nDownload may be unavailable — please try again.`,
            )
          }
        }
      }

      if (!tailorRes.ok) {
        throw new Error(await tailorRes.text())
      }

      const { data } = await tailorRes.json()
      tailoredResult = data as ResumeData
      setTailoredData(data)

      const optimizedScore = await scoreResume(data, keywords)
      setAfterScore(optimizedScore)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      stopSteps()
      setLoading(false)
      setRetrying(false)
    }

    // Tech lead score loads separately after ATS results are visible
    if (tailoredResult) {
      setTechLeadLoading(true)
      try {
        const tlScore = await scoreTechLeadApi(sourceResumeData, tailoredResult)
        setTechLeadScore(tlScore)
      } catch {
        setTechLeadError(true)
      } finally {
        setTechLeadLoading(false)
      }
    }
  }

  // ─── Derived display data ─────────────────────────────────────────────────

  const keywordItems = buildKeywordItems(beforeScore, afterScore)
  const gainedKeywords = keywordItems
    .filter((item) => item.status === 'gained')
    .map((item) => item.keyword)
  const rewrittenBullets = buildRewrittenBullets(
    sourceResumeData,
    tailoredData,
    gainedKeywords,
  )

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    // controlled input
    jobDescription,
    handleJobDescriptionChange,

    // async action
    handleGenerate,

    // loading / error
    loading,
    retrying,
    stepIdx,
    error,

    // results
    tailoredData,
    fixedKeywords,
    beforeScore,
    afterScore,

    // tech lead scoring
    techLeadScore,
    techLeadLoading,
    techLeadError,

    // keyword UI state
    keywordFilter,
    setKeywordFilter,

    // derived display data
    keywordItems,
    rewrittenBullets,
  }
}

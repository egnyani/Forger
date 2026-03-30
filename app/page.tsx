'use client'

import { useState } from 'react'

import { ATSScore, ResumeData } from '@/lib/types'
import { useDownloadPdf } from '@/lib/useDownloadPdf'
import {
  useTailor,
  LOADING_STEPS,
} from '@/lib/useTailor'
import type { KeywordFilter, KeywordItem, RewrittenBullet, TechLeadScore } from '@/lib/useTailor'

function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)}%`
}

function IconSparkle() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconTarget() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#4f46e5"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconAlert() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconX() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string
  value: string
  detail: string
  accent: string
}) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white px-[10px] py-[14px] text-center shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
      <div className="mb-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.05em] text-slate-400">
        {label}
      </div>
      <div className={`whitespace-nowrap text-[clamp(20px,3vw,28px)] font-extrabold leading-none tracking-[-1px] ${accent}`}>
        {value}
      </div>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-slate-500">
        {detail}
      </div>
    </div>
  )
}

function KeywordBadge({
  item,
}: {
  item: KeywordItem
}) {
  const styles =
    item.status === 'gained'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : item.status === 'present'
        ? 'border-green-200 bg-green-50 text-green-700'
        : 'border-rose-300 bg-rose-50 text-rose-700'

  return (
    <span
      className={`mb-[5px] mr-1 inline-flex items-center gap-1 rounded-full border px-[10px] py-[3px] text-[11px] font-semibold ${styles}`}
    >
      {item.status === 'gained' ? (
        <IconPlus />
      ) : item.status === 'present' ? (
        <IconCheck />
      ) : (
        <IconX />
      )}
      {item.keyword}
    </span>
  )
}

function ChangeCard({ change, index }: { change: RewrittenBullet; index: number }) {
  const [open, setOpen] = useState(index < 2)

  return (
    <div className="mb-2 overflow-hidden rounded-[10px] border border-slate-200 bg-white shadow-sm transition hover:shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <button
        className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-[3px] flex items-center justify-between gap-2">
            <div className="min-w-0 truncate whitespace-nowrap text-[11px] font-semibold text-indigo-600">
              {change.roleLabel}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {change.gainedCount > 0 ? (
                <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-[2px] text-[11px] font-bold text-emerald-600">
                  +{change.gainedCount} keywords
                </span>
              ) : null}
              <span
                className={`text-xs text-slate-400 transition ${
                  open ? 'rotate-180' : ''
                }`}
              >
                ▼
              </span>
            </div>
          </div>
          <div className="truncate whitespace-nowrap text-xs text-slate-500">
            {change.before}
          </div>
        </div>
      </button>

      {open ? (
        <div className="px-[14px] pb-[14px]">
          <div className="mb-[6px] rounded-md border border-rose-200 bg-rose-50 px-3 py-[10px]">
            <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-rose-800">
              Before
            </div>
            <div className="text-[12.5px] leading-[1.65] text-rose-900">{change.before}</div>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-[10px]">
            <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.08em] text-emerald-800">
              After
            </div>
            <div className="text-[12.5px] leading-[1.65] text-emerald-900">{change.after}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TechLeadScoreCard({
  score,
  loading,
  error,
}: {
  score: TechLeadScore | null
  loading: boolean
  error: boolean
}) {
  const shadow =
    'shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]'

  if (loading) {
    return (
      <div
        className={`flex min-h-[152px] items-center justify-center rounded-[14px] border border-slate-200 bg-white px-5 py-4 ${shadow}`}
      >
        <div className="text-center">
          <div className="mx-auto mb-2 h-7 w-7 animate-spin rounded-full border-[2.5px] border-indigo-100 border-t-indigo-600" />
          <div className="text-xs text-slate-400">
            Scoring for tech lead readability...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex min-h-[152px] items-center justify-center rounded-[14px] border border-slate-200 bg-white px-5 py-4 ${shadow}`}
      >
        <div className="text-center text-xs text-slate-400">
          Tech lead review unavailable
        </div>
      </div>
    )
  }

  if (!score) return null

  const verdictStyle: Record<
    TechLeadScore['verdict'],
    { bg: string; text: string; border: string }
  > = {
    passes: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
    },
    'minor fixes': {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
    },
    'ai tells': {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
    },
    'rejection risk': {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      border: 'border-rose-200',
    },
  }
  const vs = verdictStyle[score.verdict]

  const totalColor =
    score.total >= 90
      ? 'text-emerald-600'
      : score.total >= 75
        ? 'text-amber-600'
        : score.total >= 50
          ? 'text-orange-600'
          : 'text-rose-600'

  const barColor =
    score.total >= 90
      ? 'bg-emerald-500'
      : score.total >= 75
        ? 'bg-amber-500'
        : score.total >= 50
          ? 'bg-orange-500'
          : 'bg-rose-500'

  // Synthesize positive checks from breakdown scores
  const positiveChecks: string[] = []
  if (score.breakdown.metricPreservation >= 25) {
    positiveChecks.push('All metrics preserved')
  }
  if (score.breakdown.openerUniqueness >= 25) {
    positiveChecks.push('No repeated openers')
  }
  if (score.breakdown.semanticAccuracy >= 20) {
    positiveChecks.push('Vocabulary mappings accurate')
  }
  if (score.breakdown.naturalVoice >= 20) {
    positiveChecks.push('Natural candidate voice')
  }

  return (
    <div
      className={`rounded-[14px] border border-slate-200 bg-white px-5 py-4 ${shadow}`}
    >
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>Tech Lead Score</span>
        <span
          className={`rounded-full border px-2 py-[2px] text-[11px] font-semibold ${vs.bg} ${vs.text} ${vs.border}`}
        >
          {score.verdict}
        </span>
      </div>

      <div className="mb-3 flex items-end gap-1">
        <span
          className={`text-[clamp(20px,3vw,28px)] font-extrabold leading-none tracking-[-1px] ${totalColor}`}
        >
          {score.total}
        </span>
        <span className="mb-[3px] text-xs text-slate-400">/ 100</span>
      </div>

      <div className="relative h-2 rounded-full bg-slate-100">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score.total}%` }}
        />
      </div>

      <div className="mt-3 space-y-[5px]">
        {score.flags.map((flag, i) => (
          <div
            key={`flag-${i}`}
            className="flex items-start gap-[6px] text-[11px] leading-[1.5] text-slate-600"
          >
            <span className="mt-px shrink-0 text-amber-500">⚠</span>
            <span>{flag}</span>
          </div>
        ))}
        {positiveChecks.map((check, i) => (
          <div
            key={`pass-${i}`}
            className="flex items-center gap-[6px] text-[11px] text-slate-500"
          >
            <span className="shrink-0 text-emerald-500">✓</span>
            <span>{check}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsPanel({
  beforeScore,
  afterScore,
  fixedKeywordCount,
  tailoredData,
  keywordFilter,
  onKeywordFilterChange,
  keywordItems,
  rewrittenBullets,
  pdfLoading,
  onDownload,
  techLeadScore,
  techLeadLoading,
  techLeadError,
}: {
  beforeScore: ATSScore | null
  afterScore: ATSScore | null
  fixedKeywordCount: number
  tailoredData: ResumeData | null
  keywordFilter: KeywordFilter
  onKeywordFilterChange: (filter: KeywordFilter) => void
  keywordItems: KeywordItem[]
  rewrittenBullets: RewrittenBullet[]
  pdfLoading: boolean
  onDownload: () => void
  techLeadScore: TechLeadScore | null
  techLeadLoading: boolean
  techLeadError: boolean
}) {
  const gainedKeywords = keywordItems.filter((item) => item.status === 'gained')
  const presentKeywords = keywordItems.filter((item) => item.status === 'present')
  const missingKeywords = keywordItems.filter((item) => item.status === 'missing')
  const filteredKeywordItems =
    keywordFilter === 'all'
      ? keywordItems
      : keywordItems.filter((item) => item.status === keywordFilter)

  const beforePercent = beforeScore?.score ?? null
  const afterPercent = afterScore?.score ?? null
  const gainedPercent =
    beforePercent !== null && afterPercent !== null
      ? afterPercent - beforePercent
      : null
  const totalKeywordCount =
    fixedKeywordCount > 0
      ? fixedKeywordCount
      : (afterScore?.matched_keywords.length ?? 0) +
        (afterScore?.missing_keywords.length ?? 0)
  const afterColor =
    afterPercent !== null && afterPercent >= 80
      ? 'text-emerald-600'
      : afterPercent !== null && afterPercent >= 60
        ? 'text-amber-600'
        : 'text-rose-600'

  return (
    <div className="animate-[fadeIn_.25s_ease-out] space-y-4">
      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-3">
        <MetricCard
          label="Before"
          value={formatPercent(beforePercent)}
          detail={
            beforeScore
              ? `${beforeScore.matched_keywords.length} / ${
                  beforeScore.matched_keywords.length +
                  beforeScore.missing_keywords.length
                } keywords`
              : 'Base score'
          }
          accent="text-slate-400"
        />
        <MetricCard
          label="After"
          value={formatPercent(afterPercent)}
          detail={
            afterScore
              ? `${afterScore.matched_keywords.length} / ${
                  afterScore.matched_keywords.length + afterScore.missing_keywords.length
                } keywords`
              : 'Optimized score'
          }
          accent={afterColor}
        />
        <MetricCard
          label="Gained"
          value={
            gainedPercent === null
              ? '—'
              : `${gainedPercent > 0 ? '+' : ''}${gainedPercent.toFixed(1)}%`
          }
          detail={`${gainedKeywords.length} new keywords`}
          accent="text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-[10px] lg:grid-cols-2">
        <div className="rounded-[14px] border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>ATS Keyword Coverage</span>
            <span className={`font-semibold ${afterColor}`}>
              {afterPercent !== null ? `${afterPercent.toFixed(1)}% matched` : '—'}
            </span>
          </div>
          <div className="relative mt-5 h-2 overflow-visible rounded-full bg-slate-100">
            <span className="absolute left-[80%] top-[-18px] -translate-x-1/2 whitespace-nowrap text-[9px] font-bold text-amber-600">
              Target 80%
            </span>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-slate-300 transition-all duration-700"
              style={{ width: `${Math.min(beforePercent ?? 0, 100)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-indigo-600 transition-all duration-700 delay-100"
              style={{ width: `${Math.min(afterPercent ?? 0, 100)}%` }}
            />
            <div className="absolute bottom-[-4px] top-[-4px] left-[80%] w-[2px] rounded-full bg-amber-500" />
          </div>
          <div className="mt-[6px] flex justify-between text-[10px] text-slate-400">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        <TechLeadScoreCard score={techLeadScore} loading={techLeadLoading} error={techLeadError} />
      </div>

      <button
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-emerald-600 px-4 py-3 text-[13px] font-bold text-white transition hover:-translate-y-px hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!tailoredData || pdfLoading}
        onClick={onDownload}
        type="button"
      >
        <IconDownload />
        {pdfLoading ? 'Generating PDF...' : 'Download Optimized Resume'}
        {!pdfLoading ? (
          <span className="font-medium text-emerald-100">
            · {rewrittenBullets.length} bullets rewritten
          </span>
        ) : null}
      </button>

      <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-[6px]">
          <span className="whitespace-nowrap text-[13px] font-bold text-slate-900">
            Keywords{' '}
            <span className="text-xs font-medium text-slate-400">({totalKeywordCount})</span>
          </span>
          <div className="flex flex-wrap gap-1">
            {([
              ['all', 'All'],
              ['gained', `+${gainedKeywords.length} gained`],
              ['present', `${presentKeywords.length} present`],
              ['missing', `${missingKeywords.length} missing`],
            ] as Array<[KeywordFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                className={`rounded-full border px-[11px] py-1 text-[11px] font-semibold transition ${
                  keywordFilter === value
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
                onClick={() => onKeywordFilterChange(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-[6px] flex flex-wrap gap-[10px] text-[11px] text-slate-500">
          <span>
            <span className="font-bold text-emerald-600">{afterScore?.matched_keywords.length ?? 0}</span>{' '}
            matched
          </span>
          <span>
            <span className="font-bold text-indigo-600">+{gainedKeywords.length}</span> gained
          </span>
          <span>
            <span className="font-bold text-slate-600">{presentKeywords.length}</span> already present
          </span>
          {missingKeywords.length > 0 ? (
            <span>
              <span className="font-bold text-rose-600">{missingKeywords.length}</span> missing
            </span>
          ) : null}
        </div>

        <div className="mt-[10px] flex flex-wrap">
          {filteredKeywordItems.length > 0 ? (
            filteredKeywordItems.map((item) => (
              <KeywordBadge key={`${item.status}-${item.keyword}`} item={item} />
            ))
          ) : (
            <div className="py-1 text-xs text-slate-400">No keywords in this filter</div>
          )}
        </div>
      </div>

      {rewrittenBullets.length > 0 ? (
        <div>
          <div className="mb-[10px] flex items-center justify-between gap-[6px]">
            <span className="text-[13px] font-bold text-slate-900">Rewritten Bullets</span>
            <span className="text-xs font-medium text-slate-500">
              {rewrittenBullets.length} {rewrittenBullets.length === 1 ? 'change' : 'changes'}
            </span>
          </div>
          {rewrittenBullets.map((change, index) => (
            <ChangeCard change={change} index={index} key={change.id} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LoadingPanel({ stepIdx, retrying }: { stepIdx: number; retrying: boolean }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white px-8 py-12 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
      <div className="mx-auto mb-5 h-11 w-11 animate-spin rounded-full border-[3px] border-indigo-100 border-t-indigo-600" />
      <div className="mb-[6px] text-sm font-bold text-slate-900">
        {retrying ? 'Refining output...' : 'Optimizing Your Resume'}
      </div>
      <div className="min-h-10 text-[13px] leading-6 text-slate-500">
        {retrying ? 'Applying a second pass to ensure quality — almost done.' : LOADING_STEPS[stepIdx]}
      </div>
      <div className="mt-3 text-[11px] text-slate-400">This takes about 30-60 seconds</div>
      <div className="mt-5 flex justify-center gap-[5px]">
        {LOADING_STEPS.map((_, index) => (
          <div
            key={index}
            className={`h-[6px] w-[6px] rounded-full ${
              index === stepIdx ? 'bg-indigo-600' : 'bg-indigo-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function extractCompanyFromJd(jd: string): string {
  const lines = jd.split('\n').map((l) => l.trim()).filter(Boolean)

  // Known location tokens to reject as company names
  const isLocation = (s: string) =>
    /^(united states|washington|new york|san francisco|california|texas|seattle|redmond|remote|hybrid|on.?site)/i.test(s)

  // Pattern 1: sentence-initial "At [Company]," — covers overview paragraphs like
  // "At Bing Places, we build..." or "At Google, our mission..."
  const atSentence = /\bAt\s+([A-Z][A-Za-z0-9 &.,']+?)(?:\s*,|\s*\.|\s+we\b|\s+you\b|\s+our\b|\s+is\b)/g
  let m: RegExpExecArray | null
  while ((m = atSentence.exec(jd)) !== null) {
    const candidate = m[1].trim()
    if (candidate.split(' ').length <= 4 && candidate.length > 2 && !isLocation(candidate)) {
      return candidate
    }
  }

  // Pattern 2: "Role at Company" or "Role at Company, Location" in first 8 lines
  for (const line of lines.slice(0, 8)) {
    const inLine = line.match(/\bat\s+([A-Z][^,–\-|\n]{1,40})/i)
    if (inLine) {
      const candidate = inLine[1].trim()
      if (!isLocation(candidate)) return candidate
    }
  }

  // Pattern 3: explicit label — "Company: Name" / "About [Company]:"
  for (const line of lines.slice(0, 30)) {
    const label = line.match(/^(?:company|organization|employer)\s*[:\-]\s*(.+)/i)
    if (label) return label[1].trim()
    const about = line.match(/^About\s+([A-Z][A-Za-z0-9 &.,']{1,40})(?:\s*$|:)/)
    if (about && !isLocation(about[1])) return about[1].trim()
  }

  // Pattern 4: first short standalone line that is not a job title or location
  const skipWords = /^(senior|junior|staff|lead|principal|software|engineer|manager|director|head|vp|about|we |our |job|position|role|requirements|responsibilities|overview|apply|add to|matched|united|washington|remote)/i
  for (const line of lines.slice(0, 6)) {
    if (line.length <= 40 && /^[A-Z]/.test(line) && !skipWords.test(line) && !isLocation(line)) {
      return line
    }
  }

  return ''
}

export default function HomePage() {
  const {
    jobDescription,
    handleJobDescriptionChange,
    handleGenerate,
    loading,
    retrying,
    stepIdx,
    error,
    tailoredData,
    fixedKeywords,
    beforeScore,
    afterScore,
    techLeadScore,
    techLeadLoading,
    techLeadError,
    keywordFilter,
    setKeywordFilter,
    keywordItems,
    rewrittenBullets,
  } = useTailor()

  const { downloadPdf, loading: pdfLoading } = useDownloadPdf()

  const hasResults = afterScore !== null
  const errorLines = (error ?? '').split('\n').filter(Boolean)

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <nav className="sticky top-0 z-50 flex h-14 items-center border-b border-slate-200 bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)] md:px-6">
        <div className="flex items-center gap-[10px]">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[15px] font-extrabold text-white">
            R
          </div>
          <span className="text-[15px] font-bold tracking-[-0.2px] text-slate-900">
            ResumeForge
          </span>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-[7px] py-[2px] text-[10px] font-semibold tracking-[0.2px] text-indigo-600">
            ATS Optimizer
          </span>
        </div>
      </nav>

      <div className="w-full p-4 md:p-5">
        <div className="grid w-full items-start gap-5 lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-[72px]">
            <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
              <div className="text-sm font-bold text-slate-900">Job Description</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Paste text to tailor and score your resume
              </div>

              <div className="my-[14px] flex rounded-[10px] border border-slate-200 bg-[#f7f8fa] p-[3px]">
                <button
                  className="flex-1 rounded-[7px] bg-white px-3 py-[7px] text-[13px] font-semibold text-indigo-600 shadow-sm"
                  type="button"
                >
                  Paste Text
                </button>
                <button
                  className="flex-1 rounded-[7px] bg-transparent px-3 py-[7px] text-[13px] font-semibold text-slate-400"
                  disabled
                  type="button"
                >
                  URL
                </button>
              </div>

              <textarea
                className="min-h-[360px] w-full resize-y rounded-[10px] border-[1.5px] border-slate-200 bg-[#f7f8fa] px-3 py-[10px] text-[13px] leading-[1.65] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:bg-white focus:shadow-[0_0_0_3px_rgba(79,70,229,0.1)]"
                onChange={(event) => handleJobDescriptionChange(event.target.value)}
                placeholder={
                  'Paste the full job description here...\n\nSoftware Engineer\n\nQualifications:\n• Experience with microservices...\n• Proficiency in TypeScript / Python...'
                }
                value={jobDescription}
              />

              {error ? (
                <div className="mt-3 rounded-[10px] border border-rose-300 bg-rose-50 px-[14px] py-3 text-[13px] text-rose-600">
                  <div className="mb-1 flex items-center gap-[6px] font-bold">
                    <IconAlert />
                    {errorLines[0]}
                  </div>
                  {errorLines.length > 1 ? (
                    <div className="whitespace-pre-wrap text-xs text-rose-900">
                      {errorLines.slice(1).join('\n').trim()}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <button
                className="mt-[14px] w-full rounded-[10px] bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-px hover:opacity-95 disabled:cursor-not-allowed disabled:bg-indigo-300"
                disabled={loading || !jobDescription.trim()}
                onClick={handleGenerate}
                type="button"
              >
                <span className="flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-[2.5px] border-white/40 border-t-white" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <IconSparkle />
                      Generate Optimized Resume
                    </>
                  )}
                </span>
              </button>

              <div className="mt-4 rounded-[10px] border border-indigo-200 bg-indigo-50 p-[14px]">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-indigo-600">
                  How it works
                </div>
                {[
                  'Scores your current resume against the job description first.',
                  'Tailors bullets only where the source resume supports stronger alignment.',
                  'Measures keyword gains after optimization.',
                  'Exports the tailored resume as a downloadable PDF.',
                ].map((step, index) => (
                  <div
                    className="mb-[5px] flex items-start gap-2 text-xs leading-[1.5] text-indigo-900 last:mb-0"
                    key={step}
                  >
                    <span className="mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 overflow-hidden">
            {!hasResults && !loading ? (
              <div className="rounded-[14px] border border-slate-200 bg-white px-8 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[26px]">
                  <IconTarget />
                </div>
                <div className="mb-2 text-[15px] font-bold text-slate-900">Ready to optimize</div>
                <div className="text-[13px] leading-[1.75] text-slate-500">
                  Paste a job description and click Generate.
                  <br />
                  ResumeForge will tailor your resume and highlight the exact keyword gains.
                </div>
              </div>
            ) : null}

            {loading ? <LoadingPanel stepIdx={stepIdx} retrying={retrying} /> : null}

            {hasResults ? (
              <ResultsPanel
                afterScore={afterScore}
                beforeScore={beforeScore}
                fixedKeywordCount={fixedKeywords.length}
                keywordFilter={keywordFilter}
                keywordItems={keywordItems}
                techLeadScore={techLeadScore}
                techLeadLoading={techLeadLoading}
                techLeadError={techLeadError}
                onDownload={() => {
                  if (tailoredData) {
                    const sanitize = (s: string) =>
                      s.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
                    const namePart = sanitize(tailoredData.contact.name)
                    const companyPart = sanitize(extractCompanyFromJd(jobDescription))
                    const filename = companyPart
                      ? `${namePart}_${companyPart}.pdf`
                      : `${namePart}_Resume.pdf`
                    downloadPdf(tailoredData, filename)
                  }
                }}
                onKeywordFilterChange={setKeywordFilter}
                pdfLoading={pdfLoading}
                rewrittenBullets={rewrittenBullets}
                tailoredData={tailoredData}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

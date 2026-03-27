'use client'

import { useState } from 'react'
import { ResumeData, ATSScore } from '@/lib/types'
import { useDownloadPdf } from '@/lib/useDownloadPdf'
import ResumeTemplate from '@/components/ResumeTemplate'
import ScoreCard from '@/components/ScoreCard'
import { resumeToText } from '@/lib/resumeToText'

export default function HomePage() {
  const [jobDescription, setJobDescription] = useState('')
  const [tailoredData, setTailoredData] = useState<ResumeData | null>(null)
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null)
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { downloadPdf, loading: pdfLoading } = useDownloadPdf()

  async function handleGenerate() {
    setError(null)
    setTailoredData(null)
    setAtsScore(null)

    try {
      setLoadingMessage('Tailoring resume...')
      const tailorRes = await fetch('/api/tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription }),
      })
      if (!tailorRes.ok) throw new Error(await tailorRes.text())
      const { data } = await tailorRes.json()
      setTailoredData(data)

      setLoadingMessage('Scoring against JD...')
      const text = resumeToText(data)
      const scoreRes = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text, jobDescription }),
      })
      if (!scoreRes.ok) throw new Error(await scoreRes.text())
      const { score } = await scoreRes.json()
      setAtsScore(score)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoadingMessage(null)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 border-b 
        border-gray-200 bg-white shrink-0" style={{ height: '52px' }}>
        <span className="font-semibold text-gray-900">ResumeForge</span>
        <button
          onClick={() => tailoredData && downloadPdf(tailoredData)}
          disabled={!tailoredData || pdfLoading}
          className="px-4 py-1.5 text-sm font-medium rounded-md bg-gray-900 
            text-white hover:bg-gray-700 disabled:bg-gray-300 
            disabled:cursor-not-allowed transition-colors"
        >
          {pdfLoading ? 'Generating PDF...' : 'Download PDF'}
        </button>
      </header>

      {/* TWO PANELS */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL */}
        <div className="flex flex-col w-1/2 p-6 border-r border-gray-200">
          <label className="text-sm font-medium text-gray-700 mb-1">
            Job Description
          </label>
          <p className="text-xs text-gray-400 mb-3">
            Paste a job description to tailor your resume
          </p>
          <textarea
            className="flex-1 w-full resize-none border border-gray-200 
              rounded-lg p-3 text-sm text-gray-800 
              focus:outline-none focus:ring-1 focus:ring-gray-400"
            placeholder="Paste job description here..."
            value={jobDescription}
            onChange={(e) => {
              setJobDescription(e.target.value)
              setTailoredData(null)
              setAtsScore(null)
              setError(null)
            }}
          />
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
          <button
            onClick={handleGenerate}
            disabled={!jobDescription.trim() || loadingMessage !== null}
            className="mt-3 w-full h-10 bg-gray-900 text-white text-sm 
              font-medium rounded-lg hover:bg-gray-700 
              disabled:bg-gray-300 disabled:cursor-not-allowed 
              transition-colors"
          >
            {loadingMessage ?? 'Generate Tailored Resume'}
          </button>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-col w-1/2 overflow-y-auto">
          {tailoredData === null ? (
            <div className="flex flex-col items-center justify-center 
              flex-1 gap-3">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="4" width="32" height="40" rx="3"
                  stroke="#D1D5DB" strokeWidth="2"/>
                <line x1="14" y1="14" x2="34" y2="14"
                  stroke="#D1D5DB" strokeWidth="2"/>
                <line x1="14" y1="20" x2="34" y2="20"
                  stroke="#D1D5DB" strokeWidth="2"/>
                <line x1="14" y1="26" x2="28" y2="26"
                  stroke="#D1D5DB" strokeWidth="2"/>
              </svg>
              <p className="text-sm text-gray-400">
                Your tailored resume will appear here
              </p>
            </div>
          ) : (
            <div className="px-6 py-6">
              {atsScore && <ScoreCard score={atsScore} />}
              <ResumeTemplate data={tailoredData} />
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

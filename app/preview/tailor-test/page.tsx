"use client";

import { useState } from "react";

import { ResumeTemplate } from "@/components/ResumeTemplate";
import { ScoreCard } from "@/components/ScoreCard";
import { resumeToText } from "@/lib/engine/resumeToText";
import type { ATSScore, ResumeData } from "@/lib/types";
import { useDownloadPdf } from "@/lib/useDownloadPdf";

export default function TailorTestPage() {
  const [jobDescription, setJobDescription] = useState("");
  const [tailoredData, setTailoredData] = useState<ResumeData | null>(null);
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null);
  const [error, setError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const { downloadPdf, loading: pdfLoading } = useDownloadPdf();

  async function handleTailor() {
    setLoadingMessage("Tailoring resume...");
    setError("");
    setTailoredData(null);
    setAtsScore(null);

    try {
      const keywordResponse = await fetch("/api/extract-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription }),
      });

      if (!keywordResponse.ok) {
        throw new Error(await keywordResponse.text());
      }

      const { keywords } = (await keywordResponse.json()) as {
        keywords: string[];
      };

      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, keywords }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const { data } = (await response.json()) as { data: ResumeData };
      setTailoredData(data);

      setLoadingMessage("Scoring against JD...");

      const resumeText = resumeToText(data);
      const scoreResponse = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, keywords }),
      });

      if (!scoreResponse.ok) {
        throw new Error(await scoreResponse.text());
      }

      const { score } = (await scoreResponse.json()) as { score: ATSScore };
      setAtsScore(score);
    } catch (err) {
      setTailoredData(null);
      setAtsScore(null);
      setError(err instanceof Error ? err.message : "Tailoring failed");
    } finally {
      setLoadingMessage("");
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-10 border-b bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <textarea
            value={jobDescription}
            onChange={(event) => {
              setJobDescription(event.target.value);
              setTailoredData(null);
              setAtsScore(null);
              setError("");
              setLoadingMessage("");
            }}
            placeholder="Paste a job description here to test the tailor API..."
            className="min-h-36 w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTailor}
              disabled={Boolean(loadingMessage)}
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMessage || "Tailor Resume"}
            </button>
            {tailoredData ? (
              <button
                type="button"
                onClick={() => downloadPdf(tailoredData)}
                disabled={pdfLoading}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pdfLoading ? "Generating..." : "Download PDF"}
              </button>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </div>
      </div>
      <div className="pt-64">
        {atsScore ? <ScoreCard score={atsScore} /> : null}
        {tailoredData ? <ResumeTemplate data={tailoredData} /> : null}
      </div>
    </>
  );
}

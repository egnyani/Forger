"use client";

import { ResumeTemplate } from "@/components/ResumeTemplate";
import resume from "@/lib/resume.json";
import type { ResumeData } from "@/lib/types";
import { useDownloadPdf } from "@/lib/useDownloadPdf";

export default function PreviewPage() {
  const { downloadPdf, loading } = useDownloadPdf();
  const resumeData = resume as ResumeData;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-10 border-b bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => downloadPdf(resumeData)}
          disabled={loading}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Generating..." : "Download PDF"}
        </button>
      </div>
      <div className="pt-16">
        <ResumeTemplate data={resumeData} />
      </div>
    </>
  );
}

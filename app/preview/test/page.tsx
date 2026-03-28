"use client";

import { ResumeTemplate } from "@/components/ResumeTemplate";
import resume from "@/lib/engine/resume.json";
import type { ResumeData } from "@/lib/types";
import { useDownloadPdf } from "@/lib/useDownloadPdf";

function buildModifiedResumeData(): ResumeData {
  const baseData = resume as ResumeData;

  return {
    ...baseData,
    contact: {
      ...baseData.contact,
      name: `${baseData.contact.name} [LAYER 4 TEST]`,
    },
    experience: baseData.experience.map((role, roleIndex) => ({
      ...role,
      bullets: role.bullets.map((bullet, bulletIndex) =>
        roleIndex === 0 && bulletIndex === 0
          ? "LAYER 4 TEST BULLET — dynamic data is flowing correctly through the pipeline."
          : bullet,
      ),
    })),
    education: baseData.education.map((entry) => ({ ...entry })),
    skills: {
      ...baseData.skills,
      "Test Category": ["dynamic", "data", "working"],
    },
    projects: baseData.projects.map((project) => ({
      ...project,
      bullets: [...project.bullets],
      tags: [...project.tags],
    })),
  };
}

export default function TestPreviewPage() {
  const { downloadPdf, loading } = useDownloadPdf();
  const modifiedData = buildModifiedResumeData();

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-10 border-b bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => downloadPdf(modifiedData)}
          disabled={loading}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Generating..." : "Download PDF"}
        </button>
      </div>
      <div className="pt-16">
        <ResumeTemplate data={modifiedData} />
      </div>
    </>
  );
}

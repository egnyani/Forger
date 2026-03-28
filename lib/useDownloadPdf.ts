"use client";

import { useState } from "react";

import type { ResumeData } from "@/lib/types";

export function useDownloadPdf() {
  const [loading, setLoading] = useState(false);

  async function downloadPdf(data: ResumeData, filename = "resume.pdf") {
    setLoading(true);
    try {
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("PDF export failed. Check the console.");
    } finally {
      setLoading(false);
    }
  }

  return { downloadPdf, loading };
}

import { existsSync } from "node:fs";

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

import { renderResumeHtml } from "@/lib/renderResumeHtml";
import { PDF_CONFIG } from "@/lib/resumeLayout";
import type { ResumeData } from "@/lib/types";

export const runtime = "nodejs";

async function launchBrowser() {
  const chromiumForPuppeteer = Object.assign(chromium, {
    defaultViewport: null,
    headless: "shell" as const,
  }) as typeof chromium & {
    defaultViewport: null;
    headless: "shell";
  };

  try {
    return await puppeteer.launch({
      args: chromiumForPuppeteer.args,
      defaultViewport: chromiumForPuppeteer.defaultViewport,
      executablePath: await chromiumForPuppeteer.executablePath(),
      headless: chromiumForPuppeteer.headless,
    });
  } catch (error) {
    if (
      process.platform !== "darwin" ||
      !(error instanceof Error) ||
      !error.message.includes("ENOEXEC")
    ) {
      throw error;
    }

    const localChromePath = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ].find((path) => existsSync(path));

    if (!localChromePath) {
      throw error;
    }

    return puppeteer.launch({
      executablePath: localChromePath,
      headless: true,
      args: ["--no-sandbox"],
    });
  }
}

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    const { data } = (await request.json()) as { data: ResumeData };
    const html = renderResumeHtml(data);
    browser = await launchBrowser();

    const page = await browser.newPage();

    // Set viewport to match the PDF width (8.5in @ 96dpi = 816px) so content
    // wraps identically during measurement and during PDF rendering.
    await page.setViewport({ width: 816, height: 600 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Use getBoundingClientRect().height on the page container rather than
    // scrollHeight. getBoundingClientRect() returns the full rendered height of
    // the element including ALL CSS padding (top + content + bottom), which is
    // exactly what we need. scrollHeight has known Chrome behaviour where it can
    // exclude the bottom padding of the outermost container.
    //
    // pdfHeight = container.getBoundingClientRect().height
    //           = PAGE_PADDING (top) + content + PAGE_PADDING (bottom)  ✓
    const pdfHeight = await page.evaluate(() => {
      const container = document.body.firstElementChild as HTMLElement | null;
      if (!container) return document.body.scrollHeight;
      return Math.ceil(container.getBoundingClientRect().height);
    });

    const pdf = await page.pdf({
      width: PDF_CONFIG.width,
      height: `${pdfHeight}px`,
      printBackground: PDF_CONFIG.printBackground,
      margin: PDF_CONFIG.margin,
    });

    await browser.close();
    browser = null;

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });
  } catch (error: unknown) {
    if (browser) {
      await browser.close();
    }

    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

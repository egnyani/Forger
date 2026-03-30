import { runTailoringPipeline } from "@/lib/engine/tailoringPipeline";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      jobDescription?: string;
      keywords?: string[];
    };
    const jobDescription = body.jobDescription?.trim();
    const fixedKeywordList = body.keywords?.filter(
      (k): k is string => typeof k === "string" && k.trim().length > 0,
    );

    if (!jobDescription) {
      return new Response(JSON.stringify({ error: "jobDescription is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!fixedKeywordList || fixedKeywordList.length === 0) {
      return new Response(JSON.stringify({ error: "keywords are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await runTailoringPipeline({
      jobDescription,
      keywords: fixedKeywordList,
    });

    // Strip the internal `ok` discriminant before sending — callers never see it.
    // JSON.stringify replacer signature: (key: string, value: unknown) => unknown
    const omitOk = (k: string, v: unknown) => (k === "ok" ? undefined : v);

    if (!result.ok) {
      return new Response(JSON.stringify(result, omitOk), {
        status: result.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result, omitOk), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

import type { ResumeData } from "@/lib/types";

export type DeterministicScoreResult = {
  openerScore: number;
  metricScore: number;
  flags: string[];
};

// ─── Dimension 1 + 3: deterministic checks (no LLM needed) ───────────────────

export function scoreDeterministic(
  original: ResumeData,
  tailored: ResumeData,
): DeterministicScoreResult {
  const flags: string[] = [];

  // ── Opener uniqueness — track first 5 words of each bullet ──────────────
  const tailoredBulletsList = tailored.experience.flatMap(
    (r) => r.bullets as string[],
  );
  const openers = tailoredBulletsList.map((b) =>
    b.split(" ").slice(0, 5).join(" ").toLowerCase(),
  );

  const openerCounts = new Map<string, number>();
  openers.forEach((o) =>
    openerCounts.set(o, (openerCounts.get(o) ?? 0) + 1),
  );

  let openerDeductions = 0;
  openerCounts.forEach((count, opener) => {
    if (count > 1) {
      openerDeductions += (count - 1) * 5;
      flags.push(`Repeated opener (×${count}): "${opener}..."`);
    }
  });

  // ── Metric preservation — extract numbers with units from original ───────
  const extractMetrics = (text: string) =>
    text.match(
      /\d+(?:\.\d+)?(?:%|K\+|k\+|\+| minutes?| seconds?| ms| hours?)/g,
    ) ?? [];

  const originalBullets = original.experience.flatMap(
    (r) => r.bullets as string[],
  );
  const tailoredBullets = tailored.experience.flatMap(
    (r) => r.bullets as string[],
  );

  let metricDeductions = 0;
  originalBullets.forEach((orig, i) => {
    const tailoredBullet = tailoredBullets[i];
    if (!tailoredBullet) return;
    const origMetrics = extractMetrics(orig);
    origMetrics.forEach((metric) => {
      if (!tailoredBullet.includes(metric)) {
        metricDeductions += 8;
        flags.push(
          `Dropped metric "${metric}" from: "${orig.slice(0, 60)}${orig.length > 60 ? "..." : ""}"`,
        );
      }
    });
  });

  return {
    openerScore: Math.max(0, 25 - openerDeductions),
    metricScore: Math.max(0, 25 - metricDeductions),
    flags,
  };
}

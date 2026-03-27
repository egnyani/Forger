import type { ResumeData } from "@/lib/types";

const MUST_SURFACE_TERMS = [
  "reactjs",
  "react",
  "javascript",
  "typescript",
  "node.js",
  "aws",
  "serverless",
  "cloud-native",
  "ci/cd",
  "devops",
  "agile",
  "scrum",
  "web-based software applications",
  "production systems",
  "scalable",
  "secure",
  "reliable",
];

const GOOD_TO_SURFACE_TERMS = [
  "code reviews",
  "peer reviews",
  "maintainability",
  "testability",
  "documentation",
  "clean code",
  "responsive user interfaces",
  "application logic",
  "troubleshooting",
  "collaboration",
  "continuous learning",
  "experimentation",
  "platform",
  "quality",
];

const DO_NOT_FORCE_TERMS = [
  "college board",
  "assessment",
  "education programs",
  "millions of students",
  "institutions",
  "mission-driven",
  "public responsibility",
  "travel",
  "reston",
  "nyc",
  "authorization to work",
  "learner needs",
];

const ALIASES: Record<string, string[]> = {
  react: ["react", "reactjs", "react.js"],
  reactjs: ["react", "reactjs", "react.js"],
  "node.js": ["node.js", "node"],
  aws: ["aws", "amazon web services"],
  "ci/cd": ["ci/cd", "continuous integration", "continuous delivery"],
  agile: ["agile", "scrum", "agile/scrum"],
  devops: ["devops", "ci/cd", "release validation"],
  "cloud-native": ["cloud-native", "cloud native"],
  secure: ["secure", "security", "iam", "audit logging"],
  scalable: ["scalable", "scale", "scaling", "latency-sensitive"],
  reliable: ["reliable", "reliability", "uptime", "observability", "monitoring"],
  collaboration: ["collaboration", "cross-functional", "team", "feedback"],
  "continuous learning": ["continuous learning", "learning", "feedback", "iterative"],
  experimentation: ["experimentation", "experiment", "testing assumptions", "iterate"],
  "responsive user interfaces": ["responsive user interfaces", "react", "frontend"],
  "application logic": ["application logic", "backend", "api"],
  "web-based software applications": ["web-based software applications", "react", "node.js", "fastapi"],
  platform: ["platform", "platforms", "shared capabilities", "services"],
  quality: ["quality", "reliability", "testing"],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#/. -]/g, "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });

  return result;
}

function buildSourceTerms(data: ResumeData): string[] {
  return unique([
    ...Object.values(data.skills).flat(),
    ...data.summary,
    ...data.experience.flatMap((role) => role.bullets),
    ...data.projects.flatMap((project) => [project.name, ...project.tags, ...project.bullets]),
  ]).flatMap((term) => {
    const normalized = normalize(term);
    return [normalized, ...(ALIASES[normalized] ?? []).map(normalize)];
  });
}

function jdIncludes(jd: string, term: string): boolean {
  const normalizedJd = normalize(jd);
  const normalizedTerm = normalize(term);
  return normalizedJd.includes(normalizedTerm);
}

function sourceSupports(term: string, sourceTerms: string[]): boolean {
  const normalizedTerm = normalize(term);
  const aliases = [normalizedTerm, ...(ALIASES[normalizedTerm] ?? []).map(normalize)];
  return aliases.some((alias) =>
    sourceTerms.some(
      (sourceTerm) =>
        sourceTerm === alias ||
        sourceTerm.includes(alias) ||
        alias.includes(sourceTerm),
    ),
  );
}

function collectTerms(jd: string, sourceData: ResumeData, terms: string[]): {
  supported: string[];
  unsupported: string[];
} {
  const sourceTerms = buildSourceTerms(sourceData);
  const supported: string[] = [];
  const unsupported: string[] = [];

  terms.forEach((term) => {
    if (!jdIncludes(jd, term)) return;
    if (sourceSupports(term, sourceTerms)) {
      supported.push(term);
    } else {
      unsupported.push(term);
    }
  });

  return {
    supported: unique(supported),
    unsupported: unique(unsupported),
  };
}

export interface JobDescriptionSignals {
  must_surface_if_supported: string[];
  good_to_surface_if_supported: string[];
  do_not_force: string[];
}

export function extractJobDescriptionSignals(
  jobDescription: string,
  sourceData: ResumeData,
): JobDescriptionSignals {
  const must = collectTerms(jobDescription, sourceData, MUST_SURFACE_TERMS);
  const good = collectTerms(jobDescription, sourceData, GOOD_TO_SURFACE_TERMS);
  const doNotForce = collectTerms(jobDescription, sourceData, DO_NOT_FORCE_TERMS);

  return {
    must_surface_if_supported: must.supported,
    good_to_surface_if_supported: good.supported,
    do_not_force: unique([
      ...must.unsupported,
      ...good.unsupported,
      ...doNotForce.supported,
      ...doNotForce.unsupported,
    ]),
  };
}

import path from "node:path";
import { existsSync } from "node:fs";

import mammoth from "mammoth";

import resumeJson from "@/lib/resume.json";
import { resumeToText } from "@/lib/resumeToText";
import type { Experience, Project, ResumeData } from "@/lib/types";

const SOURCE_RESUME_DOCX_CANDIDATES = [
  process.env.SOURCE_RESUME_DOCX_PATH,
  path.join(process.cwd(), "data", "source-resume.docx"),
  path.join(process.env.HOME ?? "", "Downloads", "Gnyani_resume_updated.docx"),
].filter((value): value is string => Boolean(value));

const EXTRA_SIGNAL_TERMS = [
  "React",
  "React.js",
  "ReactJS",
  "Material UI",
  "Recharts",
  "Node.js",
  "Express",
  "Express.js",
  "Flask",
  "Django",
  "Django REST Framework",
  "Python",
  "TypeScript",
  "JavaScript",
  "AWS Lambda",
  "AWS SQS",
  "AWS ECS",
  "API Gateway",
  "CloudWatch",
  "IAM",
  "GitHub Actions",
  "Docker",
  "PostgreSQL",
  "DynamoDB",
  "MongoDB",
  "Redis",
  "SQL",
  "LLM APIs",
  "LangChain",
  "RAG",
  "embeddings",
  "vector search",
  "Text Embeddings",
  "Retrieval-Augmented Generation",
  "GraphQL",
  "REST APIs",
  "WebSockets",
  "CI/CD",
  "cloud deployment",
  "serverless",
  "monitoring",
  "data modeling",
  "compliance workflows",
  "audit logging",
  "real-time",
  "classification",
  "PyTorch",
  "NumPy",
  "Pandas",
  "Java",
  "C#",
  "Apache Kafka",
  "Maven",
  "Redux",
  "Next.js",
  "Webpack",
  "MySQL",
  "NoSQL",
  "ETL",
  "Jenkins",
  "Jira",
  "Agile",
  "Scrum",
  "Unit Testing",
  "Integration Testing",
  "API Testing",
  "End-to-End Testing",
];

const METRIC_PATTERNS = [
  "response times under 300 ms",
  "30 minutes to under 10 minutes",
  "40%",
  "25%",
  "millions of records",
  "32%",
  "18%",
  "100K+ monthly transactions",
  "99.95% uptime",
  "45 minutes to 7 minutes",
  "5,000+ client labor hours",
  "15+ countries",
  "42%",
  "68% to 99.6%",
];

const DOMAIN_TAG_RULES: Array<{ tag: string; terms: string[] }> = [
  {
    tag: "AI / ML",
    terms: [
      "AI",
      "LLM",
      "LLM APIs",
      "LangChain",
      "RAG",
      "embeddings",
      "vector search",
      "Text Embeddings",
      "Retrieval-Augmented Generation",
      "classification",
      "GenAI",
      "PyTorch",
    ],
  },
  {
    tag: "Backend",
    terms: [
      "Python",
      "Django",
      "Flask",
      "Node.js",
      "Express",
      "Express.js",
      "SQL",
      "PostgreSQL",
      "DynamoDB",
      "Redis",
      "GraphQL",
      "REST APIs",
      "WebSockets",
      "API design",
      "data modeling",
    ],
  },
  {
    tag: "Frontend",
    terms: [
      "React",
      "React.js",
      "ReactJS",
      "Material UI",
      "Recharts",
      "Next.js",
      "JavaScript",
      "TypeScript",
      "HTML",
      "CSS",
      "Redux",
    ],
  },
  {
    tag: "Cloud / DevOps",
    terms: [
      "AWS",
      "Docker",
      "CI/CD",
      "GitHub Actions",
      "Jenkins",
      "CloudWatch",
      "IAM",
      "API Gateway",
      "ECS",
      "Lambda",
      "SQS",
      "serverless",
      "cloud deployment",
    ],
  },
  {
    tag: "Reliability / Operations",
    terms: ["reliability", "uptime", "monitoring", "audit logging", "safety fallbacks", "confidence checks"],
  },
  {
    tag: "Data / Analytics",
    terms: ["analytics", "data modeling", "retrieval", "compliance workflows", "reporting", "dashboards"],
  },
];

export interface BulletEvidence {
  text: string;
  technologies: string[];
  metrics: string[];
  domainTags: string[];
}

export interface RoleEvidence {
  id: string;
  company: string;
  title: string;
  technologies: string[];
  metrics: string[];
  domainTags: string[];
  bullets: BulletEvidence[];
}

export interface ProjectEvidence {
  id: string;
  name: string;
  technologies: string[];
  metrics: string[];
  domainTags: string[];
  bullets: BulletEvidence[];
}

export interface SourceResumeContext {
  sourceData: ResumeData;
  sourceText: string;
  sourcePath: string | null;
  evidenceModel: {
    supportedSkills: string[];
    supportedTechnologies: string[];
    roleEvidence: RoleEvidence[];
    projectEvidence: ProjectEvidence[];
  };
}

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

function flattenSkills(data: ResumeData): string[] {
  return unique(Object.values(data.skills).flat());
}

function buildSourceTermCatalog(data: ResumeData): string[] {
  return unique([
    ...flattenSkills(data),
    ...data.projects.flatMap((project) => [project.name, ...project.tags]),
    ...EXTRA_SIGNAL_TERMS,
  ]);
}

function extractTechnologies(text: string, catalog: string[]): string[] {
  const lower = normalize(text);

  return catalog.filter((term) => {
    const normalized = normalize(term);
    if (!normalized) return false;
    if (normalized.includes(" ")) return lower.includes(normalized);
    return new RegExp(`(^|[^a-z0-9+#/])${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9+#/])`, "i").test(lower);
  });
}

function extractMetrics(text: string): string[] {
  const normalizedText = normalize(text);
  return METRIC_PATTERNS.filter((metric) => normalizedText.includes(normalize(metric)));
}

function extractDomainTags(text: string): string[] {
  const normalizedText = normalize(text);

  return DOMAIN_TAG_RULES.filter((rule) =>
    rule.terms.some((term) => normalizedText.includes(normalize(term))),
  ).map((rule) => rule.tag);
}

function buildBulletEvidence(text: string, catalog: string[]): BulletEvidence {
  return {
    text,
    technologies: extractTechnologies(text, catalog),
    metrics: extractMetrics(text),
    domainTags: extractDomainTags(text),
  };
}

function buildRoleEvidence(role: Experience, catalog: string[]): RoleEvidence {
  const bullets = role.bullets.map((bullet) => buildBulletEvidence(bullet, catalog));

  return {
    id: role.id,
    company: role.company,
    title: role.title,
    technologies: unique(bullets.flatMap((bullet) => bullet.technologies)),
    metrics: unique(bullets.flatMap((bullet) => bullet.metrics)),
    domainTags: unique(bullets.flatMap((bullet) => bullet.domainTags)),
    bullets,
  };
}

function buildProjectEvidence(project: Project, catalog: string[]): ProjectEvidence {
  const bullets = project.bullets.map((bullet) => buildBulletEvidence(bullet, catalog));

  return {
    id: project.id,
    name: project.name,
    technologies: unique([
      ...project.tags,
      ...bullets.flatMap((bullet) => bullet.technologies),
    ]),
    metrics: unique(bullets.flatMap((bullet) => bullet.metrics)),
    domainTags: unique(bullets.flatMap((bullet) => bullet.domainTags)),
    bullets,
  };
}

function resolveSourceResumePath(): string | null {
  return SOURCE_RESUME_DOCX_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

async function loadDocxText(docxPath: string | null, sourceData: ResumeData): Promise<{
  sourcePath: string | null;
  sourceText: string;
}> {
  if (!docxPath) {
    return {
      sourcePath: null,
      sourceText: resumeToText(sourceData),
    };
  }

  try {
    const result = await mammoth.extractRawText({ path: docxPath });

    return {
      sourcePath: docxPath,
      sourceText: result.value.trim(),
    };
  } catch {
    return {
      sourcePath: null,
      sourceText: resumeToText(sourceData),
    };
  }
}

export async function loadSourceResumeContext(): Promise<SourceResumeContext> {
  const sourceData = resumeJson as ResumeData;
  const catalog = buildSourceTermCatalog(sourceData);
  const docxPath = resolveSourceResumePath();
  const { sourcePath, sourceText } = await loadDocxText(docxPath, sourceData);

  return {
    sourceData,
    sourceText,
    sourcePath,
    evidenceModel: {
      supportedSkills: flattenSkills(sourceData),
      supportedTechnologies: catalog,
      roleEvidence: sourceData.experience.map((role) => buildRoleEvidence(role, catalog)),
      projectEvidence: sourceData.projects.map((project) =>
        buildProjectEvidence(project, catalog),
      ),
    },
  };
}

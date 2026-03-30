/**
 * Unit tests for lib/engine/keywordUtils.ts
 *
 * Coverage: normalizeKeyword, keywordMatchesText, buildKeywordAnchors,
 * findZeroEvidenceKeywords, stripZeroEvidenceSkills, stripFabricatedSkillCategories
 *
 * Regression tests for known edge cases:
 *   - "automated testing" vs "automation"
 *   - "reliable releases" (now in source resume skills)
 *   - ALWAYS_BLOCKED_CONCEPTS always flagged as zero-evidence
 *   - zero-evidence multi-word vs single-word keywords
 *   - source skills in existing categories must be preserved
 */

import {
  normalizeKeyword,
  keywordMatchesText,
  buildKeywordAnchors,
  findZeroEvidenceKeywords,
  stripZeroEvidenceSkills,
  stripFabricatedSkillCategories,
  ALWAYS_BLOCKED_CONCEPTS,
} from "@/lib/engine/keywordUtils";
import type { ResumeData } from "@/lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Minimal ResumeData factory for use in tests. */
function makeResume(
  overrides: Partial<ResumeData> = {},
): ResumeData {
  return {
    contact: {
      name: "Test User",
      phone: "555-0000",
      email: "test@example.com",
      linkedin: "linkedin.com/in/test",
    },
    summary: [],
    experience: [],
    education: [],
    skills: {},
    projects: [],
    ...overrides,
  };
}

/** Source resume modelled after the actual resume.json skills section. */
function makeSourceResume(): ResumeData {
  return makeResume({
    skills: {
      "Backend Technologies": [
        "Python", "Java", "C#", "Node.js", "Express.js", "GraphQL",
        "Apache Kafka", "REST APIs", "Maven", "Flask", "Django",
      ],
      "Frontend Technologies": [
        "HTML", "CSS", "JavaScript", "TypeScript", "ReactJS", "Redux",
        "Next.js", "Material UI", "Webpack", "Recharts",
      ],
      "Database Management": [
        "PostgreSQL", "MySQL", "MongoDB", "DynamoDB", "Redis",
        "NoSQL Concepts", "Data Modeling", "Database Indexing",
        "Query Optimization", "Database Migrations", "ETL",
      ],
      "Cloud Platforms": [
        "AWS (Lambda, ECS, API Gateway, SQS, CloudWatch, IAM)",
        "Docker", "Containerization", "Serverless Deployments",
        "Load Balancing", "Auto Scaling", "CI/CD Pipelines",
      ],
      "AI / ML Integration": [
        "NumPy", "Pandas", "PyTorch", "LangChain", "LLM APIs",
        "Text Embeddings", "Retrieval-Augmented Generation (RAG)",
        "Ranking Logic", "Feature Engineering", "WebSockets",
      ],
      "Testing and Automation": [
        "Unit Testing", "Integration Testing", "API Testing",
        "End-to-End Testing", "Automated Testing", "Reliable Releases",
        "Git", "GitHub Actions", "Jenkins", "CI/CD Automation",
        "Jira", "Agile/Scrum",
      ],
    },
  });
}

// ─── normalizeKeyword ────────────────────────────────────────────────────────

describe("normalizeKeyword", () => {
  test("lowercases input", () => {
    expect(normalizeKeyword("React")).toBe("react");
    expect(normalizeKeyword("POSTGRESQL")).toBe("postgresql");
  });

  test("preserves allowed characters: letters, digits, +, #, /, ., space, hyphen", () => {
    expect(normalizeKeyword("C++")).toBe("c++");
    expect(normalizeKeyword("C#")).toBe("c#");
    expect(normalizeKeyword("node.js")).toBe("node.js");
    expect(normalizeKeyword("ASP.NET Core")).toBe("asp.net core");
    expect(normalizeKeyword("CI/CD")).toBe("ci/cd");
    expect(normalizeKeyword("end-to-end")).toBe("end-to-end");
  });

  test("replaces disallowed characters with space, then collapses and trims", () => {
    // parentheses and commas are replaced with spaces, then spaces are collapsed
    expect(normalizeKeyword("AWS (Lambda, ECS)")).toBe("aws lambda ecs");
    // at-signs are also disallowed
    expect(normalizeKeyword("test@example.com")).toBe("test example.com");
  });

  test("collapses multiple spaces into one", () => {
    expect(normalizeKeyword("  multiple   spaces  ")).toBe("multiple spaces");
  });

  test("trims leading and trailing whitespace", () => {
    expect(normalizeKeyword("  python  ")).toBe("python");
  });

  test("handles empty string", () => {
    expect(normalizeKeyword("")).toBe("");
  });

  test("handles string of only disallowed chars", () => {
    expect(normalizeKeyword("@@@!!!")).toBe("");
  });

  test("preserves mixed case skill with plus sign", () => {
    expect(normalizeKeyword("C++")).toBe("c++");
  });
});

// ─── keywordMatchesText ──────────────────────────────────────────────────────

describe("keywordMatchesText", () => {
  // ── Direct substring matching ────────────────────────────────────────────

  test("matches exact keyword in text (case-insensitive)", () => {
    expect(keywordMatchesText("python", "Built Python backend services")).toBe(true);
    expect(keywordMatchesText("PostgreSQL", "Designed PostgreSQL schemas")).toBe(true);
  });

  test("returns false when keyword is absent", () => {
    expect(keywordMatchesText("GraphQL", "Built REST APIs in Python")).toBe(false);
  });

  // ── Alias matching ───────────────────────────────────────────────────────

  test("ci/cd matches text containing 'github actions' (alias)", () => {
    expect(keywordMatchesText("ci/cd", "set up GitHub Actions for automated deploys")).toBe(true);
  });

  test("ci/cd matches text containing 'jenkins' (alias)", () => {
    expect(keywordMatchesText("ci/cd", "configured Jenkins pipeline for deployment")).toBe(true);
  });

  test("ci/cd matches text containing 'continuous integration' (alias)", () => {
    expect(keywordMatchesText("ci/cd", "implemented continuous integration across services")).toBe(true);
  });

  test("react matches 'reactjs' variant", () => {
    expect(keywordMatchesText("react", "built UI using ReactJS components")).toBe(true);
  });

  test("nodejs matches 'node.js' variant", () => {
    expect(keywordMatchesText("nodejs", "API gateway with Node.js express")).toBe(true);
  });

  test("reliability alias: matches 'uptime'", () => {
    expect(keywordMatchesText("reliability", "maintained 99.95% uptime")).toBe(true);
  });

  test("scalability alias: matches 'scalable'", () => {
    expect(keywordMatchesText("scalability", "built scalable microservices")).toBe(true);
  });

  // ── REGRESSION: "automated testing" vs "automation" ─────────────────────
  // "automated testing" must NOT match a text that only contains "automation".
  // These are semantically different: automation = a broad practice,
  // automated testing = specifically writing test suites.

  test("REGRESSION: 'automated testing' does NOT match text with only 'automation'", () => {
    const textWithOnlyAutomation = "Implemented automation frameworks and release pipelines";
    expect(keywordMatchesText("automated testing", textWithOnlyAutomation)).toBe(false);
  });

  test("REGRESSION: 'automated testing' DOES match text containing 'automated testing'", () => {
    expect(keywordMatchesText("automated testing", "Expanded automated testing coverage to 85%")).toBe(true);
  });

  test("REGRESSION: 'automation' DOES match text containing 'automation'", () => {
    expect(keywordMatchesText("automation", "Implemented automation frameworks")).toBe(true);
  });

  // ── REGRESSION: "reliable releases" ─────────────────────────────────────
  // "Reliable Releases" is now a source resume skill and should match text
  // containing that phrase (case-insensitive).

  test("REGRESSION: 'reliable releases' matches text containing 'Reliable Releases' (source skill)", () => {
    const skillsText = "Unit Testing, Integration Testing, Automated Testing, Reliable Releases, Git";
    expect(keywordMatchesText("reliable releases", skillsText)).toBe(true);
  });

  test("REGRESSION: 'reliable releases' matches text with lower-case form", () => {
    expect(keywordMatchesText("Reliable Releases", "focus on reliable releases and CI/CD automation")).toBe(true);
  });

  // ── Token-level fallback ─────────────────────────────────────────────────

  test("token fallback: all keyword tokens present in text → match", () => {
    // "api testing" has no alias entry; tokens "api" and "testing" both in text
    expect(keywordMatchesText("api testing", "Performed API integration testing using Postman")).toBe(true);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  test("empty keyword returns false (no variants match empty string)", () => {
    // An empty variant string is filtered out, no tokens → returns false
    expect(keywordMatchesText("", "some text here")).toBe(false);
  });

  test("keyword with special chars normalized before matching", () => {
    expect(keywordMatchesText("C#", "Experience with C# and .NET")).toBe(true);
    expect(keywordMatchesText("C++", "Wrote high-performance C++ modules")).toBe(true);
  });
});

// ─── buildKeywordAnchors ─────────────────────────────────────────────────────

describe("buildKeywordAnchors", () => {
  const RESUME_TEXT = [
    "Python Django REST APIs PostgreSQL",
    "GitHub Actions CI/CD Docker AWS Lambda",
    "React TypeScript Unit Testing Automated Testing Reliable Releases",
  ].join("\n");

  test("keywords present in source go into mustKeepKeywords", () => {
    const { mustKeepKeywords } = buildKeywordAnchors(RESUME_TEXT, ["Python", "PostgreSQL", "Docker"]);
    expect(mustKeepKeywords).toContain("Python");
    expect(mustKeepKeywords).toContain("PostgreSQL");
    expect(mustKeepKeywords).toContain("Docker");
  });

  test("keywords absent from source go into mustAddKeywords", () => {
    const { mustAddKeywords } = buildKeywordAnchors(RESUME_TEXT, [".NET", "C#", "Entity Framework"]);
    expect(mustAddKeywords).toContain(".NET");
    expect(mustAddKeywords).toContain("C#");
    expect(mustAddKeywords).toContain("Entity Framework");
  });

  test("no keyword appears in both arrays", () => {
    const keywords = ["Python", "PostgreSQL", ".NET", "C#", "ci/cd"];
    const { mustKeepKeywords, mustAddKeywords } = buildKeywordAnchors(RESUME_TEXT, keywords);
    const keepNorm = new Set(mustKeepKeywords.map(normalizeKeyword));
    const addNorm = new Set(mustAddKeywords.map(normalizeKeyword));
    const overlap = Array.from(keepNorm).filter((k) => addNorm.has(k));
    expect(overlap).toHaveLength(0);
  });

  test("all provided keywords are accounted for across both arrays", () => {
    const keywords = ["Python", "PostgreSQL", ".NET", "C#"];
    const { mustKeepKeywords, mustAddKeywords } = buildKeywordAnchors(RESUME_TEXT, keywords);
    const allNorm = [...mustKeepKeywords, ...mustAddKeywords].map(normalizeKeyword).sort();
    const expectedNorm = keywords.map(normalizeKeyword).sort();
    expect(allNorm).toEqual(expectedNorm);
  });

  test("alias match puts keyword into mustKeepKeywords (ci/cd vs github actions)", () => {
    // ci/cd not literally in text, but "GitHub Actions" alias is present
    const { mustKeepKeywords } = buildKeywordAnchors(RESUME_TEXT, ["ci/cd"]);
    expect(mustKeepKeywords).toContain("ci/cd");
  });

  test("REGRESSION: 'Automated Testing' is kept when source contains it", () => {
    const { mustKeepKeywords } = buildKeywordAnchors(RESUME_TEXT, ["Automated Testing"]);
    expect(mustKeepKeywords).toContain("Automated Testing");
  });

  test("REGRESSION: 'Reliable Releases' is kept when source contains it", () => {
    const { mustKeepKeywords } = buildKeywordAnchors(RESUME_TEXT, ["Reliable Releases"]);
    expect(mustKeepKeywords).toContain("Reliable Releases");
  });

  test("duplicate keywords are deduplicated", () => {
    const { mustAddKeywords } = buildKeywordAnchors(RESUME_TEXT, [".NET", ".NET", ".net"]);
    expect(mustAddKeywords).toHaveLength(1);
  });

  test("empty keywords array returns empty arrays", () => {
    const { mustKeepKeywords, mustAddKeywords } = buildKeywordAnchors(RESUME_TEXT, []);
    expect(mustKeepKeywords).toHaveLength(0);
    expect(mustAddKeywords).toHaveLength(0);
  });
});

// ─── findZeroEvidenceKeywords ─────────────────────────────────────────────────

describe("findZeroEvidenceKeywords", () => {
  const SOURCE_TEXT = [
    "Built Python Django REST APIs with PostgreSQL supporting 100K+ monthly transactions.",
    "Implemented LLM-based classification and RAG pipelines using LangChain.",
    "Set up GitHub Actions and Jenkins CI/CD pipelines on AWS Lambda.",
    "Used Docker for containerization and DynamoDB for data storage.",
    "Maintained 99.95% uptime with CloudWatch monitoring.",
    "Skills: Unit Testing, Integration Testing, Automated Testing, Reliable Releases",
  ].join("\n");

  // ── ALWAYS_BLOCKED_CONCEPTS ──────────────────────────────────────────────

  test("REGRESSION: ALWAYS_BLOCKED_CONCEPTS entries are always zero-evidence regardless of source", () => {
    const blocked = Array.from(ALWAYS_BLOCKED_CONCEPTS);
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, blocked);
    // Every blocked concept must be returned as zero-evidence
    for (const concept of blocked) {
      expect(result).toContain(concept);
    }
  });

  test("'ai training' is zero-evidence even when source mentions 'AI'", () => {
    const sourceWithAI = SOURCE_TEXT + "\nBuilt AI-driven classification pipelines.";
    const result = findZeroEvidenceKeywords(sourceWithAI, ["ai training"]);
    expect(result).toContain("ai training");
  });

  test("'model training' is zero-evidence always", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["model training"]);
    expect(result).toContain("model training");
  });

  test("'fine-tuning' is zero-evidence always", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["fine-tuning"]);
    expect(result).toContain("fine-tuning");
  });

  // ── Single-word keywords ─────────────────────────────────────────────────

  test("single-word keyword is NEVER zero-evidence", () => {
    // Even completely absent single words like "Blazor" are safe to add to skills
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["Blazor"]);
    expect(result).not.toContain("Blazor");
  });

  test("single-word keyword not in source is NEVER zero-evidence", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["Kubernetes", "Terraform", "Rust"]);
    expect(result).toHaveLength(0);
  });

  test("hyphenated single-token keyword (no space) is treated as single-word — not zero-evidence", () => {
    // "end-to-end" has hyphens but no space, so the condition !trimmed.includes(" ") is true
    // but !trimmed.includes("-") is false → so it IS treated as multi-word → check proper noun
    // "end-to-end" normalized → "end-to-end", tokens by /[\s\-_/()[\],]+/ → ["end", "to", "end"]
    // all < 4 chars → properNounTokens = [] → no proper nouns → injectable → NOT zero-evidence
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["end-to-end"]);
    expect(result).not.toContain("end-to-end");
  });

  // ── ALWAYS_INJECTABLE_CONCEPTS ───────────────────────────────────────────

  test("'distributed systems' is injectable even though first token is absent", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["distributed systems"]);
    expect(result).not.toContain("distributed systems");
  });

  test("'microservices' is injectable (in ALWAYS_INJECTABLE_CONCEPTS)", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["microservices"]);
    expect(result).not.toContain("microservices");
  });

  test("'intelligent automation' is injectable", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["intelligent automation"]);
    expect(result).not.toContain("intelligent automation");
  });

  test("'reliability' is injectable", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["reliability"]);
    expect(result).not.toContain("reliability");
  });

  test("'logging' is injectable", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["logging"]);
    expect(result).not.toContain("logging");
  });

  // ── REGRESSION: zero-evidence multi-word vs single-word ─────────────────

  test("REGRESSION: 'Microsoft Copilot' is zero-evidence (proper noun 'Microsoft' absent)", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["Microsoft Copilot"]);
    expect(result).toContain("Microsoft Copilot");
  });

  test("REGRESSION: 'Power Platform' is zero-evidence (proper noun 'Power' + 'Platform' absent)", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["Power Platform"]);
    expect(result).toContain("Power Platform");
  });

  test("REGRESSION: 'D365 Customer Service' is zero-evidence (proper noun 'D365' absent)", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["D365 Customer Service"]);
    expect(result).toContain("D365 Customer Service");
  });

  test("'LangChain' (single word) is NOT zero-evidence even though it is a proper noun", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["LangChain"]);
    expect(result).not.toContain("LangChain");
  });

  test("'Entity Framework' is zero-evidence when 'Entity' is absent from source", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["Entity Framework"]);
    expect(result).toContain("Entity Framework");
  });

  test("'GitHub Actions' is NOT zero-evidence when 'GitHub' IS present in source", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["GitHub Actions"]);
    expect(result).not.toContain("GitHub Actions");
  });

  test("'AWS Lambda' is NOT zero-evidence when 'AWS' IS present in source", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["AWS Lambda"]);
    expect(result).not.toContain("AWS Lambda");
  });

  // ── Generic lowercase multi-word → not zero-evidence ────────────────────

  test("all-lowercase multi-word phrase with no proper nouns is NOT zero-evidence", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["object-oriented programming"]);
    expect(result).not.toContain("object-oriented programming");
  });

  test("'agile/scrum' (no proper nouns after normalization) is NOT zero-evidence", () => {
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, ["agile/scrum"]);
    expect(result).not.toContain("agile/scrum");
  });

  // ── Empty and mixed inputs ───────────────────────────────────────────────

  test("empty mustAddKeywords returns empty array", () => {
    expect(findZeroEvidenceKeywords(SOURCE_TEXT, [])).toEqual([]);
  });

  test("mix: returns only the zero-evidence ones", () => {
    const mixed = ["Python", "Microsoft Copilot", "Docker", "ai training", "GitHub Actions"];
    const result = findZeroEvidenceKeywords(SOURCE_TEXT, mixed);
    expect(result).toContain("Microsoft Copilot");
    expect(result).toContain("ai training");
    expect(result).not.toContain("Python");
    expect(result).not.toContain("Docker");
    expect(result).not.toContain("GitHub Actions");
  });
});

// ─── stripZeroEvidenceSkills ──────────────────────────────────────────────────

describe("stripZeroEvidenceSkills", () => {
  const baseResume = makeResume({
    skills: {
      "Backend Technologies": ["Python", "Django", "REST APIs", "Microsoft Copilot"],
      "Cloud Platforms": ["AWS", "Docker", "ai training"],
      "Testing and Automation": ["Unit Testing", "Automated Testing", "Reliable Releases"],
    },
  });

  test("removes skill entries matching zero-evidence keywords", () => {
    const result = stripZeroEvidenceSkills(baseResume, ["Microsoft Copilot", "ai training"]);
    expect(result.skills["Backend Technologies"]).not.toContain("Microsoft Copilot");
    expect(result.skills["Cloud Platforms"]).not.toContain("ai training");
  });

  test("preserves all other skills in the same category", () => {
    const result = stripZeroEvidenceSkills(baseResume, ["Microsoft Copilot"]);
    expect(result.skills["Backend Technologies"]).toContain("Python");
    expect(result.skills["Backend Technologies"]).toContain("Django");
    expect(result.skills["Backend Technologies"]).toContain("REST APIs");
  });

  test("removes entire category when all skills are zero-evidence", () => {
    const resume = makeResume({
      skills: {
        "Fabricated Category": ["ai training", "model training"],
        "Backend Technologies": ["Python"],
      },
    });
    const result = stripZeroEvidenceSkills(resume, ["ai training", "model training"]);
    expect(result.skills).not.toHaveProperty("Fabricated Category");
    expect(result.skills).toHaveProperty("Backend Technologies");
  });

  test("zero zeroEvidenceKeywords → returns resume unchanged", () => {
    const result = stripZeroEvidenceSkills(baseResume, []);
    expect(result).toBe(baseResume); // same reference — early return
  });

  test("matching is case-insensitive", () => {
    const result = stripZeroEvidenceSkills(baseResume, ["microsoft copilot"]);
    expect(result.skills["Backend Technologies"]).not.toContain("Microsoft Copilot");
  });

  // ── REGRESSION: source skills must be preserved ──────────────────────────

  test("REGRESSION: 'Automated Testing' is preserved when NOT in zeroEvidenceKeywords", () => {
    const result = stripZeroEvidenceSkills(baseResume, ["Microsoft Copilot"]);
    expect(result.skills["Testing and Automation"]).toContain("Automated Testing");
  });

  test("REGRESSION: 'Reliable Releases' is preserved when NOT in zeroEvidenceKeywords", () => {
    const result = stripZeroEvidenceSkills(baseResume, ["Microsoft Copilot"]);
    expect(result.skills["Testing and Automation"]).toContain("Reliable Releases");
  });

  test("REGRESSION: 'Automated Testing' and 'Reliable Releases' both preserved with full source skills", () => {
    const source = makeSourceResume();
    const result = stripZeroEvidenceSkills(source, ["ai training", "model training"]);
    expect(result.skills["Testing and Automation"]).toContain("Automated Testing");
    expect(result.skills["Testing and Automation"]).toContain("Reliable Releases");
    expect(result.skills["Testing and Automation"]).toContain("Unit Testing");
    expect(result.skills["Testing and Automation"]).toContain("GitHub Actions");
  });
});

// ─── stripFabricatedSkillCategories ──────────────────────────────────────────

describe("stripFabricatedSkillCategories", () => {
  const sourceResume = makeSourceResume();

  test("keeps categories that exist in source", () => {
    const tailored = makeResume({
      skills: {
        "Backend Technologies": ["Python", "Django", ".NET", "C#"],
        "Testing and Automation": ["Unit Testing", "Automated Testing", "xUnit"],
      },
    });
    const result = stripFabricatedSkillCategories(tailored, sourceResume);
    expect(result.skills).toHaveProperty("Backend Technologies");
    expect(result.skills).toHaveProperty("Testing and Automation");
  });

  test("removes categories NOT in source", () => {
    const tailored = makeResume({
      skills: {
        "Backend Technologies": ["Python"],
        "Engineering Practices": ["Agile", "Scrum", "Code Reviews"],
        "Additional Skills": ["Object-Oriented Programming"],
      },
    });
    const result = stripFabricatedSkillCategories(tailored, sourceResume);
    expect(result.skills).not.toHaveProperty("Engineering Practices");
    expect(result.skills).not.toHaveProperty("Additional Skills");
    expect(result.skills).toHaveProperty("Backend Technologies");
  });

  test("does not modify skills within kept categories", () => {
    const tailored = makeResume({
      skills: {
        "Backend Technologies": ["Python", "C#", ".NET", "Entity Framework"],
      },
    });
    const result = stripFabricatedSkillCategories(tailored, sourceResume);
    // All skills within the kept category are untouched (stripFabricatedSkillCategories
    // only removes CATEGORIES, not individual skills within them)
    expect(result.skills["Backend Technologies"]).toEqual([
      "Python", "C#", ".NET", "Entity Framework",
    ]);
  });

  test("result contains no categories beyond those in source", () => {
    const tailored = makeResume({
      skills: {
        "Backend Technologies": ["Python"],
        "Cloud Platforms": ["AWS"],
        "New Category A": ["skill1"],
        "New Category B": ["skill2"],
        "Testing and Automation": ["Unit Testing"],
      },
    });
    const result = stripFabricatedSkillCategories(tailored, sourceResume);
    const sourceCategories = new Set(Object.keys(sourceResume.skills));
    for (const category of Object.keys(result.skills)) {
      expect(sourceCategories.has(category)).toBe(true);
    }
  });

  test("all six source categories preserved when tailored matches all", () => {
    const result = stripFabricatedSkillCategories(sourceResume, sourceResume);
    expect(Object.keys(result.skills)).toHaveLength(6);
  });

  test("empty tailored skills → empty result skills", () => {
    const tailored = makeResume({ skills: {} });
    const result = stripFabricatedSkillCategories(tailored, sourceResume);
    expect(result.skills).toEqual({});
  });

  // ── REGRESSION: source skills in existing categories preserved ───────────

  test("REGRESSION: 'Testing and Automation' category survives with all source entries intact", () => {
    const tailored = makeResume({
      skills: {
        "Testing and Automation": [
          "Unit Testing", "Integration Testing", "API Testing",
          "End-to-End Testing", "Automated Testing", "Reliable Releases",
          "Git", "GitHub Actions", "Jenkins", "CI/CD Automation",
          "Jira", "Agile/Scrum",
        ],
      },
    });
    const result = stripFabricatedSkillCategories(tailored, sourceResume);
    expect(result.skills["Testing and Automation"]).toContain("Automated Testing");
    expect(result.skills["Testing and Automation"]).toContain("Reliable Releases");
  });
});

// ─── ALWAYS_BLOCKED_CONCEPTS export ──────────────────────────────────────────

describe("ALWAYS_BLOCKED_CONCEPTS", () => {
  test("is a Set", () => {
    expect(ALWAYS_BLOCKED_CONCEPTS).toBeInstanceOf(Set);
  });

  test("contains the 6 expected entries", () => {
    const expected = [
      "ai training",
      "ai training and inferencing",
      "ai training and inferencing services",
      "ai inferencing",
      "model training",
      "fine-tuning",
    ];
    for (const entry of expected) {
      expect(ALWAYS_BLOCKED_CONCEPTS.has(entry)).toBe(true);
    }
    expect(ALWAYS_BLOCKED_CONCEPTS.size).toBe(6);
  });

  test("does NOT contain 'agentic ai' (must not be blocked)", () => {
    expect(ALWAYS_BLOCKED_CONCEPTS.has("agentic ai")).toBe(false);
  });

  test("does NOT contain 'rag' or 'retrieval-augmented generation'", () => {
    expect(ALWAYS_BLOCKED_CONCEPTS.has("rag")).toBe(false);
    expect(ALWAYS_BLOCKED_CONCEPTS.has("retrieval-augmented generation")).toBe(false);
  });
});

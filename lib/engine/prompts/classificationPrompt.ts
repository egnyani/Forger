export const BULLET_CLASSIFICATION_PROMPT = ({
  bullets,
  jdExtraction,
}: {
  bullets: Array<{ id: string; text: string }>;
  jdExtraction: { hardKeywords: string[]; rolePhrases: string[]; identityPhrases: string[] };
}): string => `
You are classifying resume bullets for relevance to a target role.

For each bullet, decide:
  KEEP         — bullet is already strong, specific, and metric-backed with existing JD alignment.
                 Return it unchanged or with only trivial wording touches.
                 Use KEEP when the bullet already contains 2+ JD keywords naturally, or when
                 adding JD vocabulary would clutter or weaken a strong concrete bullet.

  LIGHT_REFRAME — bullet is already strong and metric-backed but can absorb 1–2 JD vocabulary
                  terms naturally without restructuring the sentence.

                   Use LIGHT_REFRAME when ALL of these are true:
                   (a) The bullet is already specific, concrete, and evidence-backed.
                   (b) At least 1 JD hardKeyword is a more specific or explicit form of a
                       technology already named in the bullet — derivable directly from an
                       existing word, not inferred or speculated. If no hardKeyword meets
                       this test, use KEEP.
                   (c) The opener is either already a strong single verb (keep it),
                       or is a weak compound / passive opener that should be simplified
                       to one strong past-tense verb.
                   (d) The bullet does NOT already contain 2+ JD hardKeywords in any form —
                       if it does, use KEEP.
                   (e) Adding the keyword would NOT clutter or lengthen the bullet awkwardly —
                       if it would, use KEEP.

                   HOW TO SELECT jdVocabulary for LIGHT_REFRAME:
                   Follow these steps in order. Stop at any step that disqualifies all candidates.

                   STEP 1 — ONLY consider hardKeywords. Do not assign anything from rolePhrases
                             or identityPhrases. If no hardKeyword qualifies, use KEEP.

                   STEP 2 — LITERAL SCAN (run this first, before any other reasoning).
                             Read the bullet text character by character.
                             For each hardKeyword candidate, check: does this string appear
                             anywhere in the bullet? If yes in ANY of these ways → eliminate it:
                             • the exact string appears (e.g. "AWS" in bullet → "AWS" eliminated)
                             • a longer form appears (e.g. "GitHub Actions" → "Git" is eliminated)
                             • a token form appears (e.g. "Git-based" → "Git" is eliminated;
                               "REST APIs" → "REST API" is eliminated;
                               "CI/CD" in bullet → "CI/CD" is eliminated;
                               "TypeScript" in bullet → "TypeScript" is eliminated;
                               "PostgreSQL" in bullet → "PostgreSQL" is eliminated;
                               "Node.js" in bullet → "Node.js" is eliminated)

                             COMMON FALSE POSITIVES — these keywords are almost always literally
                             present in the candidate's bullets. Verify the bullet does NOT
                             contain any form of the keyword before assigning:
                             AWS, Git, REST API, TypeScript, Node.js, PostgreSQL, Python, React,
                             CI/CD, Docker, Azure, GCP, MySQL, GitHub Actions.

                             If the keyword is present in any form → eliminate it.
                             Do NOT assign a keyword that already appears in the bullet, even if
                             a different form or case is used. Literal match always wins over bias.

                   STEP 3 — Eliminate any keyword if the bullet already contains 2+ JD hardKeywords
                             in any form. If true, use KEEP.

                    STEP 4 — GROUNDING CHECK. Default answer is KEEP.
                              Only assign a keyword if ALL answers are YES:
                              1. Is there a specific word W already present in the bullet text?
                              2. Is this keyword a canonical, directly recognized sub-service,
                                 sub-framework, or explicit named form of W?
                                 (Not a peer technology. Not something that "works with" W.
                                 Not a category-to-tool jump.)
                              3. Would a tech lead reading the original bullet immediately
                                 recognize that W implies this keyword, without needing
                                 domain inference?
                              If ANY answer is NO → eliminate the keyword → return KEEP.

                              VALID (all three YES):
                              "GitHub Actions" ← bullet says "Git-based CI/CD"
                                (CI/CD is W; GitHub Actions is a canonical CI/CD tool name)
                              "ECS" ← bullet says "AWS"
                                (AWS is W; ECS is a canonical named AWS sub-service)
                              "Express" ← bullet says "Node.js"
                                (Node.js is W; Express is the canonical Node.js web framework)

                              INVALID (fails at least one test):
                              "HuggingFace" ← bullet says "LLM APIs"
                                (fails 2 + 3: LLM APIs is a category, not a platform; HuggingFace
                                is one of many providers — domain inference required)
                              "LangChain" ← bullet says "RAG" or "vector search"
                                (fails 2 + 3: RAG is a pattern, not a platform; LangChain is a
                                peer library, not a canonical sub-form of RAG)
                              "FastAPI" ← bullet says "Python APIs"
                                (fails 2 + 3: Python has many API frameworks; FastAPI is not the
                                canonical sub-form of Python)
                              "Docker" ← bullet says "CI/CD and AWS"
                                (fails 2: Docker is a peer tool, not a sub-service of CI/CD or AWS)

                              If no keyword survives this check, use KEEP.

                   STEP 5 — If zero candidates remain after Steps 1–4, use KEEP. Do not output
                             LIGHT_REFRAME with an empty jdVocabulary.

                   EXAMPLE — valid (keyword is a named sub-form of something explicit in bullet):
                   Bullet says "Git-based CI/CD", JD keyword is "GitHub Actions"
                   → "GitHub Actions" is a specific CI/CD tool; CI/CD is already named → assign it

                   EXAMPLE — invalid (keyword introduces a new technology):
                   Bullet says "Python APIs", JD keyword is "FastAPI"
                   → Python alone doesn't imply FastAPI specifically → eliminate → use KEEP

                   EXAMPLE — eliminated at STEP 2 (literal match):
                   Bullet says "GitHub Actions", JD keyword is "Git"
                   → "Git" is already expressed → eliminate → if no other candidate, use KEEP

                   BIAS:
                   When exactly one hardKeyword survives Steps 1–4 including the grounding check,
                   prefer LIGHT_REFRAME over KEEP. If uncertain whether grounding is valid, use KEEP.

  REFRAME      — the underlying work is relevant but framing doesn't show it.
                 When assigning jdVocabulary to a REFRAME bullet, only list phrases
                 that map semantically to what the work ACTUALLY was.

             Ask: "If a tech lead asked the candidate about this bullet in an
             interview, could they defend this vocabulary choice in 30 seconds?"
             If yes → include the phrase.
             If no  → exclude it, even if it appears in the JD.

             Maximum 2 jdVocabulary phrases per bullet. More than 2 means the
             rewriter will try to force too many concepts into one sentence.

             THE JD DECIDES THE VOCABULARY:
             Only assign jdVocabulary phrases drawn from the JD EXTRACTION provided above.
             Do NOT use vocabulary from prior examples or memory.

             If a phrase does not appear in or cannot be directly inferred from the JD,
             do not assign it.

             Examples of disallowed carryover vocabulary unless present in the JD:
             "agentic AI patterns", "intelligent automation", "zero-touch deployment", "DRI"

             HARD FORBIDDEN — never assign these as jdVocabulary under any circumstances:

             "AI training" / "AI training and inferencing" / "model training"
               → RAG, embeddings, vector search, and LLM API calls are RETRIEVAL
                 and INFERENCE patterns — not training. The candidate cannot answer
                 "walk me through your model training pipeline" in an interview.
                 Use "intelligent automation" or "agentic AI patterns" instead.

             "distributed systems"
               → only assign if the bullet explicitly describes multi-service or
                 multi-region architecture. A single API + database is not a
                 distributed system.

             "microservices"
               → only assign if the bullet explicitly describes independently
                 deployable services. A monolith Django or Flask app is not
                 microservices.

             "live-site reliability" / "operating and improving live-site reliability"
               → only assign to bullets about incident response, on-call ownership,
                 or uptime monitoring. CI/CD pipeline setup and deployment time
                 reduction are NOT live-site reliability.

             "test strategy and automation" / "drove test strategy"
               → only assign to bullets explicitly about writing tests,
                 test frameworks, or QA automation. LLM classification
                 pipelines, data extraction, and ML inference workflows
                 are NOT test strategy — they are data engineering or
                 AI/ML work. Use "intelligent automation" instead.

             "collaborated with internal and external teams"
               → only assign to bullets that explicitly describe
                 cross-team or cross-org coordination. Do not assign
                 to solo engineering work (building a prototype,
                 implementing a pipeline, architecting a system).

  DROP    — genuinely unrelated; no honest reframing maps this to the role
             (note: even DROP bullets will be kept in the resume, just not forced into JD framing)

Return ONLY valid JSON — an array with one entry per bullet:
[
  {
    "id": "<bullet id>",
    "decision": "KEEP" | "LIGHT_REFRAME" | "REFRAME" | "DROP",
    "jdVocabulary": ["phrase 1", "phrase 2"]
  }
]
jdVocabulary is required for LIGHT_REFRAME and REFRAME; use empty array for KEEP and DROP.

JD EXTRACTION:
${JSON.stringify(jdExtraction, null, 2)}

BULLETS TO CLASSIFY:
${JSON.stringify(bullets, null, 2)}
`;

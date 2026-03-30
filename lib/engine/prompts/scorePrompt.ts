export const SCORE_PROMPT = (
  resumeText: string,
  jobDescription: string,
): string => `
You are an ATS (Applicant Tracking System) analyzer.

Compare the resume text against the job description and return a JSON object 
with exactly this shape:
{
  "score": <number 0–100>,
  "matched_keywords": [<string>, ...],
  "missing_keywords": [<string>, ...],
  "suggestions": [<string>, ...]
}

- score: overall ATS match percentage as an integer
- matched_keywords: important keywords/phrases from the JD present in the resume
- missing_keywords: important keywords/phrases from the JD absent from the resume
- suggestions: exactly 3 specific actionable suggestions to improve the score

Return ONLY valid JSON. No markdown fences, no explanation. Raw JSON only.

RESUME TEXT:
${resumeText}

JOB DESCRIPTION:
${jobDescription}
`;

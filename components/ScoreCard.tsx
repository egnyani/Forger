import type { ATSScore } from "@/lib/types";

interface ScoreCardProps {
  score: ATSScore;
}

export function ScoreCard({ score }: ScoreCardProps) {
  const scoreColor =
    score.score >= 70
      ? "text-green-600"
      : score.score >= 50
        ? "text-amber-500"
        : "text-red-500";

  return (
    <div className="mx-auto mt-0 max-w-[740px] rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-end gap-3">
        <div className={`text-4xl font-bold ${scoreColor}`}>{score.score}%</div>
        <div className="text-sm text-gray-500">ATS Match Score</div>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-green-700">
            Matched Keywords
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {score.matched_keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-red-700">Missing Keywords</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {score.missing_keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-800"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-gray-700">Suggestions</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-gray-600">
          {score.suggestions.map((suggestion) => (
            <li key={suggestion}>{suggestion}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default ScoreCard;

import * as ReactDOMServer from "react-dom/server.node";

import { ResumeTemplate } from "@/components/ResumeTemplate";
import { HTML_RESET_CSS } from "@/lib/resumeLayout";
import type { ResumeData } from "@/lib/types";

export function renderResumeHtml(data: ResumeData): string {
  const markup = ReactDOMServer.renderToStaticMarkup(
    <ResumeTemplate data={data} />,
  );

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>${HTML_RESET_CSS}</style>
    </head>
    <body>
      ${markup}
    </body>
  </html>`;
}

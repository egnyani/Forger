/**
 * ResumeTemplate — Pure rendering component.
 *
 * ALL layout styles are locked in lib/resumeLayout.ts.
 * This file contains ONLY JSX structure. Do not add inline styles here.
 * To change resume CONTENT, edit lib/prompts.ts or lib/sourceResume.ts.
 * To change resume LAYOUT, edit lib/resumeLayout.ts (requires approval).
 */

import type { ResumeData } from "@/lib/types";
import {
  pageStyle,
  nameStyle,
  contactRowStyle,
  sectionHeaderStyle,
  summaryListStyle,
  summaryItemStyle,
  roleBlockStyle,
  companyDateRowStyle,
  companyNameStyle,
  dateStyle,
  roleTitleStyle,
  bulletListStyle,
  bulletItemStyle,
  skillRowStyle,
  skillLabelStyle,
  skillValuesStyle,
  eduBlockStyle,
  eduSchoolRowStyle,
  eduSchoolStyle,
  eduDegreeRowStyle,
  eduDegreeStyle,
  eduLocationStyle,
  projectBlockStyle,
  projectHeaderRowStyle,
  projectNameStyle,
  linkStyle,
  renderInlineBold,
} from "@/lib/resumeLayout";

interface ResumeTemplateProps {
  data: ResumeData;
}

export function ResumeTemplate({ data }: ResumeTemplateProps) {
  return (
    <div style={pageStyle}>
      {/* NAME */}
      <h1 style={nameStyle}>{data.contact.name}</h1>

      {/* CONTACT — phone and email as plain text, LinkedIn/Github as hyperlinks */}
      <p style={contactRowStyle}>
        {data.contact.phone}
        {"  |  "}
        {data.contact.email}
        {"  |  "}
        <a href={`https://${data.contact.linkedin}`} style={linkStyle}>LinkedIn</a>
        {data.contact.github && (
          <>
            {"  |  "}
            <a href={`https://${data.contact.github}`} style={linkStyle}>Github</a>
          </>
        )}
      </p>

      {/* SUMMARY */}
      <section>
        <h2 style={sectionHeaderStyle}>Summary</h2>
        <ul style={summaryListStyle}>
          {data.summary.map((point, i) => (
            <li key={i} style={summaryItemStyle}>
              {renderInlineBold(point)}
            </li>
          ))}
        </ul>
      </section>

      {/* EXPERIENCE */}
      <section>
        <h2 style={sectionHeaderStyle}>Experience</h2>
        {data.experience.map((role) => (
          <div key={role.id} style={roleBlockStyle}>
            {/* Company (bold, left) ── Date (right) */}
            <div style={companyDateRowStyle}>
              <span style={companyNameStyle}>{role.company}</span>
              <span style={dateStyle}>
                {role.start} – {role.end}
              </span>
            </div>
            {/* Title on its own line */}
            <div style={roleTitleStyle}>{role.title}</div>
            <ul style={bulletListStyle}>
              {role.bullets.map((bullet, index) => {
                const bulletText =
                  typeof bullet === "string"
                    ? bullet
                    : (bullet as { text?: string }).text ?? "";
                return (
                  <li key={index} style={bulletItemStyle}>
                    {renderInlineBold(bulletText)}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {/* TECHNICAL SKILLS */}
      <section>
        <h2 style={sectionHeaderStyle}>Technical Skills</h2>
        {Object.entries(data.skills).map(([category, values]) => (
          <div key={category} style={skillRowStyle}>
            <span style={skillLabelStyle}>{category}:</span>
            <span style={skillValuesStyle}> {values.join(", ")}</span>
          </div>
        ))}
      </section>

      {/* EDUCATION */}
      <section>
        <h2 style={sectionHeaderStyle}>Education</h2>
        {data.education.map((entry) => (
          <div key={`${entry.school}-${entry.degree}`} style={eduBlockStyle}>
            {/* School (bold, left) ── Dates (right) */}
            <div style={eduSchoolRowStyle}>
              <span style={eduSchoolStyle}>{entry.school}</span>
              <span style={dateStyle}>
                {entry.start} – {entry.end}
              </span>
            </div>
            {/* Degree (left) ── Location (right) */}
            <div style={eduDegreeRowStyle}>
              <span style={eduDegreeStyle}>{entry.degree}</span>
              <span style={eduLocationStyle}>{entry.location}</span>
            </div>
          </div>
        ))}
      </section>

      {/* PROJECTS (only if present) */}
      {data.projects && data.projects.length > 0 && (
        <section>
          <h2 style={sectionHeaderStyle}>Projects</h2>
          {data.projects.map((project) => (
            <div key={project.id} style={projectBlockStyle}>
              <div style={projectHeaderRowStyle}>
                <span style={projectNameStyle}>{project.name}</span>
                <span style={dateStyle}>{project.date}</span>
              </div>
              <ul style={bulletListStyle}>
                {project.bullets.map((bullet, index) => (
                  <li key={index} style={bulletItemStyle}>
                    {renderInlineBold(bullet)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

    </div>
  );
}

export default ResumeTemplate;

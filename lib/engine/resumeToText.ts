import type { ResumeData } from "@/lib/types";

export function resumeToText(data: ResumeData): string {
  const lines: string[] = [];

  lines.push(data.contact.name);
  lines.push(
    [data.contact.email, data.contact.phone, data.contact.linkedin].join(", "),
  );
  lines.push("SUMMARY");
  lines.push(data.summary.join("\n"));
  lines.push("EXPERIENCE");

  data.experience.forEach((role) => {
    lines.push(`${role.title} at ${role.company}, ${role.start} - ${role.end}`);
    role.bullets.forEach((bullet) => {
      const bulletText = typeof bullet === "string" ? bullet : (bullet as { text?: string }).text ?? "";
      lines.push(bulletText);
    });
  });

  lines.push("SKILLS");
  Object.entries(data.skills).forEach(([category, skills]) => {
    lines.push(`${category}: ${skills.join(", ")}`);
  });

  lines.push("EDUCATION");
  data.education.forEach((entry) => {
    lines.push(`${entry.degree}, ${entry.school}, ${entry.start} - ${entry.end}`);
  });

  lines.push("PROJECTS");
  data.projects.forEach((project) => {
    lines.push(`${project.name}, ${project.date}`);
    project.bullets.forEach((bullet) => {
      lines.push(bullet);
    });
  });

  return lines.join("\n");
}

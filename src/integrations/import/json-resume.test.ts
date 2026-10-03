import { describe, expect, it } from "vite-plus/test";

import { resumeDataSchema } from "@/schema/resume/data";

import { JSONResumeImporter } from "./json-resume";

const importer = new JSONResumeImporter();

describe("JSONResumeImporter", () => {
  it("maps work, a GitHub profile, and an expert skill into resume data", () => {
    const parsed = importer.parse(
      JSON.stringify({
        basics: {
          name: "Ada Lovelace",
          profiles: [{ network: "GitHub", username: "ada", url: "https://github.com/ada" }],
        },
        work: [
          {
            name: "TechCorp",
            position: "Engineer",
            startDate: "2020-03",
            summary: "Built things",
            highlights: ["Shipped"],
          },
        ],
        skills: [{ name: "TypeScript", level: "Expert", keywords: ["types"] }],
      }),
    );

    expect(resumeDataSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.sections.experience.items[0]).toMatchObject({
      company: "TechCorp",
      position: "Engineer",
      period: "01/03/2020 - Present",
      description: "<p>Built things</p><ul><li>Shipped</li></ul>",
    });
    expect(parsed.sections.profiles.items[0]).toMatchObject({
      icon: "github-logo",
      network: "GitHub",
      username: "ada",
    });
    expect(parsed.sections.skills.items[0]).toMatchObject({
      name: "TypeScript",
      level: 5,
      proficiency: "Expert",
    });
  });

  it("throws when the JSON is invalid or fails the resume schema", () => {
    expect(() => importer.parse("{")).toThrow();
    expect(() => importer.parse(JSON.stringify({ basics: { email: "not-an-email" } }))).toThrow(Error);
  });
});

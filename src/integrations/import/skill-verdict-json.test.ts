import { describe, expect, it } from "vite-plus/test";

import { defaultResumeData, resumeDataSchema, sectionTypeSchema } from "@/schema/resume/data";

import { SkillVerdictJSONImporter } from "./skill-verdict-json";

const importer = new SkillVerdictJSONImporter();
const builtInSectionIds = sectionTypeSchema.options.filter((section) => section !== "cover-letter");

describe("SkillVerdictJSONImporter", () => {
  it("round-trips a valid export", () => {
    const parsed = importer.parse(JSON.stringify(defaultResumeData));

    expect(resumeDataSchema.safeParse(parsed).success).toBe(true);
    expect(parsed).toEqual(defaultResumeData);
  });

  it("builds one default page when the export has no pages", () => {
    const resume = structuredClone(defaultResumeData);
    resume.metadata.layout.pages = [];

    const parsed = importer.parse(JSON.stringify(resume));

    expect(parsed.metadata.layout.pages).toEqual([
      { fullWidth: false, main: builtInSectionIds, sidebar: [] },
    ]);
  });

  it("appends a missing skills section without reordering the imported layout", () => {
    const resume = structuredClone(defaultResumeData);
    const page = resume.metadata.layout.pages[0];
    const main = [...page.main];
    page.sidebar = page.sidebar.filter((id) => id !== "skills");

    const parsed = importer.parse(JSON.stringify(resume));

    expect(parsed.metadata.layout.pages[0]?.main).toEqual([...main, "skills"]);
    expect(parsed.metadata.layout.pages[0]?.sidebar).toEqual(page.sidebar);
  });
});

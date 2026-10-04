import { describe, expect, it } from "vite-plus/test";

import { customSectionItemSchema, defaultResumeData, resumeDataSchema } from "./data";

describe("resumeDataSchema", () => {
  it("parses the default resume", () => {
    expect(resumeDataSchema.parse(defaultResumeData)).toEqual(defaultResumeData);
  });

  it("keeps recipient on a cover letter custom item", () => {
    const item = {
      id: "letter-1",
      hidden: false,
      recipient: "<p>Hiring Manager</p>",
      content: "<p>Hello</p>",
    };

    const parsed = customSectionItemSchema.parse(item);

    expect(parsed).toMatchObject({ recipient: "<p>Hiring Manager</p>", content: "<p>Hello</p>" });

    const resume = structuredClone(defaultResumeData);
    resume.customSections = [
      {
        id: "custom-1",
        type: "cover-letter",
        title: "Letter",
        columns: 1,
        hidden: false,
        items: [item],
      },
    ];

    const document = resumeDataSchema.parse(resume);
    expect(document.customSections[0]?.items[0]).toMatchObject({
      recipient: "<p>Hiring Manager</p>",
    });
  });

  it("falls back to the onyx template when the template is unknown", () => {
    const resume = structuredClone(defaultResumeData);
    resume.metadata.template = "not-a-template" as typeof resume.metadata.template;

    expect(resumeDataSchema.parse(resume).metadata.template).toBe("onyx");
  });

  it("rejects an experience item with an empty company", () => {
    const resume = structuredClone(defaultResumeData);
    resume.sections.experience.items = [
      {
        id: "exp-1",
        hidden: false,
        company: "",
        position: "Engineer",
        location: "",
        period: "",
        website: { url: "", label: "" },
        description: "",
        roles: [],
      },
    ];

    expect(resumeDataSchema.safeParse(resume).success).toBe(false);
  });
});

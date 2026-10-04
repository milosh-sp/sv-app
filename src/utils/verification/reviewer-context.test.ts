import { describe, expect, it } from "vite-plus/test";

import type { ResumeData } from "@/schema/resume/data";

import { defaultResumeData } from "@/schema/resume/data";

import {
  buildRedactedRelatedExperience,
  buildReviewerSkillContext,
  formatReviewerCaseId,
  mapReviewerDocumentUrl,
  stripIdentifyingHtml,
} from "./reviewer-context";
import { deriveSkillKeywordId } from "./skills";

const parentId = "019bef5a-93e4-7746-ad39-622f9d41da55";
const csharpItemId = deriveSkillKeywordId(parentId, "C#");

function makeResumeData(overrides?: Partial<ResumeData>): ResumeData {
  return { ...defaultResumeData, ...overrides };
}

describe("formatReviewerCaseId", () => {
  it("returns the last 8 hex chars of the request id", () => {
    expect(formatReviewerCaseId("019bef5a-93e4-7746-ad39-622f9d41da55")).toBe("9D41DA55");
  });
});

describe("stripIdentifyingHtml", () => {
  it("removes mailto and tel links", () => {
    const html = '<p>Contact <a href="mailto:test@example.com">email</a> or <a href="tel:+123">phone</a></p>';
    const result = stripIdentifyingHtml(html);
    expect(result).not.toContain("mailto:");
    expect(stripIdentifyingHtml("")).toBe("");
  });
});

describe("buildReviewerSkillContext", () => {
  it("extracts keyword skill context from parent category", () => {
    const resumeData = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        skills: {
          ...defaultResumeData.sections.skills,
          items: [
            {
              id: parentId,
              hidden: false,
              icon: "cpu",
              name: "Programming Languages",
              proficiency: "Expert",
              level: 5,
              keywords: ["C#", "Python"],
            },
          ],
        },
      },
    });

    const context = buildReviewerSkillContext(resumeData, "skill", csharpItemId, "C#");

    expect(context).toEqual({
      sectionType: "skill",
      itemLabel: "C#",
      parentItemLabel: "Programming Languages",
      proficiency: "Expert",
      level: 5,
      keywords: ["C#", "Python"],
    });
  });

  it("extracts project context without website", () => {
    const projectId = "019bef5a-93e4-7746-ad39-5e8bb7cacbc8";
    const resumeData = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        projects: {
          ...defaultResumeData.sections.projects,
          items: [
            {
              id: projectId,
              hidden: false,
              name: "Inventory API",
              period: "2024",
              website: { url: "https://github.com/jane/inventory", label: "Repo" },
              description: "<p>Built a REST API with TypeScript.</p>",
            },
          ],
        },
      },
    });

    const context = buildReviewerSkillContext(resumeData, "project", projectId, "Inventory API");

    expect(context.sectionType).toBe("project");
    expect(context.name).toBe("Inventory API");
    expect(context.period).toBe("2024");
    expect(context.description).toContain("REST API");
    expect(context).not.toHaveProperty("website");
  });

  it("falls back when the resume, project, or skill category is missing", () => {
    expect(buildReviewerSkillContext(null, "project", "missing", "Label")).toEqual({
      sectionType: "project",
      itemLabel: "Label",
      parentItemLabel: null,
      name: "Label",
      period: "",
      description: "",
    });
    expect(buildReviewerSkillContext(undefined, "skill", "missing", "Label")).toMatchObject({
      sectionType: "skill",
      itemLabel: "Label",
      parentItemLabel: null,
      proficiency: "",
      level: 0,
      keywords: [],
    });
  });
});

describe("buildRedactedRelatedExperience", () => {
  it("returns experience items mentioning the skill without company or location", () => {
    const resumeData = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        experience: {
          ...defaultResumeData.sections.experience,
          items: [
            {
              id: "exp-1",
              hidden: false,
              company: "Acme Corp",
              position: "Backend Engineer",
              location: "Berlin",
              period: "2022 - 2024",
              website: { url: "https://acme.example", label: "Acme" },
              description: "<p>Built services in C# and .NET.</p>",
              roles: [],
            },
            {
              id: "exp-2",
              hidden: false,
              company: "Other Inc",
              position: "Designer",
              location: "Paris",
              period: "2020 - 2021",
              website: { url: "", label: "" },
              description: "<p>UI design only.</p>",
              roles: [],
            },
          ],
        },
      },
    });

    const items = buildRedactedRelatedExperience(resumeData, "C#", "Programming Languages");

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      position: "Backend Engineer",
      period: "2022 - 2024",
      description: "<p>Built services in C# and .NET.</p>",
      roles: [],
    });
    expect(items[0]).not.toHaveProperty("company");
    expect(items[0]).not.toHaveProperty("location");
  });

  it("uses a role title when the job title is blank and stops at the requested limit", () => {
    const role = {
      id: "role-1",
      hidden: false,
      position: "Lead",
      period: "2020",
      description: "<p>C# lead</p>",
    };
    const resumeData = makeResumeData({
      sections: {
        ...defaultResumeData.sections,
        experience: {
          ...defaultResumeData.sections.experience,
          items: [
            {
              id: "hidden",
              hidden: true,
              company: "Hidden",
              position: "C#",
              location: "",
              period: "",
              website: { url: "", label: "" },
              description: "<p>C#</p>",
              roles: [],
            },
            {
              id: "exp",
              hidden: false,
              company: "",
              position: "",
              location: "",
              period: "",
              website: { url: "", label: "" },
              description: "<p>Used C#.</p>",
              roles: [role],
            },
            {
              id: "exp-2",
              hidden: false,
              company: "",
              position: "",
              location: "",
              period: "",
              website: { url: "", label: "" },
              description: "<p>More C#.</p>",
              roles: [],
            },
          ],
        },
      },
    });

    const limited = buildRedactedRelatedExperience(resumeData, "C#", null, 1);
    expect(limited).toHaveLength(1);
    expect(limited[0]?.position).toBe("Lead");
    expect(limited[0]?.roles).toEqual([{ position: "Lead", period: "2020", description: "<p>C# lead</p>" }]);

    const untitled = buildRedactedRelatedExperience(
      makeResumeData({
        sections: {
          ...defaultResumeData.sections,
          experience: {
            ...defaultResumeData.sections.experience,
            items: [
              {
                id: "exp",
                hidden: false,
                company: "",
                position: "",
                location: "",
                period: "",
                website: { url: "", label: "" },
                description: "<p>C# only.</p>",
                roles: [],
              },
            ],
          },
        },
      }),
      "C#",
      null,
    );
    expect(untitled[0]?.position).toBe("");
    expect(buildRedactedRelatedExperience(null, "C#", null)).toEqual([]);
    expect(
      buildRedactedRelatedExperience(
        { ...resumeData, sections: { ...resumeData.sections, experience: undefined } } as unknown as ResumeData,
        "C#",
        null,
      ),
    ).toEqual([]);
  });
});

describe("mapReviewerDocumentUrl", () => {
  it("returns proxied urls for file documents", () => {
    expect(mapReviewerDocumentUrl("req-1", "doc-1", "assessment_solution", "uploads/user/doc.pdf")).toBe(
      "/api/reviewer/documents/req-1/doc-1",
    );
  });

  it("returns external urls for link documents", () => {
    expect(
      mapReviewerDocumentUrl("req-1", "doc-1", "assessment_solution_link", "https://github.com/example/repo"),
    ).toBe("https://github.com/example/repo");
  });
});

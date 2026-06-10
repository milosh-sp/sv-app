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
    expect(result).not.toContain("tel:");
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

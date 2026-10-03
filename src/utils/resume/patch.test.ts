import { describe, expect, it } from "vite-plus/test";

import type { ResumeData } from "@/schema/resume/data";
import type { TailorOutput } from "@/schema/tailor";

import { defaultResumeData } from "@/schema/resume/data";

import { applyResumePatches, ResumePatchError } from "./patch";
import { tailorOutputToPatches } from "./tailor";

function resumeWithExperience(): ResumeData {
  return {
    ...defaultResumeData,
    summary: { ...defaultResumeData.summary, content: "<p>Original summary</p>" },
    sections: {
      ...defaultResumeData.sections,
      experience: {
        ...defaultResumeData.sections.experience,
        items: [
          {
            id: "exp-1",
            hidden: false,
            company: "TechCorp",
            position: "Engineer",
            location: "NYC",
            period: "2020-2024",
            website: { url: "", label: "" },
            description: "<p>Original description</p>",
            roles: [],
          },
        ],
      },
      skills: {
        ...defaultResumeData.sections.skills,
        items: [
          {
            id: "skill-0",
            hidden: false,
            icon: "",
            name: "JavaScript",
            proficiency: "Advanced",
            level: 4,
            keywords: ["React"],
          },
        ],
      },
    },
  };
}

describe("applyResumePatches", () => {
  it("replaces a field and leaves the original document unchanged", () => {
    const original = resumeWithExperience();
    const snapshot = structuredClone(original);

    const next = applyResumePatches(original, [
      { op: "replace", path: "/summary/content", value: "<p>Next summary</p>" },
    ]);

    expect(next.summary.content).toBe("<p>Next summary</p>");
    expect(original).toEqual(snapshot);
  });

  it("throws ResumePatchError with the failing operation index for a missing path", () => {
    let error: unknown;
    try {
      applyResumePatches(resumeWithExperience(), [
        { op: "replace", path: "/summary/content", value: "<p>Ok</p>" },
        { op: "replace", path: "/does/not/exist", value: "x" },
      ]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ResumePatchError);
    expect((error as ResumePatchError).code).toBe("OPERATION_PATH_UNRESOLVABLE");
    expect((error as ResumePatchError).index).toBe(1);
    expect((error as ResumePatchError).operation).toMatchObject({ path: "/does/not/exist" });
  });

  it("throws ResumePatchError when a test operation does not match", () => {
    let error: unknown;
    try {
      applyResumePatches(resumeWithExperience(), [
        { op: "replace", path: "/summary/content", value: "<p>Ok</p>" },
        { op: "test", path: "/summary/content", value: "<p>Wrong</p>" },
      ]);
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ResumePatchError);
    expect((error as ResumePatchError).code).toBe("TEST_OPERATION_FAILED");
    expect((error as ResumePatchError).index).toBe(1);
  });

  it("rejects a patch that clears a required experience field", () => {
    expect(() =>
      applyResumePatches(resumeWithExperience(), [
        { op: "replace", path: "/sections/experience/items/0/company", value: "" },
      ]),
    ).toThrow(/Patch produced invalid resume data/);
  });

  it("applies a tailor patch onto the resume", () => {
    const original = resumeWithExperience();
    const output: TailorOutput = {
      summary: { content: "<p>Tailored summary</p>" },
      experiences: [{ index: 0, description: "<p>Tailored role</p>", roles: [] }],
      references: [],
      skills: [
        {
          name: "TypeScript",
          keywords: ["types"],
          proficiency: "Advanced",
          icon: "",
          isNew: true,
        },
      ],
    };

    const { operations } = tailorOutputToPatches(output, original);
    const next = applyResumePatches(original, operations);

    expect(next.summary.content).toBe("<p>Tailored summary</p>");
    expect(next.sections.experience.items[0]?.description).toBe("<p>Tailored role</p>");
    expect(next.sections.skills.items[0]?.hidden).toBe(true);
    expect(next.sections.skills.items.some((skill) => skill.name === "TypeScript" && !skill.hidden)).toBe(true);
  });

  it("drops out-of-range tailor indexes and still applies", () => {
    const original = resumeWithExperience();
    const output: TailorOutput = {
      summary: { content: "" },
      experiences: [{ index: 99, description: "<p>Missing</p>", roles: [] }],
      references: [{ index: 50, description: "<p>Missing</p>" }],
      skills: [],
    };

    const { operations } = tailorOutputToPatches(output, original);

    expect(operations).toEqual([]);
    expect(applyResumePatches(original, operations)).toEqual(resumeWithExperience());
  });
});

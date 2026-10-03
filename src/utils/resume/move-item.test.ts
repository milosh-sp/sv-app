import { describe, expect, it, vi } from "vite-plus/test";

import type { ResumeData } from "@/schema/resume/data";

import { defaultResumeData } from "@/schema/resume/data";

import {
  addItemToSection,
  createCustomSectionWithItem,
  createPageWithSection,
  getCompatibleMoveTargets,
  getSourceSectionTitle,
  removeItemFromSource,
} from "./move-item";
import { getSectionTitle } from "./section";

vi.mock("./section", () => ({
  getSectionTitle: (type: string) => `title:${type}`,
}));

const experienceItem = {
  id: "exp-1",
  hidden: false,
  company: "TechCorp",
  position: "Engineer",
  location: "NYC",
  period: "2020-2024",
  website: { url: "", label: "" },
  description: "<p>Built things</p>",
  roles: [],
};

function resumeWithMoveTargets(): ResumeData {
  const resume = structuredClone(defaultResumeData);
  resume.customSections = [
    {
      id: "custom-a",
      type: "experience",
      title: "Contracts",
      columns: 1,
      hidden: false,
      items: [],
    },
    {
      id: "custom-b",
      type: "experience",
      title: "Internships",
      columns: 1,
      hidden: false,
      items: [],
    },
    {
      id: "custom-edu",
      type: "education",
      title: "Courses",
      columns: 1,
      hidden: false,
      items: [],
    },
  ];
  resume.metadata.layout.pages = [
    { fullWidth: false, main: ["experience", "custom-a"], sidebar: ["education"] },
    { fullWidth: false, main: ["custom-b", "custom-edu"], sidebar: [] },
  ];
  resume.sections.experience.items = [{ ...experienceItem }];
  return resume;
}

describe("resume section item moves", () => {
  it("lists same-type sections on other pages and skips the source and other types", () => {
    const resume = resumeWithMoveTargets();

    const fromBuiltIn = getCompatibleMoveTargets(resume, "experience", undefined);
    expect(fromBuiltIn[0]?.sections.map((section) => section.sectionId)).toEqual(["custom-a"]);
    expect(fromBuiltIn[1]?.sections.map((section) => section.sectionId)).toEqual(["custom-b"]);

    const fromCustom = getCompatibleMoveTargets(resume, "experience", "custom-a");
    expect(fromCustom[0]?.sections.map((section) => section.sectionId)).toEqual(["experience"]);
    expect(fromCustom[1]?.sections.map((section) => section.sectionId)).toEqual(["custom-b"]);
  });

  it("removes an item from a built-in section and returns null when it cannot", () => {
    const resume = resumeWithMoveTargets();

    const removed = removeItemFromSource(resume, "exp-1", "experience");
    expect(removed).toMatchObject({ id: "exp-1", company: "TechCorp" });
    expect(resume.sections.experience.items).toEqual([]);

    expect(removeItemFromSource(resume, "exp-1", "experience", "missing-section")).toBeNull();
    expect(removeItemFromSource(resumeWithMoveTargets(), "missing-item", "experience")).toBeNull();
    expect(removeItemFromSource(resumeWithMoveTargets(), "missing-item", "experience", "custom-b")).toBeNull();
  });

  it("adds an item to a custom section by id and to a standard section by type", () => {
    const resume = resumeWithMoveTargets();
    resume.sections.experience.items = [];

    addItemToSection(resume, experienceItem, "custom-b", "experience");
    expect(resume.customSections.find((section) => section.id === "custom-b")?.items).toEqual([experienceItem]);

    addItemToSection(resume, { ...experienceItem, id: "exp-2" }, "experience", "experience");
    expect(resume.sections.experience.items.map((item) => item.id)).toEqual(["exp-2"]);
  });

  it("creates a custom section on the target page main column", () => {
    const resume = resumeWithMoveTargets();
    const pageCount = resume.metadata.layout.pages.length;

    const sectionId = createCustomSectionWithItem(resume, experienceItem, "experience", "Freelance", 1);

    expect(resume.customSections.find((section) => section.id === sectionId)?.items).toEqual([experienceItem]);
    expect(resume.metadata.layout.pages[1]?.main).toContain(sectionId);
    expect(resume.metadata.layout.pages).toHaveLength(pageCount);
  });

  it("appends a page whose main column holds only the new section", () => {
    const resume = resumeWithMoveTargets();

    createPageWithSection(resume, experienceItem, "experience", "Freelance");

    const page = resume.metadata.layout.pages.at(-1);
    const sectionId = page?.main[0];
    expect(page).toMatchObject({ fullWidth: false, sidebar: [] });
    expect(page?.main).toEqual([sectionId]);
    expect(resume.customSections.find((section) => section.id === sectionId)?.title).toBe("Freelance");
  });

  it("uses the custom title and falls back when the section is missing", () => {
    const resume = resumeWithMoveTargets();

    expect(getSourceSectionTitle(resume, "experience", "custom-a")).toBe("Contracts");
    expect(getSourceSectionTitle(resume, "experience", "missing")).toBe(getSectionTitle("experience"));
    expect(getSourceSectionTitle(resume, "experience")).toBe("title:experience");
  });
});

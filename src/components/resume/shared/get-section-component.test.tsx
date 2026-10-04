import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

import { getSectionComponent } from "./get-section-component";

const sections = [
  ["summary", "PageSummary"],
  ["profiles", "ProfilesItem"],
  ["experience", "ExperienceItem"],
  ["education", "EducationItem"],
  ["projects", "ProjectsItem"],
  ["skills", "SkillsItem"],
  ["languages", "LanguagesItem"],
  ["interests", "InterestsItem"],
  ["awards", "AwardsItem"],
  ["certifications", "CertificationsItem"],
  ["publications", "PublicationsItem"],
  ["volunteer", "VolunteerItem"],
  ["references", "ReferencesItem"],
] as const;

describe("getSectionComponent", () => {
  it("resolves each section type to its item component", () => {
    for (const [type, item] of sections) {
      const Component = getSectionComponent(type, { sectionClassName: "section", itemClassName: "item" });
      expect(Component).toEqual(expect.any(Function));
      expect(Function.prototype.toString.call(Component)).toContain(item);
    }

    const custom = getSectionComponent("custom-1");
    expect(Function.prototype.toString.call(custom)).toContain("customSections");
  });
});

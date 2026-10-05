import { describe, expect, it } from "vite-plus/test";

import { ISO_COUNTRIES } from "@/constants/iso-countries";
import { icons } from "@/schema/icons";
import { resumeDataSchema } from "@/schema/resume/data";
import { sampleResumeData } from "@/schema/resume/sample";
import { techSkills } from "@/utils/verification/tech-skills";

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

describe("data catalogs", () => {
  it("keeps tech skill ids unique and labels filled in", () => {
    expect(techSkills.length).toBeGreaterThan(100);
    expect(duplicates(techSkills.map((skill) => skill.id))).toEqual([]);
    for (const skill of techSkills) {
      expect(skill.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(skill.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps icon names unique, with a single blank hide option", () => {
    expect(icons[0]).toBe("");
    expect(duplicates(icons)).toEqual([]);
    for (const name of icons.slice(1)) {
      expect(name).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("keeps ISO country codes unique", () => {
    expect(ISO_COUNTRIES.length).toBeGreaterThan(200);
    expect(duplicates(ISO_COUNTRIES.map((country) => country.code))).toEqual([]);
    for (const country of ISO_COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("parses the sample resume", () => {
    expect(resumeDataSchema.parse(sampleResumeData)).toEqual(sampleResumeData);
  });
});

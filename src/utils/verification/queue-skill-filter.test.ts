import { describe, expect, it } from "vite-plus/test";

import {
  buildReviewerQueueFilterOptions,
  filterQueueItemsBySkills,
  PROJECT_QUEUE_FILTER_VALUE,
  sanitizeQueueSkillFilter,
} from "./queue-skill-filter";

type TestItem = {
  id: string;
  sectionType: string;
  itemLabel: string;
};

const items: TestItem[] = [
  { id: "skill-ts", sectionType: "skill", itemLabel: "TypeScript" },
  { id: "skill-rust", sectionType: "skill", itemLabel: "Rust" },
  { id: "skill-js", sectionType: "skill", itemLabel: "Javascript" },
  { id: "project-1", sectionType: "project", itemLabel: "My App" },
];

describe("buildReviewerQueueFilterOptions", () => {
  it("returns assigned skills as options", () => {
    const options = buildReviewerQueueFilterOptions(["TypeScript", "React"], false);
    expect(options).toEqual([
      { value: "TypeScript", label: "TypeScript" },
      { value: "React", label: "React" },
    ]);
  });

  it("appends Projects option when queue has projects", () => {
    const options = buildReviewerQueueFilterOptions(["TypeScript"], true);
    expect(options).toEqual([
      { value: "TypeScript", label: "TypeScript" },
      { value: PROJECT_QUEUE_FILTER_VALUE, label: "Projects" },
    ]);
  });
});

describe("sanitizeQueueSkillFilter", () => {
  it("keeps only allowed values", () => {
    const allowed = ["TypeScript", PROJECT_QUEUE_FILTER_VALUE];
    expect(sanitizeQueueSkillFilter(["TypeScript", "Rust", PROJECT_QUEUE_FILTER_VALUE], allowed)).toEqual([
      "TypeScript",
      PROJECT_QUEUE_FILTER_VALUE,
    ]);
  });
});

describe("filterQueueItemsBySkills", () => {
  it("returns all items when no skills are selected", () => {
    expect(filterQueueItemsBySkills(items, [])).toEqual(items);
  });

  it("filters to matching skills only", () => {
    const result = filterQueueItemsBySkills(items, ["TypeScript"]);
    expect(result.map((item) => item.id)).toEqual(["skill-ts"]);
  });

  it("matches skills with alias or casing differences", () => {
    const result = filterQueueItemsBySkills(items, ["JavaScript"]);
    expect(result.map((item) => item.id)).toEqual(["skill-js"]);
  });

  it("shows projects only when Projects filter is selected", () => {
    expect(filterQueueItemsBySkills(items, ["TypeScript"]).map((item) => item.id)).toEqual(["skill-ts"]);
    expect(filterQueueItemsBySkills(items, [PROJECT_QUEUE_FILTER_VALUE]).map((item) => item.id)).toEqual(["project-1"]);
  });

  it("uses OR logic for combined skill and project filters", () => {
    const result = filterQueueItemsBySkills(items, ["TypeScript", PROJECT_QUEUE_FILTER_VALUE]);
    expect(result.map((item) => item.id)).toEqual(["skill-ts", "project-1"]);
  });
});

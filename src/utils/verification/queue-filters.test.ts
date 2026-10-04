import { describe, expect, it } from "vite-plus/test";

import {
  buildAllowedFilterValues,
  buildFilterOptionsFromItems,
  buildReviewerQueueFilterOptions,
  filterQueueItems,
  filterQueueItemsBySkills,
  hasActiveQueueFilters,
  PROJECT_QUEUE_FILTER_VALUE,
  sanitizeQueueFilters,
  sanitizeQueueSkillFilter,
  shouldShowMultiSelectFilter,
  type QueueFilterAllowedValues,
} from "./queue-filters";

type TestItem = {
  id: string;
  sectionType: string;
  itemLabel: string;
  parentItemLabel?: string | null;
  status?: string;
  proposedVerdict?: "verified" | "rejected" | "issue" | null;
};

const items: TestItem[] = [
  {
    id: "skill-ts",
    sectionType: "skill",
    itemLabel: "TypeScript",
    parentItemLabel: "Programming Languages",
    status: "pending",
  },
  {
    id: "skill-rust",
    sectionType: "skill",
    itemLabel: "Rust",
    parentItemLabel: "Programming Languages",
    status: "pending",
  },
  {
    id: "skill-js",
    sectionType: "skill",
    itemLabel: "Javascript",
    parentItemLabel: "Programming Languages",
    status: "pending",
  },
  {
    id: "project-1",
    sectionType: "project",
    itemLabel: "My App",
    parentItemLabel: "Projects",
    status: "pending",
  },
  {
    id: "skill-blank-parent",
    sectionType: "skill",
    itemLabel: "Orphan",
    status: "pending",
  },
];

const myCaseItems: TestItem[] = [
  {
    id: "case-1",
    sectionType: "skill",
    itemLabel: "React",
    parentItemLabel: "Frameworks & Libraries",
    status: "claimed",
    proposedVerdict: null,
  },
  {
    id: "case-2",
    sectionType: "skill",
    itemLabel: "TypeScript",
    parentItemLabel: "Programming Languages",
    status: "verdict_pending",
    proposedVerdict: "rejected",
  },
  {
    id: "case-3",
    sectionType: "skill",
    itemLabel: "Vue",
    parentItemLabel: "Frameworks & Libraries",
    status: "verdict_pending",
    proposedVerdict: "verified",
  },
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

describe("buildFilterOptionsFromItems", () => {
  it("builds queue options from assigned skills", () => {
    const options = buildFilterOptionsFromItems(items, ["TypeScript", "React"], "queue");
    expect(options.skills.map((option) => option.value)).toEqual(["TypeScript", "React", PROJECT_QUEUE_FILTER_VALUE]);
  });

  it("omits category options when fewer than two categories exist", () => {
    const options = buildFilterOptionsFromItems(
      items.filter((item) => item.id !== "project-1"),
      ["TypeScript"],
      "queue",
    );
    expect(options.categories).toEqual([]);
  });

  it("includes category options when two or more categories exist", () => {
    const options = buildFilterOptionsFromItems(items, ["TypeScript"], "queue");
    expect(options.categories.map((option) => option.value)).toEqual(["Programming Languages", "Projects"]);
    expect(buildAllowedFilterValues(options).categories).toEqual(["Programming Languages", "Projects"]);
  });

  it("always includes both my-case statuses when cases exist", () => {
    const options = buildFilterOptionsFromItems(myCaseItems, [], "cases");
    expect(options.statuses.map((option) => option.value)).toEqual(["claimed", "verdict_pending"]);
  });

  it("includes proposed options present in my cases", () => {
    const options = buildFilterOptionsFromItems(myCaseItems, [], "cases");
    expect(options.proposed.map((option) => option.value)).toEqual(["verified", "rejected"]);
    expect(buildAllowedFilterValues(options).proposed).toEqual(["verified", "rejected"]);
  });

  it("includes type options when both skills and projects exist", () => {
    const options = buildFilterOptionsFromItems(items, ["TypeScript"], "queue");
    expect(options.types.map((option) => option.value)).toEqual(["skill", "project"]);
    expect(buildAllowedFilterValues(options)).toMatchObject({
      types: ["skill", "project"],
      skills: expect.arrayContaining(["TypeScript"]),
    });
  });

  it("lists only the history statuses that appear, and ignores a blank status", () => {
    const options = buildFilterOptionsFromItems(
      [
        { ...items[0], status: "verified" },
        { ...items[1], status: "issue" },
        { ...items[2], status: "" },
      ],
      [],
      "history",
    );
    expect(options.statuses.map((option) => option.value)).toEqual(["verified", "issue"]);
    expect(buildAllowedFilterValues(options).statuses).toEqual(["verified", "issue"]);
    expect(shouldShowMultiSelectFilter(options.statuses)).toBe(true);
    expect(shouldShowMultiSelectFilter([])).toBe(false);
    expect(hasActiveQueueFilters({ skills: [], categories: [], statuses: [], proposed: [], types: [] })).toBe(false);
    expect(
      hasActiveQueueFilters({ skills: ["TypeScript"], categories: [], statuses: [], proposed: [], types: [] }),
    ).toBe(true);
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

describe("sanitizeQueueFilters", () => {
  it("drops unknown values across all dimensions", () => {
    const allowed: QueueFilterAllowedValues = {
      skills: ["TypeScript"],
      categories: ["Programming Languages"],
      statuses: ["claimed"],
      proposed: ["verified"],
      types: ["skill"],
    };

    expect(
      sanitizeQueueFilters(
        {
          skills: ["TypeScript", "Rust"],
          categories: ["Programming Languages", "Other"],
          statuses: ["claimed", "pending"],
          proposed: ["verified", "rejected"],
          types: ["skill", "project"],
        },
        allowed,
      ),
    ).toEqual({
      skills: ["TypeScript"],
      categories: ["Programming Languages"],
      statuses: ["claimed"],
      proposed: ["verified"],
      types: ["skill"],
    });
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

describe("filterQueueItems", () => {
  it("combines filters with AND logic", () => {
    const result = filterQueueItems(myCaseItems, {
      skills: ["TypeScript"],
      categories: ["Programming Languages"],
      statuses: ["verdict_pending"],
      proposed: ["rejected"],
      types: [],
    });

    expect(result.map((item) => item.id)).toEqual(["case-2"]);
  });

  it("filters by category", () => {
    const result = filterQueueItems(myCaseItems, {
      skills: [],
      categories: ["Frameworks & Libraries"],
      statuses: [],
      proposed: [],
      types: [],
    });

    expect(result.map((item) => item.id)).toEqual(["case-1", "case-3"]);
  });

  it("filters by status and proposed verdict", () => {
    const result = filterQueueItems(myCaseItems, {
      skills: [],
      categories: [],
      statuses: ["verdict_pending"],
      proposed: ["verified"],
      types: [],
    });

    expect(result.map((item) => item.id)).toEqual(["case-3"]);
  });

  it("filters by section type", () => {
    const result = filterQueueItems(items, {
      skills: [],
      categories: [],
      statuses: [],
      proposed: [],
      types: ["project"],
    });

    expect(result.map((item) => item.id)).toEqual(["project-1"]);
  });
});

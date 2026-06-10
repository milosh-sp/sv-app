import type { ComboboxOption } from "@/components/ui/combobox";

import { reviewerCanReviewSkill } from "./skills";

export const PROJECT_QUEUE_FILTER_VALUE = "__project__";

export type QueueFilterTab = "queue" | "cases" | "history";

export type ProposedVerdict = "verified" | "rejected" | "issue";
export type SectionType = "skill" | "project";

export type QueueFilterableItem = {
  sectionType: string;
  itemLabel: string;
  parentItemLabel?: string | null;
  status?: string;
  proposedVerdict?: ProposedVerdict | null;
};

export type QueueFilterParams = {
  skills: string[];
  categories: string[];
  statuses: string[];
  proposed: ProposedVerdict[];
  types: SectionType[];
};

export type QueueFilterOptions = {
  skills: ComboboxOption<string>[];
  categories: ComboboxOption<string>[];
  statuses: ComboboxOption<string>[];
  proposed: ComboboxOption<ProposedVerdict>[];
  types: ComboboxOption<SectionType>[];
};

export type QueueFilterAllowedValues = {
  skills: string[];
  categories: string[];
  statuses: string[];
  proposed: ProposedVerdict[];
  types: SectionType[];
};

const PROPOSED_VERDICT_LABELS: Record<ProposedVerdict, string> = {
  verified: "Proposed: Pass",
  rejected: "Proposed: Fail",
  issue: "Proposed: Issue",
};

const MY_CASES_STATUS_OPTIONS: ComboboxOption<string>[] = [
  { value: "claimed", label: "Claimed" },
  { value: "verdict_pending", label: "Verdict Pending" },
];

export function buildReviewerQueueFilterOptions(
  assignedSkills: string[],
  hasProjects: boolean,
): ComboboxOption<string>[] {
  const options: ComboboxOption<string>[] = assignedSkills.map((skill) => ({
    value: skill,
    label: skill,
  }));

  if (hasProjects) {
    options.push({
      value: PROJECT_QUEUE_FILTER_VALUE,
      label: "Projects",
    });
  }

  return options;
}

export function buildFilterOptionsFromItems<T extends QueueFilterableItem>(
  items: T[],
  assignedSkills: string[],
  tab: QueueFilterTab,
): QueueFilterOptions {
  const hasProjects = items.some((item) => item.sectionType === "project");
  const hasSkills = items.some((item) => item.sectionType === "skill");

  let skillValues: string[];
  if (tab === "queue") {
    skillValues = [...assignedSkills];
  } else {
    const itemLabels = items.filter((item) => item.sectionType !== "project").map((item) => item.itemLabel);
    skillValues = [...new Set([...assignedSkills, ...itemLabels])].sort((a, b) => a.localeCompare(b));
  }

  const skills: ComboboxOption<string>[] = skillValues.map((skill) => ({
    value: skill,
    label: skill,
  }));

  if (hasProjects) {
    skills.push({
      value: PROJECT_QUEUE_FILTER_VALUE,
      label: "Projects",
    });
  }

  const categorySet = new Set<string>();
  for (const item of items) {
    if (item.parentItemLabel) {
      categorySet.add(item.parentItemLabel);
    }
  }
  const categories =
    categorySet.size >= 2
      ? [...categorySet]
          .sort((a, b) => a.localeCompare(b))
          .map((category) => ({
            value: category,
            label: category,
          }))
      : [];

  const statuses: ComboboxOption<string>[] = [];
  if (tab === "cases" && items.length > 0) {
    statuses.push(...MY_CASES_STATUS_OPTIONS);
  } else if (tab === "history") {
    const statusValues = new Set(items.map((item) => item.status).filter(Boolean));
    for (const status of ["verified", "rejected", "issue"] as const) {
      if (statusValues.has(status)) {
        statuses.push({
          value: status,
          label: status.charAt(0).toUpperCase() + status.slice(1),
        });
      }
    }
  }

  const proposedInData = new Set(
    items.map((item) => item.proposedVerdict).filter((value): value is ProposedVerdict => value != null),
  );
  const proposed: ComboboxOption<ProposedVerdict>[] = [];
  for (const verdict of ["verified", "rejected", "issue"] as const) {
    if (proposedInData.has(verdict)) {
      proposed.push({
        value: verdict,
        label: PROPOSED_VERDICT_LABELS[verdict],
      });
    }
  }

  const types: ComboboxOption<SectionType>[] = [];
  if (hasSkills && hasProjects) {
    types.push({ value: "skill", label: "Skill" }, { value: "project", label: "Project" });
  }

  return { skills, categories, statuses, proposed, types };
}

export function buildAllowedFilterValues(options: QueueFilterOptions): QueueFilterAllowedValues {
  return {
    skills: options.skills.map((option) => option.value),
    categories: options.categories.map((option) => option.value),
    statuses: options.statuses.map((option) => option.value),
    proposed: options.proposed.map((option) => option.value),
    types: options.types.map((option) => option.value),
  };
}

export function sanitizeQueueSkillFilter(selectedSkills: string[], allowedValues: string[]): string[] {
  const allowed = new Set(allowedValues);
  return selectedSkills.filter((skill) => allowed.has(skill));
}

export function sanitizeQueueFilters(params: QueueFilterParams, allowed: QueueFilterAllowedValues): QueueFilterParams {
  return {
    skills: sanitizeQueueSkillFilter(params.skills, allowed.skills),
    categories: params.categories.filter((value) => allowed.categories.includes(value)),
    statuses: params.statuses.filter((value) => allowed.statuses.includes(value)),
    proposed: params.proposed.filter((value) => allowed.proposed.includes(value)),
    types: params.types.filter((value) => allowed.types.includes(value)),
  };
}

export function hasActiveQueueFilters(params: QueueFilterParams): boolean {
  return (
    params.skills.length > 0 ||
    params.categories.length > 0 ||
    params.statuses.length > 0 ||
    params.proposed.length > 0 ||
    params.types.length > 0
  );
}

export function shouldShowMultiSelectFilter(options: unknown[]): boolean {
  return options.length >= 2;
}

export function filterQueueItemsBySkills<T extends QueueFilterableItem>(
  items: T[],
  selectedSkills: string[],
  projectFilterValue: string = PROJECT_QUEUE_FILTER_VALUE,
): T[] {
  if (selectedSkills.length === 0) {
    return items;
  }

  const skillFilters = selectedSkills.filter((skill) => skill !== projectFilterValue);
  const includeProjects = selectedSkills.includes(projectFilterValue);

  return items.filter((item) => {
    if (item.sectionType === "project") {
      return includeProjects;
    }

    return reviewerCanReviewSkill(skillFilters, item.itemLabel);
  });
}

export function filterQueueItems<T extends QueueFilterableItem>(items: T[], params: QueueFilterParams): T[] {
  let result = items;

  if (params.skills.length > 0) {
    result = filterQueueItemsBySkills(result, params.skills);
  }

  if (params.categories.length > 0) {
    const categories = new Set(params.categories);
    result = result.filter((item) => item.parentItemLabel != null && categories.has(item.parentItemLabel));
  }

  if (params.statuses.length > 0) {
    const statuses = new Set(params.statuses);
    result = result.filter((item) => item.status != null && statuses.has(item.status));
  }

  if (params.proposed.length > 0) {
    const proposed = new Set(params.proposed);
    result = result.filter((item) => item.proposedVerdict != null && proposed.has(item.proposedVerdict));
  }

  if (params.types.length > 0) {
    const types = new Set(params.types);
    result = result.filter((item) => types.has(item.sectionType as SectionType));
  }

  return result;
}

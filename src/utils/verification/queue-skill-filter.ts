import type { ComboboxOption } from "@/components/ui/combobox";

import { reviewerCanReviewSkill } from "./skills";

export const PROJECT_QUEUE_FILTER_VALUE = "__project__";

export type QueueFilterableItem = {
  sectionType: string;
  itemLabel: string;
};

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

export function sanitizeQueueSkillFilter(selectedSkills: string[], allowedValues: string[]): string[] {
  const allowed = new Set(allowedValues);
  return selectedSkills.filter((skill) => allowed.has(skill));
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

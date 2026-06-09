import type { skillItemSchema } from "@/schema/resume/data";
import type z from "zod";
import { v5 as uuidv5 } from "uuid";

/** Fixed namespace for deterministic per-keyword verification IDs. */
export const SKILL_KEYWORD_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export type SkillItem = z.infer<typeof skillItemSchema>;

export type VerifiableSkillUnit = {
  itemId: string;
  itemLabel: string;
  parentItemId: string;
  parentItemLabel: string;
};

export function normalizeSkillLabel(label: string): string {
  return label.trim().toLowerCase();
}

export function deriveSkillKeywordId(parentItemId: string, keyword: string): string {
  return uuidv5(`${parentItemId}:${normalizeSkillLabel(keyword)}`, SKILL_KEYWORD_NAMESPACE);
}

function dedupeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const keyword of keywords) {
    const trimmed = keyword.trim();
    if (!trimmed) continue;

    const key = normalizeSkillLabel(trimmed);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function expandSkillItemsForVerification(items: SkillItem[]): VerifiableSkillUnit[] {
  const units: VerifiableSkillUnit[] = [];

  for (const item of items) {
    if (item.hidden) continue;

    const visibleKeywords = dedupeKeywords(item.keywords);

    if (visibleKeywords.length > 0) {
      for (const keyword of visibleKeywords) {
        units.push({
          itemId: deriveSkillKeywordId(item.id, keyword),
          itemLabel: keyword,
          parentItemId: item.id,
          parentItemLabel: item.name,
        });
      }
    } else {
      units.push({
        itemId: item.id,
        itemLabel: item.name,
        parentItemId: item.id,
        parentItemLabel: item.name,
      });
    }
  }

  return units;
}

export function findVerifiableSkillUnit(
  items: SkillItem[],
  itemId: string,
): VerifiableSkillUnit | undefined {
  return expandSkillItemsForVerification(items).find((unit) => unit.itemId === itemId);
}

export function findSkillCategoryForVerificationId(
  items: SkillItem[],
  itemId: string,
): { parentItemLabel: string; itemLabel: string } | null {
  const unit = findVerifiableSkillUnit(items, itemId);
  if (!unit) return null;

  return {
    parentItemLabel: unit.parentItemLabel,
    itemLabel: unit.itemLabel,
  };
}

export function normalizeReviewerSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;

    const key = normalizeSkillLabel(trimmed);
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function reviewerCanReviewSkill(reviewerSkills: string[], itemLabel: string): boolean {
  const normalized = normalizeSkillLabel(itemLabel);
  return reviewerSkills.some((skill) => normalizeSkillLabel(skill) === normalized);
}

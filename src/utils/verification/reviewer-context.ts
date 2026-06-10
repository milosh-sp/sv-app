import type { ResumeData } from "@/schema/resume/data";

import { findSkillCategoryForVerificationId, findVerifiableSkillUnit } from "./skills";

export type ReviewerSkillContext = {
  sectionType: "skill" | "project";
  itemLabel: string;
  parentItemLabel: string | null;
  proficiency?: string;
  level?: number;
  keywords?: string[];
  name?: string;
  period?: string;
  description?: string;
};

export type RedactedExperienceRole = {
  position: string;
  period: string;
  description: string;
};

export type RedactedExperienceItem = {
  position: string;
  period: string;
  description: string;
  roles: RedactedExperienceRole[];
};

const MAX_RELATED_EXPERIENCE = 5;

export function formatReviewerCaseId(requestId: string): string {
  return requestId.replace(/-/g, "").slice(-8).toUpperCase();
}

/** Server-safe HTML cleanup. DOMPurify is browser-only and cannot run in oRPC handlers. */
export function stripIdentifyingHtml(html: string): string {
  if (!html) return "";

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<a[^>]*href\s*=\s*["']?mailto:[^"'>]*["']?[^>]*>.*?<\/a>/gi, "")
    .replace(/<a[^>]*href\s*=\s*["']?tel:[^"'>]*["']?[^>]*>.*?<\/a>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
}

export function buildReviewerSkillContext(
  resumeData: ResumeData | null | undefined,
  sectionType: string,
  itemId: string,
  itemLabel: string,
): ReviewerSkillContext {
  if (sectionType === "project") {
    const project = resumeData?.sections.projects?.items.find((item) => item.id === itemId && !item.hidden);

    return {
      sectionType: "project",
      itemLabel,
      parentItemLabel: null,
      name: project?.name ?? itemLabel,
      period: project?.period ?? "",
      description: project ? stripIdentifyingHtml(project.description) : "",
    };
  }

  const skillItems = resumeData?.sections.skills?.items ?? [];
  const category = findSkillCategoryForVerificationId(skillItems, itemId);
  const unit = findVerifiableSkillUnit(skillItems, itemId);
  const parentSkill = unit ? skillItems.find((item) => item.id === unit.parentItemId && !item.hidden) : undefined;

  const resolvedItemLabel = category?.itemLabel ?? itemLabel;
  const resolvedParentLabel =
    category && category.parentItemLabel !== category.itemLabel ? category.parentItemLabel : null;

  return {
    sectionType: "skill",
    itemLabel: resolvedItemLabel,
    parentItemLabel: resolvedParentLabel,
    proficiency: parentSkill?.proficiency ?? "",
    level: parentSkill?.level ?? 0,
    keywords: parentSkill?.keywords?.filter(Boolean) ?? [],
  };
}

function textMentionsSkill(text: string, skillLabel: string, parentLabel: string | null): boolean {
  const haystack = text.toLowerCase();
  const needles = [skillLabel, parentLabel].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());

  return needles.some((needle) => haystack.includes(needle));
}

export function buildRedactedRelatedExperience(
  resumeData: ResumeData | null | undefined,
  skillLabel: string,
  parentItemLabel: string | null,
  maxItems = MAX_RELATED_EXPERIENCE,
): RedactedExperienceItem[] {
  if (!resumeData) return [];

  const matched: RedactedExperienceItem[] = [];

  for (const item of resumeData.sections.experience?.items ?? []) {
    if (item.hidden) continue;

    const roleTexts = item.roles.map((role) => `${role.position} ${role.description}`).join(" ");
    const fullText = `${item.position} ${item.description} ${roleTexts}`;

    if (!textMentionsSkill(fullText, skillLabel, parentItemLabel)) continue;

    matched.push({
      position: item.position || item.roles[0]?.position || "",
      period: item.period,
      description: stripIdentifyingHtml(item.description),
      roles: item.roles.map((role) => ({
        position: role.position,
        period: role.period,
        description: stripIdentifyingHtml(role.description),
      })),
    });

    if (matched.length >= maxItems) break;
  }

  return matched;
}

export function mapReviewerDocumentUrl(requestId: string, documentId: string, documentType: string, externalUrl: string) {
  if (documentType === "freelancer_link" || documentType === "assessment_solution_link") {
    return externalUrl;
  }

  return `/api/reviewer/documents/${requestId}/${documentId}`;
}

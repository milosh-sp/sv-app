import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { WarningCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/utils/sanitize";

type ReviewerQueueItem = RouterOutput["admin"]["verification"]["listQueue"][number];

export function ReviewerCaseLabel({ caseLabel }: { caseLabel: string }) {
  return (
    <p className="truncate text-xs text-muted-foreground">
      <Trans>Case</Trans> #{caseLabel}
    </p>
  );
}

export function ReviewerSkillContextPanel({ skillContext }: { skillContext: ReviewerQueueItem["skillContext"] }) {
  if (skillContext.sectionType === "project") {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          <Trans>Project context</Trans>
        </p>
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(7rem,auto)_1fr]">
            <dt className="text-muted-foreground">
              <Trans>Project</Trans>
            </dt>
            <dd className="wrap-break-word">{skillContext.name ?? skillContext.itemLabel}</dd>

            {skillContext.period ? (
              <>
                <dt className="text-muted-foreground">
                  <Trans>Period</Trans>
                </dt>
                <dd>{skillContext.period}</dd>
              </>
            ) : null}

            {skillContext.description ? (
              <>
                <dt className="text-muted-foreground">
                  <Trans>Description</Trans>
                </dt>
                <dd
                  className="prose prose-sm dark:prose-invert max-w-none wrap-break-word"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(skillContext.description) }}
                />
              </>
            ) : null}
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Skill context</Trans>
      </p>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(7rem,auto)_1fr]">
          <dt className="text-muted-foreground">
            <Trans>Skill</Trans>
          </dt>
          <dd className="wrap-break-word">{skillContext.itemLabel}</dd>

          {skillContext.parentItemLabel ? (
            <>
              <dt className="text-muted-foreground">
                <Trans>Category</Trans>
              </dt>
              <dd className="wrap-break-word">{skillContext.parentItemLabel}</dd>
            </>
          ) : null}

          {skillContext.proficiency ? (
            <>
              <dt className="text-muted-foreground">
                <Trans>Proficiency</Trans>
              </dt>
              <dd>{skillContext.proficiency}</dd>
            </>
          ) : null}

          {skillContext.level != null && skillContext.level > 0 ? (
            <>
              <dt className="text-muted-foreground">
                <Trans>Level</Trans>
              </dt>
              <dd>{skillContext.level}/5</dd>
            </>
          ) : null}

          {skillContext.keywords && skillContext.keywords.length > 0 ? (
            <>
              <dt className="text-muted-foreground">
                <Trans>Related keywords</Trans>
              </dt>
              <dd>{skillContext.keywords.join(", ")}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function RedactedExperiencePanel({
  relatedExperience,
}: {
  relatedExperience: ReviewerQueueItem["relatedExperience"];
}) {
  const [expanded, setExpanded] = useState(false);

  if (relatedExperience.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-x-2">
        <p className="text-xs font-medium text-muted-foreground">
          <Trans>Related experience</Trans>
        </p>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Trans>Hide</Trans> : <Trans>Show</Trans>}
        </Button>
      </div>

      {!expanded ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Employer names and locations are hidden to keep review anonymous.</Trans>
        </p>
      ) : (
        <div className="space-y-2">
          {relatedExperience.map((experience, index) => (
            <div key={`${experience.position}-${experience.period}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
              <p className="font-medium">{experience.position || t`Role`}</p>
              {experience.period ? <p className="text-muted-foreground">{experience.period}</p> : null}
              {experience.description ? (
                <div
                  className="prose prose-sm dark:prose-invert mt-2 max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(experience.description) }}
                />
              ) : null}
              {experience.roles.length > 0 ? (
                <div className="mt-2 space-y-2 border-t pt-2">
                  {experience.roles.map((role, roleIndex) => (
                    <div key={`${role.position}-${role.period}-${roleIndex}`}>
                      <p className="font-medium">{role.position}</p>
                      {role.period ? <p className="text-muted-foreground">{role.period}</p> : null}
                      {role.description ? (
                        <div
                          className="prose prose-sm dark:prose-invert mt-1 max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(role.description) }}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewerSubmissionContext({ item }: { item: ReviewerQueueItem }) {
  return (
    <div className="space-y-3">
      <ReviewerSkillContextPanel skillContext={item.skillContext} />
      <RedactedExperiencePanel relatedExperience={item.relatedExperience} />
    </div>
  );
}

export function ExternalLinkWarning() {
  return (
    <p className="flex items-center gap-x-2 rounded-md border border-orange-500/30 bg-orange-50/50 px-3 py-2 text-xs text-orange-800 dark:bg-orange-900/20 dark:text-orange-300">
      <WarningCircleIcon className="size-3.5 shrink-0" weight="fill" />
      <Trans>External link — may contain identifying information. Evaluate the technical content only.</Trans>
    </p>
  );
}

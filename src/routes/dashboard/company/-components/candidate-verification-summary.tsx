import { Trans } from "@lingui/react/macro";
import { BriefcaseIcon, SealCheckIcon } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";

type CandidateVerificationSummaryProps = {
  verifiedSkills: string[];
  verifiedExperiences: string[];
  skillLimit?: number;
  experienceLimit?: number;
};

export function CandidateVerificationSummary({
  verifiedSkills,
  verifiedExperiences,
  skillLimit = 6,
  experienceLimit = 4,
}: CandidateVerificationSummaryProps) {
  const skills = verifiedSkills.slice(0, skillLimit);
  const experiences = verifiedExperiences.slice(0, experienceLimit);

  if (skills.length === 0 && experiences.length === 0) return null;

  return (
    <div className="space-y-2">
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((skill) => (
            <Badge key={skill} variant="outline" className="gap-x-1">
              <SealCheckIcon className="size-3" />
              {skill}
            </Badge>
          ))}
        </div>
      )}

      {experiences.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            <Trans>Verified experience</Trans>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {experiences.map((experience) => (
              <Badge key={experience} variant="outline" className="gap-x-1">
                <BriefcaseIcon className="size-3" />
                {experience}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function IdentityVerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;

  return (
    <Badge variant="secondary" className="gap-x-1 shrink-0">
      <SealCheckIcon className="size-3" />
      <Trans>Identity verified</Trans>
    </Badge>
  );
}

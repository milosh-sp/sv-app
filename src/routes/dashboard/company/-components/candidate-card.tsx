import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

import { type Candidate, CandidateActions, type CandidateActionFlags } from "./candidate-actions";
import { CandidateVerificationSummary, IdentityVerifiedBadge } from "./candidate-verification-summary";

type CandidateCardProps = {
  candidate: Candidate;
  /** Rendered next to the name, e.g. a match score. */
  aside?: React.ReactNode;
  /** Rendered below the verification summary, e.g. a match reason. */
  children?: React.ReactNode;
  skillLimit?: number;
  onView: () => void;
  onFlagsChange?: (flags: Partial<CandidateActionFlags>) => void;
};

export function CandidateCard({ candidate, aside, children, skillLimit, onView, onFlagsChange }: CandidateCardProps) {
  return (
    <div className="flex flex-col gap-y-3 rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate font-medium">{candidate.displayName}</h3>
            <IdentityVerifiedBadge verified={candidate.identityVerified} />
          </div>
          {candidate.headline && <p className="truncate text-sm text-muted-foreground">{candidate.headline}</p>}
        </div>
        {aside}
      </div>

      <CandidateVerificationSummary
        verifiedSkills={candidate.verifiedSkills}
        verifiedExperiences={candidate.verifiedExperiences}
        skillLimit={skillLimit}
      />

      {children}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CandidateActions candidate={candidate} onFlagsChange={onFlagsChange} />
        <Button size="sm" variant="ghost" onClick={onView}>
          <Trans>View profile</Trans>
          <ArrowRightIcon />
        </Button>
      </div>
    </div>
  );
}

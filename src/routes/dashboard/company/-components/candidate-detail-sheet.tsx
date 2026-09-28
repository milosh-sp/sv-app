import { t } from "@lingui/core/macro";
import { useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { type Candidate, CandidateActions, type CandidateActionFlags } from "./candidate-actions";
import { CandidateResumePreview } from "./candidate-resume-preview";
import { CandidateVerificationSummary, IdentityVerifiedBadge } from "./candidate-verification-summary";

type CandidateDetailSheetProps<T extends Candidate> = {
  /** The sheet is open while a candidate is selected. */
  candidate: T | null;
  onClose: () => void;
  /** Rendered above the verification summary, e.g. match score and reason. */
  renderExtra?: (candidate: T) => React.ReactNode;
  onFlagsChange?: (candidate: T, flags: Partial<CandidateActionFlags>) => void;
};

export function CandidateDetailSheet<T extends Candidate>({
  candidate,
  onClose,
  renderExtra,
  onFlagsChange,
}: CandidateDetailSheetProps<T>) {
  // Keep rendering the last candidate while the sheet animates closed.
  const [shown, setShown] = useState(candidate);
  if (candidate && candidate !== shown) setShown(candidate);

  return (
    <Sheet open={candidate !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="overflow-y-auto data-[side=right]:sm:max-w-2xl">
        {shown && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <span>{shown.displayName}</span>
                <IdentityVerifiedBadge verified={shown.identityVerified} />
              </SheetTitle>
              <SheetDescription>{shown.headline || t`Vetted candidate`}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 pb-6">
              {renderExtra?.(shown)}

              <CandidateVerificationSummary
                verifiedSkills={shown.verifiedSkills}
                verifiedExperiences={shown.verifiedExperiences}
                skillLimit={20}
                experienceLimit={20}
              />

              {shown.slug && <CandidateResumePreview username={shown.username} slug={shown.slug} />}

              <CandidateActions candidate={shown} onFlagsChange={(flags) => onFlagsChange?.(shown, flags)} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

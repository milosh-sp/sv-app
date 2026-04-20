import { Trans } from "@lingui/react/macro";
import { SealCheckIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { SKILL_VERDICT_LINKS } from "@/constants/brand";

import { SectionBase } from "../shared/section-base";

export function InformationSectionBuilder() {
  return (
    <SectionBase type="information" className="space-y-4">
      <div className="space-y-2 rounded-md border bg-sky-600 p-5 text-white dark:bg-sky-700">
        <h4 className="font-medium tracking-tight">
          <Trans>Turn your CV2.0 into verified evidence</Trans>
        </h4>

        <div className="space-y-2 text-xs leading-normal">
          <Trans>
            <p>
              Skill Verdict helps you go beyond keywords. Get your skills peer-verified by experienced Gurus, earn
              shareable skill badges, and let employers discover you through your CV2.0.
            </p>
            <p>Finish your resume here, then get it verified on Skill Verdict to stand out.</p>
          </Trans>
        </div>

        <Button
          size="sm"
          variant="default"
          nativeButton={false}
          className="mt-2 px-4! text-xs whitespace-normal"
          render={
            <a href={SKILL_VERDICT_LINKS.candidate} target="_blank" rel="noopener noreferrer">
              <SealCheckIcon />
              <span className="truncate">
                <Trans>Verify my skills</Trans>
              </span>
            </a>
          }
        />
      </div>

      <div className="flex flex-wrap gap-0.5">
        <Button
          size="sm"
          variant="link"
          className="text-xs"
          nativeButton={false}
          render={
            <a href={SKILL_VERDICT_LINKS.home} target="_blank" rel="noopener noreferrer">
              <Trans>Skill Verdict</Trans>
            </a>
          }
        />

        <Button
          size="sm"
          variant="link"
          className="text-xs"
          nativeButton={false}
          render={
            <a href={SKILL_VERDICT_LINKS.candidate} target="_blank" rel="noopener noreferrer">
              <Trans>For candidates</Trans>
            </a>
          }
        />

        <Button
          size="sm"
          variant="link"
          className="text-xs"
          nativeButton={false}
          render={
            <a href={SKILL_VERDICT_LINKS.verifier} target="_blank" rel="noopener noreferrer">
              <Trans>For Gurus</Trans>
            </a>
          }
        />

        <Button
          size="sm"
          variant="link"
          className="text-xs"
          nativeButton={false}
          render={
            <a href={SKILL_VERDICT_LINKS.contact} target="_blank" rel="noopener noreferrer">
              <Trans>Contact</Trans>
            </a>
          }
        />
      </div>
    </SectionBase>
  );
}

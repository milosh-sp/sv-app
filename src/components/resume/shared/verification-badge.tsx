import { CheckCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

/** Explicit colors: resume preview sets IconContext to `--page-primary-color`, which would tint these badges red. */
const VERIFIED_BADGE_COLOR = "rgb(22 163 74)";

type VerificationBadgeProps = {
  requestId: string;
  status: string;
  badgeVisible: boolean;
  className?: string;
};

export function shouldShowVerificationBadge(status: string, badgeVisible: boolean): boolean {
  return badgeVisible && status === "verified";
}

export function showsReviewerProfileLink(profileUrl: string | null | undefined): boolean {
  return Boolean(profileUrl);
}

export function VerificationBadge({ requestId, status, badgeVisible, className }: VerificationBadgeProps) {
  if (!shouldShowVerificationBadge(status, badgeVisible)) return null;

  return <VerifiedBadge requestId={requestId} className={className} />;
}

function VerifiedBadge({ requestId, className }: { requestId: string; className?: string }) {
  const { data: detail } = useQuery(orpc.verification.getBadgeDetail.queryOptions({ input: { requestId } }));

  if (!detail) {
    return (
      <CheckCircleIcon
        className={cn("inline-block size-3.5", className)}
        color={VERIFIED_BADGE_COLOR}
        weight="fill"
        data-testid="verification-badge-verified"
      />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex cursor-default" data-testid="verification-badge-verified">
            <CheckCircleIcon
              className={cn("inline-block size-3.5", className)}
              color={VERIFIED_BADGE_COLOR}
              weight="fill"
            />
          </span>
        }
      />
      <TooltipContent
        className={cn(
          "max-w-sm border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10",
          "*:data-[slot=tooltip-arrow]:bg-popover *:data-[slot=tooltip-arrow]:fill-popover",
        )}
      >
        <BadgeTooltipContent detail={detail} />
      </TooltipContent>
    </Tooltip>
  );
}

type BadgeDetail = {
  type: "identity" | "experience" | "reviewer";
  label: string;
  profileUrl?: string | null;
};

function BadgeTooltipContent({ detail }: { detail: BadgeDetail }) {
  if (detail.type === "identity") {
    return <span data-testid="tooltip-identity">{detail.label}</span>;
  }

  if (detail.type === "experience") {
    return <span data-testid="tooltip-experience">{detail.label}</span>;
  }

  return (
    <span data-testid="tooltip-reviewer">
      {detail.label}
      {showsReviewerProfileLink(detail.profileUrl) && (
        <>
          {" — "}
          <Link to={detail.profileUrl} className="underline" target="_blank" rel="noopener noreferrer">
            View profile
          </Link>
        </>
      )}
    </span>
  );
}

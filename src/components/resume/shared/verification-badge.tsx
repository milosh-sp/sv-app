import { CheckCircleIcon, ClockIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

/** Explicit colors: resume preview sets IconContext to `--page-primary-color`, which would tint these badges red. */
const VERIFIED_BADGE_COLOR = "rgb(22 163 74)";
const PENDING_BADGE_COLOR = "rgb(245 158 11)";

type VerificationBadgeProps = {
  requestId: string;
  status: string;
  badgeVisible: boolean;
  className?: string;
};

export function VerificationBadge({ requestId, status, badgeVisible, className }: VerificationBadgeProps) {
  if (!badgeVisible) return null;

  if (status === "rejected" || status === "issue") return null;

  const isVerified = status === "verified";
  const isPending = status === "pending" || status === "claimed" || status === "verdict_pending";

  if (!isVerified && !isPending) return null;

  if (isVerified) {
    return <VerifiedBadge requestId={requestId} className={className} />;
  }

  return (
    <ClockIcon
      className={cn("inline-block size-3.5", className)}
      color={PENDING_BADGE_COLOR}
      weight="fill"
      data-testid="verification-badge-pending"
    />
  );
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
      <TooltipContent>
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
      {detail.profileUrl && (
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

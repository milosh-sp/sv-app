import type { ReactElement } from "react";

import { Trans } from "@lingui/react/macro";
import { ClockIcon, SealCheckIcon, WarningIcon } from "@phosphor-icons/react";

import { cn } from "@/utils/style";

export type IdentitySidebarVerificationState = "verified" | "pending" | "unverified";

const textClassByState = {
  verified: "text-green-700",
  pending: "text-amber-600",
  unverified: "text-muted-foreground",
} satisfies Record<IdentitySidebarVerificationState, string>;

const labelByState = {
  verified: <Trans>Identity Verified</Trans>,
  pending: <Trans>Pending verification</Trans>,
  unverified: <Trans>Identity Unverified</Trans>,
};

const identityStatusIconClass = "size-3.5 shrink-0";

const iconByState = {
  verified: <SealCheckIcon className={identityStatusIconClass} />,
  pending: <ClockIcon className={identityStatusIconClass} />,
  unverified: <WarningIcon className={cn(identityStatusIconClass, "text-amber-600/90")} />,
} satisfies Record<IdentitySidebarVerificationState, ReactElement>;

export function deriveIdentitySidebarVerificationState(
  identity: { status: string } | null | undefined,
): IdentitySidebarVerificationState {
  const status = identity?.status;
  if (status === "verified") return "verified";
  if (status === "pending" || status === "claimed" || status === "verdict_pending") return "pending";
  return "unverified";
}

type SidebarIdentityVerificationStatusProps = {
  state: IdentitySidebarVerificationState;
};

export function SidebarIdentityVerificationStatus({ state }: SidebarIdentityVerificationStatusProps) {
  return (
    <span className={cn("mt-1 flex min-w-0 items-center gap-x-1.5 text-xs font-medium", textClassByState[state])}>
      <span className="min-w-0 flex-1 truncate leading-snug">{labelByState[state]}</span>
      {iconByState[state]}
    </span>
  );
}

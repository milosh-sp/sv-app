import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { SealCheckIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";

import {
  getReviewerSetupStatus,
  ReviewerProfileDialogTrigger,
  ReviewerSetupStatusBadge,
} from "./-components/reviewer-profile-panel";
import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/admin/reviewers")({
  component: RouteComponent,
});

type ReviewerRow = RouterOutput["admin"]["reviewerProfiles"]["list"][number];

function RouteComponent() {
  const { data, isLoading, isError, refetch } = useQuery({
    ...orpc.admin.reviewerProfiles.list.queryOptions(),
    retry: false,
  });

  return (
    <div className="space-y-4">
      <DashboardHeader icon={SealCheckIcon} title={t`Reviewers`} />

      <Separator />

      <p className="text-sm text-muted-foreground">
        <Trans>
          Create reviewer profiles and assign reviewable skills. Reviewers need at least one skill before cases appear
          in their queue.
        </Trans>
      </p>

      {isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 p-4">
          <p className="text-sm text-destructive">
            <Trans>Failed to load reviewers.</Trans>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            <Trans>Retry</Trans>
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Trans>Loading reviewers…</Trans>
        </p>
      ) : !data || data.length === 0 ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            <Trans>No Reviewer Admins found.</Trans>
          </p>
          <p className="text-xs text-muted-foreground">
            <Trans>
              Assign the Reviewer Admin role on the{" "}
              <Link to="/dashboard/admin/users" className="underline underline-offset-2">
                Users
              </Link>{" "}
              page first.
            </Trans>
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.map((reviewer) => (
            <ReviewerListRow key={reviewer.userId} reviewer={reviewer} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewerListRow({ reviewer }: { reviewer: ReviewerRow }) {
  const status = getReviewerSetupStatus(reviewer.profile);
  const skillCount = reviewer.profile?.reviewerSkills?.length ?? 0;

  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{reviewer.name}</p>
            <ReviewerSetupStatusBadge status={status} />
          </div>
          <p className="truncate text-sm text-muted-foreground">{reviewer.email}</p>
          {reviewer.profile ? (
            <p className="text-xs text-muted-foreground">
              {reviewer.profile.firstName} {reviewer.profile.lastName} · {reviewer.profile.title}
              {skillCount > 0 ? (
                <>
                  {" "}
                  · {skillCount} {skillCount === 1 ? t`skill` : t`skills`}
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Trans>No public reviewer profile yet.</Trans>
            </p>
          )}
        </div>

        <ReviewerProfileDialogTrigger
          adminId={reviewer.userId}
          userName={reviewer.name}
          userEmail={reviewer.email}
          hasProfile={Boolean(reviewer.profile)}
        />
      </div>
    </li>
  );
}

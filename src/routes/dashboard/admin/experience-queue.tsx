import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CalendarBlankIcon, ShieldStarIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebounceCallback } from "usehooks-ts";
import z from "zod";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";
import { formatDefaultDate } from "@/utils/format-date";
import {
  ADMIN_VERIFICATION_PAGE_SIZE,
  buildVerificationListInput,
  defaultAdminExperienceSearch,
  hasActiveAdminExperienceFilters,
} from "@/utils/verification/admin-verification-search";

import type { ReviewAction } from "./-components/verification-queue-shared";

import { DashboardHeader } from "../-components/header";
import { AdminListPagination } from "./-components/admin-list-pagination";
import {
  AdminExperienceFilterBar,
  defaultAdminExperienceSearch as filterDefaults,
} from "./-components/admin-verification-filters";
import {
  ApplicantDetails,
  DirectAdminReviewHistoryTab,
  DocumentPreview,
  MethodBadge,
  QueueEmptyState,
  QueueErrorState,
  QueueLoadingState,
  QueueResumePreview,
  ReviewDecisionPanel,
  StatusBadge,
} from "./-components/verification-queue-shared";

const experienceSearchSchema = z.object({
  q: z.string().optional().default(""),
  method: z.enum(["all", "document_upload", "freelancer_link", "identity_call"]).default("all"),
  statuses: z
    .array(z.enum(["verified", "rejected", "issue"]))
    .optional()
    .default([]),
  page: z.coerce.number().int().min(1).default(1),
});

export const Route = createFileRoute("/dashboard/admin/experience-queue")({
  validateSearch: zodValidator(experienceSearchSchema),
  component: RouteComponent,
});

type ExperienceQueueItem = RouterOutput["admin"]["verification"]["listExperienceQueue"]["items"][number];

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath });
  const [activeTab, setActiveTab] = useState<"queue" | "history">("queue");
  const search = Route.useSearch();
  const mergedSearch = { ...defaultAdminExperienceSearch, ...search };

  const queueListInput = useMemo(
    () => buildVerificationListInput(mergedSearch, activeTab === "history" ? "history" : "queue"),
    [mergedSearch, activeTab],
  );

  const commitSearchToUrl = useCallback(
    (next: Partial<typeof search>) => {
      void navigate({
        search: (prev) => ({ ...prev, ...next }),
      });
    },
    [navigate],
  );

  const debouncedCommitSearch = useDebounceCallback((q: string) => {
    commitSearchToUrl({ q, page: 1 });
  }, 400);

  const queueQuery = useQuery({
    ...orpc.admin.verification.listExperienceQueue.queryOptions({ input: queueListInput }),
    enabled: activeTab === "queue",
    retry: false,
    placeholderData: (prev) => prev,
  });

  const historyQuery = useQuery({
    ...orpc.admin.verification.listExperienceHistory.queryOptions({ input: queueListInput }),
    enabled: activeTab === "history",
    retry: false,
    placeholderData: (prev) => prev,
  });

  const badgeQuery = useQuery({
    ...orpc.admin.verification.listExperienceQueue.queryOptions({
      input: { page: 1, pageSize: 1 },
    }),
    retry: false,
  });

  const activeQuery = activeTab === "queue" ? queueQuery : historyQuery;
  const totalPages = activeQuery.data ? Math.max(1, Math.ceil(activeQuery.data.total / activeQuery.data.pageSize)) : 1;
  const hasActiveFilter = hasActiveAdminExperienceFilters(mergedSearch, activeTab);

  if (queueQuery.isError && activeTab === "queue") return <QueueErrorState />;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={ShieldStarIcon} title={t`Experience Verification`} />

      <Separator />

      <div className="flex w-fit gap-x-1 rounded-lg border p-1">
        <Button
          size="sm"
          variant={activeTab === "queue" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => {
            setActiveTab("queue");
            commitSearchToUrl({ page: 1 });
          }}
        >
          <Trans>Experience Queue</Trans>
          {(badgeQuery.data?.totalUnfiltered ?? 0) > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
              {badgeQuery.data?.totalUnfiltered}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "history" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => {
            setActiveTab("history");
            commitSearchToUrl({ page: 1 });
          }}
        >
          <Trans>History</Trans>
        </Button>
      </div>

      <AdminExperienceFilterBar
        tab={activeTab}
        search={mergedSearch}
        onSearchChange={(next) => {
          if ("q" in next && next.q !== undefined) {
            debouncedCommitSearch(next.q);
            return;
          }
          commitSearchToUrl(next);
        }}
        onReset={() => {
          void navigate({ search: filterDefaults });
        }}
      />

      {activeTab === "queue" && (
        <ExperienceQueueTab
          items={queueQuery.data?.items ?? []}
          isLoading={queueQuery.isLoading && !queueQuery.data}
          total={queueQuery.data?.total ?? 0}
          hasActiveFilter={hasActiveFilter}
        />
      )}

      {activeTab === "history" && (
        <DirectAdminReviewHistoryTab
          items={historyQuery.data?.items ?? []}
          isLoading={historyQuery.isLoading && !historyQuery.data}
          isError={historyQuery.isError}
          emptyMessage={t`No completed experience reviews yet.`}
          filteredEmptyMessage={t`No completed reviews match the selected filters.`}
          hasActiveFilter={hasActiveFilter}
        />
      )}

      <AdminListPagination
        page={search.page}
        totalPages={totalPages}
        total={activeQuery.data?.total ?? 0}
        disabled={activeQuery.isFetching}
        onPrevious={() => {
          commitSearchToUrl({ page: Math.max(1, search.page - 1) });
        }}
        onNext={() => {
          commitSearchToUrl({ page: Math.min(totalPages, search.page + 1) });
        }}
      />
    </div>
  );
}

function ExperienceQueueTab({
  items,
  isLoading,
  total,
  hasActiveFilter,
}: {
  items: ExperienceQueueItem[];
  isLoading: boolean;
  total: number;
  hasActiveFilter: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <QueueLoadingState />;

  if (items.length === 0) {
    return (
      <QueueEmptyState
        message={
          hasActiveFilter
            ? t`No experience verification requests match the selected filters.`
            : t`No experience verification requests pending.`
        }
      />
    );
  }

  return (
    <div className="w-full space-y-3">
      {total > ADMIN_VERIFICATION_PAGE_SIZE && (
        <p className="text-xs text-muted-foreground">
          <Trans>
            Showing {items.length} of {total} pending requests
          </Trans>
        </p>
      )}
      {items.map((item) => (
        <ExperienceQueueRow
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          onExpandedChange={(open) => setExpandedId(open ? item.id : null)}
        />
      ))}
    </div>
  );
}

function ExperienceQueueRow({
  item,
  expanded,
  onExpandedChange,
}: {
  item: ExperienceQueueItem;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ReviewAction>("verified");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const reviewExperience = useMutation(orpc.admin.verification.reviewExperience.mutationOptions());

  const handleReview = () => {
    reviewExperience.mutate(
      { requestId: item.id, action, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            action === "verified"
              ? t`Experience verified successfully.`
              : action === "rejected"
                ? t`Experience request rejected.`
                : t`Experience request flagged as issue.`,
          );
          setConfirming(false);
          setNotes("");
          void queryClient.invalidateQueries({
            queryKey: orpc.admin.verification.listExperienceQueue.key(),
          });
          void queryClient.invalidateQueries({
            queryKey: orpc.admin.verification.listExperienceHistory.key(),
          });
        },
        onError: (error) => {
          toast.error(error.message);
          setConfirming(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-x-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{item.itemLabel}</p>
          {item.user ? (
            <p className="truncate text-xs text-muted-foreground">
              {item.user.name}
              <span className="mx-1.5 opacity-60">·</span>
              {item.user.email}
              <span className="mx-1.5 opacity-60">·</span>@{item.user.username}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Trans>Unknown applicant</Trans>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2">
            <StatusBadge status={item.status} />
            <MethodBadge method={item.method} />
            <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
              <CalendarBlankIcon className="size-3" />
              {formatDefaultDate(item.submittedAt)}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-xs"
          onClick={() => onExpandedChange(!expanded)}
        >
          {expanded ? <Trans>Collapse</Trans> : <Trans>Review</Trans>}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t pt-3">
          {item.user && <ApplicantDetails user={item.user} />}

          {item.resume && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>CV / resume</Trans>
              </p>
              <QueueResumePreview resume={item.resume} />
            </div>
          )}

          {item.documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Documents</Trans>
              </p>
              {item.documents.map((doc) => (
                <DocumentPreview
                  key={doc.id}
                  fileUrl={doc.fileUrl}
                  documentType={doc.documentType}
                  uploadedAt={doc.uploadedAt}
                />
              ))}
            </div>
          )}

          <ReviewDecisionPanel
            action={action}
            onActionChange={setAction}
            notes={notes}
            onNotesChange={setNotes}
            confirming={confirming}
            isPending={reviewExperience.isPending}
            onRequestConfirm={() => setConfirming(true)}
            onConfirm={handleReview}
            onCancel={() => onExpandedChange(false)}
            onBack={() => setConfirming(false)}
          />
        </div>
      )}
    </div>
  );
}

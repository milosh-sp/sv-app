import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  ShieldStarIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
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
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import {
  ADMIN_VERIFICATION_PAGE_SIZE,
  buildPendingVerdictsListInput,
  buildVerificationListInput,
  defaultAdminExperienceSearch,
  hasActiveAdminExperienceFilters,
} from "@/utils/verification/admin-verification-search";
import { formatDefaultDate } from "@/utils/format-date";

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
  ReviewerDetails,
  StatusBadge,
} from "./-components/verification-queue-shared";

const experienceSearchSchema = z.object({
  q: z.string().optional().default(""),
  method: z.enum(["all", "document_upload", "freelancer_link", "identity_call"]).default("all"),
  statuses: z.array(z.enum(["verified", "rejected", "issue"])).optional().default([]),
  proposed: z.array(z.enum(["verified", "rejected", "issue"])).optional().default([]),
  types: z.array(z.enum(["skill", "project"])).optional().default([]),
  page: z.coerce.number().int().min(1).default(1),
});

export const Route = createFileRoute("/dashboard/admin/experience-queue")({
  validateSearch: zodValidator(experienceSearchSchema),
  component: RouteComponent,
});

type ExperienceQueueItem = RouterOutput["admin"]["verification"]["listExperienceQueue"]["items"][number];
type PendingVerdictItem = RouterOutput["admin"]["verification"]["listPendingVerdicts"]["items"][number];

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath });
  const [activeTab, setActiveTab] = useState<"queue" | "verdicts" | "history">("queue");
  const search = Route.useSearch();
  const mergedSearch = { ...defaultAdminExperienceSearch, ...search };

  const queueListInput = useMemo(
    () => buildVerificationListInput(mergedSearch, activeTab === "history" ? "history" : "queue"),
    [mergedSearch, activeTab],
  );
  const verdictsListInput = useMemo(() => buildPendingVerdictsListInput(mergedSearch), [mergedSearch]);

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

  const verdictsQuery = useQuery({
    ...orpc.admin.verification.listPendingVerdicts.queryOptions({ input: verdictsListInput }),
    enabled: activeTab === "verdicts",
    retry: false,
    placeholderData: (prev) => prev,
  });

  const badgeQuery = useQuery({
    ...orpc.admin.verification.listExperienceQueue.queryOptions({
      input: { page: 1, pageSize: 1 },
    }),
    retry: false,
  });

  const verdictsBadgeQuery = useQuery({
    ...orpc.admin.verification.listPendingVerdicts.queryOptions({
      input: { page: 1, pageSize: 1 },
    }),
    retry: false,
  });

  const activeQuery =
    activeTab === "queue" ? queueQuery : activeTab === "history" ? historyQuery : verdictsQuery;
  const totalPages = activeQuery.data
    ? Math.max(1, Math.ceil(activeQuery.data.total / activeQuery.data.pageSize))
    : 1;
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
          variant={activeTab === "verdicts" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => {
            setActiveTab("verdicts");
            commitSearchToUrl({ page: 1 });
          }}
        >
          <Trans>Pending Verdicts</Trans>
          {(verdictsBadgeQuery.data?.totalUnfiltered ?? 0) > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
              {verdictsBadgeQuery.data?.totalUnfiltered}
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

      {activeTab === "verdicts" && (
        <PendingVerdictsTab
          items={verdictsQuery.data?.items ?? []}
          isLoading={verdictsQuery.isLoading && !verdictsQuery.data}
          total={verdictsQuery.data?.total ?? 0}
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

// ---------------------------------------------------------------------------
// Experience Queue Tab
// ---------------------------------------------------------------------------

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
          <Trans>Showing {items.length} of {total} pending requests</Trans>
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

// ---------------------------------------------------------------------------
// Pending Verdicts Tab
// ---------------------------------------------------------------------------

function PendingVerdictsTab({
  items,
  isLoading,
  total,
  hasActiveFilter,
}: {
  items: PendingVerdictItem[];
  isLoading: boolean;
  total: number;
  hasActiveFilter: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4 animate-spin" />
        <Trans>Loading pending verdicts...</Trans>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <CheckCircleIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {hasActiveFilter ? (
            <Trans>No verdicts match the selected filters.</Trans>
          ) : (
            <Trans>No verdicts awaiting confirmation.</Trans>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3">
      {total > ADMIN_VERIFICATION_PAGE_SIZE && (
        <p className="text-xs text-muted-foreground">
          <Trans>Showing {items.length} of {total} pending verdicts</Trans>
        </p>
      )}
      {items.map((verdict) => (
        <PendingVerdictRow key={verdict.id} verdict={verdict} />
      ))}
    </div>
  );
}

function PendingVerdictRow({ verdict }: { verdict: PendingVerdictItem }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<ReviewAction>("verified");
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmingOverride, setConfirmingOverride] = useState(false);

  const confirmVerdict = useMutation(orpc.admin.verification.confirmVerdict.mutationOptions());
  const overrideVerdict = useMutation(orpc.admin.verification.overrideVerdict.mutationOptions());

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.admin.verification.listPendingVerdicts.key(),
    });
  };

  const proposedVerdict = verdict.proposedVerdict;

  const confirmLabel =
    proposedVerdict === "verified"
      ? t`Confirm Pass`
      : proposedVerdict === "rejected"
        ? t`Confirm Fail`
        : proposedVerdict === "issue"
          ? t`Confirm Issue`
          : t`Confirm`;

  const confirmSuccessMessage =
    proposedVerdict === "verified"
      ? t`Verdict confirmed. Skill verified.`
      : proposedVerdict === "rejected"
        ? t`Verdict confirmed. Request rejected.`
        : proposedVerdict === "issue"
          ? t`Verdict confirmed. Request flagged as issue.`
          : t`Verdict confirmed.`;

  const handleConfirm = () => {
    confirmVerdict.mutate(
      { requestId: verdict.id },
      {
        onSuccess: () => {
          toast.success(confirmSuccessMessage);
          setExpanded(false);
          invalidate();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleOverride = () => {
    if (!overrideReason.trim()) {
      toast.error(t`A reason is required to override.`);
      return;
    }
    overrideVerdict.mutate(
      { requestId: verdict.id, action: overrideAction, reason: overrideReason.trim() },
      {
        onSuccess: () => {
          toast.success(t`Verdict overridden successfully.`);
          setOverrideOpen(false);
          setConfirmingOverride(false);
          setOverrideReason("");
          setExpanded(false);
          invalidate();
        },
        onError: (error) => {
          toast.error(error.message);
          setConfirmingOverride(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-x-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{verdict.itemLabel}</p>
          {"parentItemLabel" in verdict && verdict.parentItemLabel ? (
            <p className="text-xs text-muted-foreground">{verdict.parentItemLabel}</p>
          ) : null}
          {verdict.user ? (
            <p className="truncate text-xs text-muted-foreground">
              {verdict.user.name}
              <span className="mx-1.5 opacity-60">·</span>
              {verdict.user.email}
              <span className="mx-1.5 opacity-60">·</span>@{verdict.user.username}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Trans>Unknown applicant</Trans>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2">
            <StatusBadge status={verdict.status} />
            {verdict.proposedVerdict ? (
              <ProposedVerdictBadge verdict={verdict.proposedVerdict} />
            ) : (
              <MissingProposedVerdictBadge />
            )}
            <span className="text-xs text-muted-foreground capitalize">{verdict.sectionType}</span>
            <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
              <CalendarBlankIcon className="size-3" />
              {formatDefaultDate(verdict.submittedAt)}
            </span>
          </div>
          {verdict.reviewerName && (
            <p className="text-xs text-muted-foreground">
              <Trans>Reviewer:</Trans> {verdict.reviewerName}
              {verdict.reviewerTitle ? ` · ${verdict.reviewerTitle}` : ""}
            </p>
          )}
        </div>

        <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? <Trans>Collapse</Trans> : <Trans>Review</Trans>}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t pt-3">
          {verdict.user && <ApplicantDetails user={verdict.user} />}

          <ReviewerDetails
            name={verdict.reviewerName}
            title={verdict.reviewerTitle}
            skills={verdict.reviewerSkills ?? []}
            publicProfileUrl={verdict.reviewerPublicProfileUrl}
            proposedVerdict={verdict.proposedVerdict}
            verdictNotes={verdict.verdictNotes}
            verdictSubmittedAt={verdict.verdictSubmittedAt}
          />

          {verdict.resume && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>CV / resume</Trans>
              </p>
              <QueueResumePreview resume={verdict.resume} />
            </div>
          )}

          {verdict.assessmentInstructionsUrl && verdict.documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Assessment instructions</Trans>
              </p>
              {verdict.documents
                .filter((doc) => doc.documentType === "assessment_instructions")
                .map((doc) => (
                  <DocumentPreview
                    key={doc.id}
                    fileUrl={doc.fileUrl}
                    documentType={doc.documentType}
                    uploadedAt={doc.uploadedAt}
                  />
                ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Assessment solution</Trans>
            </p>
            {verdict.documents.some((doc) =>
              ["assessment_solution", "assessment_solution_link"].includes(doc.documentType),
            ) ? (
              verdict.documents
                .filter((doc) => ["assessment_solution", "assessment_solution_link"].includes(doc.documentType))
                .map((doc) => (
                  <DocumentPreview
                    key={doc.id}
                    fileUrl={doc.fileUrl}
                    documentType={doc.documentType}
                    uploadedAt={doc.uploadedAt}
                  />
                ))
            ) : (
              <p className="text-xs text-muted-foreground">
                <Trans>No solution submitted</Trans>
              </p>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Final Decision</Trans>
            </p>
            <div className="flex flex-wrap items-center gap-x-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                disabled={!proposedVerdict || confirmVerdict.isPending}
                onClick={handleConfirm}
              >
                <CheckCircleIcon className="mr-1 size-3.5" weight="fill" />
                {confirmVerdict.isPending ? <Trans>Confirming...</Trans> : confirmLabel}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setOverrideOpen(!overrideOpen)}
              >
                {overrideOpen ? <Trans>Cancel Override</Trans> : <Trans>Override</Trans>}
              </Button>
            </div>
          </div>

          {overrideOpen && (
            <div className="space-y-3 border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Override Decision</Trans>
              </p>

              <div className="flex gap-x-2">
                {(["verified", "rejected", "issue"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setOverrideAction(a)}
                    className={`flex items-center gap-x-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      overrideAction === a
                        ? a === "verified"
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : a === "rejected"
                            ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            : "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                        : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {a === "verified" && <CheckCircleIcon className="size-3.5" weight="fill" />}
                    {a === "rejected" && <XCircleIcon className="size-3.5" weight="fill" />}
                    {a === "issue" && <WarningCircleIcon className="size-3.5" weight="fill" />}
                    <span className="capitalize">{a}</span>
                  </button>
                ))}
              </div>

              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder={t`Required: reason for overriding this verdict...`}
                className="min-h-[60px] resize-none text-xs"
              />

              {!confirmingOverride ? (
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  disabled={!overrideReason.trim()}
                  onClick={() => setConfirmingOverride(true)}
                >
                  <Trans>Submit Override</Trans>
                </Button>
              ) : (
                <div className="flex items-center gap-x-2">
                  <span className="text-xs text-muted-foreground">
                    <Trans>Override to </Trans>
                    <span className="font-medium capitalize">{overrideAction}</span>?
                  </span>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    disabled={overrideVerdict.isPending}
                    onClick={handleOverride}
                  >
                    {overrideVerdict.isPending ? <Trans>Overriding...</Trans> : <Trans>Confirm</Trans>}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={overrideVerdict.isPending}
                    onClick={() => setConfirmingOverride(false)}
                  >
                    <Trans>Back</Trans>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProposedVerdictBadge({ verdict }: { verdict: "verified" | "rejected" | "issue" }) {
  const colorClass =
    verdict === "verified"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : verdict === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
        : "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";

  const label =
    verdict === "verified" ? t`Proposed: Pass` : verdict === "rejected" ? t`Proposed: Fail` : t`Proposed: Issue`;

  return <span className={`rounded-full px-2 py-0.5 text-xs ${colorClass}`}>{label}</span>;
}

function MissingProposedVerdictBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      <Trans>Missing proposed verdict</Trans>
    </span>
  );
}

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
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import { formatDefaultDate } from "@/utils/format-date";

import type { ReviewAction } from "./-components/verification-queue-shared";

import { DashboardHeader } from "../-components/header";
import {
  ApplicantDetails,
  DocumentPreview,
  MethodBadge,
  QueueEmptyState,
  QueueLoadingState,
  QueueResumePreview,
  ReviewDecisionPanel,
  StatusBadge,
} from "./-components/verification-queue-shared";

export const Route = createFileRoute("/dashboard/admin/experience-queue")({
  component: RouteComponent,
});

type ExperienceQueueItem = RouterOutput["admin"]["verification"]["listExperienceQueue"][number];
type PendingVerdictItem = RouterOutput["admin"]["verification"]["listPendingVerdicts"][number];

function RouteComponent() {
  const [activeTab, setActiveTab] = useState<"queue" | "verdicts">("queue");

  const {
    data: queue,
    isLoading: queueLoading,
    isError: queueError,
  } = useQuery({
    ...orpc.admin.verification.listExperienceQueue.queryOptions(),
    retry: false,
  });

  if (queueError) return null;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={ShieldStarIcon} title={t`Experience Verification`} />

      <Separator />

      <div className="flex w-fit gap-x-1 rounded-lg border p-1">
        <Button
          size="sm"
          variant={activeTab === "queue" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => setActiveTab("queue")}
        >
          <Trans>Experience Queue</Trans>
          {queue && queue.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
              {queue.length}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "verdicts" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => setActiveTab("verdicts")}
        >
          <Trans>Pending Verdicts</Trans>
        </Button>
      </div>

      {activeTab === "queue" && <ExperienceQueueTab items={queue ?? []} isLoading={queueLoading} />}

      {activeTab === "verdicts" && <PendingVerdictsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experience Queue Tab
// ---------------------------------------------------------------------------

function ExperienceQueueTab({ items, isLoading }: { items: ExperienceQueueItem[]; isLoading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <QueueLoadingState />;

  if (items.length === 0) {
    return <QueueEmptyState message={t`No experience verification requests pending.`} />;
  }

  return (
    <div className="max-w-4xl space-y-3">
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
            queryKey: orpc.admin.verification.listExperienceQueue.queryOptions().queryKey,
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

function PendingVerdictsTab() {
  const { data: verdicts, isLoading } = useQuery(orpc.admin.verification.listPendingVerdicts.queryOptions());

  if (isLoading) {
    return (
      <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4 animate-spin" />
        <Trans>Loading pending verdicts...</Trans>
      </div>
    );
  }

  if (!verdicts || verdicts.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <CheckCircleIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <Trans>No verdicts awaiting confirmation.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {verdicts.map((verdict) => (
        <PendingVerdictRow key={verdict.id} verdict={verdict} />
      ))}
    </div>
  );
}

function PendingVerdictRow({ verdict }: { verdict: PendingVerdictItem }) {
  const queryClient = useQueryClient();
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideAction, setOverrideAction] = useState<ReviewAction>("verified");
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmingOverride, setConfirmingOverride] = useState(false);

  const confirmVerdict = useMutation(orpc.admin.verification.confirmVerdict.mutationOptions());
  const overrideVerdict = useMutation(orpc.admin.verification.overrideVerdict.mutationOptions());

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.admin.verification.listPendingVerdicts.queryOptions().queryKey,
    });
  };

  const handleConfirm = () => {
    confirmVerdict.mutate(
      { requestId: verdict.id },
      {
        onSuccess: () => {
          toast.success(t`Verdict confirmed. Experience verified.`);
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
        <div className="space-y-1">
          <p className="text-sm font-medium">{verdict.itemLabel}</p>
          <div className="flex flex-wrap items-center gap-x-2">
            <StatusBadge status={verdict.status} />
            <span className="text-xs text-muted-foreground capitalize">{verdict.sectionType}</span>
            <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
              <CalendarBlankIcon className="size-3" />
              {formatDefaultDate(verdict.submittedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-x-2">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs"
            disabled={confirmVerdict.isPending}
            onClick={handleConfirm}
          >
            <CheckCircleIcon className="mr-1 size-3.5" weight="fill" />
            {confirmVerdict.isPending ? <Trans>Confirming...</Trans> : <Trans>Confirm</Trans>}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOverrideOpen(!overrideOpen)}>
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
  );
}

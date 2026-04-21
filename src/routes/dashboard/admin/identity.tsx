import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CalendarBlankIcon, IdentificationCardIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";
import { formatDefaultDate } from "@/utils/format-date";

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
import type { ReviewAction } from "./-components/verification-queue-shared";

export const Route = createFileRoute("/dashboard/admin/identity")({
  component: RouteComponent,
});

type IdentityQueueItem = RouterOutput["admin"]["verification"]["listIdentityQueue"][number];

function RouteComponent() {
  const {
    data: queue,
    isLoading: queueLoading,
    isError: queueError,
  } = useQuery({
    ...orpc.admin.verification.listIdentityQueue.queryOptions(),
    retry: false,
  });

  if (queueError) return null;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={IdentificationCardIcon} title={t`Identity Verification`} />

      <Separator />

      <IdentityQueueTab items={queue ?? []} isLoading={queueLoading} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Identity Queue Tab
// ---------------------------------------------------------------------------

function IdentityQueueTab({ items, isLoading }: { items: IdentityQueueItem[]; isLoading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <QueueLoadingState />;

  if (items.length === 0) {
    return <QueueEmptyState message={t`No identity verification requests pending.`} />;
  }

  return (
    <div className="w-full space-y-3">
      {items.map((item) => (
        <IdentityQueueRow
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          onExpandedChange={(open) => setExpandedId(open ? item.id : null)}
        />
      ))}
    </div>
  );
}

function IdentityQueueRow({
  item,
  expanded,
  onExpandedChange,
}: {
  item: IdentityQueueItem;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ReviewAction>("verified");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const reviewIdentity = useMutation(orpc.admin.verification.reviewIdentity.mutationOptions());

  const handleReview = () => {
    reviewIdentity.mutate(
      { requestId: item.id, action, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(
            action === "verified"
              ? t`Identity verified successfully.`
              : action === "rejected"
                ? t`Identity request rejected.`
                : t`Identity request flagged as issue.`,
          );
          setConfirming(false);
          setNotes("");
          void queryClient.invalidateQueries({
            queryKey: orpc.admin.verification.listIdentityQueue.queryOptions().queryKey,
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
            {item.calendarLinkSentAt && (
              <span className="flex items-center gap-x-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                <Trans>Call link sent</Trans>
                {" · "}
                {formatDefaultDate(item.calendarLinkSentAt)}
              </span>
            )}
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
                <Trans>Latest CV / resume</Trans>
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
            isPending={reviewIdentity.isPending}
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

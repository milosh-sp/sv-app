import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  LinkIcon,
  ShieldStarIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { RouterOutput } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/admin/")({
  component: RouteComponent,
});

type ExperienceQueueItem = RouterOutput["admin"]["verification"]["listExperienceQueue"][number];
type PendingVerdictItem = RouterOutput["admin"]["verification"]["listPendingVerdicts"][number];
type ReviewAction = "verified" | "rejected" | "issue";

function RouteComponent() {
  const [activeTab, setActiveTab] = useState<"queue" | "verdicts">("queue");

  const { data: queue, isLoading: queueLoading, isError: queueError } = useQuery({
    ...orpc.admin.verification.listExperienceQueue.queryOptions(),
    retry: false,
  });

  if (queueError) return null;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={ShieldStarIcon} title={t`Experience Verification`} />

      <Separator />

      <div className="flex gap-x-1 rounded-lg border p-1 w-fit">
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

      {activeTab === "queue" && (
        <ExperienceQueueTab items={queue ?? []} isLoading={queueLoading} />
      )}

      {activeTab === "verdicts" && <PendingVerdictsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Experience Queue Tab
// ---------------------------------------------------------------------------

function ExperienceQueueTab({ items, isLoading }: { items: ExperienceQueueItem[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
        <ClockIcon className="size-4 animate-spin" />
        <Trans>Loading queue...</Trans>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <CheckCircleIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          <Trans>No experience verification requests pending.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-3">
      {items.map((item) => (
        <ExperienceQueueRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function ExperienceQueueRow({ item }: { item: ExperienceQueueItem }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
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
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-x-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{item.itemLabel}</p>
          <div className="flex items-center gap-x-2 flex-wrap">
            <StatusBadge status={item.status} />
            <MethodBadge method={item.method} />
            <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
              <CalendarBlankIcon className="size-3" />
              {new Date(item.submittedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Trans>Collapse</Trans> : <Trans>Review</Trans>}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t pt-3">
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

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Review Decision</Trans>
            </p>
            <div className="flex gap-x-2">
              {(["verified", "rejected", "issue"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAction(a)}
                  className={`flex items-center gap-x-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    action === a
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
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t`Optional notes for the applicant...`}
              className="min-h-[60px] text-xs resize-none"
            />
          </div>

          {!confirming ? (
            <div className="flex items-center gap-x-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => setConfirming(true)}
              >
                <Trans>Submit Review</Trans>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setExpanded(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-x-2">
              <span className="text-xs text-muted-foreground">
                <Trans>Confirm decision: </Trans>
                <span className="font-medium capitalize">{action}</span>?
              </span>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                disabled={reviewExperience.isPending}
                onClick={handleReview}
              >
                {reviewExperience.isPending ? <Trans>Submitting...</Trans> : <Trans>Confirm</Trans>}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={reviewExperience.isPending}
                onClick={() => setConfirming(false)}
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

// ---------------------------------------------------------------------------
// Pending Verdicts Tab
// ---------------------------------------------------------------------------

function PendingVerdictsTab() {
  const { data: verdicts, isLoading } = useQuery(
    orpc.admin.verification.listPendingVerdicts.queryOptions(),
  );

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
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-x-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{verdict.itemLabel}</p>
          <div className="flex items-center gap-x-2 flex-wrap">
            <StatusBadge status={verdict.status} />
            <span className="text-xs text-muted-foreground capitalize">{verdict.sectionType}</span>
            <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
              <CalendarBlankIcon className="size-3" />
              {new Date(verdict.submittedAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-x-2 shrink-0">
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
            className="min-h-[60px] text-xs resize-none"
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

// ---------------------------------------------------------------------------
// Document Preview
// ---------------------------------------------------------------------------

type DocRenderType = "image" | "pdf" | "link" | "loading" | "error";

function DocumentPreview({
  fileUrl,
  documentType,
  uploadedAt,
}: {
  fileUrl: string;
  documentType: string;
  uploadedAt: Date;
}) {
  const [expanded, setExpanded] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [renderType, setRenderType] = useState<DocRenderType>("loading");
  const blobUrlRef = useRef<string | null>(null);

  const isFreelancerLink = documentType === "freelancer_link";

  useEffect(() => {
    if (!expanded || isFreelancerLink) return;

    let cancelled = false;
    setRenderType("loading");
    setObjectUrl(null);

    void (async () => {
      try {
        const res = await fetch(fileUrl, { credentials: "include" });
        if (!res.ok || cancelled) { if (!cancelled) setRenderType("error"); return; }

        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const blob = await res.blob();
        if (cancelled) return;

        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setObjectUrl(url);

        if (contentType.startsWith("image/")) {
          setRenderType("image");
        } else if (contentType === "application/pdf") {
          setRenderType("pdf");
        } else {
          // Sniff magic bytes to detect PDF or common image formats when content-type is generic
          const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
          const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
          const isJpeg = header[0] === 0xff && header[1] === 0xd8;
          const isPng = header[0] === 0x89 && header[1] === 0x50;
          setRenderType(isPdf ? "pdf" : isJpeg || isPng ? "image" : "pdf");
        }
      } catch {
        if (!cancelled) setRenderType("error");
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setObjectUrl(null);
    };
  }, [expanded, fileUrl, isFreelancerLink]);

  return (
    <div className="rounded border overflow-hidden">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-x-2">
          {isFreelancerLink ? (
            <LinkIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <FileTextIcon className="size-3.5 text-muted-foreground" />
          )}
          <span className="text-xs capitalize">{documentType.replace(/_/g, " ")}</span>
          <span className="text-xs text-muted-foreground">{new Date(uploadedAt).toLocaleDateString()}</span>
        </div>

        {isFreelancerLink ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            <Trans>Open Profile</Trans>
          </a>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <Trans>Hide</Trans> : <Trans>Preview</Trans>}
          </Button>
        )}
      </div>

      {expanded && !isFreelancerLink && (
        <div className="border-t bg-muted/30 p-2">
          {renderType === "loading" && (
            <div className="flex items-center gap-x-2 py-4 justify-center text-xs text-muted-foreground">
              <ClockIcon className="size-4 animate-spin" />
              <Trans>Loading document...</Trans>
            </div>
          )}

          {renderType === "error" && (
            <p className="py-4 text-center text-xs text-destructive">
              <Trans>Failed to load document.</Trans>
            </p>
          )}

          {renderType === "image" && objectUrl && (
            <img
              src={objectUrl}
              alt={documentType}
              className="max-h-[480px] w-auto max-w-full rounded object-contain mx-auto block"
            />
          )}

          {renderType === "pdf" && objectUrl && (
            <iframe
              src={objectUrl}
              title={documentType}
              className="h-[480px] w-full rounded border-0"
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared Components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colorClass = (() => {
    if (status === "verified") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (status === "pending") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    if (status === "verdict_pending") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    if (status === "claimed") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    if (status === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (status === "issue") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-muted text-muted-foreground";
  })();

  const label = status === "verdict_pending" ? "verdict pending" : status;

  return <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${colorClass}`}>{label}</span>;
}

function MethodBadge({ method }: { method: string | null }) {
  if (!method) return null;

  if (method === "document_upload") {
    return (
      <span className="flex items-center gap-x-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <FileTextIcon className="size-3" />
        <Trans>Document</Trans>
      </span>
    );
  }

  if (method === "freelancer_link") {
    return (
      <span className="flex items-center gap-x-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <LinkIcon className="size-3" />
        <Trans>Freelancer Link</Trans>
      </span>
    );
  }

  return null;
}

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  SealCheckIcon,
  UploadIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import { formatDefaultDate } from "@/utils/format-date";

import type { ReviewAction } from "../admin/-components/verification-queue-shared";

import { DashboardHeader } from "../-components/header";
import {
  ApplicantDetails,
  DocumentPreview,
  QueueEmptyState,
  QueueErrorState,
  QueueLoadingState,
  QueueResumePreview,
  ReviewDecisionPanel,
  StatusBadge,
} from "../admin/-components/verification-queue-shared";

export const Route = createFileRoute("/dashboard/reviewer/queue")({
  component: RouteComponent,
});

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type QueueItem = RouterOutput["admin"]["verification"]["listQueue"][number];
type MyCaseItem = RouterOutput["admin"]["verification"]["listMyCases"][number];

function RouteComponent() {
  const [activeTab, setActiveTab] = useState<"queue" | "cases">("queue");

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    ...orpc.reviewer.profile.get.queryOptions(),
    retry: false,
  });

  const {
    data: queue,
    isLoading: queueLoading,
    isError: queueError,
  } = useQuery({
    ...orpc.admin.verification.listQueue.queryOptions(),
    retry: false,
  });

  const {
    data: myCases,
    isLoading: casesLoading,
    isError: casesError,
  } = useQuery({
    ...orpc.admin.verification.listMyCases.queryOptions(),
    retry: false,
  });

  if (queueError || casesError) {
    return <QueueErrorState />;
  }

  const hasProfile = !profileError && Boolean(profile);
  const hasConsent = Boolean(profile?.consentGiven);
  const hasAssignedSkills = (profile?.reviewerSkills?.length ?? 0) > 0;
  const claimedCount = myCases?.filter((c) => c.status === "claimed").length ?? 0;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={SealCheckIcon} title={t`Skill Review Queue`} />

      <Separator />

      {!profileLoading && (!hasProfile || !hasConsent) && (
        <ReviewerSetupBanner hasProfile={hasProfile} hasConsent={hasConsent} />
      )}

      <div className="flex w-fit gap-x-1 rounded-lg border p-1">
        <Button
          size="sm"
          variant={activeTab === "queue" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => setActiveTab("queue")}
        >
          <Trans>Queue</Trans>
          {queue && queue.length > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
              {queue.length}
            </span>
          )}
        </Button>
        <Button
          size="sm"
          variant={activeTab === "cases" ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => setActiveTab("cases")}
        >
          <Trans>My Cases</Trans>
          {claimedCount > 0 && (
            <span className="ml-1.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] leading-none">
              {claimedCount}
            </span>
          )}
        </Button>
      </div>

      {activeTab === "queue" && (
        <QueueTab
          items={queue ?? []}
          isLoading={queueLoading}
          canAccept={hasProfile}
          hasAssignedSkills={hasAssignedSkills}
        />
      )}

      {activeTab === "cases" && (
        <MyCasesTab items={myCases ?? []} isLoading={casesLoading} canSubmitVerdict={hasProfile && hasConsent} />
      )}
    </div>
  );
}

function ReviewerSetupBanner({ hasProfile, hasConsent }: { hasProfile: boolean; hasConsent: boolean }) {
  const queryClient = useQueryClient();
  const giveConsent = useMutation(orpc.reviewer.profile.giveConsent.mutationOptions());

  const handleGiveConsent = () => {
    giveConsent.mutate(undefined, {
      onSuccess: () => {
        toast.success(t`Consent recorded. You can now submit verdicts.`);
        void queryClient.invalidateQueries({ queryKey: orpc.reviewer.profile.get.queryOptions().queryKey });
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-50/50 p-4 dark:bg-amber-900/10">
      <div className="flex items-start gap-x-3">
        <WarningCircleIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" weight="fill" />
        <div className="space-y-2">
          <p className="text-sm font-medium">
            <Trans>Reviewer setup required</Trans>
          </p>
          {!hasProfile ? (
            <p className="text-xs text-muted-foreground">
              <Trans>
                Your reviewer profile has not been created yet. Ask a Skill Verdict Admin to assign your reviewer role
                and create your public reviewer profile before accepting cases.
              </Trans>
            </p>
          ) : !hasConsent ? (
            <>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Before submitting verdicts, confirm that you agree to have your name displayed on verified skill
                  badges.
                </Trans>
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={giveConsent.isPending}
                onClick={handleGiveConsent}
              >
                {giveConsent.isPending ? <Trans>Recording...</Trans> : <Trans>Give consent</Trans>}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QueueTab({
  items,
  isLoading,
  canAccept,
  hasAssignedSkills,
}: {
  items: QueueItem[];
  isLoading: boolean;
  canAccept: boolean;
  hasAssignedSkills: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<QueueItem | null>(null);

  if (isLoading) return <QueueLoadingState />;

  if (!hasAssignedSkills) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-50/50 p-4 dark:bg-amber-900/10">
        <p className="text-sm text-muted-foreground">
          <Trans>
            Ask a Skill Verdict Admin to assign your reviewable skills before cases appear in the queue.
          </Trans>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return <QueueEmptyState message={t`No matching requests for your assigned skills.`} />;
  }

  return (
    <>
      <div className="w-full space-y-3">
        {items.map((item) => (
          <QueueRow
            key={item.id}
            item={item}
            expanded={expandedId === item.id}
            canAccept={canAccept}
            onExpandedChange={(open) => setExpandedId(open ? item.id : null)}
            onAcceptClick={() => setAcceptTarget(item)}
          />
        ))}
      </div>

      {acceptTarget && (
        <AcceptCaseDialog
          item={acceptTarget}
          open={Boolean(acceptTarget)}
          onOpenChange={(open) => {
            if (!open) setAcceptTarget(null);
          }}
        />
      )}
    </>
  );
}

function QueueRow({
  item,
  expanded,
  canAccept,
  onExpandedChange,
  onAcceptClick,
}: {
  item: QueueItem;
  expanded: boolean;
  canAccept: boolean;
  onExpandedChange: (open: boolean) => void;
  onAcceptClick: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-x-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{item.itemLabel}</p>
          {"parentItemLabel" in item && item.parentItemLabel ? (
            <p className="text-xs text-muted-foreground">{item.parentItemLabel}</p>
          ) : null}
          {item.user ? (
            <p className="truncate text-xs text-muted-foreground">
              {item.user.name}
              <span className="mx-1.5 opacity-60">·</span>
              {item.user.email}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Trans>Unknown applicant</Trans>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-muted-foreground capitalize">{item.sectionType}</span>
            <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
              <CalendarBlankIcon className="size-3" />
              {formatDefaultDate(item.submittedAt)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-x-2">
          <Button size="sm" variant="default" className="h-7 text-xs" disabled={!canAccept} onClick={onAcceptClick}>
            <Trans>Accept</Trans>
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onExpandedChange(!expanded)}>
            {expanded ? <Trans>Collapse</Trans> : <Trans>View</Trans>}
          </Button>
        </div>
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
        </div>
      )}
    </div>
  );
}

function AcceptCaseDialog({
  item,
  open,
  onOpenChange,
}: {
  item: QueueItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const acceptCase = useMutation(orpc.admin.verification.acceptCase.mutationOptions());

  const reset = () => {
    setFile(null);
    setMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.includes(selected.type)) {
      toast.error(t`Please upload a PDF or image file.`);
      event.target.value = "";
      setFile(null);
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      toast.error(t`File must be 5 MB or smaller.`);
      event.target.value = "";
      setFile(null);
      return;
    }

    setFile(selected);
  };

  const handleAccept = () => {
    if (!file) {
      toast.error(t`Assessment instructions file is required.`);
      return;
    }

    acceptCase.mutate(
      {
        requestId: item.id,
        file,
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t`Case accepted. Assessment instructions sent to the applicant.`);
          reset();
          onOpenChange(false);
          void queryClient.invalidateQueries({
            queryKey: orpc.admin.verification.listQueue.queryOptions().queryKey,
          });
          void queryClient.invalidateQueries({
            queryKey: orpc.admin.verification.listMyCases.queryOptions().queryKey,
          });
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Accept case</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Upload assessment instructions for "{item.itemLabel}". The applicant will receive them by email and on
              their Verification dashboard.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Instructions file</Trans> <span className="text-destructive">*</span>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_TYPES.join(",")}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs"
              onChange={handleFileChange}
            />
            {file && (
              <p className="flex items-center gap-x-1.5 text-xs text-muted-foreground">
                <FileTextIcon className="size-3.5" />
                {file.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Message to applicant (optional)</Trans>
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t`Additional context for the assessment...`}
              className="min-h-[80px] resize-none text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>
          <Button size="sm" className="h-8 text-xs" disabled={!file || acceptCase.isPending} onClick={handleAccept}>
            <UploadIcon className="mr-1.5 size-3.5" />
            {acceptCase.isPending ? <Trans>Accepting...</Trans> : <Trans>Accept & send instructions</Trans>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MyCasesTab({
  items,
  isLoading,
  canSubmitVerdict,
}: {
  items: MyCaseItem[];
  isLoading: boolean;
  canSubmitVerdict: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) return <QueueLoadingState />;

  if (items.length === 0) {
    return <QueueEmptyState message={t`You have no active cases.`} />;
  }

  return (
    <div className="w-full space-y-3">
      {items.map((item) => (
        <MyCaseRow
          key={item.id}
          item={item}
          expanded={expandedId === item.id}
          canSubmitVerdict={canSubmitVerdict}
          onExpandedChange={(open) => setExpandedId(open ? item.id : null)}
        />
      ))}
    </div>
  );
}

function MyCaseRow({
  item,
  expanded,
  canSubmitVerdict,
  onExpandedChange,
}: {
  item: MyCaseItem;
  expanded: boolean;
  canSubmitVerdict: boolean;
  onExpandedChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<ReviewAction>("verified");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const submitVerdict = useMutation(orpc.admin.verification.submitVerdict.mutationOptions());

  const isAwaitingAdmin = item.status === "verdict_pending";

  const handleSubmitVerdict = () => {
    submitVerdict.mutate(
      { requestId: item.id, verdict: action, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t`Verdict submitted for admin confirmation.`);
          setConfirming(false);
          setNotes("");
          void queryClient.invalidateQueries({
            queryKey: orpc.admin.verification.listMyCases.queryOptions().queryKey,
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
          {"parentItemLabel" in item && item.parentItemLabel ? (
            <p className="text-xs text-muted-foreground">{item.parentItemLabel}</p>
          ) : null}
          {item.user && (
            <p className="truncate text-xs text-muted-foreground">
              {item.user.name}
              <span className="mx-1.5 opacity-60">·</span>
              {item.user.email}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-2">
            <StatusBadge status={item.status} />
            {isAwaitingAdmin && item.proposedVerdict && <ProposedVerdictBadge verdict={item.proposedVerdict} />}
            <span className="text-xs text-muted-foreground capitalize">{item.sectionType}</span>
            {item.claimedAt && (
              <span className="flex items-center gap-x-1 text-xs text-muted-foreground">
                <CalendarBlankIcon className="size-3" />
                {formatDefaultDate(item.claimedAt)}
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
          {expanded ? <Trans>Collapse</Trans> : <Trans>Details</Trans>}
        </Button>
      </div>

      {isAwaitingAdmin && (
        <p className="flex items-center gap-x-2 rounded-md border border-blue-500/30 bg-blue-50/50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <ClockIcon className="size-3.5 shrink-0" />
          <Trans>Awaiting Skill Verdict Admin confirmation.</Trans>
        </p>
      )}

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

          {item.assessmentInstructionsUrl && item.documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Assessment instructions</Trans>
              </p>
              {item.documents
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

          {item.status === "claimed" && canSubmitVerdict && (
            <ReviewDecisionPanel
              action={action}
              onActionChange={setAction}
              notes={notes}
              onNotesChange={setNotes}
              confirming={confirming}
              isPending={submitVerdict.isPending}
              onRequestConfirm={() => setConfirming(true)}
              onConfirm={handleSubmitVerdict}
              onCancel={() => onExpandedChange(false)}
              onBack={() => setConfirming(false)}
            />
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

  return (
    <span className={`flex items-center gap-x-1 rounded-full px-2 py-0.5 text-xs ${colorClass}`}>
      {verdict === "verified" && <CheckCircleIcon className="size-3" weight="fill" />}
      {verdict === "rejected" && <WarningCircleIcon className="size-3" weight="fill" />}
      {verdict === "issue" && <WarningCircleIcon className="size-3" weight="fill" />}
      {label}
    </span>
  );
}

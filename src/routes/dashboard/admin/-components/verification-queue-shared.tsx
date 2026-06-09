import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  LinkIcon,
  VideoIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import type { ResumeData } from "@/schema/resume/data";

import { ResumePreview } from "@/components/resume/preview";
import { VerificationProvider } from "@/components/resume/shared/verification-context";
import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDefaultDate } from "@/utils/format-date";

export type ReviewAction = "verified" | "rejected" | "issue";

export type QueueUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  username: string;
  displayUsername: string;
  image: string | null;
  twoFactorEnabled: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QueueResume = {
  id: string;
  name: string;
  slug: string;
  tags: string[];
  data: ResumeData;
  isLocked: boolean;
};

export type QueueDocument = {
  id: string;
  fileUrl: string;
  documentType: string;
  uploadedAt: Date;
};

// ---------------------------------------------------------------------------
// Queue state helpers
// ---------------------------------------------------------------------------

export function QueueLoadingState() {
  return (
    <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
      <ClockIcon className="size-4 animate-spin" />
      <Trans>Loading queue...</Trans>
    </div>
  );
}

export function QueueEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border p-6 text-center">
      <CheckCircleIcon className="mx-auto mb-2 size-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function QueueErrorState({ message }: { message?: string }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
      <WarningCircleIcon className="mx-auto mb-2 size-8 text-destructive" weight="fill" />
      <p className="text-sm text-destructive">
        {message ?? <Trans>Failed to load queue. Please refresh and try again.</Trans>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applicant details
// ---------------------------------------------------------------------------

export function ApplicantDetails({ user }: { user: QueueUser }) {
  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Applicant</Trans>
      </p>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(7rem,auto)_1fr]">
          <dt className="text-muted-foreground">
            <Trans>User ID</Trans>
          </dt>
          <dd className="font-mono break-all">{user.id}</dd>

          <dt className="text-muted-foreground">
            <Trans>Name</Trans>
          </dt>
          <dd className="wrap-break-word">{user.name}</dd>

          <dt className="text-muted-foreground">
            <Trans>Email</Trans>
          </dt>
          <dd className="break-all">{user.email}</dd>

          <dt className="text-muted-foreground">
            <Trans>Email verified</Trans>
          </dt>
          <dd>{user.emailVerified ? t`Yes` : t`No`}</dd>

          <dt className="text-muted-foreground">
            <Trans>Username</Trans>
          </dt>
          <dd className="break-all">{user.username}</dd>

          <dt className="text-muted-foreground">
            <Trans>Display username</Trans>
          </dt>
          <dd className="break-all">{user.displayUsername}</dd>

          <dt className="text-muted-foreground">
            <Trans>Profile image URL</Trans>
          </dt>
          <dd className="break-all">{user.image ?? "—"}</dd>

          <dt className="text-muted-foreground">
            <Trans>Two-factor enabled</Trans>
          </dt>
          <dd>{user.twoFactorEnabled ? t`Yes` : t`No`}</dd>

          <dt className="text-muted-foreground">
            <Trans>Last active</Trans>
          </dt>
          <dd>{fmtDate(user.lastActiveAt)}</dd>

          <dt className="text-muted-foreground">
            <Trans>Account created</Trans>
          </dt>
          <dd>{fmtDate(user.createdAt)}</dd>

          <dt className="text-muted-foreground">
            <Trans>Account updated</Trans>
          </dt>
          <dd>{fmtDate(user.updatedAt)}</dd>
        </dl>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reviewer details
// ---------------------------------------------------------------------------

export function ReviewerDetails({
  name,
  title,
  skills,
  publicProfileUrl,
  proposedVerdict,
  verdictNotes,
  verdictSubmittedAt,
}: {
  name: string | null;
  title: string | null;
  skills: string[];
  publicProfileUrl: string | null;
  proposedVerdict: "verified" | "rejected" | "issue" | null;
  verdictNotes: string | null;
  verdictSubmittedAt: Date | null;
}) {
  const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleString() : "—");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Reviewer</Trans>
      </p>
      <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(7rem,auto)_1fr]">
          <dt className="text-muted-foreground">
            <Trans>Name</Trans>
          </dt>
          <dd className="wrap-break-word">{name ?? "—"}</dd>

          <dt className="text-muted-foreground">
            <Trans>Title</Trans>
          </dt>
          <dd className="wrap-break-word">{title ?? "—"}</dd>

          <dt className="text-muted-foreground">
            <Trans>Reviewable skills</Trans>
          </dt>
          <dd>{skills.length > 0 ? skills.join(", ") : "—"}</dd>

          <dt className="text-muted-foreground">
            <Trans>Public profile</Trans>
          </dt>
          <dd>
            {publicProfileUrl ? (
              <a href={publicProfileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {publicProfileUrl}
              </a>
            ) : (
              "—"
            )}
          </dd>

          <dt className="text-muted-foreground">
            <Trans>Proposed verdict</Trans>
          </dt>
          <dd>
            {proposedVerdict ? (
              <ProposedVerdictLabel verdict={proposedVerdict} />
            ) : (
              "—"
            )}
          </dd>

          <dt className="text-muted-foreground">
            <Trans>Verdict notes</Trans>
          </dt>
          <dd className="wrap-break-word">{verdictNotes ?? "—"}</dd>

          <dt className="text-muted-foreground">
            <Trans>Verdict submitted</Trans>
          </dt>
          <dd>{fmtDate(verdictSubmittedAt)}</dd>
        </dl>
      </div>
    </div>
  );
}

function ProposedVerdictLabel({ verdict }: { verdict: "verified" | "rejected" | "issue" }) {
  const colorClass =
    verdict === "verified"
      ? "text-green-700 dark:text-green-400"
      : verdict === "rejected"
        ? "text-red-700 dark:text-red-400"
        : "text-orange-700 dark:text-orange-400";

  const label =
    verdict === "verified" ? t`Pass` : verdict === "rejected" ? t`Fail` : t`Issue`;

  return <span className={`font-medium capitalize ${colorClass}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Resume preview
// ---------------------------------------------------------------------------

export function QueueResumePreview({ resume }: { resume: QueueResume }) {
  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  useEffect(() => {
    initialize({
      id: resume.id,
      name: resume.name,
      slug: resume.slug,
      tags: resume.tags,
      data: resume.data,
      isLocked: resume.isLocked,
    });
    return () => initialize(null);
  }, [resume.id, resume.name, resume.slug, resume.tags, resume.data, resume.isLocked, initialize]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center gap-x-2 rounded-md border py-8 text-xs text-muted-foreground">
        <ClockIcon className="size-4 animate-spin" />
        <Trans>Loading preview…</Trans>
      </div>
    );
  }

  return (
    <VerificationProvider statuses={[]}>
      <TransformWrapper centerOnInit limitToBounds={false} minScale={0.2} initialScale={0.45} maxScale={2}>
        <TransformComponent wrapperClass="!max-h-[min(70vh,32rem)] !w-full overflow-auto border rounded-md bg-muted/30">
          <ResumePreview
            showPageNumbers
            className="flex items-start space-y-10 space-x-10 p-4"
            pageClassName="shadow-md rounded-md overflow-hidden"
          />
        </TransformComponent>
      </TransformWrapper>
    </VerificationProvider>
  );
}

// ---------------------------------------------------------------------------
// Document preview
// ---------------------------------------------------------------------------

type DocRenderType = "image" | "pdf" | "link" | "loading" | "error";

export function DocumentPreview({
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

  const isExternalLink = documentType === "freelancer_link" || documentType === "assessment_solution_link";

  useEffect(() => {
    if (!expanded || isExternalLink) return;

    let cancelled = false;
    setRenderType("loading");
    setObjectUrl(null);

    void (async () => {
      try {
        const res = await fetch(fileUrl, { credentials: "include" });
        if (!res.ok || cancelled) {
          if (!cancelled) setRenderType("error");
          return;
        }

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
  }, [expanded, fileUrl, isExternalLink]);

  return (
    <div className="overflow-hidden rounded border">
      <div className="flex items-center justify-between p-2">
        <div className="flex items-center gap-x-2">
          {isExternalLink ? (
            <LinkIcon className="size-3.5 text-muted-foreground" />
          ) : (
            <FileTextIcon className="size-3.5 text-muted-foreground" />
          )}
          <span className="text-xs capitalize">{documentType.replace(/_/g, " ")}</span>
          <span className="text-xs text-muted-foreground">{formatDefaultDate(uploadedAt)}</span>
        </div>

        {isExternalLink ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {documentType === "freelancer_link" ? <Trans>Open Profile</Trans> : <Trans>Open Link</Trans>}
          </a>
        ) : (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <Trans>Hide</Trans> : <Trans>Preview</Trans>}
          </Button>
        )}
      </div>

      {expanded && !isExternalLink && (
        <div className="border-t bg-muted/30 p-2">
          {renderType === "loading" && (
            <div className="flex items-center justify-center gap-x-2 py-4 text-xs text-muted-foreground">
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
              className="mx-auto block max-h-[480px] w-auto max-w-full rounded object-contain"
            />
          )}

          {renderType === "pdf" && objectUrl && (
            <iframe src={objectUrl} title={documentType} className="h-[480px] w-full rounded border-0" />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review decision panel
// ---------------------------------------------------------------------------

export function ReviewDecisionPanel({
  action,
  onActionChange,
  notes,
  onNotesChange,
  confirming,
  isPending,
  onRequestConfirm,
  onConfirm,
  onCancel,
  onBack,
}: {
  action: ReviewAction;
  onActionChange: (a: ReviewAction) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  confirming: boolean;
  isPending: boolean;
  onRequestConfirm: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        <Trans>Review Decision</Trans>
      </p>
      <div className="flex gap-x-2">
        {(["verified", "rejected", "issue"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => onActionChange(a)}
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
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={t`Optional notes for the applicant...`}
        className="min-h-[60px] resize-none text-xs"
      />

      {!confirming ? (
        <div className="flex items-center gap-x-2">
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={onRequestConfirm}>
            <Trans>Submit Review</Trans>
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-x-2">
          <span className="text-xs text-muted-foreground">
            <Trans>Confirm decision: </Trans>
            <span className="font-medium capitalize">{action}</span>?
          </span>
          <Button size="sm" variant="default" className="h-7 text-xs" disabled={isPending} onClick={onConfirm}>
            {isPending ? <Trans>Submitting...</Trans> : <Trans>Confirm</Trans>}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={isPending} onClick={onBack}>
            <Trans>Back</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status / method badges
// ---------------------------------------------------------------------------

export function StatusBadge({ status }: { status: string }) {
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

export function MethodBadge({ method }: { method: string | null }) {
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

  if (method === "identity_call") {
    return (
      <span className="flex items-center gap-x-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        <VideoIcon className="size-3" />
        <Trans>Identity Call</Trans>
      </span>
    );
  }

  return null;
}

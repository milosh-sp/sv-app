import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
  CaretDownIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  FileTextIcon,
  LinkIcon,
  PaperPlaneRightIcon,
  SealCheckIcon,
  UploadIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/verification/")({
  component: RouteComponent,
});

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type VerificationItem = {
  id: string;
  sectionType: string;
  itemId: string;
  itemLabel: string;
  status: string;
  badgeVisible: boolean;
  submittedAt: Date;
  resumeId: string | null;
};

type ResumeItem = {
  id: string;
  label: string;
};

function RouteComponent() {
  const queryClient = useQueryClient();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  const { data: resumes } = useSuspenseQuery(
    orpc.resume.list.queryOptions({ input: { tags: [], sort: "lastUpdatedAt" } }),
  );

  const firstResumeId = resumes?.[0]?.id ?? null;
  const activeResumeId = selectedResumeId ?? firstResumeId;

  const { data: resumeData } = useQuery({
    ...orpc.resume.getById.queryOptions({ input: { id: activeResumeId! } }),
    enabled: !!activeResumeId,
  });

  const { data: statuses } = useSuspenseQuery(
    orpc.verification.getAllStatuses.queryOptions(),
  );

  const resumeStatuses = useMemo(
    () => statuses.filter((s) => s.resumeId === activeResumeId),
    [statuses, activeResumeId],
  );

  const getStatusForItem = useCallback(
    (itemId: string) => resumeStatuses.find((s) => s.itemId === itemId),
    [resumeStatuses],
  );

  const skills: ResumeItem[] = useMemo(() => {
    if (!resumeData?.data?.sections?.skills?.items) return [];
    return resumeData.data.sections.skills.items
      .filter((item) => !item.hidden)
      .map((item) => ({ id: item.id, label: item.name }));
  }, [resumeData]);

  const projects: ResumeItem[] = useMemo(() => {
    if (!resumeData?.data?.sections?.projects?.items) return [];
    return resumeData.data.sections.projects.items
      .filter((item) => !item.hidden)
      .map((item) => ({ id: item.id, label: item.name }));
  }, [resumeData]);

  const experiences: ResumeItem[] = useMemo(() => {
    if (!resumeData?.data?.sections?.experience?.items) return [];
    return resumeData.data.sections.experience.items
      .filter((item) => !item.hidden)
      .map((item) => ({
        id: item.id,
        label: item.position ? `${item.company} — ${item.position}` : item.company,
      }));
  }, [resumeData]);

  const countVerified = (items: ResumeItem[]) =>
    items.filter((item) => getStatusForItem(item.id)?.status === "verified").length;

  const invalidateStatuses = () => {
    void queryClient.invalidateQueries({ queryKey: orpc.verification.getAllStatuses.queryOptions().queryKey });
  };

  if (!resumes || resumes.length === 0) {
    return (
      <div className="space-y-4">
        <DashboardHeader icon={SealCheckIcon} title={t`Verification`} />
        <Separator />
        <p className="text-sm text-muted-foreground">
          <Trans>Create a resume first to start verifying your skills, projects, and experience.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardHeader icon={SealCheckIcon} title={t`Verification`} />

      <Separator />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="max-w-3xl space-y-6"
      >
        {/* Resume selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            <Trans>Select Resume</Trans>
          </label>
          <div className="flex flex-wrap gap-2">
            {resumes.map((resume) => (
              <Button
                key={resume.id}
                size="sm"
                variant={activeResumeId === resume.id ? "default" : "outline"}
                onClick={() => setSelectedResumeId(resume.id)}
              >
                {resume.name}
              </Button>
            ))}
          </div>
        </div>

        {activeResumeId && resumeData && (
          <>
            <VerificationSection
              title={t`Skills`}
              sectionType="skill"
              resumeId={activeResumeId}
              items={skills}
              getStatusForItem={getStatusForItem}
              verifiedCount={countVerified(skills)}
              totalCount={skills.length}
              onMutationSuccess={invalidateStatuses}
            />

            <VerificationSection
              title={t`Projects`}
              sectionType="project"
              resumeId={activeResumeId}
              items={projects}
              getStatusForItem={getStatusForItem}
              verifiedCount={countVerified(projects)}
              totalCount={projects.length}
              onMutationSuccess={invalidateStatuses}
            />

            <ExperienceVerificationSection
              title={t`Work Experience`}
              resumeId={activeResumeId}
              items={experiences}
              getStatusForItem={getStatusForItem}
              verifiedCount={countVerified(experiences)}
              totalCount={experiences.length}
              onMutationSuccess={invalidateStatuses}
            />
          </>
        )}
      </motion.div>
    </div>
  );
}

// --- Skills & Projects Section ---

type VerificationSectionProps = {
  title: string;
  sectionType: "skill" | "project";
  resumeId: string;
  items: ResumeItem[];
  getStatusForItem: (itemId: string) => VerificationItem | undefined;
  verifiedCount: number;
  totalCount: number;
  onMutationSuccess: () => void;
};

function VerificationSection({
  title,
  sectionType,
  resumeId,
  items,
  getStatusForItem,
  verifiedCount,
  totalCount,
  onMutationSuccess,
}: VerificationSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {verifiedCount}/{totalCount} <Trans>verified</Trans>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          <Trans>No items in this section. Add some to your resume first.</Trans>
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <SkillProjectItemRow
              key={item.id}
              item={item}
              sectionType={sectionType}
              resumeId={resumeId}
              existingStatus={getStatusForItem(item.id)}
              onMutationSuccess={onMutationSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillProjectItemRow({
  item,
  sectionType,
  resumeId,
  existingStatus,
  onMutationSuccess,
}: {
  item: ResumeItem;
  sectionType: "skill" | "project";
  resumeId: string;
  existingStatus: VerificationItem | undefined;
  onMutationSuccess: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const requestSkill = useMutation(orpc.verification.requestSkill.mutationOptions());
  const requestProject = useMutation(orpc.verification.requestProject.mutationOptions());
  const isPending = requestSkill.isPending || requestProject.isPending;

  const canRetry = existingStatus &&
    ["rejected", "issue"].includes(existingStatus.status);

  const handleRequest = () => {
    const mutate = sectionType === "skill" ? requestSkill.mutate : requestProject.mutate;
    mutate(
      { resumeId, itemId: item.id, itemLabel: item.label },
      {
        onSuccess: () => {
          toast.success(t`Verification requested for "${item.label}".`);
          setConfirming(false);
          onMutationSuccess();
        },
        onError: (error) => {
          toast.error(error.message);
          setConfirming(false);
        },
      },
    );
  };

  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <StatusIcon status={existingStatus?.status} />
          <span className="text-sm">{item.label}</span>
        </div>

        <div className="flex items-center gap-x-2">
          {existingStatus && (
            <StatusBadge status={existingStatus.status} />
          )}

          {(!existingStatus || canRetry) && !confirming && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setConfirming(true)}
            >
              <PaperPlaneRightIcon className="mr-1.5 size-3" />
              {canRetry ? <Trans>Retry</Trans> : <Trans>Request</Trans>}
            </Button>
          )}

          {confirming && (
            <div className="flex items-center gap-x-1.5">
              <span className="text-xs text-muted-foreground">
                <Trans>Submit?</Trans>
              </span>
              <Button
                size="sm"
                variant="default"
                className="h-6 px-2 text-xs"
                disabled={isPending}
                onClick={handleRequest}
              >
                <Trans>Confirm</Trans>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setConfirming(false)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </div>
          )}

          {existingStatus && (
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              {historyOpen ? <CaretDownIcon className="size-3" /> : <CaretRightIcon className="size-3" />}
            </Button>
          )}
        </div>
      </div>

      {historyOpen && existingStatus && <VerificationHistory itemId={item.id} />}
    </div>
  );
}

// --- Experience Section ---

type ExperienceSectionProps = {
  title: string;
  resumeId: string;
  items: ResumeItem[];
  getStatusForItem: (itemId: string) => VerificationItem | undefined;
  verifiedCount: number;
  totalCount: number;
  onMutationSuccess: () => void;
};

function ExperienceVerificationSection({
  title,
  resumeId,
  items,
  getStatusForItem,
  verifiedCount,
  totalCount,
  onMutationSuccess,
}: ExperienceSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {verifiedCount}/{totalCount} <Trans>verified</Trans>
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          <Trans>No experience items in your resume. Add some to get started.</Trans>
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ExperienceItemRow
              key={item.id}
              item={item}
              resumeId={resumeId}
              existingStatus={getStatusForItem(item.id)}
              onMutationSuccess={onMutationSuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ExperienceStep = "idle" | "method" | "upload" | "confirm";

function ExperienceItemRow({
  item,
  resumeId,
  existingStatus,
  onMutationSuccess,
}: {
  item: ResumeItem;
  resumeId: string;
  existingStatus: VerificationItem | undefined;
  onMutationSuccess: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [step, setStep] = useState<ExperienceStep>("idle");
  const [method, setMethod] = useState<"document_upload" | "freelancer_link" | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const uploadDocument = useMutation(orpc.verification.uploadDocument.mutationOptions());
  const requestExperience = useMutation(orpc.verification.requestExperience.mutationOptions());

  const isSubmitting = requestExperience.isPending || uploadDocument.isPending;

  const canRetry = existingStatus &&
    ["rejected", "issue"].includes(existingStatus.status);

  const resetFlow = () => {
    setStep("idle");
    setMethod(null);
    setSelectedFile(null);
  };

  const handleFileSelected = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error(t`Only PDF, JPG, JPEG, and PNG files are allowed.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t`File size must be under 5MB.`);
      return;
    }

    setSelectedFile(file);
    setStep("confirm");
  };

  const handleFreelancerLink = () => {
    setMethod("freelancer_link");
    setStep("confirm");
  };

  const handleSubmitExperience = () => {
    if (!method) return;

    requestExperience.mutate(
      {
        resumeId,
        itemId: item.id,
        itemLabel: item.label,
        method,
      },
      {
        onSuccess: () => {
          if (method === "document_upload" && selectedFile) {
            const docType: "payslip" | "contract" =
              selectedFile.name.toLowerCase().includes("payslip") ? "payslip" : "contract";

            uploadDocument.mutate(
              {
                resumeId,
                itemId: item.id,
                file: selectedFile,
                documentType: docType,
              },
              {
                onSuccess: () => {
                  toast.success(t`Experience verification requested for "${item.label}".`);
                  resetFlow();
                  onMutationSuccess();
                },
                onError: (error) => {
                  toast.error(error.message);
                  onMutationSuccess();
                  resetFlow();
                },
              },
            );
          } else {
            toast.success(t`Experience verification requested for "${item.label}".`);
            resetFlow();
            onMutationSuccess();
          }
        },
        onError: (error) => {
          toast.error(error.message);
          resetFlow();
        },
      },
    );
  };

  return (
    <div className="rounded border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <StatusIcon status={existingStatus?.status} />
          <span className="text-sm">{item.label}</span>
        </div>

        <div className="flex items-center gap-x-2">
          {existingStatus && (
            <StatusBadge status={existingStatus.status} />
          )}

          {(!existingStatus || canRetry) && step === "idle" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setStep("method")}
            >
              <PaperPlaneRightIcon className="mr-1.5 size-3" />
              {canRetry ? <Trans>Retry</Trans> : <Trans>Verify</Trans>}
            </Button>
          )}

          {existingStatus && (
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0"
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              {historyOpen ? <CaretDownIcon className="size-3" /> : <CaretRightIcon className="size-3" />}
            </Button>
          )}
        </div>
      </div>

      {/* Method selection step */}
      {step === "method" && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            <Trans>Choose a verification method:</Trans>
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                setMethod("document_upload");
                setStep("upload");
              }}
            >
              <FileTextIcon className="mr-1.5 size-3.5" />
              <Trans>Upload Document</Trans>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleFreelancerLink}
            >
              <LinkIcon className="mr-1.5 size-3.5" />
              <Trans>Freelancer Profile Link</Trans>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={resetFlow}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </div>
      )}

      {/* File selection step — file is held client-side, not uploaded yet */}
      {step === "upload" && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            <Trans>Select a payslip, contract, or other proof of employment (PDF, JPG, PNG, max 5MB).</Trans>
          </p>
          <div className="flex items-center gap-2">
            <FileUploadButton onUpload={handleFileSelected} isUploading={false} />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={resetFlow}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation step */}
      {step === "confirm" && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {method === "document_upload" && selectedFile ? (
              <Trans>
                File selected: {selectedFile.name}. Submit your verification request?
              </Trans>
            ) : (
              <Trans>Submit verification via freelancer profile link?</Trans>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs"
              disabled={isSubmitting}
              onClick={handleSubmitExperience}
            >
              <PaperPlaneRightIcon className="mr-1.5 size-3" />
              {isSubmitting ? <Trans>Submitting...</Trans> : <Trans>Submit Request</Trans>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              disabled={isSubmitting}
              onClick={resetFlow}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </div>
      )}

      {historyOpen && existingStatus && <VerificationHistory itemId={item.id} />}
    </div>
  );
}

// --- Shared Components ---

function StatusIcon({ status }: { status: string | undefined }) {
  if (!status) return null;

  if (status === "verified") {
    return <CheckCircleIcon className="size-4 text-green-600" weight="fill" />;
  }
  if (status === "pending" || status === "claimed" || status === "verdict_pending") {
    return <ClockIcon className="size-4 text-amber-500" />;
  }
  if (status === "rejected") {
    return <XCircleIcon className="size-4 text-red-500" />;
  }
  if (status === "issue") {
    return <WarningCircleIcon className="size-4 text-orange-500" />;
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const displayStatus = (s: string) => {
    if (s === "claimed" || s === "verdict_pending") return "pending";
    return s;
  };

  const colorClass = (() => {
    const s = displayStatus(status);
    if (s === "verified") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (s === "pending") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    if (s === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (s === "issue") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-muted";
  })();

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${colorClass}`}>
      {displayStatus(status)}
    </span>
  );
}

function VerificationHistory({ itemId }: { itemId: string }) {
  const { data: history } = useSuspenseQuery(
    orpc.verification.getHistory.queryOptions({ input: { itemId } }),
  );

  if (!history || history.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        <Trans>No history available.</Trans>
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1 border-t pt-2">
      {history.map((entry) => (
        <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{entry.status}</span>
          <span>{new Date(entry.submittedAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

function FileUploadButton({
  onUpload,
  isUploading,
}: {
  onUpload: (file: File) => void;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      onUpload(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onUpload],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <UploadIcon className="mr-1.5 size-3.5" />
        {isUploading ? <Trans>Uploading...</Trans> : <Trans>Choose File</Trans>}
      </Button>
    </>
  );
}

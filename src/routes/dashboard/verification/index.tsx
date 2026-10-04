import type z from "zod";

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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { skillItemSchema } from "@/schema/resume/data";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";
import { formatDefaultDate } from "@/utils/format-date";
import { hasAssessmentSolutionInput } from "@/utils/verification-assessment-solution";
import { expandSkillItemsForVerification } from "@/utils/verification/skills";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/verification/")({
  component: RouteComponent,
});

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_SOLUTION_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/zip",
  "application/x-zip-compressed",
];
const MAX_SOLUTION_FILE_SIZE = 25 * 1024 * 1024;

export function verificationDocumentRejection(file: { type: string; size: number }): "type" | "size" | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_FILE_SIZE) return "size";
  return null;
}

export function verificationDisplayStatus(status: string): string {
  if (status === "claimed") return "assessment in progress";
  if (status === "verdict_pending") return "awaiting final review";
  return status;
}

export function canRetryVerification(status: string | undefined): boolean {
  return status === "rejected" || status === "issue";
}

export function blocksNewVerificationRequest(status: string | undefined): boolean {
  if (!status) return false;
  return !canRetryVerification(status);
}

export function visibleNamedItems(items: { id: string; name: string; hidden: boolean }[]) {
  return items.filter((item) => !item.hidden).map((item) => ({ id: item.id, label: item.name }));
}

export function visibleExperienceItems(items: { id: string; company: string; position: string; hidden: boolean }[]) {
  return items
    .filter((item) => !item.hidden)
    .map((item) => ({
      id: item.id,
      label: item.position ? `${item.company} — ${item.position}` : item.company,
    }));
}

export function findVerificationItemStatus<T extends { itemId: string; resumeId: string | null }>(
  statuses: T[],
  itemId: string,
  resumeId: string | null,
) {
  return statuses.find((status) => status.itemId === itemId && status.resumeId === resumeId);
}

export function countVerifiedItems<T extends { id: string }>(
  items: T[],
  statusOf: (id: string) => { status: string } | undefined,
) {
  return items.filter((item) => statusOf(item.id)?.status === "verified").length;
}

type VerificationItem = {
  id: string;
  sectionType: string;
  itemId: string;
  itemLabel: string;
  status: string;
  badgeVisible: boolean;
  submittedAt: Date;
  resumeId: string | null;
  assessmentInstructionsUrl?: string | null;
  assessmentAcceptedAt?: Date | null;
  assessmentSolutionSubmittedAt?: Date | null;
  assessmentSolutionFileUrl?: string | null;
  assessmentSolutionLinkUrl?: string | null;
};

type ResumeItem = {
  id: string;
  label: string;
};

type SkillItem = z.infer<typeof skillItemSchema>;

type SkillGroup = {
  item: SkillItem;
  units: ReturnType<typeof expandSkillItemsForVerification>;
};

//TODO: Projects verification UI is not enabled yet
const showProjectsFeature = false;

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);

  const { data: resumes } = useSuspenseQuery(
    orpc.resume.list.queryOptions({
      input: { tags: [], sort: "lastUpdatedAt" },
    }),
  );

  const firstResumeId = resumes?.[0]?.id ?? null;
  const activeResumeId = selectedResumeId ?? firstResumeId;

  const { data: resumeData } = useQuery({
    ...orpc.resume.getById.queryOptions({ input: { id: activeResumeId! } }),
    enabled: !!activeResumeId,
  });

  const { data: statuses } = useSuspenseQuery(orpc.verification.getAllStatuses.queryOptions());

  const getStatusForItem = useCallback(
    (itemId: string) => findVerificationItemStatus(statuses, itemId, activeResumeId),
    [statuses, activeResumeId],
  );

  const skillGroups: SkillGroup[] = useMemo(() => {
    if (!resumeData?.data?.sections?.skills?.items) return [];

    return resumeData.data.sections.skills.items
      .filter((item) => !item.hidden)
      .map((item) => ({
        item,
        units: expandSkillItemsForVerification([item]),
      }))
      .filter((group) => group.units.length > 0);
  }, [resumeData]);

  const verifiableSkills = useMemo(() => skillGroups.flatMap((group) => group.units), [skillGroups]);

  const projects: ResumeItem[] = useMemo(() => {
    if (!resumeData?.data?.sections?.projects?.items) return [];
    return visibleNamedItems(resumeData.data.sections.projects.items);
  }, [resumeData]);

  const experiences: ResumeItem[] = useMemo(() => {
    if (!resumeData?.data?.sections?.experience?.items) return [];
    return visibleExperienceItems(resumeData.data.sections.experience.items);
  }, [resumeData]);

  const countVerified = (items: ResumeItem[]) => countVerifiedItems(items, (id) => getStatusForItem(id));

  const invalidateStatuses = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.verification.getAllStatuses.queryOptions().queryKey,
    });
  };

  if (!resumes || resumes.length === 0) {
    return (
      <div className="space-y-4">
        <DashboardHeader icon={SealCheckIcon} title={t`Verification`} />
        <Separator />
        <p className="text-sm text-muted-foreground">
          <Trans>Create a resume first to start verifying your skills, projects, and experience.</Trans>
        </p>
        <Button
          size="sm"
          onClick={() =>
            void navigate({
              to: "/dashboard/resumes",
              search: { sort: "lastUpdatedAt", tags: [] },
            })
          }
        >
          <Trans>Create a new resume</Trans>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardHeader icon={SealCheckIcon} title={t`Verification`} />

      <p className="text-sm text-muted-foreground">
        <Trans>
          Request verification for the items on your resume. Skills are reviewed by domain-expert reviewers, while work
          experience is confirmed from documents or a freelancer profile link.
        </Trans>
      </p>

      <Separator />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full space-y-6"
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
            <SkillVerificationSection
              title={t`Skills`}
              resumeId={activeResumeId}
              groups={skillGroups}
              getStatusForItem={getStatusForItem}
              verifiedCount={countVerified(
                verifiableSkills.map((unit) => ({
                  id: unit.itemId,
                  label: unit.itemLabel,
                })),
              )}
              totalCount={verifiableSkills.length}
              onMutationSuccess={invalidateStatuses}
            />

            {showProjectsFeature && (
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
            )}

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

// --- Skills Section (collapsible groups) ---

type SkillVerificationSectionProps = {
  title: string;
  resumeId: string;
  groups: SkillGroup[];
  getStatusForItem: (itemId: string) => VerificationItem | undefined;
  verifiedCount: number;
  totalCount: number;
  onMutationSuccess: () => void;
};

function SkillVerificationSection({
  title,
  resumeId,
  groups,
  getStatusForItem,
  verifiedCount,
  totalCount,
  onMutationSuccess,
}: SkillVerificationSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {verifiedCount}/{totalCount} <Trans>verified</Trans>
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          <Trans>No items in this section. Add some to your resume first.</Trans>
        </p>
      ) : (
        <Accordion className="space-y-2">
          {groups.map((group) => {
            const groupVerifiedCount = group.units.filter(
              (unit) => getStatusForItem(unit.itemId)?.status === "verified",
            ).length;
            const legacyParentStatus = getStatusForItem(group.item.id);

            return (
              <AccordionItem key={group.item.id} value={group.item.id} className="rounded border px-3">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-x-3 pe-2">
                    <div className="flex items-center gap-x-2">
                      {legacyParentStatus && <StatusIcon status={legacyParentStatus.status} />}
                      <span className="text-sm font-medium">{group.item.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {groupVerifiedCount}/{group.units.length} <Trans>verified</Trans>
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  {legacyParentStatus && group.units.every((unit) => unit.itemId !== group.item.id) && (
                    <div className="mb-2 rounded border border-dashed p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-x-2">
                          <StatusIcon status={legacyParentStatus.status} />
                          <span className="text-sm text-muted-foreground">
                            <Trans>Legacy category request</Trans>
                          </span>
                        </div>
                        <StatusBadge status={legacyParentStatus.status} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    {group.units.map((unit) => (
                      <SkillProjectItemRow
                        key={unit.itemId}
                        item={{ id: unit.itemId, label: unit.itemLabel }}
                        sectionType="skill"
                        resumeId={resumeId}
                        existingStatus={getStatusForItem(unit.itemId)}
                        onMutationSuccess={onMutationSuccess}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

// --- Projects Section ---

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
  const solutionFileInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [solutionUrl, setSolutionUrl] = useState("");

  const requestSkill = useMutation(orpc.verification.requestSkill.mutationOptions());
  const requestProject = useMutation(orpc.verification.requestProject.mutationOptions());
  const submitAssessmentSolution = useMutation(orpc.verification.submitAssessmentSolution.mutationOptions());
  const isPending = requestSkill.isPending || requestProject.isPending || submitAssessmentSolution.isPending;

  const canRetry = canRetryVerification(existingStatus?.status);
  const hasSubmittedSolution = Boolean(
    existingStatus?.assessmentSolutionSubmittedAt ||
    existingStatus?.assessmentSolutionFileUrl ||
    existingStatus?.assessmentSolutionLinkUrl,
  );
  const showSolutionForm = existingStatus?.status === "claimed" && !hasSubmittedSolution;

  const resetSolutionForm = () => {
    setSolutionFile(null);
    setSolutionUrl("");
    if (solutionFileInputRef.current) solutionFileInputRef.current.value = "";
  };

  const handleSolutionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSolutionFile(null);
      return;
    }

    if (!ALLOWED_SOLUTION_TYPES.includes(file.type)) {
      toast.error(t`Only PDF, JPG, JPEG, PNG, and ZIP files are allowed.`);
      event.target.value = "";
      setSolutionFile(null);
      return;
    }

    if (file.size > MAX_SOLUTION_FILE_SIZE) {
      toast.error(t`File size must be under 25MB.`);
      event.target.value = "";
      setSolutionFile(null);
      return;
    }

    setSolutionFile(file);
  };

  const handleSubmitSolution = () => {
    const trimmedUrl = solutionUrl.trim();
    if (!hasAssessmentSolutionInput({ file: solutionFile ?? undefined, solutionUrl })) {
      toast.error(t`Provide a file or solution URL.`);
      return;
    }

    submitAssessmentSolution.mutate(
      {
        resumeId,
        itemId: item.id,
        ...(solutionFile ? { file: solutionFile } : {}),
        ...(trimmedUrl ? { solutionUrl: trimmedUrl } : {}),
      },
      {
        onSuccess: () => {
          toast.success(t`Assessment solution submitted for "${item.label}".`);
          resetSolutionForm();
          onMutationSuccess();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

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
          {existingStatus && <StatusBadge status={existingStatus.status} />}

          {(!existingStatus || canRetry) && !confirming && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setConfirming(true)}>
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
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirming(false)}>
                <Trans>Cancel</Trans>
              </Button>
            </div>
          )}

          {existingStatus && (
            <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setHistoryOpen(!historyOpen)}>
              {historyOpen ? <CaretDownIcon className="size-3" /> : <CaretRightIcon className="size-3" />}
            </Button>
          )}
        </div>
      </div>

      {existingStatus?.status === "claimed" && existingStatus.assessmentInstructionsUrl && (
        <div className="mt-3 space-y-3 rounded-md border border-purple-500/30 bg-purple-50/40 p-3 dark:bg-purple-900/10">
          <div className="space-y-2">
            <p className="text-xs font-medium text-purple-900 dark:text-purple-200">
              <Trans>Assessment in progress</Trans>
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans>
                Your reviewer has accepted your request. Download the instructions, complete the assessment, then submit
                your solution below.
              </Trans>
            </p>
            <a
              href={existingStatus.assessmentInstructionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-x-1.5 text-xs font-medium text-primary hover:underline"
            >
              <FileTextIcon className="size-3.5" />
              <Trans>Download assessment instructions</Trans>
            </a>
          </div>

          {showSolutionForm ? (
            <div className="space-y-2 border-t border-purple-500/20 pt-3">
              <p className="text-xs font-medium text-purple-900 dark:text-purple-200">
                <Trans>Submit your solution</Trans>
              </p>
              <p className="text-xs text-muted-foreground">
                <Trans>
                  Upload a file or share a link (for example, a GitHub repository). At least one is required.
                </Trans>
              </p>
              <div className="space-y-2">
                <input
                  ref={solutionFileInputRef}
                  type="file"
                  accept={ALLOWED_SOLUTION_TYPES.join(",")}
                  className="block w-full text-xs file:me-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
                  onChange={handleSolutionFileChange}
                />
                {solutionFile ? (
                  <p className="text-xs text-muted-foreground">
                    <Trans>Selected file:</Trans> {solutionFile.name}
                  </p>
                ) : null}
                <div className="flex items-center gap-x-2">
                  <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    type="url"
                    value={solutionUrl}
                    onChange={(event) => setSolutionUrl(event.target.value)}
                    placeholder={t`https://github.com/you/your-solution`}
                    className="h-8 w-full rounded border bg-background px-2 text-xs"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                disabled={isPending}
                onClick={handleSubmitSolution}
              >
                <UploadIcon className="mr-1.5 size-3" />
                <Trans>Submit solution</Trans>
              </Button>
            </div>
          ) : hasSubmittedSolution ? (
            <div className="space-y-2 border-t border-purple-500/20 pt-3">
              <p className="text-xs font-medium text-purple-900 dark:text-purple-200">
                <Trans>Solution submitted</Trans>
              </p>
              {existingStatus.assessmentSolutionSubmittedAt ? (
                <p className="text-xs text-muted-foreground">
                  <Trans>Submitted on</Trans> {formatDefaultDate(existingStatus.assessmentSolutionSubmittedAt)}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {existingStatus.assessmentSolutionFileUrl ? (
                  <a
                    href={existingStatus.assessmentSolutionFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-x-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <FileTextIcon className="size-3.5" />
                    <Trans>View submitted file</Trans>
                  </a>
                ) : null}
                {existingStatus.assessmentSolutionLinkUrl ? (
                  <a
                    href={existingStatus.assessmentSolutionLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-x-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <LinkIcon className="size-3.5" />
                    <Trans>Open submitted link</Trans>
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {existingStatus?.status === "verdict_pending" && (
        <div className="mt-3 space-y-3 rounded-md border border-blue-500/30 bg-blue-50/40 p-3 dark:bg-blue-900/10">
          <div className="space-y-2">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
              <Trans>Awaiting final approval</Trans>
            </p>
            <p className="text-xs text-muted-foreground">
              <Trans>
                Your reviewer has completed their assessment. Your submission is now awaiting final approval from Skill
                Verdict Admin. You will be notified by email once a final decision is made.
              </Trans>
            </p>
          </div>

          {hasSubmittedSolution ? (
            <div className="space-y-2 border-t border-blue-500/20 pt-3">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                <Trans>Submitted solution</Trans>
              </p>
              {existingStatus.assessmentSolutionSubmittedAt ? (
                <p className="text-xs text-muted-foreground">
                  <Trans>Submitted on</Trans> {formatDefaultDate(existingStatus.assessmentSolutionSubmittedAt)}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {existingStatus.assessmentSolutionFileUrl ? (
                  <a
                    href={existingStatus.assessmentSolutionFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-x-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <FileTextIcon className="size-3.5" />
                    <Trans>View submitted file</Trans>
                  </a>
                ) : null}
                {existingStatus.assessmentSolutionLinkUrl ? (
                  <a
                    href={existingStatus.assessmentSolutionLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-x-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <LinkIcon className="size-3.5" />
                    <Trans>Open submitted link</Trans>
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {historyOpen && existingStatus && <VerificationHistory resumeId={resumeId} itemId={item.id} />}
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

type ExperienceStep = "idle" | "method" | "upload" | "link_input" | "confirm";

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
  const [freelancerUrl, setFreelancerUrl] = useState("");
  const [documentPending, setDocumentPending] = useState(false);

  const uploadDocument = useMutation(orpc.verification.uploadDocument.mutationOptions());
  const requestExperience = useMutation(orpc.verification.requestExperience.mutationOptions());

  const isSubmitting = requestExperience.isPending || uploadDocument.isPending;

  const canRetry = canRetryVerification(existingStatus?.status);

  const resetFlow = () => {
    setStep("idle");
    setMethod(null);
    setSelectedFile(null);
    setFreelancerUrl("");
    setDocumentPending(false);
  };

  const uploadSelectedFile = () => {
    if (!selectedFile) return;

    const docType: "payslip" | "contract" = selectedFile.name.toLowerCase().includes("payslip")
      ? "payslip"
      : "contract";

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
        },
      },
    );
  };

  const handleFileSelected = (file: File) => {
    const rejection = verificationDocumentRejection(file);
    if (rejection === "type") {
      toast.error(t`Only PDF, JPG, JPEG, and PNG files are allowed.`);
      return;
    }
    if (rejection === "size") {
      toast.error(t`File size must be under 5MB.`);
      return;
    }

    setSelectedFile(file);
    setStep("confirm");
  };

  const handleFreelancerLink = () => {
    setMethod("freelancer_link");
    setStep("link_input");
  };

  const handleSubmitExperience = () => {
    if (!method) return;

    if (method === "document_upload" && documentPending) {
      uploadSelectedFile();
      return;
    }

    requestExperience.mutate(
      {
        resumeId,
        itemId: item.id,
        itemLabel: item.label,
        method,
        ...(method === "freelancer_link" && freelancerUrl ? { freelancerUrl } : {}),
      },
      {
        onSuccess: () => {
          if (method === "document_upload" && selectedFile) {
            setDocumentPending(true);
            uploadSelectedFile();
            return;
          }

          toast.success(t`Experience verification requested for "${item.label}".`);
          resetFlow();
          onMutationSuccess();
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
          {existingStatus && <StatusBadge status={existingStatus.status} />}

          {(!existingStatus || canRetry) && step === "idle" && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setStep("method")}>
              <PaperPlaneRightIcon className="mr-1.5 size-3" />
              {canRetry ? <Trans>Retry</Trans> : <Trans>Verify</Trans>}
            </Button>
          )}

          {existingStatus && (
            <Button variant="ghost" size="sm" className="size-6 p-0" onClick={() => setHistoryOpen(!historyOpen)}>
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
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleFreelancerLink}>
              <LinkIcon className="mr-1.5 size-3.5" />
              <Trans>Freelancer Profile Link</Trans>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetFlow}>
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
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetFlow}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </div>
      )}

      {/* Freelancer link input step */}
      {step === "link_input" && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            <Trans>Enter your freelancer profile URL (e.g. Upwork, Fiverr, Toptal):</Trans>
          </p>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={freelancerUrl}
              onChange={(e) => setFreelancerUrl(e.target.value)}
              placeholder={t`https://www.upwork.com/freelancers/~...`}
              className="h-8 flex-1 rounded-md border bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs"
              disabled={!freelancerUrl.trim()}
              onClick={() => setStep("confirm")}
            >
              <Trans>Continue</Trans>
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={resetFlow}>
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
              <Trans>File selected: {selectedFile.name}. Submit your verification request?</Trans>
            ) : (
              <Trans>Profile link: {freelancerUrl}. Submit your verification request?</Trans>
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
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={isSubmitting} onClick={resetFlow}>
              <Trans>Cancel</Trans>
            </Button>
          </div>
        </div>
      )}

      {historyOpen && existingStatus && <VerificationHistory resumeId={resumeId} itemId={item.id} />}
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
  const colorClass = (() => {
    const s = verificationDisplayStatus(status);
    if (s === "verified") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (s === "pending") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    if (s === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (s === "issue") return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    return "bg-muted";
  })();

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${colorClass}`}>
      {verificationDisplayStatus(status)}
    </span>
  );
}

function VerificationHistory({ resumeId, itemId }: { resumeId: string; itemId: string }) {
  const {
    data: history,
    isLoading,
    isError,
    error,
  } = useQuery(orpc.verification.getHistory.queryOptions({ input: { resumeId, itemId } }));

  if (isLoading) {
    return (
      <div className="mt-2 flex items-center gap-x-2 border-t pt-2">
        <ClockIcon className="size-3 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          <Trans>Loading history...</Trans>
        </span>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="mt-2 text-xs text-destructive" title={error.message}>
        <Trans>Unable to load verification history right now.</Trans>
      </p>
    );
  }

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
          <div className="min-w-0">
            <span className="capitalize">{entry.status}</span>
            {entry.verifiedBy && (
              <p className="truncate text-[11px] text-muted-foreground/80">
                <Trans>Verified by {entry.verifiedBy}</Trans>
                {entry.reviewerProfileUrl && (
                  <>
                    {" — "}
                    <Link to={entry.reviewerProfileUrl} className="underline" target="_blank" rel="noopener noreferrer">
                      <Trans>View profile</Trans>
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
          <span>{formatDefaultDate(entry.submittedAt)}</span>
        </div>
      ))}
    </div>
  );
}

function FileUploadButton({ onUpload, isUploading }: { onUpload: (file: File) => void; isUploading: boolean }) {
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
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleChange} />
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

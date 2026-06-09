import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { orpc } from "@/integrations/orpc/client";
import { buildReviewerSkillOptions } from "@/utils/verification/common-reviewer-skills";

type ReviewerProfileDialogProps = {
  adminId: string;
  userName: string;
  userEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  onSaved?: () => void;
};

export function ReviewerProfileDialogTrigger({
  adminId,
  userName,
  userEmail,
  hasProfile,
  currentUserId,
  onSaved,
  size = "sm",
  variant = "outline",
}: {
  adminId: string;
  userName: string;
  userEmail?: string;
  hasProfile?: boolean;
  currentUserId?: string;
  onSaved?: () => void;
  size?: "sm" | "default";
  variant?: "outline" | "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size={size} variant={variant} onClick={() => setOpen(true)}>
        {hasProfile === true ? (
          <Trans>Manage profile</Trans>
        ) : hasProfile === false ? (
          <Trans>Create profile</Trans>
        ) : (
          <Trans>Reviewer profile</Trans>
        )}
      </Button>
      <ReviewerProfileDialog
        adminId={adminId}
        userName={userName}
        userEmail={userEmail}
        open={open}
        onOpenChange={setOpen}
        currentUserId={currentUserId}
        onSaved={onSaved}
      />
    </>
  );
}

export function ReviewerProfileDialog({
  adminId,
  userName,
  userEmail,
  open,
  onOpenChange,
  currentUserId,
  onSaved,
}: ReviewerProfileDialogProps) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    ...orpc.admin.reviewerProfiles.getByAdminId.queryOptions({ input: { adminId } }),
    enabled: open,
    retry: false,
  });

  const createProfile = useMutation(orpc.admin.reviewerProfiles.create.mutationOptions());
  const updateProfile = useMutation(orpc.admin.reviewerProfiles.updateDirect.mutationOptions());

  const hasProfile = Boolean(profileQuery.data);
  const isPending = createProfile.isPending || updateProfile.isPending;

  const invalidateProfile = () => {
    void queryClient.invalidateQueries({
      queryKey: orpc.admin.reviewerProfiles.getByAdminId.queryOptions({ input: { adminId } }).queryKey,
    });
    void queryClient.invalidateQueries({
      queryKey: orpc.admin.reviewerProfiles.list.queryOptions().queryKey,
    });
    if (currentUserId && adminId === currentUserId) {
      void queryClient.invalidateQueries({
        queryKey: orpc.reviewer.profile.get.queryOptions().queryKey,
      });
    }
    onSaved?.();
  };

  const handleSuccess = (message: string) => {
    toast.success(message);
    invalidateProfile();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showClose>
        <DialogHeader>
          <DialogTitle>
            {hasProfile ? <Trans>Edit reviewer profile</Trans> : <Trans>Reviewer profile</Trans>}
          </DialogTitle>
          <DialogDescription>
            {userEmail ? (
              <Trans>
                {userName} · {userEmail}
              </Trans>
            ) : (
              userName
            )}
          </DialogDescription>
        </DialogHeader>

        {profileQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">
            <Trans>Loading reviewer profile…</Trans>
          </p>
        ) : profileQuery.isError ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-destructive">
              <Trans>Failed to load reviewer profile.</Trans>
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void profileQuery.refetch()}>
              <Trans>Retry</Trans>
            </Button>
          </div>
        ) : (
          <ReviewerProfileForm
            key={`${adminId}-${profileQuery.dataUpdatedAt}`}
            adminId={adminId}
            userName={userName}
            profile={profileQuery.data ?? null}
            isPending={isPending}
            onCancel={() => onOpenChange(false)}
            onCreate={(input) => {
              createProfile.mutate(input, {
                onSuccess: () => handleSuccess(t`Reviewer profile created.`),
                onError: (error) => toast.error(error.message),
              });
            }}
            onSave={(input) => {
              updateProfile.mutate(input, {
                onSuccess: () => handleSuccess(t`Reviewer profile updated.`),
                onError: (error) => toast.error(error.message),
              });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type ProfileData = {
  firstName: string;
  lastName: string;
  title: string;
  reviewerSkills?: string[];
} | null;

function ReviewerProfileForm({
  adminId,
  userName,
  profile,
  isPending,
  onCancel,
  onCreate,
  onSave,
}: {
  adminId: string;
  userName: string;
  profile: ProfileData;
  isPending: boolean;
  onCancel: () => void;
  onCreate: (input: {
    adminId: string;
    firstName: string;
    lastName: string;
    title: string;
    reviewerSkills: string[];
  }) => void;
  onSave: (input: {
    adminId: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    reviewerSkills: string[];
  }) => void;
}) {
  const hasProfile = Boolean(profile);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [reviewerSkills, setReviewerSkills] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setTitle(profile.title);
      setReviewerSkills(profile.reviewerSkills ?? []);
      return;
    }

    const nameParts = userName.trim().split(/\s+/);
    setFirstName(nameParts[0] ?? "");
    setLastName(nameParts.slice(1).join(" "));
    setTitle("");
    setReviewerSkills([]);
  }, [profile, userName]);

  const skillOptions = useMemo(
    () => buildReviewerSkillOptions(profile?.reviewerSkills ?? reviewerSkills),
    [profile?.reviewerSkills, reviewerSkills],
  );

  const warnIfNoSkills = () => {
    if (reviewerSkills.length === 0) {
      toast.warning(
        t`No reviewable skills assigned. The reviewer's queue will stay empty until at least one skill is added.`,
      );
    }
  };

  const handleSubmit = () => {
    warnIfNoSkills();

    const nameParts = userName.trim().split(/\s+/);
    const defaultFirst = firstName.trim() || nameParts[0] || "Reviewer";
    const defaultLast = lastName.trim() || nameParts.slice(1).join(" ") || "Admin";
    const resolvedTitle = title.trim() || t`Reviewer`;

    if (hasProfile) {
      onSave({
        adminId,
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(title.trim() ? { title: title.trim() } : {}),
        reviewerSkills,
      });
      return;
    }

    onCreate({
      adminId,
      firstName: defaultFirst,
      lastName: defaultLast,
      title: resolvedTitle,
      reviewerSkills,
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t`First name`} />
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t`Last name`} />
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t`Title`} />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            <Trans>Reviewable skills</Trans>
          </p>
          <Combobox
            multiple
            value={reviewerSkills}
            onValueChange={(value) => setReviewerSkills(value ?? [])}
            options={skillOptions}
            placeholder={t`Select skills…`}
            searchPlaceholder={t`Search skills…`}
            emptyMessage={t`No matching skills.`}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            {reviewerSkills.length === 0 ? (
              <Trans>No skills selected.</Trans>
            ) : reviewerSkills.length === 1 ? (
              <Trans>1 skill selected.</Trans>
            ) : (
              <Trans>{reviewerSkills.length} skills selected.</Trans>
            )}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? (
            hasProfile ? (
              <Trans>Saving…</Trans>
            ) : (
              <Trans>Creating…</Trans>
            )
          ) : hasProfile ? (
            <Trans>Save reviewer profile</Trans>
          ) : (
            <Trans>Create reviewer profile</Trans>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}

export type ReviewerSetupStatus = "no_profile" | "no_skills" | "ready";

export function getReviewerSetupStatus(profile: { reviewerSkills?: string[] } | null): ReviewerSetupStatus {
  if (!profile) return "no_profile";
  if ((profile.reviewerSkills?.length ?? 0) === 0) return "no_skills";
  return "ready";
}

export function ReviewerSetupStatusBadge({ status }: { status: ReviewerSetupStatus }) {
  const colorClass =
    status === "ready"
      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      : status === "no_skills"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  const label = status === "ready" ? t`Ready` : status === "no_skills" ? t`No skills` : t`No profile`;

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>{label}</span>;
}

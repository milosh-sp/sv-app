import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BookmarkSimpleIcon, HeartIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { orpc } from "@/integrations/orpc/client";

export type CandidateActionFlags = {
  isFavorite: boolean;
  isToContact: boolean;
  contactStatus: "pending" | "accepted" | "declined" | null;
};

type CandidateActionsProps = {
  candidateUserId: string;
  resumeId: string | null;
  isFavorite: boolean;
  isToContact: boolean;
  contactStatus: "pending" | "accepted" | "declined" | null;
  onFlagsChange?: (flags: Partial<CandidateActionFlags>) => void;
};

export function CandidateActions({
  candidateUserId,
  resumeId,
  isFavorite,
  isToContact,
  contactStatus,
  onFlagsChange,
}: CandidateActionsProps) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.company.listSaved.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.company.listContactRequests.key() }),
    ]);
  };

  const setSaved = useMutation({
    ...orpc.company.setSaved.mutationOptions(),
    onSuccess: async (_data, variables) => {
      onFlagsChange?.(
        variables.listType === "favorite" ? { isFavorite: variables.saved } : { isToContact: variables.saved },
      );
      await invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t`Could not update saved list.`);
    },
  });

  const contact = useMutation({
    ...orpc.company.createContactRequest.mutationOptions(),
    onSuccess: async () => {
      toast.success(t`Contact request sent.`);
      onFlagsChange?.({ contactStatus: "pending" });
      await invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t`Could not send contact request.`);
    },
  });

  const contactLabel =
    contactStatus === "pending"
      ? t`Pending`
      : contactStatus === "accepted"
        ? t`Accepted`
        : contactStatus === "declined"
          ? t`Declined`
          : t`Contact`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={isFavorite ? "default" : "outline"}
        disabled={setSaved.isPending}
        onClick={(event) => {
          event.stopPropagation();
          setSaved.mutate({
            candidateUserId,
            resumeId,
            listType: "favorite",
            saved: !isFavorite,
          });
        }}
      >
        <HeartIcon weight={isFavorite ? "fill" : "regular"} />
        <Trans>Favorite</Trans>
      </Button>

      <Button
        size="sm"
        variant={isToContact ? "default" : "outline"}
        disabled={setSaved.isPending}
        onClick={(event) => {
          event.stopPropagation();
          setSaved.mutate({
            candidateUserId,
            resumeId,
            listType: "to_contact",
            saved: !isToContact,
          });
        }}
      >
        <BookmarkSimpleIcon weight={isToContact ? "fill" : "regular"} />
        <Trans>To contact</Trans>
      </Button>

      <Button
        size="sm"
        disabled={contact.isPending || contactStatus === "pending" || contactStatus === "accepted"}
        onClick={(event) => {
          event.stopPropagation();
          contact.mutate({ candidateUserId, resumeId });
        }}
      >
        <PaperPlaneTiltIcon />
        {contactLabel}
      </Button>
    </div>
  );
}

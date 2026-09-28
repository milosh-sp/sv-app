import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BookmarkSimpleIcon, HeartIcon, PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { orpc } from "@/integrations/orpc/client";

import { getContactStatusLabel } from "../../-components/contact-status";

/** Fields shared by AI match results and saved candidates. */
export type Candidate = Omit<RouterOutput["company"]["listSaved"][number], "listType" | "savedAt">;

export type CandidateActionFlags = Pick<Candidate, "isFavorite" | "isToContact" | "contactStatus">;

type CandidateActionsProps = {
  candidate: Pick<Candidate, "candidateUserId" | "resumeId"> & CandidateActionFlags;
  onFlagsChange?: (flags: Partial<CandidateActionFlags>) => void;
};

export function CandidateActions({ candidate, onFlagsChange }: CandidateActionsProps) {
  const queryClient = useQueryClient();
  const { candidateUserId, resumeId, isFavorite, isToContact, contactStatus } = candidate;

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={isFavorite ? "default" : "outline"}
        aria-pressed={isFavorite}
        disabled={setSaved.isPending}
        onClick={() => setSaved.mutate({ candidateUserId, resumeId, listType: "favorite", saved: !isFavorite })}
      >
        <HeartIcon weight={isFavorite ? "fill" : "regular"} />
        <Trans>Favorite</Trans>
      </Button>

      <Button
        size="sm"
        variant={isToContact ? "default" : "outline"}
        aria-pressed={isToContact}
        disabled={setSaved.isPending}
        onClick={() => setSaved.mutate({ candidateUserId, resumeId, listType: "to_contact", saved: !isToContact })}
      >
        <BookmarkSimpleIcon weight={isToContact ? "fill" : "regular"} />
        <Trans>To contact</Trans>
      </Button>

      <Button
        size="sm"
        disabled={contact.isPending || contactStatus === "pending" || contactStatus === "accepted"}
        onClick={() => contact.mutate({ candidateUserId, resumeId })}
      >
        <PaperPlaneTiltIcon />
        {contactStatus ? getContactStatusLabel(contactStatus) : t`Contact`}
      </Button>
    </div>
  );
}

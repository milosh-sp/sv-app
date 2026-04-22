import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowClockwiseIcon, SparkleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAiIntegration } from "@/integrations/ai/use-ai-integration";
import { orpc } from "@/integrations/orpc/client";

import { type DialogProps, useDialogStore } from "../store";

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>;
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={`${token}-${index}`} className="rounded bg-muted px-1 py-0.5">
          {token.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${token}-${index}`}>{token}</Fragment>;
  });
}

function renderMarkdown(content: string): ReactNode[] {
  const lines = content.split(/\r?\n/);

  return lines.map((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      return <div key={`space-${index}`} className="h-3" />;
    }

    const heading3 = line.match(/^###\s+(.*)$/);
    if (heading3) {
      return (
        <h3 key={`h3-${index}`} className="text-base font-semibold">
          {renderInlineMarkdown(heading3[1])}
        </h3>
      );
    }

    const heading2 = line.match(/^##\s+(.*)$/);
    if (heading2) {
      return (
        <h2 key={`h2-${index}`} className="text-lg font-semibold">
          {renderInlineMarkdown(heading2[1])}
        </h2>
      );
    }

    const heading1 = line.match(/^#\s+(.*)$/);
    if (heading1) {
      return (
        <h1 key={`h1-${index}`} className="text-xl font-semibold">
          {renderInlineMarkdown(heading1[1])}
        </h1>
      );
    }

    const orderedListItem = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedListItem) {
      return (
        <div key={`ol-${index}`} className="my-1 flex items-start gap-x-2">
          <span className="font-medium">{orderedListItem[1]}.</span>
          <p>{renderInlineMarkdown(orderedListItem[2])}</p>
        </div>
      );
    }

    const unorderedListItem = line.match(/^[-*]\s+(.*)$/);
    if (unorderedListItem) {
      return (
        <div key={`ul-${index}`} className="my-1 flex items-start gap-x-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/70" />
          <p>{renderInlineMarkdown(unorderedListItem[1])}</p>
        </div>
      );
    }

    return (
      <p key={`p-${index}`} className="my-2">
        {renderInlineMarkdown(line)}
      </p>
    );
  });
}

export function ResumeAiReviewDialog({ data }: DialogProps<"resume.ai.review">) {
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const { canUse, isAvailabilityLoaded } = useAiIntegration();
  const [analysis, setAnalysis] = useState("");

  const { mutate: reviewResume, isPending, error } = useMutation(orpc.ai.reviewResume.mutationOptions());

  const runReview = () => {
    if (!canUse) return;

    setAnalysis("");
    reviewResume(
      { resumeId: data.id },
      {
        onSuccess: (result) => {
          setAnalysis(result.analysis);
        },
        onError: (mutationError) => {
          toast.error(t`Failed to generate AI review`, { description: mutationError.message });
        },
      },
    );
  };

  useEffect(() => {
    if (!isAvailabilityLoaded || !canUse) return;
    runReview();
    // Run once when the dialog opens for this resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.id, canUse, isAvailabilityLoaded]);

  const showLoading = isAvailabilityLoaded && canUse && isPending && analysis.length === 0;
  const displayContent = analysis || error?.message || t`No analysis was generated. Try again.`;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-x-2">
          <SparkleIcon />
          <Trans>AI review for {data.name}</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>Get AI feedback on what is strong in this resume and what should be improved.</Trans>
        </DialogDescription>
      </DialogHeader>

      {!isAvailabilityLoaded && (
        <div className="flex min-h-80 items-center justify-center">
          <Spinner />
        </div>
      )}

      {isAvailabilityLoaded && !canUse && (
        <Textarea
          readOnly
          className="min-h-80 resize-none whitespace-pre-wrap font-mono text-sm"
          value={t`AI integration is not configured. Contact an administrator to enable AI features.`}
        />
      )}

      {showLoading && (
        <div className="flex min-h-80 items-center justify-center">
          <Spinner />
        </div>
      )}

      {isAvailabilityLoaded && canUse && !showLoading && (
        <ScrollArea className="h-80 rounded-md border">
          <div className="p-4 text-sm leading-7 whitespace-normal">{renderMarkdown(displayContent)}</div>
        </ScrollArea>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={closeDialog}>
          <Trans>Close</Trans>
        </Button>
        <Button onClick={runReview} disabled={!canUse || isPending}>
          <ArrowClockwiseIcon />
          <Trans>Regenerate review</Trans>
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

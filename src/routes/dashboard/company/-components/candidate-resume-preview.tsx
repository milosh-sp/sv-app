import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowSquareOutIcon, ClockIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

import { ResumePreview } from "@/components/resume/preview";
import { VerificationProvider } from "@/components/resume/shared/verification-context";
import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { orpc } from "@/integrations/orpc/client";

type CandidateResumePreviewProps = {
  username: string;
  slug: string;
};

export function CandidateResumePreview({ username, slug }: CandidateResumePreviewProps) {
  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  const resumeQuery = useQuery(orpc.resume.getBySlug.queryOptions({ input: { username, slug } }));

  const verificationQuery = useQuery({
    ...orpc.verification.getPublicStatus.queryOptions({
      input: { resumeId: resumeQuery.data?.id ?? "" },
    }),
    enabled: Boolean(resumeQuery.data?.id),
  });

  useEffect(() => {
    if (!resumeQuery.data) return;
    initialize({
      id: resumeQuery.data.id,
      name: resumeQuery.data.name,
      slug: resumeQuery.data.slug,
      tags: resumeQuery.data.tags,
      data: resumeQuery.data.data,
      isLocked: resumeQuery.data.isLocked,
    });
    return () => initialize(null);
  }, [resumeQuery.data, initialize]);

  if (resumeQuery.isPending || verificationQuery.isPending) {
    return (
      <div className="flex items-center justify-center gap-x-2 rounded-md border py-8 text-xs text-muted-foreground">
        <ClockIcon className="size-4 animate-spin" />
        <Trans>Loading resume…</Trans>
      </div>
    );
  }

  if (resumeQuery.isError || !resumeQuery.data) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <Trans>Could not load this candidate's resume.</Trans>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          <Trans>Resume</Trans>
        </p>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to="/$username/$slug" params={{ username, slug }} target="_blank" rel="noopener noreferrer" />}
        >
          <ArrowSquareOutIcon />
          {t`Open full CV`}
        </Button>
      </div>

      {!isReady ? (
        <div className="flex items-center justify-center gap-x-2 rounded-md border py-8 text-xs text-muted-foreground">
          <ClockIcon className="size-4 animate-spin" />
          <Trans>Loading preview…</Trans>
        </div>
      ) : (
        <VerificationProvider statuses={verificationQuery.data ?? []}>
          <TransformWrapper centerOnInit limitToBounds={false} minScale={0.2} initialScale={0.45} maxScale={2}>
            <TransformComponent wrapperClass="!max-h-[min(70vh,36rem)] !w-full overflow-auto rounded-md border bg-muted/30">
              <ResumePreview
                showPageNumbers
                className="flex items-start space-y-10 space-x-10 p-4"
                pageClassName="shadow-md rounded-md overflow-hidden"
              />
            </TransformComponent>
          </TransformWrapper>
        </VerificationProvider>
      )}
    </div>
  );
}

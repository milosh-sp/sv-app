import { Trans } from "@lingui/react/macro";
import { ORPCError } from "@orpc/client";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import type { ResumeData } from "@/schema/resume/data";

import { LoadingScreen } from "@/components/layout/loading-screen";
import { ResumePreview } from "@/components/resume/preview";
import { VerificationProvider } from "@/components/resume/shared/verification-context";
import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { downloadFromUrl } from "@/utils/file";
import { formatDefaultDate } from "@/utils/format-date";
import { cn } from "@/utils/style";

type LoaderData = Omit<RouterOutput["resume"]["getBySlug"], "data"> & { data: ResumeData };
type PublicTimelineData = RouterOutput["verification"]["getPublicTimeline"];

export const Route = createFileRoute("/$username/$slug")({
  component: RouteComponent,
  loader: async ({ context, params: { username, slug } }) => {
    const resume = await context.queryClient.ensureQueryData(
      orpc.resume.getBySlug.queryOptions({ input: { username, slug } }),
    );

    const verificationStatuses = await context.queryClient.ensureQueryData(
      orpc.verification.getPublicStatus.queryOptions({ input: { resumeId: (resume as LoaderData).id } }),
    );

    const verificationTimeline = await context.queryClient.ensureQueryData(
      orpc.verification.getPublicTimeline.queryOptions({ input: { resumeId: (resume as LoaderData).id } }),
    );

    return { resume: resume as LoaderData, verificationStatuses, verificationTimeline };
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.resume.name} - Skill Verdict` : "Skill Verdict" }],
  }),
  onError: (error) => {
    if (error instanceof ORPCError && error.code === "NEED_PASSWORD") {
      const data = error.data as { username?: string; slug?: string } | undefined;
      const username = data?.username;
      const slug = data?.slug;

      if (username && slug) {
        throw redirect({
          to: "/auth/resume-password",
          search: { redirect: `/${username}/${slug}` },
        });
      }
    }

    throw notFound();
  },
});

function RouteComponent() {
  const { resume, verificationStatuses, verificationTimeline } = Route.useLoaderData();
  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  const { mutateAsync: printResumeAsPDF, isPending: isPrinting } = useMutation(
    orpc.printer.printResumeAsPDF.mutationOptions(),
  );

  useEffect(() => {
    if (!resume) return;
    initialize(resume);
    return () => initialize(null);
  }, [resume, initialize]);

  const handleDownload = useCallback(async () => {
    if (!resume) return;
    const { url } = await printResumeAsPDF({ id: resume.id });
    await downloadFromUrl(url, `${resume.name}.pdf`);
  }, [resume, printResumeAsPDF]);

  if (!isReady) return <LoadingScreen />;

  return (
    <>
      <VerificationProvider statuses={verificationStatuses}>
        <div
          className={cn(
            "mx-auto max-w-[210mm]",
            "print:m-0 print:block print:max-w-full print:px-0",
            "md:my-4 md:px-4",
          )}
        >
          <ResumePreview className="space-y-4" pageClassName="print:w-full! w-full max-w-full" />
          <PublicVerificationTimeline data={verificationTimeline} />
        </div>
      </VerificationProvider>

      <Button
        size="lg"
        variant="secondary"
        disabled={isPrinting}
        className="fixed inset-e-4 bottom-4 z-50 hidden rounded-full px-4 md:inline-flex print:hidden"
        onClick={handleDownload}
      >
        {isPrinting ? <Spinner /> : <DownloadSimpleIcon />}
        {isPrinting ? <Trans>Downloading...</Trans> : <Trans>Download</Trans>}
      </Button>
    </>
  );
}

function PublicVerificationTimeline({ data }: { data: PublicTimelineData }) {
  if (!data.enabled || data.entries.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded border bg-card p-4 print:hidden">
      <h2 className="text-sm font-semibold">
        <Trans>Verification History</Trans>
      </h2>
      <div className="mt-3 space-y-2">
        {data.entries.map((entry) => (
          <div key={entry.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="min-w-0">
              <p className="truncate">
                {entry.itemLabel} - <span className="capitalize">{entry.status}</span>
              </p>
              {entry.verifiedBy && (
                <p className="truncate text-[11px] text-muted-foreground/80">
                  <Trans>Verified by {entry.verifiedBy}</Trans>
                </p>
              )}
            </div>
            <span className="shrink-0">{formatDefaultDate(entry.submittedAt)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

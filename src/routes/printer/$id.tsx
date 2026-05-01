import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import { z } from "zod";

import { LoadingScreen } from "@/components/layout/loading-screen";
import { ResumePreview } from "@/components/resume/preview";
import { VerificationProvider } from "@/components/resume/shared/verification-context";
import { useResumeStore } from "@/components/resume/store/resume";
import { getORPCClient } from "@/integrations/orpc/client";
import { env } from "@/utils/env";
import { verifyPrinterToken } from "@/utils/printer-token";

const searchSchema = z.object({
  token: z.string().catch(""),
});

export const Route = createFileRoute("/printer/$id")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ params, search }) => {
    if (env.FLAG_DEBUG_PRINTER) return;

    try {
      // Verify the token and ensure it matches the resume ID
      const payload = verifyPrinterToken(search.token);
      if (!payload) throw new Error();
      const { resumeId: tokenResumeId } = payload;
      if (tokenResumeId !== params.id) throw new Error();
    } catch {
      // Invalid or missing token - throw error to be caught by error handler
      throw redirect({ to: "/", search: {}, throw: true });
    }
  },
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: async ({ params, deps }) => {
    const client = getORPCClient();
    const resume = await client.resume.getByIdForPrinter({ id: params.id });
    let verificationStatuses: {
      id: string;
      sectionType: string;
      itemId: string;
      itemLabel: string;
      status: string;
      badgeVisible: boolean;
      submittedAt: Date;
    }[] = [];

    try {
      verificationStatuses = await client.verification.getPrinterStatus({
        resumeId: params.id,
        token: deps.token,
      });
    } catch {
      // Continue rendering the resume even if verification data is unavailable.
    }

    return { resume, verificationStatuses };
  },
});

function RouteComponent() {
  const { resume, verificationStatuses } = Route.useLoaderData();

  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  useEffect(() => {
    if (!resume) return;
    initialize(resume);
    return () => initialize(null);
  }, [resume, initialize]);

  if (!isReady) return <LoadingScreen />;

  return (
    <VerificationProvider statuses={verificationStatuses}>
      <ResumePreview pageClassName="print:w-full!" />
    </VerificationProvider>
  );
}

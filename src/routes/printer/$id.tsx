import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect } from "react";
import z from "zod";

import type { RouterOutput } from "@/integrations/orpc/client";

import { LoadingScreen } from "@/components/layout/loading-screen";
import { ResumePreview } from "@/components/resume/preview";
import { VerificationProvider } from "@/components/resume/shared/verification-context";
import { useResumeStore } from "@/components/resume/store/resume";
import { resumeService } from "@/integrations/orpc/services/resume";
import { verifyPrinterToken } from "@/utils/printer-token";

type PrinterResume = RouterOutput["resume"]["getByIdForPrinter"];

const searchSchema = z.object({ token: z.string().min(1) });

const getPrinterResume = createServerFn({ method: "GET" })
  .validator((data: { id: string; token: string }) => data)
  .handler(async ({ data: { id, token } }) => {
    // Validate the printer token — throws if invalid or expired
    let verified: { resumeId: string };
    try {
      verified = verifyPrinterToken(token);
    } catch {
      throw notFound();
    }

    // Ensure the token was issued for this specific resume
    if (verified.resumeId !== id) throw notFound();

    // Fetch the resume data (converts picture to base64 for offline rendering)
    let resume: PrinterResume;
    try {
      resume = await resumeService.getByIdForPrinter({ id });
    } catch {
      throw notFound();
    }

    return resume;
  });

export const Route = createFileRoute("/printer/$id")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
  loader: async ({ params, search }) => {
    const resume = await getPrinterResume({ data: { id: params.id, token: search.token } });
    return { resume };
  },
});

function RouteComponent() {
  const { resume } = Route.useLoaderData();
  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  useEffect(() => {
    initialize(resume);
    return () => initialize(null);
  }, [resume, initialize]);

  if (!isReady) return <LoadingScreen />;

  return (
    <VerificationProvider statuses={[]}>
      <div className="resume-printer-container">
        <ResumePreview className="space-y-0" pageClassName="w-full max-w-full" />
      </div>
    </VerificationProvider>
  );
}

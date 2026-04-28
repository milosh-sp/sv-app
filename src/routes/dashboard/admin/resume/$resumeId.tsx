import { Trans } from "@lingui/react/macro";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { LoadingScreen } from "@/components/layout/loading-screen";
import { ResumePreview } from "@/components/resume/preview";
import { useResumeStore } from "@/components/resume/store/resume";
import { Button } from "@/components/ui/button";
import { getORPCClient } from "@/integrations/orpc/client";

export const Route = createFileRoute("/dashboard/admin/resume/$resumeId")({
  loader: async ({ params }) => {
    const client = getORPCClient();
    const resume = await client.resume.getByIdForPrinter({ id: params.resumeId });
    return { resume };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { resume } = Route.useLoaderData();
  const isReady = useResumeStore((state) => state.isReady);
  const initialize = useResumeStore((state) => state.initialize);

  useEffect(() => {
    initialize(resume);
    return () => initialize(null);
  }, [resume, initialize]);

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" size="sm" onClick={() => void navigate({ to: "/dashboard/admin/users" })}>
        <Trans>Back to users</Trans>
      </Button>
      <div className="rounded-lg border p-2 sm:p-4">
        <ResumePreview className="space-y-4" pageClassName="w-full max-w-full" />
      </div>
    </div>
  );
}

import { t } from "@lingui/core/macro";
import { FloppyDiskIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useHotkeys } from "react-hotkeys-hook";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { toast } from "sonner";

import { ResumePreview } from "@/components/resume/preview";
import { VerificationProvider } from "@/components/resume/shared/verification-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/integrations/orpc/client";

import { BuilderDock } from "./-components/dock";

export const Route = createFileRoute("/builder/$resumeId/")({
  component: RouteComponent,
});

function RouteComponent() {
  const isMobile = useIsMobile();
  const { resumeId } = Route.useParams();
  const { data: verificationStatuses } = useQuery(orpc.verification.getStatus.queryOptions({ input: { resumeId } }));

  useHotkeys(
    ["ctrl+s", "meta+s"],
    () => {
      toast.info(t`Your changes are saved automatically.`, {
        id: "auto-save",
        icon: <FloppyDiskIcon />,
      });
    },
    { preventDefault: true, enableOnFormTags: true },
  );

  return (
    <div className="fixed inset-0">
      <TransformWrapper
        centerOnInit
        limitToBounds={false}
        minScale={isMobile ? 0.2 : 0.3}
        initialScale={isMobile ? 0.42 : 0.6}
        maxScale={isMobile ? 4 : 6}
      >
        <TransformComponent wrapperClass="h-full! w-full!">
          <VerificationProvider statuses={verificationStatuses ?? []}>
            <ResumePreview
              showPageNumbers
              className="flex items-start space-y-4 space-x-4 p-4 pt-20 pb-32 md:space-y-10 md:space-x-10 md:p-0"
              pageClassName="shadow-xl rounded-md overflow-hidden"
            />
          </VerificationProvider>
        </TransformComponent>

        <BuilderDock />
      </TransformWrapper>
    </div>
  );
}

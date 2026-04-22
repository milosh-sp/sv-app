import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CircleNotchIcon, LockSimpleIcon, SparkleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { match, P } from "ts-pattern";

import { useDialogStore } from "@/dialogs/store";
import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { useAiIntegration } from "@/integrations/ai/use-ai-integration";
import { formatDefaultDateTime } from "@/utils/format-date";
import { cn } from "@/utils/style";

import { ResumeContextMenu } from "../menus/context-menu";
import { BaseCard } from "./base-card";

type ResumeCardProps = {
  resume: RouterOutput["resume"]["list"][number];
};

export function ResumeCard({ resume }: ResumeCardProps) {
  const { openDialog } = useDialogStore();
  const { canUse: canUseAI } = useAiIntegration();

  const { data: screenshotData, isLoading } = useQuery({
    ...orpc.printer.getResumeScreenshot.queryOptions({ input: { id: resume.id } }),
    // Keep polling while no preview URL is available yet.
    refetchInterval: (query) => (query.state.data?.url ? false : 8000),
  });

  const updatedAt = useMemo(() => formatDefaultDateTime(resume.updatedAt), [resume.updatedAt]);
  const screenshotUrl = useMemo(() => {
    const url = screenshotData?.url;
    if (!url) return null;

    try {
      const parsed = new URL(url);
      // Ensure screenshot URLs render correctly even when APP_URL differs from current host.
      if (parsed.pathname.startsWith("/uploads/")) return `${parsed.pathname}${parsed.search}`;
    } catch {
      // Non-absolute URL; use as-is.
    }

    return url;
  }, [screenshotData?.url]);

  return (
    <ResumeContextMenu resume={resume}>
      <Link to="/builder/$resumeId" params={{ resumeId: resume.id }} className="cursor-default">
        <motion.div
          whileHover={{ y: -2, scale: 1.005 }}
          whileTap={{ scale: 0.998 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          style={{ willChange: "transform" }}
        >
          <BaseCard
            title={resume.name}
            description={t`Last updated on ${updatedAt}`}
            tags={resume.tags}
            header={
              <button
                type="button"
                disabled={!canUseAI}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openDialog("resume.ai.review", { id: resume.id, name: resume.name });
                }}
                className={cn(
                  "flex w-full items-center justify-start gap-2 px-4 py-2.5 text-left text-base font-semibold tracking-wide text-white uppercase transition-colors",
                  "hover:bg-white/10 hover:cursor-pointer",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <SparkleIcon className="size-4 shrink-0 text-white" weight="bold" />
                <Trans>AI review</Trans>
              </button>
            }
          >
            {match({ isLoading, imageSrc: screenshotUrl })
              .with({ isLoading: true }, () => (
                <div className="flex size-full items-center justify-center">
                  <CircleNotchIcon weight="thin" className="size-12 animate-spin" />
                </div>
              ))
              .with({ imageSrc: P.string }, ({ imageSrc }) => (
                <img
                  src={imageSrc}
                  alt={resume.name}
                  className={cn("size-full object-cover transition-all", resume.isLocked && "blur-xs")}
                />
              ))
              .otherwise(() => null)}

            <ResumeLockOverlay isLocked={resume.isLocked} />
          </BaseCard>
        </motion.div>
      </Link>
    </ResumeContextMenu>
  );
}

function ResumeLockOverlay({ isLocked }: { isLocked: boolean }) {
  return (
    <AnimatePresence>
      {isLocked && (
        <motion.div
          key="resume-lock-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{ willChange: "opacity" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="flex items-center justify-center rounded-full bg-popover p-6">
            <LockSimpleIcon weight="thin" className="size-12 opacity-60" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

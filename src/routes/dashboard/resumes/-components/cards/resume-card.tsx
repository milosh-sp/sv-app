import { t } from "@lingui/core/macro";
import { CircleNotchIcon, LockSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { match, P } from "ts-pattern";

import { orpc, type RouterOutput } from "@/integrations/orpc/client";
import { formatDefaultDateTime } from "@/utils/format-date";
import { cn } from "@/utils/style";

import { ResumeContextMenu } from "../menus/context-menu";
import { BaseCard } from "./base-card";

type ResumeCardProps = {
  resume: RouterOutput["resume"]["list"][number];
};

export function ResumeCard({ resume }: ResumeCardProps) {
  const { data: screenshotData, isLoading } = useQuery(
    orpc.printer.getResumeScreenshot.queryOptions({ input: { id: resume.id } }),
  );

  const updatedAt = useMemo(() => formatDefaultDateTime(resume.updatedAt), [resume.updatedAt]);

  return (
    <ResumeContextMenu resume={resume}>
      <Link to="/builder/$resumeId" params={{ resumeId: resume.id }} className="cursor-default">
        <motion.div
          whileHover={{ y: -2, scale: 1.005 }}
          whileTap={{ scale: 0.998 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          style={{ willChange: "transform" }}
        >
          <BaseCard title={resume.name} description={t`Last updated on ${updatedAt}`} tags={resume.tags}>
            {match({ isLoading, imageSrc: screenshotData?.url })
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

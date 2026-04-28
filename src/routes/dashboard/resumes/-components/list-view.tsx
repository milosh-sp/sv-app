import { Trans } from "@lingui/react/macro";
import { DotsThreeIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { formatDefaultDateTime } from "@/utils/format-date";

import { ResumeContextMenu } from "./menus/context-menu";
import { ResumeDropdownMenu } from "./menus/dropdown-menu";

type Resume = RouterOutput["resume"]["list"][number];

type Props = {
  resumes: Resume[];
};

export function ListView({ resumes }: Props) {
  return (
    <div className="flex flex-col gap-y-1">
      <AnimatePresence initial={false} mode="popLayout">
        {resumes?.map((resume, index) => (
          <motion.div
            layout
            key={resume.id}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.18, delay: Math.min(0.12, index * 0.02), ease: "easeOut" }}
            style={{ willChange: "transform, opacity" }}
          >
            <ResumeListItem resume={resume} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ResumeListItem({ resume }: { resume: Resume }) {
  const updatedAt = useMemo(() => formatDefaultDateTime(resume.updatedAt), [resume.updatedAt]);

  return (
    <ResumeContextMenu resume={resume}>
      <div className="flex items-center gap-x-2">
        <Button
          size="lg"
          variant="ghost"
          nativeButton={false}
          className="h-12 w-full flex-1 justify-start gap-x-4 text-start"
          render={
            <Link to="/builder/$resumeId" params={{ resumeId: resume.id }}>
              <div className="size-3" />
              <div className="min-w-80 truncate">{resume.name}</div>

              <p className="text-xs opacity-60">
                <Trans>Last updated on {updatedAt}</Trans>
              </p>
            </Link>
          }
        />

        <ResumeDropdownMenu resume={resume} align="end">
          <Button size="icon" variant="ghost" className="size-12">
            <DotsThreeIcon />
          </Button>
        </ResumeDropdownMenu>
      </div>
    </ResumeContextMenu>
  );
}

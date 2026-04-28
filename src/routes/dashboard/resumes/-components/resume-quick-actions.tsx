import { Trans } from "@lingui/react/macro";
import { DownloadSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { useDialogStore } from "@/dialogs/store";

const actionButtonClass =
  "h-auto min-h-14 w-full items-start justify-start gap-3 px-4 py-3 text-start whitespace-normal";

export function ResumeQuickActions() {
  const { openDialog } = useDialogStore();

  return (
    <div className="flex flex-wrap gap-3">
      <motion.div
        className="min-w-0 flex-1"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
      >
        <Button
          variant="outline"
          size="lg"
          className={actionButtonClass}
          onClick={() => openDialog("resume.create", undefined)}
        >
          <PlusIcon className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5 text-start">
            <span className="leading-snug font-medium">
              <Trans>Create a new resume</Trans>
            </span>
            <span className="text-xs leading-snug opacity-60">
              <Trans>Start building your resume from scratch</Trans>
            </span>
          </div>
        </Button>
      </motion.div>

      <motion.div
        className="min-w-0 flex-1"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.03, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
      >
        <Button
          variant="outline"
          size="lg"
          className={actionButtonClass}
          onClick={() => openDialog("resume.import", undefined)}
        >
          <DownloadSimpleIcon className="mt-0.5 shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5 text-start">
            <span className="leading-snug font-medium">
              <Trans>Import an existing resume</Trans>
            </span>
            <span className="text-xs leading-snug opacity-60">
              <Trans>Continue where you left off</Trans>
            </span>
          </div>
        </Button>
      </motion.div>
    </div>
  );
}

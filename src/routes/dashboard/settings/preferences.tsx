import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { GearSixIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";

import { LocaleCombobox } from "@/components/locale/combobox";
import { ThemeCombobox } from "@/components/theme/combobox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/settings/preferences")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="space-y-4">
      <DashboardHeader icon={GearSixIcon} title={t`Preferences`} />

      <Separator />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
        className="grid max-w-xl gap-6"
      >
        <div className="grid gap-1.5">
          <Label className="mb-0.5">
            <Trans>Theme</Trans>
          </Label>
          <ThemeCombobox />
        </div>

        <div className="grid gap-1.5">
          <Label className="mb-0.5">
            <Trans>Language</Trans>
          </Label>
          <LocaleCombobox />
        </div>
      </motion.div>
    </div>
  );
}

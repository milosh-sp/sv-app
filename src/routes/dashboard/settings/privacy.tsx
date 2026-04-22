import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { EyeIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

export const Route = createFileRoute("/dashboard/settings/privacy")({
  loader: async ({ context }) => {
    const adminFlags = await context.queryClient.ensureQueryData(orpc.verification.getMyAdminFlags.queryOptions());

    if (adminFlags.skillVerdictAdmin) {
      throw redirect({ to: "/dashboard/settings/profile", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { data: statuses } = useSuspenseQuery(orpc.verification.getAllStatuses.queryOptions());

  const approvedItems = statuses.filter((s) => s.status === "verified");

  const { mutate: toggleBadge } = useMutation(orpc.verification.toggleBadge.mutationOptions());

  const handleBadgeToggle = (requestId: string, visible: boolean) => {
    toggleBadge(
      { requestId, visible },
      {
        onError: (error) => {
          toast.error(error.message);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <DashboardHeader icon={EyeIcon} title={t`Privacy`} />

      <Separator />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
        className="w-full space-y-6"
      >
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            <Trans>Verification Badges</Trans>
          </h3>
          <p className="text-xs text-muted-foreground">
            <Trans>Control which verification badges are visible on your public CV.</Trans>
          </p>

          {approvedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="no-approved-items">
              <Trans>No verified items yet.</Trans>
            </p>
          ) : (
            <div className="space-y-3">
              {approvedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <p className="text-sm">{item.itemLabel}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.sectionType}</p>
                  </div>
                  <Switch
                    defaultChecked={item.badgeVisible}
                    onCheckedChange={(checked: boolean) => handleBadgeToggle(item.id, checked)}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <TimelineToggle />
      </motion.div>
    </div>
  );
}

function TimelineToggle() {
  const queryClient = useQueryClient();
  const { data: rows } = useSuspenseQuery(orpc.verification.listTimelineSettings.queryOptions());

  const {
    mutate: toggleTimeline,
    isPending,
    variables,
  } = useMutation({
    ...orpc.verification.toggleTimeline.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orpc.verification.listTimelineSettings.queryOptions().queryKey,
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          <Trans>Verification History Timeline</Trans>
        </h3>
        <p className="text-xs text-muted-foreground">
          <Trans>Show or hide the verification timeline on your public CV. This is off by default.</Trans>
        </p>
        <p className="text-xs text-muted-foreground" data-testid="timeline-toggle-empty">
          <Trans>Make at least one resume public to control the timeline on your public CV.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">
        <Trans>Verification History Timeline</Trans>
      </h3>
      <p className="text-xs text-muted-foreground">
        <Trans>Show or hide the verification timeline on your public CV. This is off by default.</Trans>
      </p>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.resumeId} className="flex items-center justify-between gap-3 rounded border p-3">
            <Label className="min-w-0 truncate text-sm">
              {rows.length > 1 ? row.name : <Trans>Show Timeline on Public CV</Trans>}
            </Label>
            <Switch
              checked={row.showTimeline}
              disabled={isPending && variables?.resumeId === row.resumeId}
              onCheckedChange={(checked: boolean) => {
                toggleTimeline({ resumeId: row.resumeId, show: checked });
              }}
              size="sm"
              data-testid="timeline-toggle"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

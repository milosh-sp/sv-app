import { Trans } from "@lingui/react/macro";
import { SealCheckIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";

import { orpc } from "@/integrations/orpc/client";
import { formatDefaultDate } from "@/utils/format-date";

export const Route = createFileRoute("/reviewer/$adminId")({
  component: RouteComponent,
  loader: async ({ context, params: { adminId } }) => {
    try {
      const profile = await context.queryClient.ensureQueryData(
        orpc.reviewer.publicProfile.get.queryOptions({ input: { adminId } }),
      );
      return { profile };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.profile.firstName} ${loaderData.profile.lastName} - Reviewer - Skill Verdict`
          : "Reviewer - Skill Verdict",
      },
    ],
  }),
});

function RouteComponent() {
  const { adminId } = Route.useParams();
  const { data: profile } = useQuery(orpc.reviewer.publicProfile.get.queryOptions({ input: { adminId } }));

  if (!profile) return null;

  const memberSince = formatDefaultDate(profile.createdAt);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full rounded-xl border bg-card p-8 shadow-sm"
      >
        <div className="flex items-center gap-x-3">
          <SealCheckIcon className="size-8 text-primary" weight="fill" />
          <div>
            <h1 className="text-lg font-semibold">
              {profile.firstName} {profile.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">{profile.title}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-xs text-muted-foreground">
            <Trans>Reviewer since {memberSince}</Trans>
          </p>
          <p className="text-xs text-muted-foreground/70">
            <Trans>
              This page shows live profile information. Verification snapshots captured at the time of review may differ
              from the current details shown here.
            </Trans>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

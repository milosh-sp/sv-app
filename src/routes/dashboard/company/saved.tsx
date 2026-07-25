import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { HeartIcon, SealCheckIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";
import { CandidateActions } from "./-components/candidate-actions";

export const Route = createFileRoute("/dashboard/company/saved")({
  component: RouteComponent,
});

function RouteComponent() {
  const [tab, setTab] = useState<"favorite" | "to_contact">("favorite");

  const {
    data = [],
    isPending,
    refetch,
  } = useQuery({
    ...orpc.company.listSaved.queryOptions({ input: { listType: tab } }),
  });

  return (
    <div className="space-y-4">
      <DashboardHeader icon={HeartIcon} title={t`Saved Candidates`} />
      <Separator />

      <Tabs value={tab} onValueChange={(value) => setTab(value as "favorite" | "to_contact")}>
        <TabsList>
          <TabsTrigger value="favorite">
            <Trans>Favorites</Trans>
          </TabsTrigger>
          <TabsTrigger value="to_contact">
            <Trans>To contact</Trans>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {isPending && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}

          {!isPending && data.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">
              {tab === "favorite" ? (
                <Trans>No favorite candidates yet.</Trans>
              ) : (
                <Trans>No candidates marked to contact later.</Trans>
              )}
            </p>
          )}

          {data.map((candidate) => (
            <div key={`${candidate.listType}-${candidate.candidateUserId}`} className="space-y-3 rounded-md border p-4">
              <div>
                <h3 className="font-medium">{candidate.displayName}</h3>
                {candidate.headline && <p className="text-sm text-muted-foreground">{candidate.headline}</p>}
              </div>

              {candidate.verifiedSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {candidate.verifiedSkills.slice(0, 8).map((skill) => (
                    <Badge key={skill} variant="outline" className="gap-x-1">
                      <SealCheckIcon className="size-3" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}

              <CandidateActions
                candidateUserId={candidate.candidateUserId}
                resumeId={candidate.resumeId}
                isFavorite={candidate.isFavorite}
                isToContact={candidate.isToContact}
                contactStatus={candidate.contactStatus}
                onFlagsChange={() => {
                  void refetch();
                }}
              />
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

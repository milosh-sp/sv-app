import type z from "zod";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { HeartIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/integrations/orpc/client";
import { companySavedListTypeSchema } from "@/integrations/orpc/dto/company";

import { DashboardHeader } from "../-components/header";
import { CandidateCard } from "./-components/candidate-card";
import { CandidateDetailSheet } from "./-components/candidate-detail-sheet";

export const Route = createFileRoute("/dashboard/company/saved")({
  component: RouteComponent,
});

type ListType = z.infer<typeof companySavedListTypeSchema>;

function RouteComponent() {
  const [tab, setTab] = useState<ListType>("favorite");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data = [], isPending } = useQuery(orpc.company.listSaved.queryOptions({ input: { listType: tab } }));
  const selected = data.find((candidate) => candidate.candidateUserId === selectedUserId) ?? null;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={HeartIcon} title={t`Saved Candidates`} />
      <Separator />

      <Tabs value={tab} onValueChange={(value) => setTab(companySavedListTypeSchema.parse(value))}>
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
            <CandidateCard
              key={candidate.candidateUserId}
              candidate={candidate}
              skillLimit={8}
              onView={() => setSelectedUserId(candidate.candidateUserId)}
            />
          ))}
        </TabsContent>
      </Tabs>

      <CandidateDetailSheet candidate={selected} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { HeartIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";
import { CandidateActions } from "./-components/candidate-actions";
import { CandidateResumePreview } from "./-components/candidate-resume-preview";
import {
    CandidateVerificationSummary,
    IdentityVerifiedBadge,
} from "./-components/candidate-verification-summary";

export const Route = createFileRoute("/dashboard/company/saved")({
  component: RouteComponent,
});

type SavedCandidate = RouterOutput["company"]["listSaved"][number];

function RouteComponent() {
  const [tab, setTab] = useState<"favorite" | "to_contact">("favorite");
  const [selected, setSelected] = useState<SavedCandidate | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
            <button
              key={`${candidate.listType}-${candidate.candidateUserId}`}
              type="button"
              className="w-full space-y-3 rounded-md border p-4 text-start transition-colors hover:bg-accent/50"
              onClick={() => {
                setSelected(candidate);
                setSheetOpen(true);
              }}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{candidate.displayName}</h3>
                  <IdentityVerifiedBadge verified={candidate.identityVerified} />
                </div>
                {candidate.headline && <p className="text-sm text-muted-foreground">{candidate.headline}</p>}
              </div>

              <CandidateVerificationSummary
                verifiedSkills={candidate.verifiedSkills}
                verifiedExperiences={candidate.verifiedExperiences}
                skillLimit={8}
              />

              <div onClick={(event) => event.stopPropagation()}>
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
            </button>
          ))}
        </TabsContent>
      </Tabs>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto data-[side=right]:sm:max-w-2xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex flex-wrap items-center gap-2">
                  <span>{selected.displayName}</span>
                  <IdentityVerifiedBadge verified={selected.identityVerified} />
                </SheetTitle>
                <SheetDescription>{selected.headline || t`Vetted candidate`}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4 px-4 pb-6">
                <CandidateVerificationSummary
                  verifiedSkills={selected.verifiedSkills}
                  verifiedExperiences={selected.verifiedExperiences}
                  skillLimit={20}
                  experienceLimit={20}
                />

                {sheetOpen && selected.slug && (
                  <CandidateResumePreview username={selected.username} slug={selected.slug} />
                )}

                <CandidateActions
                  candidateUserId={selected.candidateUserId}
                  resumeId={selected.resumeId}
                  isFavorite={selected.isFavorite}
                  isToContact={selected.isToContact}
                  contactStatus={selected.contactStatus}
                  onFlagsChange={() => {
                    void refetch();
                  }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

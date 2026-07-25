import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { MagnifyingGlassIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import z from "zod";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import { companyDto } from "@/integrations/orpc/dto/company";

import { DashboardHeader } from "../-components/header";
import { CandidateActions, type CandidateActionFlags } from "./-components/candidate-actions";
import { CandidateResumePreview } from "./-components/candidate-resume-preview";
import {
    CandidateVerificationSummary,
    IdentityVerifiedBadge,
} from "./-components/candidate-verification-summary";

export const Route = createFileRoute("/dashboard/company/match")({
  component: RouteComponent,
});

type MatchResult = RouterOutput["company"]["matchCandidates"][number];

const MATCH_STATE_STORAGE_KEY = "company-match-state";

const matchPageStateSchema = z.object({
  jobDescription: z.string().max(20_000),
  results: companyDto.matchCandidates.output,
  hasSearched: z.boolean(),
});

type MatchPageState = z.infer<typeof matchPageStateSchema>;

const emptyMatchPageState: MatchPageState = {
  jobDescription: "",
  results: [],
  hasSearched: false,
};

function loadMatchPageState(): MatchPageState {
  try {
    const stored = localStorage.getItem(MATCH_STATE_STORAGE_KEY);
    if (!stored) return emptyMatchPageState;
    return matchPageStateSchema.parse(JSON.parse(stored));
  } catch {
    return emptyMatchPageState;
  }
}

function saveMatchPageState(state: MatchPageState): void {
  try {
    localStorage.setItem(MATCH_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function patchCandidate(candidate: MatchResult, flags: Partial<CandidateActionFlags>): MatchResult {
  return { ...candidate, ...flags };
}

function MatchCard({
  candidate,
  onClick,
  onFlagsChange,
}: {
  candidate: MatchResult;
  onClick: () => void;
  onFlagsChange: (flags: Partial<CandidateActionFlags>) => void;
}) {
  return (
    <motion.button
      type="button"
      className="flex w-full cursor-pointer flex-col gap-y-3 rounded-md border bg-card p-4 text-start transition-colors hover:bg-accent/50"
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate font-medium">{candidate.displayName}</h3>
            <IdentityVerifiedBadge verified={candidate.identityVerified} />
          </div>
          {candidate.headline && <p className="truncate text-sm text-muted-foreground">{candidate.headline}</p>}
        </div>
        <Badge variant="secondary">{candidate.matchScore}%</Badge>
      </div>

      <CandidateVerificationSummary
        verifiedSkills={candidate.verifiedSkills}
        verifiedExperiences={candidate.verifiedExperiences}
      />

      <p className="line-clamp-2 text-sm text-muted-foreground">{candidate.matchReason}</p>

      <div onClick={(event) => event.stopPropagation()}>
        <CandidateActions
          candidateUserId={candidate.candidateUserId}
          resumeId={candidate.resumeId}
          isFavorite={candidate.isFavorite}
          isToContact={candidate.isToContact}
          contactStatus={candidate.contactStatus}
          onFlagsChange={onFlagsChange}
        />
      </div>
    </motion.button>
  );
}

function RouteComponent() {
  const [jobDescription, setJobDescription] = useState("");
  const [results, setResults] = useState<MatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<MatchResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const stored = loadMatchPageState();
    setJobDescription(stored.jobDescription);
    setResults(stored.results);
    setHasSearched(stored.hasSearched);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveMatchPageState({ jobDescription, results, hasSearched });
  }, [jobDescription, results, hasSearched, hydrated]);

  const updateFlags = (resumeId: string | null, flags: Partial<CandidateActionFlags>) => {
    setResults((current) => current.map((row) => (row.resumeId === resumeId ? patchCandidate(row, flags) : row)));
    setSelected((current) => (current?.resumeId === resumeId ? patchCandidate(current, flags) : current));
  };

  const matchMutation = useMutation({
    ...orpc.company.matchCandidates.mutationOptions(),
    onSuccess: (data) => {
      setResults(data);
      setHasSearched(true);
    },
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    matchMutation.mutate({
      jobDescription,
      workAuthRegions: [],
    });
  };

  return (
    <div className="space-y-4">
      <DashboardHeader icon={MagnifyingGlassIcon} title={t`Match Candidates`} />
      <Separator />

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="job-description">
            <Trans>Job description</Trans>
          </Label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder={t`Paste a job description to find closely matching vetted candidates…`}
            className="min-h-40"
          />
        </div>

        <Button type="submit" disabled={matchMutation.isPending || jobDescription.trim().length < 20}>
          {matchMutation.isPending ? <Spinner /> : <MagnifyingGlassIcon />}
          <Trans>Find matches</Trans>
        </Button>
      </form>

      {matchMutation.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-2">
            <WarningCircleIcon className="mt-0.5 size-4 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                <Trans>Could not match candidates</Trans>
              </p>
              <p className="text-sm text-muted-foreground">{matchMutation.error.message}</p>
            </div>
          </div>
        </div>
      )}

      {matchMutation.isPending && results.length === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex animate-pulse flex-col gap-y-3 rounded-md border bg-card p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((candidate) => (
            <MatchCard
              key={candidate.resumeId}
              candidate={candidate}
              onClick={() => {
                setSelected(candidate);
                setSheetOpen(true);
              }}
              onFlagsChange={(flags) => updateFlags(candidate.resumeId, flags)}
            />
          ))}
        </div>
      )}

      {hasSearched && !matchMutation.isPending && results.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            <Trans>No matching vetted candidates found. Try adjusting the job description.</Trans>
          </p>
        </div>
      )}

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
                <Badge variant="secondary">
                  <Trans>Match score: {selected.matchScore}%</Trans>
                </Badge>

                <p className="text-sm text-muted-foreground">{selected.matchReason}</p>

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
                  onFlagsChange={(flags) => updateFlags(selected.resumeId, flags)}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

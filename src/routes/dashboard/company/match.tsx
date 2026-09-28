import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { MagnifyingGlassIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import { useLocalStorage } from "usehooks-ts";
import z from "zod";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/integrations/orpc/client";
import { companyDto } from "@/integrations/orpc/dto/company";

import type { CandidateActionFlags } from "./-components/candidate-actions";

import { DashboardHeader } from "../-components/header";
import { CandidateCard } from "./-components/candidate-card";
import { CandidateDetailSheet } from "./-components/candidate-detail-sheet";

export const Route = createFileRoute("/dashboard/company/match")({
  component: RouteComponent,
});

type MatchResult = RouterOutput["company"]["matchCandidates"][number];

const MIN_JOB_DESCRIPTION_LENGTH = 20;

const matchPageStateSchema = z.object({
  jobDescription: z.string().max(20_000),
  results: companyDto.matchCandidates.output,
  hasSearched: z.boolean(),
});

type MatchPageState = z.infer<typeof matchPageStateSchema>;

const emptyMatchPageState: MatchPageState = { jobDescription: "", results: [], hasSearched: false };

// Module-level so the hook's memoized callbacks stay stable; a schema mismatch falls back to the empty state.
const matchPageStorageOptions = {
  initializeWithValue: false,
  deserializer: (raw: string) => matchPageStateSchema.parse(JSON.parse(raw)),
};

function MatchResultsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex animate-pulse flex-col gap-y-3 rounded-md border bg-card p-4">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="h-3 w-5/6 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function MatchError({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2">
        <WarningCircleIcon className="mt-0.5 size-4 text-destructive" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">
            <Trans>Could not match candidates</Trans>
          </p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

function RouteComponent() {
  const [state, setState] = useLocalStorage("company-match-state", emptyMatchPageState, matchPageStorageOptions);
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const { jobDescription, results, hasSearched } = state;
  const selected = results.find((row) => row.resumeId === selectedResumeId) ?? null;

  // Saved lists and contact requests are per candidate, not per resume.
  const updateFlags = (candidateUserId: string, flags: Partial<CandidateActionFlags>) => {
    setState((prev) => ({
      ...prev,
      results: prev.results.map((row) => (row.candidateUserId === candidateUserId ? { ...row, ...flags } : row)),
    }));
  };

  const matchMutation = useMutation({
    ...orpc.company.matchCandidates.mutationOptions(),
    onSuccess: (data) => setState((prev) => ({ ...prev, results: data, hasSearched: true })),
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    matchMutation.mutate({ jobDescription, workAuthRegions: [] });
  };

  return (
    <div className="space-y-4">
      <DashboardHeader icon={MagnifyingGlassIcon} title={t`Smart AI Search`} />
      <Separator />

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex flex-col gap-y-2">
          <Label htmlFor="job-description">
            <Trans>Job description</Trans>
          </Label>
          <Textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setState((prev) => ({ ...prev, jobDescription: event.target.value }))}
            placeholder={t`Paste a job description to find closely matching vetted candidates…`}
            className="min-h-40"
          />
        </div>

        <Button
          type="submit"
          disabled={matchMutation.isPending || jobDescription.trim().length < MIN_JOB_DESCRIPTION_LENGTH}
        >
          {matchMutation.isPending ? <Spinner /> : <MagnifyingGlassIcon />}
          <Trans>Find matches</Trans>
        </Button>
      </form>

      {matchMutation.isError && <MatchError message={matchMutation.error.message} />}

      {matchMutation.isPending && results.length === 0 && <MatchResultsSkeleton />}

      {results.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((candidate) => (
            <motion.div
              key={candidate.resumeId ?? candidate.candidateUserId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <CandidateCard
                candidate={candidate}
                aside={<Badge variant="secondary">{candidate.matchScore}%</Badge>}
                onView={() => setSelectedResumeId(candidate.resumeId)}
                onFlagsChange={(flags) => updateFlags(candidate.candidateUserId, flags)}
              >
                <p className="line-clamp-2 text-sm text-muted-foreground">{candidate.matchReason}</p>
              </CandidateCard>
            </motion.div>
          ))}
        </div>
      )}

      {hasSearched && !matchMutation.isPending && results.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          <Trans>No matching vetted candidates found. Try adjusting the job description.</Trans>
        </p>
      )}

      <CandidateDetailSheet<MatchResult>
        candidate={selected}
        onClose={() => setSelectedResumeId(null)}
        onFlagsChange={(candidate, flags) => updateFlags(candidate.candidateUserId, flags)}
        renderExtra={(candidate) => (
          <>
            <Badge variant="secondary">
              <Trans>Match score: {candidate.matchScore}%</Trans>
            </Badge>
            <p className="text-sm text-muted-foreground">{candidate.matchReason}</p>
          </>
        )}
      />
    </div>
  );
}

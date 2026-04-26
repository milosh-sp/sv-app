import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BuildingsIcon, GlobeIcon, UsersIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useMemo } from "react";
import z from "zod";

import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";
import { sponsorshipRequirementSchema, workAuthorizationStatusSchema } from "@/schema/resume/data";

import { DashboardHeader } from "../-components/header";

const regionSchema = z.enum(["eu", "usa", "uk"]);
type Region = z.infer<typeof regionSchema>;

const searchSchema = z.object({
  workAuthRegions: z.array(regionSchema).default([]),
  sponsorshipRequired: sponsorshipRequirementSchema.optional(),
  euStatus: workAuthorizationStatusSchema.optional(),
  usaStatus: workAuthorizationStatusSchema.optional(),
  ukStatus: workAuthorizationStatusSchema.optional(),
  authorizationFreshnessDays: z.number().int().min(1).optional(),
});

const formatWorkAuthStatusLabel = (value: string) =>
  value === "needs_sponsorship" ? "requires employer sponsorship" : value.replaceAll("_", " ");

export const Route = createFileRoute("/dashboard/admin/candidates")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
  search: {
    middlewares: [stripSearchParams({ workAuthRegions: [] })],
  },
});

function RouteComponent() {
  const navigate = useNavigate({ from: Route.fullPath });
  const search = Route.useSearch();

  const queryInput = useMemo(
    () => ({
      workAuthRegions: search.workAuthRegions,
      sponsorshipRequired: search.sponsorshipRequired,
      workAuthStatusByRegion: {
        eu: search.euStatus,
        usa: search.usaStatus,
        uk: search.ukStatus,
      },
      authorizationFreshnessDays: search.authorizationFreshnessDays,
    }),
    [search],
  );

  const { data, isLoading, isError } = useQuery(orpc.resume.searchForEmployers.queryOptions({ input: queryInput }));

  if (isError) return null;

  const regionOptions = [
    { value: "eu", label: "EU" },
    { value: "usa", label: "USA" },
    { value: "uk", label: "UK" },
  ];
  const sponsorshipOptions = sponsorshipRequirementSchema.options.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  }));
  const statusOptions = workAuthorizationStatusSchema.options.map((value) => ({
    value,
    label: formatWorkAuthStatusLabel(value),
  }));

  return (
    <div className="space-y-4">
      <DashboardHeader icon={UsersIcon} title={t`Candidate Search`} />

      <Separator />

      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
        <Combobox
          multiple
          value={search.workAuthRegions}
          options={regionOptions}
          placeholder={t`Regions`}
          onValueChange={(value) => void navigate({ search: { ...search, workAuthRegions: (value ?? []) as Region[] } })}
        />
        <Combobox
          value={search.sponsorshipRequired ?? null}
          options={sponsorshipOptions}
          placeholder={t`Sponsorship requirement`}
          onValueChange={(value) =>
            void navigate({ search: { ...search, sponsorshipRequired: value ?? undefined } })
          }
        />
        <Combobox
          value={search.euStatus ?? null}
          options={statusOptions}
          placeholder={t`EU status`}
          onValueChange={(value) => void navigate({ search: { ...search, euStatus: value ?? undefined } })}
        />
        <Combobox
          value={search.usaStatus ?? null}
          options={statusOptions}
          placeholder={t`USA status`}
          onValueChange={(value) => void navigate({ search: { ...search, usaStatus: value ?? undefined } })}
        />
        <Combobox
          value={search.ukStatus ?? null}
          options={statusOptions}
          placeholder={t`UK status`}
          onValueChange={(value) => void navigate({ search: { ...search, ukStatus: value ?? undefined } })}
        />
        <input
          type="number"
          min={1}
          className="h-9 rounded-md border px-3 text-sm"
          value={search.authorizationFreshnessDays ?? ""}
          placeholder={t`Freshness days`}
          onChange={(event) => {
            const value = event.target.value;
            void navigate({
              search: { ...search, authorizationFreshnessDays: value ? Number(value) : undefined },
            });
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          <Trans>Loading candidates...</Trans>
        </p>
      ) : data && data.length > 0 ? (
        <div className="grid gap-3">
          {data.map((candidate) => (
            <div key={candidate.id} className="space-y-2 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="font-medium">{candidate.basics.name || candidate.name}</p>
                <p className="text-sm text-muted-foreground">{candidate.basics.headline}</p>
                <p className="text-xs text-muted-foreground">
                  <BuildingsIcon className="mr-1 inline size-3.5" />
                  @{candidate.slug}
                  {candidate.basics.location ? ` · ${candidate.basics.location}` : ""}
                </p>
              </div>
              <div className="grid gap-1 text-xs sm:grid-cols-3">
                {(["eu", "usa", "uk"] as const).map((region) => (
                  <div key={region} className="rounded border p-2">
                    <p className="mb-1 flex items-center gap-1 font-medium uppercase">
                      <GlobeIcon className="size-3.5" />
                      {region}
                    </p>
                    <p>{formatWorkAuthStatusLabel(candidate.workAuthorization[region].status)}</p>
                    <p className="text-muted-foreground">
                      <Trans>Sponsorship:</Trans> {candidate.workAuthorization[region].sponsorshipRequired.replaceAll("_", " ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Trans>No candidates match these work authorization filters yet.</Trans>
        </p>
      )}
    </div>
  );
}

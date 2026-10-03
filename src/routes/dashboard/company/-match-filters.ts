import z from "zod";

import { companyDto, companyMatchFiltersSchema } from "@/integrations/orpc/dto/company";
import { workAuthorizationRegionSchema } from "@/schema/resume/data";

export type CompanyMatchFilters = z.infer<typeof companyMatchFiltersSchema>;
export type WorkAuthRegion = z.infer<typeof workAuthorizationRegionSchema>;

export const emptyCompanyMatchFilters: CompanyMatchFilters = { workAuthRegions: [] };

const workAuthRegions = workAuthorizationRegionSchema.options;

export const matchPageStateSchema = z.object({
  jobDescription: z.string().max(20_000),
  results: companyDto.matchCandidates.output,
  hasSearched: z.boolean(),
  filters: companyMatchFiltersSchema.default(emptyCompanyMatchFilters),
});

export type MatchPageState = z.infer<typeof matchPageStateSchema>;

export const emptyMatchPageState: MatchPageState = {
  jobDescription: "",
  results: [],
  hasSearched: false,
  filters: emptyCompanyMatchFilters,
};

export function readMatchPageState(raw: string): MatchPageState {
  try {
    const parsed = matchPageStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyMatchPageState;
  } catch {
    return emptyMatchPageState;
  }
}

function statusForSelectedRegions(filters: CompanyMatchFilters) {
  const status = filters.workAuthStatusByRegion;
  if (!status) return undefined;

  const next = {
    ...(filters.workAuthRegions.includes("eu") && status.eu ? { eu: status.eu } : {}),
    ...(filters.workAuthRegions.includes("usa") && status.usa ? { usa: status.usa } : {}),
    ...(filters.workAuthRegions.includes("uk") && status.uk ? { uk: status.uk } : {}),
  };

  return next.eu || next.usa || next.uk ? next : undefined;
}

export function buildCompanyMatchInput(jobDescription: string, filters: CompanyMatchFilters) {
  return companyDto.matchCandidates.input.parse({
    jobDescription,
    workAuthRegions: filters.workAuthRegions,
    sponsorshipRequired: filters.sponsorshipRequired,
    workAuthStatusByRegion: statusForSelectedRegions(filters),
    authorizationFreshnessDays: filters.authorizationFreshnessDays,
  });
}

export function toggleWorkAuthRegion(filters: CompanyMatchFilters, region: WorkAuthRegion): CompanyMatchFilters {
  const selected = filters.workAuthRegions.includes(region);
  const workAuthRegions = selected
    ? filters.workAuthRegions.filter((item) => item !== region)
    : workAuthRegionsOrder(filters.workAuthRegions, region);

  return {
    ...filters,
    workAuthRegions,
    workAuthStatusByRegion: selected
      ? statusForSelectedRegions({ ...filters, workAuthRegions })
      : filters.workAuthStatusByRegion,
  };
}

function workAuthRegionsOrder(current: CompanyMatchFilters["workAuthRegions"], region: WorkAuthRegion) {
  const selected = new Set([...current, region]);
  return workAuthRegions.filter((item) => selected.has(item));
}

export function setWorkAuthRegionStatus(
  filters: CompanyMatchFilters,
  region: WorkAuthRegion,
  status: NonNullable<CompanyMatchFilters["workAuthStatusByRegion"]>[WorkAuthRegion] | null,
): CompanyMatchFilters {
  const next = { ...filters.workAuthStatusByRegion };
  if (status) next[region] = status;
  else delete next[region];

  return {
    ...filters,
    workAuthStatusByRegion: next.eu || next.usa || next.uk ? next : undefined,
  };
}

export function setSponsorshipRequired(
  filters: CompanyMatchFilters,
  sponsorshipRequired: CompanyMatchFilters["sponsorshipRequired"] | null,
): CompanyMatchFilters {
  return { ...filters, sponsorshipRequired: sponsorshipRequired ?? undefined };
}

export function setAuthorizationFreshnessDays(filters: CompanyMatchFilters, raw: string): CompanyMatchFilters {
  const trimmed = raw.trim();
  if (!trimmed) return { ...filters, authorizationFreshnessDays: undefined };

  const days = Number(trimmed);
  if (!Number.isInteger(days) || days < 1) return { ...filters, authorizationFreshnessDays: undefined };

  return { ...filters, authorizationFreshnessDays: days };
}

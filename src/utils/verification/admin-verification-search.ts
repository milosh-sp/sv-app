export const ADMIN_VERIFICATION_PAGE_SIZE = 20;

export type AdminVerificationHistoryStatus = "verified" | "rejected" | "issue";
export type AdminVerificationMethod = "document_upload" | "freelancer_link" | "identity_call";
export type AdminVerificationProposedOutcome = AdminVerificationHistoryStatus;
export type AdminVerificationSectionType = "skill" | "project";

export type AdminVerificationBaseSearch = {
  q: string;
  page: number;
  statuses: AdminVerificationHistoryStatus[];
  method: AdminVerificationMethod | "all";
};

export type AdminExperienceSearch = AdminVerificationBaseSearch & {
  proposed: AdminVerificationProposedOutcome[];
  types: AdminVerificationSectionType[];
};

export const defaultAdminVerificationSearch: AdminVerificationBaseSearch = {
  q: "",
  page: 1,
  statuses: [],
  method: "all",
};

export const defaultAdminExperienceSearch: AdminExperienceSearch = {
  ...defaultAdminVerificationSearch,
  proposed: [],
  types: [],
};

export function buildVerificationListInput(
  search: AdminVerificationBaseSearch,
  tab: "queue" | "history",
): {
  page: number;
  pageSize: number;
  query?: string;
  method?: AdminVerificationMethod;
  statuses?: AdminVerificationHistoryStatus[];
} {
  const query = search.q.trim();
  return {
    page: search.page,
    pageSize: ADMIN_VERIFICATION_PAGE_SIZE,
    query: query.length > 0 ? query : undefined,
    method: search.method === "all" ? undefined : search.method,
    statuses: tab === "history" && search.statuses.length > 0 ? search.statuses : undefined,
  };
}

export function buildPendingVerdictsListInput(search: AdminExperienceSearch): {
  page: number;
  pageSize: number;
  query?: string;
  proposed?: AdminVerificationProposedOutcome[];
  types?: AdminVerificationSectionType[];
} {
  const query = search.q.trim();
  return {
    page: search.page,
    pageSize: ADMIN_VERIFICATION_PAGE_SIZE,
    query: query.length > 0 ? query : undefined,
    proposed: search.proposed.length > 0 ? search.proposed : undefined,
    types: search.types.length > 0 ? search.types : undefined,
  };
}

export function hasActiveAdminVerificationFilters(
  search: AdminVerificationBaseSearch,
  tab: "queue" | "history" | "verdicts",
): boolean {
  if (search.q.trim().length > 0) return true;
  if (search.method !== "all") return true;
  if (tab === "history" && search.statuses.length > 0) return true;
  return false;
}

export function hasActiveAdminExperienceFilters(
  search: AdminExperienceSearch,
  tab: "queue" | "history" | "verdicts",
): boolean {
  if (hasActiveAdminVerificationFilters(search, tab)) return true;
  if (tab === "verdicts" && search.proposed.length > 0) return true;
  if (tab === "verdicts" && search.types.length > 0) return true;
  return false;
}

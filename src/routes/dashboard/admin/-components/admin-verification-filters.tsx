import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  type AdminExperienceSearch,
  type AdminVerificationBaseSearch,
  type AdminVerdictSearch,
  type AdminVerificationHistoryStatus,
  type AdminVerificationMethod,
  type AdminVerificationProposedOutcome,
  type AdminVerificationSectionType,
  defaultAdminExperienceSearch,
  defaultAdminVerdictSearch,
  defaultAdminVerificationSearch,
  hasActiveAdminExperienceFilters,
  hasActiveAdminVerificationFilters,
  hasActiveAdminVerdictFilters,
} from "@/utils/verification/admin-verification-search";

const HISTORY_STATUS_OPTIONS: ComboboxOption<AdminVerificationHistoryStatus>[] = [
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "issue", label: "Issue" },
];

const EXPERIENCE_METHOD_OPTIONS: ComboboxOption<AdminVerificationMethod | "all">[] = [
  { value: "all", label: "All methods" },
  { value: "document_upload", label: "Document upload" },
  { value: "freelancer_link", label: "Freelancer link" },
];

const PROPOSED_OUTCOME_OPTIONS: ComboboxOption<AdminVerificationProposedOutcome>[] = [
  { value: "verified", label: "Proposed: Pass" },
  { value: "rejected", label: "Proposed: Fail" },
  { value: "issue", label: "Proposed: Issue" },
];

const SECTION_TYPE_OPTIONS: ComboboxOption<AdminVerificationSectionType>[] = [
  { value: "skill", label: "Skill" },
  { value: "project", label: "Project" },
];

function AdminVerificationSearchField({
  committedQ,
  onCommittedQChange,
}: {
  committedQ: string;
  onCommittedQChange: (q: string) => void;
}) {
  const [qInput, setQInput] = useState(committedQ);

  useEffect(() => {
    setQInput(committedQ);
  }, [committedQ]);

  return (
    <div className="space-y-1.5 md:col-span-2">
      <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-verification-search">
        <Trans>Search</Trans>
      </label>
      <Input
        id="admin-verification-search"
        value={qInput}
        placeholder={t`Name, email, @username, or label…`}
        onChange={(e) => {
          const value = e.target.value;
          setQInput(value);
          onCommittedQChange(value);
        }}
      />
    </div>
  );
}

export function AdminVerificationFilterBar({
  variant,
  tab,
  search,
  onSearchChange,
  onReset,
}: {
  variant: "identity" | "experience";
  tab: "queue" | "history";
  search: AdminVerificationBaseSearch;
  onSearchChange: (next: Partial<AdminVerificationBaseSearch>) => void;
  onReset: () => void;
}) {
  const hasActiveFilter = hasActiveAdminVerificationFilters(search, tab);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {hasActiveFilter && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onReset}>
            <Trans>Reset filters</Trans>
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminVerificationSearchField
          committedQ={search.q}
          onCommittedQChange={(q) => {
            onSearchChange({ q, page: 1 });
          }}
        />

        {variant === "experience" && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Method</Trans>
            </p>
            <Combobox
              value={search.method}
              options={EXPERIENCE_METHOD_OPTIONS}
              placeholder={t`All methods`}
              onValueChange={(value) => {
                onSearchChange({
                  method: (value ?? "all") as AdminVerificationMethod | "all",
                  page: 1,
                });
              }}
            />
          </div>
        )}

        {tab === "history" && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Status</Trans>
            </p>
            <Combobox
              multiple
              value={search.statuses}
              options={HISTORY_STATUS_OPTIONS}
              placeholder={t`Filter by status`}
              searchPlaceholder={t`Search statuses…`}
              emptyMessage={t`No matching statuses.`}
              onValueChange={(value) => {
                onSearchChange({ statuses: value ?? [], page: 1 });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminExperienceFilterBar({
  tab,
  search,
  onSearchChange,
  onReset,
}: {
  tab: "queue" | "history";
  search: AdminExperienceSearch;
  onSearchChange: (next: Partial<AdminExperienceSearch>) => void;
  onReset: () => void;
}) {
  const hasActiveFilter = hasActiveAdminExperienceFilters(search, tab);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {hasActiveFilter && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onReset}>
            <Trans>Reset filters</Trans>
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminVerificationSearchField
          committedQ={search.q}
          onCommittedQChange={(q) => {
            onSearchChange({ q, page: 1 });
          }}
        />

        {tab === "queue" || tab === "history" ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Method</Trans>
            </p>
            <Combobox
              value={search.method}
              options={EXPERIENCE_METHOD_OPTIONS}
              placeholder={t`All methods`}
              onValueChange={(value) => {
                onSearchChange({
                  method: (value ?? "all") as AdminVerificationMethod | "all",
                  page: 1,
                });
              }}
            />
          </div>
        ) : null}

        {tab === "history" && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              <Trans>Status</Trans>
            </p>
            <Combobox
              multiple
              value={search.statuses}
              options={HISTORY_STATUS_OPTIONS}
              placeholder={t`Filter by status`}
              searchPlaceholder={t`Search statuses…`}
              emptyMessage={t`No matching statuses.`}
              onValueChange={(value) => {
                onSearchChange({ statuses: value ?? [], page: 1 });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminVerdictFilterBar({
  tab,
  search,
  onSearchChange,
  onReset,
}: {
  tab: "queue" | "history";
  search: AdminVerdictSearch;
  onSearchChange: (next: Partial<AdminVerdictSearch>) => void;
  onReset: () => void;
}) {
  const hasActiveFilter = hasActiveAdminVerdictFilters(search, tab);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      {hasActiveFilter && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onReset}>
            <Trans>Reset filters</Trans>
          </Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <AdminVerificationSearchField
          committedQ={search.q}
          onCommittedQChange={(q) => {
            onSearchChange({ q, page: 1 });
          }}
        />

        {tab === "queue" && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Proposed outcome</Trans>
              </p>
              <Combobox
                multiple
                value={search.proposed}
                options={PROPOSED_OUTCOME_OPTIONS}
                placeholder={t`Filter by proposed outcome`}
                searchPlaceholder={t`Search outcomes…`}
                emptyMessage={t`No matching outcomes.`}
                onValueChange={(value) => {
                  onSearchChange({ proposed: value ?? [], page: 1 });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Type</Trans>
              </p>
              <Combobox
                multiple
                value={search.types}
                options={SECTION_TYPE_OPTIONS}
                placeholder={t`Filter by type`}
                searchPlaceholder={t`Search types…`}
                emptyMessage={t`No matching types.`}
                onValueChange={(value) => {
                  onSearchChange({ types: value ?? [], page: 1 });
                }}
              />
            </div>
          </>
        )}

        {tab === "history" && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Status</Trans>
              </p>
              <Combobox
                multiple
                value={search.statuses}
                options={HISTORY_STATUS_OPTIONS}
                placeholder={t`Filter by status`}
                searchPlaceholder={t`Search statuses…`}
                emptyMessage={t`No matching statuses.`}
                onValueChange={(value) => {
                  onSearchChange({ statuses: value ?? [], page: 1 });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                <Trans>Type</Trans>
              </p>
              <Combobox
                multiple
                value={search.types}
                options={SECTION_TYPE_OPTIONS}
                placeholder={t`Filter by type`}
                searchPlaceholder={t`Search types…`}
                emptyMessage={t`No matching types.`}
                onValueChange={(value) => {
                  onSearchChange({ types: value ?? [], page: 1 });
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { defaultAdminExperienceSearch, defaultAdminVerdictSearch, defaultAdminVerificationSearch };

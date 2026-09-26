import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { UserListIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebounceCallback } from "usehooks-ts";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";
import { ReviewerProfileDialogTrigger } from "./-components/reviewer-profile-panel";

const PAGE_SIZE = 20;

const usersSearchSchema = z.object({
  q: z.string().optional().default(""),
  role: z.enum(["all", "user", "skill_verdict_admin", "reviewer_admin"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

const roleSelectOptions: ComboboxOption<string>[] = [
  { value: "__none__", label: "User" },
  { value: "skill_verdict_admin", label: "Skill Verdict Admin" },
  { value: "reviewer_admin", label: "Reviewer Admin" },
];

const roleFilterOptions: ComboboxOption<string>[] = [
  { value: "all", label: "All roles" },
  { value: "user", label: "User" },
  { value: "skill_verdict_admin", label: "Skill Verdict Admin" },
  { value: "reviewer_admin", label: "Reviewer Admin" },
];

function roleToSelectValue(role: "skill_verdict_admin" | "reviewer_admin" | null): string {
  return role ?? "__none__";
}

function selectValueToRole(value: string | null): "skill_verdict_admin" | "reviewer_admin" | null {
  if (!value || value === "__none__") return null;
  if (value === "skill_verdict_admin" || value === "reviewer_admin") return value;
  return null;
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const parsed = typeof value === "string" ? new Date(value) : value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMethodLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function formatWorkAuthStatusLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value === "needs_sponsorship" ? "requires employer sponsorship" : value.replaceAll("_", " ");
}

function formatSponsorshipLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replaceAll("_", " ");
}

function truncateText(value: string | null | undefined, maxLength = 80): string {
  if (!value) return "";
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export const Route = createFileRoute("/dashboard/admin/users")({
  validateSearch: zodValidator(usersSearchSchema),
  component: RouteComponent,
});

function AdminUsersSearchField({
  committedQ,
  onCommittedQChange,
}: {
  committedQ: string;
  onCommittedQChange: (q: string) => void;
}) {
  const [qInput, setQInput] = useState(committedQ);
  const [prevCommittedQ, setPrevCommittedQ] = useState(committedQ);

  if (committedQ !== prevCommittedQ) {
    setPrevCommittedQ(committedQ);
    setQInput(committedQ);
  }

  return (
    <div className="space-y-1.5 md:col-span-2">
      <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-users-search">
        <Trans>Search</Trans>
      </label>
      <Input
        id="admin-users-search"
        value={qInput}
        placeholder={t`Name, email, or @username…`}
        onChange={(e) => {
          const v = e.target.value;
          setQInput(v);
          onCommittedQChange(v);
        }}
      />
    </div>
  );
}

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { session } = useRouteContext({ strict: false });
  const currentUserId = session?.user?.id;

  const search = Route.useSearch();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const listInput = useMemo(
    () => ({
      page: search.page,
      pageSize: PAGE_SIZE,
      query: search.q.trim() || undefined,
      roleFilter: search.role,
    }),
    [search.page, search.q, search.role],
  );

  const commitSearchToUrl = useCallback(
    (q: string) => {
      void navigate({
        search: (prev) => ({ ...prev, q, page: 1 }),
      });
    },
    [navigate],
  );

  const debouncedCommitSearch = useDebounceCallback(commitSearchToUrl, 400);

  const listQuery = useQuery({
    ...orpc.admin.users.listUsers.queryOptions({ input: listInput }),
    placeholderData: (prev) => prev,
  });

  const setRole = useMutation({
    ...orpc.admin.users.setUserAdminRole.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success(t`Role updated`);
      await queryClient.invalidateQueries({
        queryKey: orpc.admin.users.listUsers.queryOptions({ input: listInput }).queryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.auth.getAdminRole.queryOptions().queryKey,
      });
      if (currentUserId && variables.userId === currentUserId && variables.role !== "skill_verdict_admin") {
        void navigate({ to: "/dashboard", replace: true });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const { data, isLoading, isError } = listQuery;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (isError) return null;

  return (
    <div className="space-y-4">
      <DashboardHeader icon={UserListIcon} title={t`Users`} />

      <Separator />

      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
        <AdminUsersSearchField committedQ={search.q} onCommittedQChange={debouncedCommitSearch} />
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            <Trans>Role</Trans>
          </p>
          <Combobox
            value={search.role}
            options={roleFilterOptions}
            placeholder={t`All roles`}
            onValueChange={(value) => {
              void navigate({
                search: (prev) => ({
                  ...prev,
                  role: (value ?? "all") as (typeof search)["role"],
                  page: 1,
                }),
              });
            }}
          />
        </div>
      </div>

      {isLoading && !data ? (
        <p className="text-sm text-muted-foreground">
          <Trans>Loading users…</Trans>
        </p>
      ) : data && data.users.length > 0 ? (
        <>
          <ul className="divide-y rounded-lg border">
            {data.users.map((u) => (
              <UserRoleRow
                key={u.id}
                user={u}
                currentUserId={currentUserId}
                disabled={setRole.isPending}
                expanded={expandedUserId === u.id}
                onExpandedChange={(expanded) => {
                  setExpandedUserId((prev) => {
                    if (!expanded) return prev === u.id ? null : prev;
                    return u.id;
                  });
                }}
                onSave={(role) => {
                  setRole.mutate({ userId: u.id, role });
                }}
              />
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              <Trans>
                Page {search.page} of {totalPages} — {data.total} users
              </Trans>
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={search.page <= 1 || setRole.isPending}
                onClick={() =>
                  void navigate({
                    search: (s) => ({ ...s, page: Math.max(1, s.page - 1) }),
                  })
                }
              >
                <Trans>Previous</Trans>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={search.page >= totalPages || setRole.isPending}
                onClick={() =>
                  void navigate({
                    search: (s) => ({ ...s, page: Math.min(totalPages, s.page + 1) }),
                  })
                }
              >
                <Trans>Next</Trans>
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Trans>No users match your filters.</Trans>
        </p>
      )}
    </div>
  );
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  username: string;
  displayUsername: string;
  createdAt: Date | string;
  adminRole: "skill_verdict_admin" | "reviewer_admin" | null;
};

function UserRoleRow({
  user,
  currentUserId,
  disabled,
  expanded,
  onExpandedChange,
  onSave,
}: {
  user: UserRow;
  currentUserId: string | undefined;
  disabled: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSave: (role: "skill_verdict_admin" | "reviewer_admin" | null) => void;
}) {
  const serverValue = roleToSelectValue(user.adminRole);
  const [draft, setDraft] = useState(serverValue);
  const [prevServerValue, setPrevServerValue] = useState(serverValue);

  if (serverValue !== prevServerValue) {
    setPrevServerValue(serverValue);
    setDraft(serverValue);
  }
  const isDirty = draft !== serverValue;
  const detailsQuery = useQuery({
    ...orpc.admin.users.getUserOverview.queryOptions({
      input: { userId: user.id },
    }),
    enabled: expanded,
  });
  const workAuthorization = detailsQuery.data?.workAuthorization ?? null;

  const created =
    typeof user.createdAt === "string"
      ? new Date(user.createdAt)
      : user.createdAt instanceof Date
        ? user.createdAt
        : new Date(String(user.createdAt));

  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">
            @{user.displayUsername} ·{" "}
            {created.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            {currentUserId === user.id ? (
              <span className="ms-2 font-medium text-foreground">
                <Trans>(you)</Trans>
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {user.adminRole === "reviewer_admin" ? (
            <ReviewerProfileDialogTrigger
              adminId={user.id}
              userName={user.name}
              userEmail={user.email}
              hasProfile={undefined}
              currentUserId={currentUserId}
            />
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => onExpandedChange(!expanded)}>
            {expanded ? <Trans>Hide details</Trans> : <Trans>View details</Trans>}
          </Button>
          <Combobox
            value={draft}
            options={roleSelectOptions}
            placeholder={t`Admin role`}
            className="min-w-56"
            onValueChange={(value) => setDraft(value ?? "__none__")}
            disabled={disabled}
          />
          <Button
            type="button"
            size="sm"
            disabled={disabled || !isDirty}
            onClick={() => onSave(selectValueToRole(draft))}
          >
            <Trans>Save</Trans>
          </Button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-3 border-t pt-4">
          {detailsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              <Trans>Loading user details…</Trans>
            </p>
          ) : detailsQuery.isError ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-destructive">
                <Trans>Failed to load user details.</Trans>
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void detailsQuery.refetch()}>
                <Trans>Retry</Trans>
              </Button>
            </div>
          ) : detailsQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>Account health</Trans>
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Email verified</Trans>: {detailsQuery.data.user.emailVerified ? "Yes" : "No"}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Two-factor enabled</Trans>: {detailsQuery.data.user.twoFactorEnabled ? "Yes" : "No"}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Last active</Trans>: {formatDateTime(detailsQuery.data.user.lastActiveAt)}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Updated</Trans>: {formatDateTime(detailsQuery.data.user.updatedAt)}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Role assigned</Trans>: {formatDateTime(detailsQuery.data.user.adminRoleAssignedAt)}
                  </p>
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>Session summary</Trans>
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Total sessions</Trans>: {detailsQuery.data.sessions.total}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Active sessions</Trans>: {detailsQuery.data.sessions.active}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Recent sessions</Trans>:
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {detailsQuery.data.sessions.recent.length > 0 ? (
                      detailsQuery.data.sessions.recent.map((sessionRow) => (
                        <li key={sessionRow.id}>
                          {formatDateTime(sessionRow.createdAt)} • {sessionRow.ipAddress ?? "—"} •{" "}
                          {(sessionRow.userAgent ?? "Unknown device").slice(0, 42)}
                        </li>
                      ))
                    ) : (
                      <li>
                        <Trans>No sessions found.</Trans>
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>Auth providers</Trans>
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Linked accounts</Trans>: {detailsQuery.data.authProviders.totalLinkedAccounts}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Providers</Trans>:{" "}
                    {detailsQuery.data.authProviders.providerIds.length > 0
                      ? detailsQuery.data.authProviders.providerIds.join(", ")
                      : "—"}
                  </p>
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>Resume footprint</Trans>
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Total resumes</Trans>: {detailsQuery.data.resumes.total}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Public</Trans>: {detailsQuery.data.resumes.publicCount}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Locked</Trans>: {detailsQuery.data.resumes.lockedCount}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Last resume update</Trans>: {formatDateTime(detailsQuery.data.resumes.lastUpdatedAt)}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Views / downloads</Trans>: {detailsQuery.data.resumes.totalViews} /{" "}
                    {detailsQuery.data.resumes.totalDownloads}
                  </p>
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-medium text-foreground">
                      <Trans>Resumes</Trans>
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                      {detailsQuery.data.resumes.items.length > 0 ? (
                        detailsQuery.data.resumes.items.map((resumeItem) => (
                          <li key={resumeItem.id} className="space-y-0.5 rounded border px-2 py-1.5">
                            <p className="break-words">
                              <Link
                                to="/dashboard/admin/resume/$resumeId"
                                params={{ resumeId: resumeItem.id }}
                                className="underline underline-offset-2"
                              >
                                {resumeItem.name}
                              </Link>
                            </p>
                            <p>
                              <Trans>Visibility</Trans>: {resumeItem.isPublic ? "public" : "private"}
                            </p>
                            <p>
                              <Trans>Lock status</Trans>: {resumeItem.isLocked ? "locked" : "unlocked"}
                            </p>
                            <p>
                              <Trans>Updated</Trans>: {formatDateTime(resumeItem.updatedAt)}
                            </p>
                          </li>
                        ))
                      ) : (
                        <li>
                          <Trans>No resumes found.</Trans>
                        </li>
                      )}
                      {detailsQuery.data.resumes.hiddenCount > 0 ? (
                        <li>
                          <Trans>+{detailsQuery.data.resumes.hiddenCount} more</Trans>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>Visa authorization</Trans>
                  </p>
                  {workAuthorization ? (
                    <div className="grid gap-2 text-xs sm:grid-cols-3">
                      {(["eu", "usa", "uk"] as const).map((region) => (
                        <div key={region} className="space-y-1 rounded border p-2">
                          <p className="font-medium uppercase">{region}</p>
                          <p className="text-muted-foreground">
                            {formatWorkAuthStatusLabel(workAuthorization[region].status)}
                          </p>
                          <p className="text-muted-foreground">
                            <Trans>Sponsorship</Trans>:{" "}
                            {formatSponsorshipLabel(workAuthorization[region].sponsorshipRequired)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      <Trans>No visa authorization data available.</Trans>
                    </p>
                  )}
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>Verification</Trans>
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Total requests</Trans>: {detailsQuery.data.verification.total}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Pending</Trans>: {detailsQuery.data.verification.pending}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Claimed</Trans>: {detailsQuery.data.verification.claimed}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Verdict pending</Trans>: {detailsQuery.data.verification.verdictPending}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Verified</Trans>: {detailsQuery.data.verification.verified}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Rejected/issue</Trans>: {detailsQuery.data.verification.rejected}/
                    {detailsQuery.data.verification.issue}
                  </p>

                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-medium text-foreground">
                      <Trans>Uploaded documents</Trans>
                    </p>
                    {detailsQuery.data.verification.uploadedDocuments.items.length > 0 ? (
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {detailsQuery.data.verification.uploadedDocuments.items.map((doc, index) => (
                          <li key={`${doc.verificationRequestId}-${doc.fileUrl}-${index}`} className="truncate">
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline underline-offset-2"
                            >
                              {doc.itemLabel} • {doc.documentType.replaceAll("_", " ")} •{" "}
                              {doc.status.replaceAll("_", " ")} • {formatDateTime(doc.uploadedAt)}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Trans>No uploaded documents found.</Trans>
                      </p>
                    )}
                    {detailsQuery.data.verification.uploadedDocuments.hiddenCount > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Trans>+{detailsQuery.data.verification.uploadedDocuments.hiddenCount} more uploaded</Trans>
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-medium text-foreground">
                      <Trans>Approved identity</Trans>
                    </p>
                    {detailsQuery.data.verification.approvedIdentity ? (
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        <p className="truncate">
                          {detailsQuery.data.verification.approvedIdentity.itemLabel} •{" "}
                          {formatDateTime(detailsQuery.data.verification.approvedIdentity.resolvedAt)}
                        </p>
                        <p className="truncate">
                          <Trans>Method</Trans>:{" "}
                          {formatMethodLabel(detailsQuery.data.verification.approvedIdentity.method)}
                        </p>
                        {detailsQuery.data.verification.approvedIdentity.reviewerNote ? (
                          <p className="truncate">
                            <Trans>Note</Trans>:{" "}
                            {truncateText(detailsQuery.data.verification.approvedIdentity.reviewerNote)}
                          </p>
                        ) : null}
                        {detailsQuery.data.verification.approvedIdentity.documents.length > 0 ? (
                          <ul className="space-y-1">
                            {detailsQuery.data.verification.approvedIdentity.documents.map((doc, index) => (
                              <li key={`${doc.fileUrl}-${index}`} className="truncate">
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline underline-offset-2"
                                >
                                  {doc.documentType} • {formatDateTime(doc.uploadedAt)}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>
                            <Trans>No approved identity documents.</Trans>
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Trans>No approved identity information.</Trans>
                      </p>
                    )}
                  </div>

                  <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-medium text-foreground">
                      <Trans>Approved experience</Trans>
                    </p>
                    {detailsQuery.data.verification.approvedExperience.items.length > 0 ? (
                      <ul className="mt-1 space-y-2 text-xs text-muted-foreground">
                        {detailsQuery.data.verification.approvedExperience.items.map((experienceItem) => (
                          <li key={experienceItem.id} className="space-y-1">
                            <p className="truncate">
                              {experienceItem.itemLabel} • {formatDateTime(experienceItem.resolvedAt)}
                            </p>
                            <p className="truncate">
                              <Trans>Method</Trans>: {formatMethodLabel(experienceItem.method)}
                            </p>
                            {experienceItem.reviewerNote ? (
                              <p className="truncate">
                                <Trans>Note</Trans>: {truncateText(experienceItem.reviewerNote, 64)}
                              </p>
                            ) : null}
                            {experienceItem.documents.length > 0 ? (
                              <ul className="space-y-1">
                                {experienceItem.documents.map((doc, index) => (
                                  <li key={`${experienceItem.id}-${doc.fileUrl}-${index}`} className="truncate">
                                    <a
                                      href={doc.fileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="underline underline-offset-2"
                                    >
                                      {doc.documentType} • {formatDateTime(doc.uploadedAt)}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Trans>No approved experience information.</Trans>
                      </p>
                    )}
                    {detailsQuery.data.verification.approvedExperience.hiddenCount > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <Trans>+{detailsQuery.data.verification.approvedExperience.hiddenCount} more approved</Trans>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-1 rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    <Trans>API keys</Trans>
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Total keys</Trans>: {detailsQuery.data.apiKeys.total}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Enabled</Trans>: {detailsQuery.data.apiKeys.enabled}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Total request count</Trans>: {detailsQuery.data.apiKeys.totalRequestCount}
                  </p>
                  <p className="text-muted-foreground">
                    <Trans>Last request</Trans>: {formatDateTime(detailsQuery.data.apiKeys.lastRequestAt)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

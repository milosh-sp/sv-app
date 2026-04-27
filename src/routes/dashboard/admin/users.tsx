import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { UserListIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDebounceCallback } from "usehooks-ts";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

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

export const Route = createFileRoute("/dashboard/admin/users")({
  validateSearch: zodValidator(usersSearchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { session } = useRouteContext({ strict: false });
  const currentUserId = session?.user?.id;

  const search = Route.useSearch();
  const [qInput, setQInput] = useState(search.q);
  useEffect(() => {
    setQInput(search.q);
  }, [search.q]);

  const listInput = useMemo(
    () => ({
      page: search.page,
      pageSize: PAGE_SIZE,
      query: search.q.trim() || undefined,
      roleFilter: search.role,
    }),
    [search.page, search.q, search.role],
  );

  const debouncedCommitQuery = useDebounceCallback((q: string) => {
    void navigate({
      search: (prev) => ({ ...prev, q, page: 1 }),
    });
  }, 400);

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
              debouncedCommitQuery(v);
            }}
          />
        </div>
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
  onSave,
}: {
  user: UserRow;
  currentUserId: string | undefined;
  disabled: boolean;
  onSave: (role: "skill_verdict_admin" | "reviewer_admin" | null) => void;
}) {
  const [draft, setDraft] = useState(() => roleToSelectValue(user.adminRole));
  const serverValue = roleToSelectValue(user.adminRole);
  const isDirty = draft !== serverValue;

  useEffect(() => {
    setDraft(roleToSelectValue(user.adminRole));
  }, [user.adminRole]);

  const created =
    typeof user.createdAt === "string"
      ? new Date(user.createdAt)
      : user.createdAt instanceof Date
        ? user.createdAt
        : new Date(String(user.createdAt));

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
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
    </li>
  );
}

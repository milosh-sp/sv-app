import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ChatsCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import z from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/integrations/orpc/client";
import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";

import { DashboardHeader } from "./-components/header";

const searchSchema = z.object({
  status: z.enum(["all", "pending", "accepted", "declined"]).default("all"),
});

const statusOptions: ComboboxOption<string>[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

export const Route = createFileRoute("/dashboard/contact-requests")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ context }) => {
    const { role } = await context.queryClient.ensureQueryData(
      getAdminRoleQueryOptionsForUser(context.session.user.id),
    );
    if (role === "company" || role === "skill_verdict_admin") {
      throw redirect({ to: "/dashboard", replace: true });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const { data = [], isPending } = useQuery({
    ...orpc.company.listMyContactRequests.queryOptions({
      input: {
        status: search.status === "all" ? undefined : search.status,
      },
    }),
  });

  const respond = useMutation({
    ...orpc.company.respondToContactRequest.mutationOptions(),
    onSuccess: async (_data, variables) => {
      toast.success(variables.decision === "accepted" ? t`Contact accepted.` : t`Contact declined.`);
      await queryClient.invalidateQueries({ queryKey: orpc.company.listMyContactRequests.key() });
    },
    onError: (error) => {
      toast.error(error.message || t`Could not update contact request.`);
    },
  });

  return (
    <div className="space-y-4">
      <DashboardHeader icon={ChatsCircleIcon} title={t`Contact Requests`} />
      <Separator />

      <Combobox
        options={statusOptions}
        value={search.status}
        onValueChange={(value) => {
          void navigate({
            search: {
              status: (value as "all" | "pending" | "accepted" | "declined") ?? "all",
            },
            replace: true,
          });
        }}
      />

      {isPending && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!isPending && data.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          <Trans>No contact requests.</Trans>
        </p>
      )}

      <div className="space-y-3">
        {data.map((row) => (
          <div key={row.id} className="space-y-3 rounded-md border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{row.companyName}</p>
                <p className="text-sm text-muted-foreground">
                  {row.companyEmail ?? t`Company email shared after you accept`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <Badge variant="secondary" className="capitalize">
                {row.status}
              </Badge>
            </div>

            {row.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: row.id, decision: "accepted" })}
                >
                  <Trans>Accept</Trans>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={respond.isPending}
                  onClick={() => respond.mutate({ id: row.id, decision: "declined" })}
                >
                  <Trans>Decline</Trans>
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

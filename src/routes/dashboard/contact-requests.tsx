import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ChatsCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import z from "zod";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/integrations/orpc/client";
import { getAdminRoleQueryOptionsForUser } from "@/integrations/orpc/get-admin-role-query-options";

import {
  ContactStatusBadge,
  contactStatusFilterSchema,
  getContactStatusFilterOptions,
} from "./-components/contact-status";
import { DashboardHeader } from "./-components/header";

const searchSchema = z.object({
  status: contactStatusFilterSchema,
});

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

type ContactRequest = RouterOutput["company"]["listMyContactRequests"][number];
type Decision = "accepted" | "declined";

function ContactRequestRow({
  request,
  disabled,
  onRespond,
}: {
  request: ContactRequest;
  disabled: boolean;
  onRespond: (decision: Decision) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{request.companyName}</p>
          <p className="text-sm text-muted-foreground">
            {request.companyEmail ?? t`Company email shared after you accept`}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(request.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <ContactStatusBadge status={request.status} />
      </div>

      {request.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={disabled} onClick={() => onRespond("accepted")}>
            <Trans>Accept</Trans>
          </Button>
          <Button size="sm" variant="outline" disabled={disabled} onClick={() => onRespond("declined")}>
            <Trans>Decline</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}

function RouteComponent() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();

  const { data = [], isPending } = useQuery(
    orpc.company.listMyContactRequests.queryOptions({
      input: { status: search.status === "all" ? undefined : search.status },
    }),
  );

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
        options={getContactStatusFilterOptions()}
        value={search.status}
        onValueChange={(status) => {
          void navigate({ search: { status: status ?? "all" }, replace: true });
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
        {data.map((request) => (
          <ContactRequestRow
            key={request.id}
            request={request}
            disabled={respond.isPending && respond.variables?.id === request.id}
            onRespond={(decision) => respond.mutate({ id: request.id, decision })}
          />
        ))}
      </div>
    </div>
  );
}

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BuildingsIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import z from "zod";

import type { RouterOutput } from "@/integrations/orpc/client";

import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/integrations/orpc/client";

import {
  ContactStatusBadge,
  contactStatusFilterSchema,
  getContactStatusFilterOptions,
} from "../-components/contact-status";
import { DashboardHeader } from "../-components/header";

const searchSchema = z.object({
  status: contactStatusFilterSchema,
  q: z.string().optional().default(""),
});

export const Route = createFileRoute("/dashboard/company/contacts")({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

type ContactRow = RouterOutput["company"]["listContactRequests"][number];

function ContactHistoryRow({ contact }: { contact: ContactRow }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">{contact.candidateName}</p>
        <p className="text-sm text-muted-foreground">{contact.candidateEmail ?? t`Email hidden until accepted`}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(contact.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <ContactStatusBadge status={contact.status} />
    </div>
  );
}

function RouteComponent() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  // The input is uncontrolled; the URL is the source of truth once typing starts.
  const [initialQuery] = useState(search.q);

  const debouncedSetQuery = useDebounceCallback((q: string) => {
    void navigate({ search: (prev) => ({ ...prev, q }), replace: true });
  }, 300);

  const { data = [], isPending } = useQuery({
    ...orpc.company.listContactRequests.queryOptions({
      input: {
        status: search.status === "all" ? undefined : search.status,
        query: search.q || undefined,
      },
    }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-4">
      <DashboardHeader icon={BuildingsIcon} title={t`Contact History`} />
      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          defaultValue={initialQuery}
          onChange={(event) => debouncedSetQuery(event.target.value)}
          placeholder={t`Search by candidate name…`}
          aria-label={t`Search by candidate name`}
          className="sm:max-w-xs"
        />

        <Combobox
          options={getContactStatusFilterOptions()}
          value={search.status}
          onValueChange={(status) => {
            void navigate({ search: (prev) => ({ ...prev, status: status ?? "all" }), replace: true });
          }}
        />
      </div>

      {isPending && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}

      {!isPending && data.length === 0 && (
        <p className="py-12 text-center text-muted-foreground">
          <Trans>No contact requests yet.</Trans>
        </p>
      )}

      <div className="space-y-3">
        {data.map((contact) => (
          <ContactHistoryRow key={contact.id} contact={contact} />
        ))}
      </div>
    </div>
  );
}

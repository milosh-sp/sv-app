import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { BuildingsIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import z from "zod";

import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { orpc } from "@/integrations/orpc/client";

import { DashboardHeader } from "../-components/header";

const searchSchema = z.object({
  status: z.enum(["all", "pending", "accepted", "declined"]).default("all"),
  q: z.string().optional().default(""),
});

const statusOptions: ComboboxOption<string>[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
];

export const Route = createFileRoute("/dashboard/company/contacts")({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

function statusBadgeVariant(status: "pending" | "accepted" | "declined") {
  if (status === "accepted") return "default" as const;
  if (status === "declined") return "destructive" as const;
  return "secondary" as const;
}

function RouteComponent() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.q);

  const debouncedSetQuery = useDebounceCallback((value: string) => {
    void navigate({
      search: (prev) => ({ ...prev, q: value }),
      replace: true,
    });
  }, 300);

  useEffect(() => {
    setQuery(search.q);
  }, [search.q]);

  const { data = [], isPending } = useQuery({
    ...orpc.company.listContactRequests.queryOptions({
      input: {
        status: search.status === "all" ? undefined : search.status,
        query: search.q || undefined,
      },
    }),
  });

  return (
    <div className="space-y-4">
      <DashboardHeader icon={BuildingsIcon} title={t`Contact History`} />
      <Separator />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            debouncedSetQuery(event.target.value);
          }}
          placeholder={t`Search by candidate name…`}
          className="sm:max-w-xs"
        />

        <Combobox
          options={statusOptions}
          value={search.status}
          onValueChange={(value) => {
            void navigate({
              search: (prev) => ({
                ...prev,
                status: (value as "all" | "pending" | "accepted" | "declined") ?? "all",
              }),
              replace: true,
            });
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
        {data.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">{row.candidateName}</p>
              <p className="text-sm text-muted-foreground">{row.candidateEmail ?? t`Email hidden until accepted`}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
            <Badge variant={statusBadgeVariant(row.status)} className="w-fit capitalize">
              {row.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

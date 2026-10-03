import { t } from "@lingui/core/macro";
import { match } from "ts-pattern";
import z from "zod";

import type { ComboboxOption } from "@/components/ui/combobox";

import { Badge } from "@/components/ui/badge";
import { companyContactStatusSchema } from "@/integrations/orpc/dto/company";

type ContactStatus = z.infer<typeof companyContactStatusSchema>;

export const contactStatusFilterSchema = z.enum(["all", ...companyContactStatusSchema.options]).default("all");

export type ContactStatusFilter = z.infer<typeof contactStatusFilterSchema>;

export function getContactStatusLabel(status: ContactStatus) {
  return match(status)
    .with("pending", () => t`Pending`)
    .with("accepted", () => t`Accepted`)
    .with("declined", () => t`Declined`)
    .exhaustive();
}

export function getContactStatusFilterOptions(): ComboboxOption<ContactStatusFilter>[] {
  return [
    { value: "all", label: t`All statuses` },
    ...companyContactStatusSchema.options.map((status) => ({ value: status, label: getContactStatusLabel(status) })),
  ];
}

const badgeVariantByStatus = {
  pending: "secondary",
  accepted: "default",
  declined: "destructive",
} as const satisfies Record<ContactStatus, "secondary" | "default" | "destructive">;

export function ContactStatusBadge({ status }: { status: ContactStatus }) {
  return (
    <Badge variant={badgeVariantByStatus[status]} className="w-fit">
      {getContactStatusLabel(status)}
    </Badge>
  );
}

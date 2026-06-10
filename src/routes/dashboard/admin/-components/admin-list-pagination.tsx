import { Trans } from "@lingui/react/macro";

import { Button } from "@/components/ui/button";

export function AdminListPagination({
  page,
  totalPages,
  total,
  disabled,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        <Trans>
          Page {page} of {totalPages} — {total} results
        </Trans>
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || page <= 1} onClick={onPrevious}>
          <Trans>Previous</Trans>
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || page >= totalPages} onClick={onNext}>
          <Trans>Next</Trans>
        </Button>
      </div>
    </div>
  );
}

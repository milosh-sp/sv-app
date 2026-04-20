import type { ErrorComponentProps } from "@tanstack/react-router";

import { Trans } from "@lingui/react/macro";
import { ArrowClockwiseIcon, WarningIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/constants/brand";

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { BrandIcon } from "../ui/brand-icon";

export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  return (
    <div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-5 px-4">
      <span className="flex size-14 items-center justify-center border-2 border-foreground bg-brand-lime">
        <BrandIcon variant="logo" forceTheme="light" className="size-8" />
      </span>

      <span className="font-mono text-[0.7rem] tracking-[0.25em] text-muted-foreground uppercase">
        — {APP_NAME} / <Trans>Error</Trans>
      </span>

      <Alert className="rounded-none border-2 border-foreground">
        <WarningIcon />
        <AlertTitle>
          <Trans>An error occurred while loading the page.</Trans>
        </AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>

      <Button variant="brand" size="lg" onClick={reset}>
        <ArrowClockwiseIcon />
        <Trans>Refresh</Trans>
      </Button>
    </div>
  );
}

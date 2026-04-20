import { Trans } from "@lingui/react/macro";
import { ArrowLeftIcon, WarningIcon } from "@phosphor-icons/react";
import { Link, type NotFoundRouteProps } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/constants/brand";

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { BrandIcon } from "../ui/brand-icon";

export function NotFoundScreen({ routeId }: NotFoundRouteProps) {
  return (
    <div className="mx-auto flex h-svh max-w-md flex-col items-center justify-center gap-y-5 px-4">
      <span className="flex size-14 items-center justify-center border-2 border-foreground bg-brand-lime">
        <BrandIcon variant="logo" forceTheme="light" className="size-8" />
      </span>

      <span className="font-mono text-[0.7rem] tracking-[0.25em] text-muted-foreground uppercase">
        — {APP_NAME} / 404
      </span>

      <Alert className="rounded-none border-2 border-foreground">
        <WarningIcon />
        <AlertTitle>
          <Trans>An error occurred while loading the page.</Trans>
        </AlertTitle>
        <AlertDescription>{routeId}</AlertDescription>
      </Alert>

      <Button variant="brand" size="lg" nativeButton={false} render={
        <Link to="..">
          <ArrowLeftIcon />
          <Trans>Go Back</Trans>
        </Link>
      } />
    </div>
  );
}

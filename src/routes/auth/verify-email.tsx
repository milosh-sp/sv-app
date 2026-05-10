import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { ArrowRightIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authClient } from "@/integrations/auth/client";

const searchSchema = z.object({
  token: z.string().optional(),
  callbackURL: z.string().optional(),
  email: z.email().optional(),
});

type VerificationResult =
  | {
      status: "success";
    }
  | {
      status: "error";
      message?: string;
    };

export const Route = createFileRoute("/auth/verify-email")({
  component: RouteComponent,
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [{ title: "Verify Email - Skill Verdict" }],
  }),
});

function RouteComponent() {
  const router = useRouter();
  const { token, callbackURL, email } = Route.useSearch();
  const { session } = Route.useRouteContext();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const continueUrl = getSafeCallbackUrl(callbackURL);

  useEffect(() => {
    let isMounted = true;

    const verifyEmail = async () => {
      if (!token) {
        setResult({ status: "error" });
        return;
      }

      try {
        const { error } = await authClient.verifyEmail({
          query: { token },
        });

        if (!isMounted) return;

        if (error) {
          setResult({ status: "error", message: error.message });
          return;
        }

        await router.invalidate();

        if (isMounted) {
          setResult({ status: "success" });
        }
      } catch {
        if (isMounted) {
          setResult({ status: "error" });
        }
      }
    };

    void verifyEmail();

    return () => {
      isMounted = false;
    };
  }, [router, token]);

  if (!token) {
    if (!session && email) return <PendingVerificationState email={email} continueUrl={continueUrl} />;
    if (!session) return <SignInRequiredState />;
    if (session.user.emailVerified) return <SuccessState continueUrl={continueUrl} />;

    return <PendingVerificationState email={session.user.email} continueUrl={continueUrl} />;
  }

  if (!result) return null;

  return result.status === "success" ? (
    <SuccessState continueUrl={continueUrl} />
  ) : (
    <ErrorState message={result.message} />
  );
}

function PendingVerificationState({ email, continueUrl }: { email: string; continueUrl: string }) {
  const [isResending, setIsResending] = useState(false);

  const handleResendVerificationEmail = async () => {
    const toastId = toast.loading(t`Resending verification email...`);
    setIsResending(true);

    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: continueUrl,
      });

      if (error) {
        toast.error(error.message, { id: toastId });
        return;
      }

      toast.success(t`A new verification link has been sent to your email address.`, { id: toastId });
    } catch {
      toast.error(t`Failed to resend verification email. Please try again.`, { id: toastId });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
          <WarningCircleIcon className="size-8" weight="fill" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            <Trans>Verify your email</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>You must verify your email address before you can access Skill Verdict.</Trans>
          </p>
        </div>
      </div>

      <Alert>
        <WarningCircleIcon />
        <AlertTitle>
          <Trans>Check your inbox</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>We sent a verification link to your email address.</Trans>{" "}
          <span className="font-medium text-foreground">{email}</span>
        </AlertDescription>
      </Alert>

      <Button className="w-full" onClick={handleResendVerificationEmail} disabled={isResending}>
        <Trans>Resend verification email</Trans>
      </Button>
    </div>
  );
}

function SignInRequiredState() {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <WarningCircleIcon className="size-8" weight="fill" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            <Trans>Sign in to verify your email</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>Sign in to your account to request a new verification email.</Trans>
          </p>
        </div>
      </div>

      <Button
        className="w-full"
        nativeButton={false}
        render={
          <Link to="/auth/login">
            <Trans>Sign in</Trans> <ArrowRightIcon />
          </Link>
        }
      />
    </div>
  );
}

function SuccessState({ continueUrl }: { continueUrl: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircleIcon className="size-8" weight="fill" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            <Trans>Email verified</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>Your email address is confirmed. You can continue using Skill Verdict.</Trans>
          </p>
        </div>
      </div>

      <Alert>
        <CheckCircleIcon />
        <AlertTitle>
          <Trans>Your account is up to date.</Trans>
        </AlertTitle>
        <AlertDescription>
          <Trans>You can now use account recovery and other features that require a verified email address.</Trans>
        </AlertDescription>
      </Alert>

      <Button
        className="w-full"
        nativeButton={false}
        render={
          <a href={continueUrl}>
            <Trans>Continue</Trans> <ArrowRightIcon />
          </a>
        }
      />
    </div>
  );
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <WarningCircleIcon className="size-8" weight="fill" />
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            <Trans>We couldn't verify your email</Trans>
          </h1>
          <p className="text-muted-foreground">
            <Trans>The verification link may be invalid, expired, or already used.</Trans>
          </p>
        </div>
      </div>

      <Alert variant="destructive">
        <WarningCircleIcon />
        <AlertTitle>
          <Trans>Try requesting a new verification link.</Trans>
        </AlertTitle>
        <AlertDescription>
          {message ?? <Trans>Sign in to your account, then request a new verification email.</Trans>}
        </AlertDescription>
      </Alert>

      <div className="grid gap-2">
        <Button
          className="w-full"
          nativeButton={false}
          render={
            <Link to="/auth/login">
              <Trans>Sign in</Trans> <ArrowRightIcon />
            </Link>
          }
        />

        <Button
          className="w-full"
          variant="outline"
          nativeButton={false}
          render={
            <Link to="/auth/verify-email">
              <Trans>Request a new link</Trans>
            </Link>
          }
        />
      </div>
    </div>
  );
}

function getSafeCallbackUrl(callbackURL: string | undefined) {
  if (!callbackURL) return "/dashboard";
  if (!callbackURL.startsWith("/") || callbackURL.startsWith("//")) return "/dashboard";

  return callbackURL;
}

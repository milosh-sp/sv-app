import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { GithubLogoIcon, GoogleLogoIcon, VaultIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/integrations/auth/client";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@/utils/style";

export function SocialAuth() {
  const router = useRouter();
  const { data: authProviders = {} } = useQuery(orpc.auth.providers.list.queryOptions());
  const hasCustomProvider = "custom" in authProviders;
  const hasGoogleProvider = "google" in authProviders;
  const hasGithubProvider = "github" in authProviders;
  const hasAnyProvider = hasCustomProvider || hasGoogleProvider || hasGithubProvider;

  const handleSocialLogin = async (provider: string) => {
    const toastId = toast.loading(t`Signing in...`);

    const { error } = await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
    });

    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }

    toast.dismiss(toastId);
    await router.invalidate();
  };

  const handleOAuthLogin = async () => {
    const toastId = toast.loading(t`Signing in...`);

    const { error } = await authClient.signIn.oauth2({
      providerId: "custom",
      callbackURL: "/dashboard",
    });

    if (error) {
      toast.error(error.message, { id: toastId });
      return;
    }

    toast.dismiss(toastId);
    await router.invalidate();
  };

  if (!hasAnyProvider) return null;

  return (
    <>
      <div className="flex items-center gap-x-2">
        <hr className="flex-1 border-border" />
        <span className="text-muted-foreground text-xs font-medium tracking-wide">
          <Trans context="Choose to authenticate with a social provider (Google, GitHub, etc.) instead of email and password">
            or continue with
          </Trans>
        </span>
        <hr className="flex-1 border-border" />
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          onClick={handleOAuthLogin}
          className={cn(
            "hidden h-11 w-full justify-center rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
            hasCustomProvider && "inline-flex",
          )}
        >
          <VaultIcon />
          {authProviders.custom}
        </Button>

        <Button
          variant="secondary"
          onClick={() => handleSocialLogin("google")}
          className={cn(
            "hidden h-11 w-full justify-center rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
            hasGoogleProvider && "inline-flex",
          )}
        >
          <GoogleLogoIcon />
          Google
        </Button>

        <Button
          variant="secondary"
          onClick={() => handleSocialLogin("github")}
          className={cn(
            "hidden h-11 w-full justify-center rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
            hasGithubProvider && "inline-flex",
          )}
        >
          <GithubLogoIcon />
          GitHub
        </Button>
      </div>
    </>
  );
}

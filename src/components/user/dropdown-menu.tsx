import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { PaletteIcon, SealCheckIcon, SignOutIcon, TranslateIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import type { AuthSession } from "@/integrations/auth/types";

import { useTheme } from "@/components/theme/provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardMode } from "@/hooks/use-dashboard-mode";
import { authClient } from "@/integrations/auth/client";
import { isLocale, loadLocale, localeMap, setLocaleServerFn } from "@/utils/locale";
import { isTheme } from "@/utils/theme";

type Props = {
  children: ({ session }: { session: AuthSession }) => React.ComponentProps<typeof DropdownMenuTrigger>["render"];
};

export function UserDropdownMenu({ children }: Props) {
  const router = useRouter();
  const { i18n } = useLingui();
  const { theme, setTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const { effectiveMode, isPending: isModePending, isReviewerPrivileged, setMode } = useDashboardMode();

  const handleThemeChange = (value: string) => {
    if (!isTheme(value)) return;
    setTheme(value);
  };

  const handleLocaleChange = async (value: string) => {
    if (!isLocale(value)) return;
    await Promise.all([loadLocale(value), setLocaleServerFn({ data: value })]);
    window.location.reload();
  };

  const handleLogout = async () => {
    const toastId = toast.loading(t`Signing out...`);

    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.dismiss(toastId);
          void router.invalidate();
        },
        onError: ({ error }) => {
          toast.error(error.message, { id: toastId });
        },
      },
    });
  };

  const handleModeToggle = async () => {
    if (isModePending) return;

    try {
      await setMode(effectiveMode === "reviewer" ? "user" : "reviewer");
    } catch {
      toast.error(t`Failed to switch dashboard mode. Please try again.`);
    }
  };

  if (!session?.user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children({ session: session as AuthSession })} />

      <DropdownMenuContent align="start" side="top">
        {isReviewerPrivileged && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={isModePending} onClick={() => void handleModeToggle()}>
                {effectiveMode === "reviewer" ? (
                  <>
                    <UserCircleIcon />
                    <Trans>Switch to User Mode</Trans>
                  </>
                ) : (
                  <>
                    <SealCheckIcon />
                    <Trans>Switch to Reviewer Mode</Trans>
                  </>
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="my-2 h-0.5 bg-border" />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <TranslateIcon />
              <Trans>Language</Trans>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-[400px] overflow-y-auto">
              <DropdownMenuRadioGroup value={i18n.locale} onValueChange={handleLocaleChange}>
                {Object.entries(localeMap).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {i18n.t(label)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon />
              <Trans>Theme</Trans>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
                <DropdownMenuRadioItem value="light">
                  <Trans>Light</Trans>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Trans>Dark</Trans>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleLogout}>
          <SignOutIcon />
          <Trans>Logout</Trans>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

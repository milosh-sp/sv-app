import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const accounts = vi.hoisted(() => ({ has: true, accountId: "acc-1" as string | undefined }));
const session = vi.hoisted(() => ({
  data: { user: { twoFactorEnabled: true } } as { user: { twoFactorEnabled?: boolean } } | null,
}));
const link = vi.hoisted(() => vi.fn(async () => undefined));
const unlink = vi.hoisted(() => vi.fn(async () => undefined));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children?: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));
vi.mock("./hooks", () => ({
  useAuthAccounts: () => ({
    hasAccount: () => accounts.has,
    getAccountByProviderId: () => (accounts.accountId ? { accountId: accounts.accountId } : {}),
  }),
  useAuthProviderActions: () => ({ link, unlink }),
  getProviderIcon: () => null,
  getProviderName: (provider: string) => provider,
}));
vi.mock("@/integrations/auth/client", () => ({
  authClient: { useSession: () => ({ data: session.data }) },
}));

import { useDialogStore } from "@/dialogs/store";

import { PasswordSection } from "./password";
import { SocialProviderSection } from "./social-provider";
import { TwoFactorSection } from "./two-factor";

describe("authentication sections", () => {
  it("updates a password, links providers, and toggles two-factor", async () => {
    const queryClient = new QueryClient();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    async function show() {
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <PasswordSection />
            <SocialProviderSection provider="google" />
            <SocialProviderSection provider="custom" name="Work SSO" />
            <TwoFactorSection />
          </QueryClientProvider>,
        );
      });
    }

    accounts.has = true;
    session.data = { user: { twoFactorEnabled: true } };
    await show();
    const update = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Update Password"));
    await act(async () => {
      update?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("auth.change-password");

    const disconnect = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Disconnect"));
    await act(async () => {
      disconnect?.click();
    });
    expect(unlink).toHaveBeenCalled();

    const disable = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Disable 2FA"));
    await act(async () => {
      disable?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("auth.two-factor.disable");

    accounts.has = false;
    accounts.accountId = undefined;
    session.data = null;
    await show();
    expect(container.textContent).toContain("Set Password");
    const connect = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Connect"));
    await act(async () => {
      connect?.click();
    });
    expect(link).toHaveBeenCalled();
    await act(async () => {
      [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Disconnect"))?.click();
    });

    accounts.has = true;
    session.data = { user: {} };
    await show();
    const enable = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Enable 2FA"));
    await act(async () => {
      enable?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("auth.two-factor.enable");

    root.unmount();
    container.remove();
  });
});

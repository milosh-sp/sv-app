import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

const authClient = vi.hoisted(() => ({
  listAccounts: vi.fn(async () => ({ data: [{ id: "acc-1", providerId: "google" }] })),
  linkSocial: vi.fn(async () => ({ error: null as { message: string } | null })),
  unlinkAccount: vi.fn(async () => ({ error: null as { message: string } | null })),
}));

vi.mock("@/integrations/auth/client", () => ({ authClient }));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    auth: {
      providers: {
        list: {
          queryOptions: () => ({
            queryKey: ["providers"],
            queryFn: async () => ["google", "github"],
          }),
        },
      },
    },
  },
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

import { toast } from "sonner";

import {
  getProviderIcon,
  getProviderName,
  useAuthAccounts,
  useAuthProviderActions,
  useEnabledProviders,
} from "./hooks";

function Harness() {
  const accounts = useAuthAccounts();
  const actions = useAuthProviderActions();
  const providers = useEnabledProviders();

  return (
    <div>
      <span>{accounts.hasAccount("google") ? "linked" : "missing"}</span>
      <span>{providers.enabledProviders ? "providers" : "none"}</span>
      <button type="button" onClick={() => void actions.link("github")}>
        link
      </button>
      <button type="button" onClick={() => void actions.unlink("google", "acc-1")}>
        unlink
      </button>
    </div>
  );
}

describe("auth provider helpers", () => {
  it("names and icons every provider", () => {
    expect(
      ["credential", "google", "github", "custom"].map((provider) => getProviderName(provider as "google")),
    ).toEqual(["Password", "Google", "GitHub", "Custom OAuth"]);
    for (const provider of ["credential", "google", "github", "custom"] as const) {
      expect(getProviderIcon(provider)).toBeTruthy();
    }
  });

  it("links an account and reports an unlink failure", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      );
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("linked");
    });

    const link = [...container.querySelectorAll("button")].find((button) => button.textContent === "link");
    await act(async () => {
      link?.click();
    });
    expect(authClient.linkSocial).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/dashboard/settings/authentication",
    });
    expect(vi.mocked(toast.dismiss)).toHaveBeenCalled();

    authClient.unlinkAccount.mockResolvedValueOnce({ error: { message: "still linked" } });
    const unlink = [...container.querySelectorAll("button")].find((button) => button.textContent === "unlink");
    await act(async () => {
      unlink?.click();
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("still linked", { id: "toast" });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

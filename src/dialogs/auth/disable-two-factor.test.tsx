import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const disable = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }));
vi.mock("@/integrations/auth/client", () => ({
  authClient: { twoFactor: { disable } },
}));

import { toast } from "sonner";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { useDialogStore } from "../store";
import { DisableTwoFactorDialog } from "./disable-two-factor";

describe("disable two-factor dialog", () => {
  it("shows the password, reports a failure, then disables two-factor", async () => {
    useDialogStore.setState({ open: true, activeDialog: { type: "auth.two-factor.disable" } as never });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ConfirmDialogProvider>
          <Dialog open>
            <DisableTwoFactorDialog />
          </Dialog>
        </ConfirmDialogProvider>,
      );
    });

    const toggle = document.querySelector("button[type='button']");
    if (!(toggle instanceof HTMLButtonElement)) throw new Error("missing password toggle");
    await act(async () => {
      toggle.click();
    });
    const input = document.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing password");
    expect(input.type).toBe("text");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "secret1");
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
    disable.mockResolvedValueOnce({ error: { message: "wrong password" } });
    await act(async () => {
      form.requestSubmit();
    });
    expect(toast.error).toHaveBeenCalledWith("wrong password", expect.anything());

    disable.mockResolvedValueOnce({ error: null });
    await act(async () => {
      form.requestSubmit();
    });
    expect(toast.success).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
    expect(useDialogStore.getState().open).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

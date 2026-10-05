import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const changePassword = vi.hoisted(() => vi.fn());

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
vi.mock("@/integrations/auth/client", () => ({
  authClient: { changePassword },
}));

import { toast } from "sonner";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { useDialogStore } from "../store";
import { ChangePasswordDialog } from "./change-password";

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("change password dialog", () => {
  it("rejects a bad password, then saves a new one", async () => {
    useDialogStore.setState({ open: true, activeDialog: { type: "auth.change-password" } as never });
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            <Dialog open>
              <ChangePasswordDialog />
            </Dialog>
          </ConfirmDialogProvider>
        </QueryClientProvider>,
      );
    });

    const [current, next] = [...document.querySelectorAll("input")];
    if (!(current instanceof HTMLInputElement) || !(next instanceof HTMLInputElement)) {
      throw new Error("missing password fields");
    }
    for (const button of document.querySelectorAll("button[type='button']")) {
      if (button instanceof HTMLButtonElement) {
        await act(async () => {
          button.click();
        });
      }
    }
    expect(current.type).toBe("text");
    expect(next.type).toBe("text");

    setInput(current, "secret1");
    setInput(next, "secret1");
    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
    await act(async () => {
      form.requestSubmit();
    });
    expect(changePassword).not.toHaveBeenCalled();

    setInput(next, "secret2");
    changePassword.mockResolvedValueOnce({ error: { message: "wrong password" } });
    await act(async () => {
      form.requestSubmit();
    });
    expect(toast.error).toHaveBeenCalledWith("wrong password", expect.anything());

    changePassword.mockResolvedValueOnce({ error: null });
    await act(async () => {
      form.requestSubmit();
    });
    expect(toast.success).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["auth", "accounts"] });
    expect(useDialogStore.getState().open).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const enable = vi.hoisted(() => vi.fn());
const verifyTotp = vi.hoisted(() => vi.fn());
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
vi.mock("qrcode.react", () => ({ QRCodeSVG: () => <div>qr</div> }));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ invalidate }) }));
vi.mock("@/integrations/auth/client", () => ({
  authClient: { twoFactor: { enable, verifyTotp } },
}));

import { toast } from "sonner";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { useDialogStore } from "../store";
import { EnableTwoFactorDialog } from "./enable-two-factor";

function setInput(value: string) {
  const inputs = [...document.querySelectorAll("input")];
  const input = inputs.at(-1);
  if (!(input instanceof HTMLInputElement)) throw new Error("missing input");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit() {
  const forms = [...document.querySelectorAll("form")];
  const form = forms.at(-1);
  if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
  await act(async () => {
    form.requestSubmit();
  });
}

describe("enable two-factor dialog", () => {
  it("shows setup failures, copies the secret, and confirms backup codes", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    useDialogStore.setState({ open: true, activeDialog: { type: "auth.two-factor.enable" } as never });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ConfirmDialogProvider>
          <Dialog open>
            <EnableTwoFactorDialog />
          </Dialog>
        </ConfirmDialogProvider>,
      );
    });

    enable.mockResolvedValueOnce({ data: null, error: { message: "bad password" } });
    setInput("secret1");
    await submit();
    expect(toast.error).toHaveBeenCalledWith("bad password", expect.anything());

    enable.mockResolvedValueOnce({ data: {}, error: null });
    await submit();
    expect(toast.error).toHaveBeenCalledWith("Failed to setup two-factor authentication.", expect.anything());

    enable.mockResolvedValueOnce({
      data: { totpURI: "otpauth://totp/Skill?secret=ABC123", backupCodes: ["111111"] },
      error: null,
    });
    await submit();
    const copy = [...document.querySelectorAll("button")].find((button) => button.querySelector("svg"));
    await act(async () => {
      copy?.click();
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ABC123");

    verifyTotp.mockResolvedValueOnce({ error: { message: "wrong code" } });
    setInput("000000");
    await submit();
    expect(toast.error).toHaveBeenCalledWith("wrong code", expect.anything());

    verifyTotp.mockResolvedValueOnce({ error: null });
    await submit();
    const finish = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes("Continue"));
    await act(async () => {
      finish?.click();
    });
    expect(toast.success).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

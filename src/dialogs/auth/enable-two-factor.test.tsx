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

  it("blocks a dirty form on each step and ignores a secret that is not a URL", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
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

    await escapeDialog();
    const toggle = document.querySelector("button[type='button']");
    if (!(toggle instanceof HTMLButtonElement)) throw new Error("missing password toggle");
    await act(async () => {
      toggle.click();
    });
    const revealed = document.querySelector("input");
    if (!(revealed instanceof HTMLInputElement)) throw new Error("missing password");
    expect(revealed.type).toBe("text");

    await act(async () => {
      setInput("secret1");
    });
    await escapeDialog();
    await stay();

    enable.mockResolvedValueOnce({
      data: { totpURI: "otpauth://totp/Skill?secret=ABC123", backupCodes: ["111111"] },
      error: null,
    });
    await submit();
    expect(document.body.textContent).toContain("Setup Authenticator App");
    await escapeDialog();
    await act(async () => {
      setInput("123456");
    });
    await escapeDialog();
    await act(async () => {
      setInput("654321");
    });
    await escapeDialog();
    await stay();

    verifyTotp.mockResolvedValueOnce({ error: null });
    await submit();
    expect(document.body.textContent).toContain("111111");
    await escapeDialog();

    await act(async () => {
      root.unmount();
    });
    container.remove();

    enable.mockResolvedValueOnce({
      data: { totpURI: "not a url", backupCodes: ["111111"] },
      error: null,
    });
    const again = document.createElement("div");
    document.body.append(again);
    const next = createRoot(again);
    await act(async () => {
      next.render(
        <ConfirmDialogProvider>
          <Dialog open>
            <EnableTwoFactorDialog />
          </Dialog>
        </ConfirmDialogProvider>,
      );
    });
    setInput("secret1");
    await submit();
    expect(document.body.textContent).toContain("Setup Authenticator App");
    expect(document.querySelector("input[readonly]")).toBeNull();
    await act(async () => {
      next.unmount();
    });
    again.remove();
  });
});

type Fiber = { return: Fiber | null; memoizedProps: Record<string, unknown> | null };

async function escapeDialog() {
  const content = document.querySelector("[data-slot='dialog-content']");
  if (!(content instanceof HTMLElement)) throw new Error("missing dialog");
  const key = Object.keys(content).find((name) => name.startsWith("__reactFiber$"));
  let fiber: Fiber | null = key ? (content as unknown as Record<string, Fiber>)[key] : null;
  while (fiber) {
    const handler = fiber.memoizedProps?.onEscapeKeyDown;
    if (typeof handler === "function" && handler.toString().includes("shouldBlock")) {
      await act(async () => {
        handler({ preventDefault() {} });
      });
      return;
    }
    fiber = fiber.return;
  }
  throw new Error("missing escape handler");
}

async function stay() {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Stay");
  if (!(button instanceof HTMLButtonElement)) throw new Error("missing stay");
  await act(async () => {
    button.click();
  });
}

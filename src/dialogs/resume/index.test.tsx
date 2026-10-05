import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

const createResume = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => "resume-1"));
const updateResume = vi.hoisted(() => vi.fn(async () => undefined));
const duplicateResume = vi.hoisted(() => vi.fn(async () => "copy-1"));
const navigate = vi.hoisted(() => vi.fn());
const session = vi.hoisted(() => ({ data: { user: { username: undefined as string | undefined } } }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast") },
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/integrations/auth/client", () => ({
  authClient: { useSession: () => session },
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: {
      create: { mutationOptions: () => ({ mutationFn: createResume }) },
      update: { mutationOptions: () => ({ mutationFn: updateResume }) },
      duplicate: { mutationOptions: () => ({ mutationFn: duplicateResume }) },
    },
  },
}));

import { toast } from "sonner";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { useDialogStore } from "../store";
import { CreateResumeDialog, DuplicateResumeDialog, UpdateResumeDialog } from "./index";

function labeledInput(label: string) {
  const match = [...document.querySelectorAll("label")].find((element) => element.textContent?.trim() === label);
  const item = match?.closest("[data-slot='form-item']");
  const input = item?.querySelector("input");
  if (!(input instanceof HTMLInputElement)) throw new Error(`missing input ${label}`);
  return input;
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderDialog(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDialogProvider>
          <Dialog open>{node}</Dialog>
        </ConfirmDialogProvider>
      </QueryClientProvider>,
    );
  });
  return () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
}

async function submit() {
  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
  form.noValidate = true;
  await act(async () => {
    form.requestSubmit();
  });
}

const resume = { id: "resume-1", name: "CV", slug: "cv", tags: ["games"] };

describe("resume dialogs", () => {
  it("keeps a hand-edited slug, reports a generic create error, and builds a sample without a name", async () => {
    useDialogStore.setState({ open: true, activeDialog: { type: "resume.create" } as never });
    const unmount = await renderDialog(<CreateResumeDialog />);
    expect(document.body.textContent).toContain(`${window.location.origin}//`);

    setInput(labeledInput("Name"), "Ada");
    await act(async () => {
      await Promise.resolve();
    });
    expect(labeledInput("Slug").value).toBe("ada");
    setInput(labeledInput("Slug"), "custom");
    setInput(labeledInput("Name"), "Ada Lovelace");
    await act(async () => {
      await Promise.resolve();
    });
    expect(labeledInput("Slug").value).toBe("custom");

    const generate = document.querySelector("button[title='Generate a random name']");
    if (!(generate instanceof HTMLButtonElement)) throw new Error("missing name generator");
    await act(async () => {
      generate.click();
    });
    expect(labeledInput("Name").value.length).toBeGreaterThan(0);

    setInput(labeledInput("Name"), "Ada Lovelace");
    createResume.mockRejectedValueOnce(new Error("nope"));
    await submit();
    expect(toast.error).toHaveBeenCalledWith("nope", expect.anything());

    unmount();
    createResume.mockClear();
    const blank = await renderDialog(<CreateResumeDialog />);
    const trigger = document.querySelector("[data-slot='dropdown-menu-trigger']");
    if (!(trigger instanceof HTMLElement)) throw new Error("missing sample menu");
    await act(async () => {
      trigger.click();
    });
    const sample = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
      element.textContent?.includes("Create a Sample Resume"),
    );
    if (!(sample instanceof HTMLElement)) throw new Error("missing sample item");
    await act(async () => {
      sample.click();
    });
    await vi.waitFor(() => {
      expect(createResume).toHaveBeenCalled();
    });
    expect(createResume.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        withSampleData: true,
        name: expect.stringMatching(/.+/),
        slug: expect.stringMatching(/.+/),
      }),
    );

    createResume.mockRejectedValueOnce(new Error("sample failed"));
    await act(async () => {
      trigger.click();
    });
    const sampleAgain = [...document.querySelectorAll("[data-slot='dropdown-menu-item']")].find((element) =>
      element.textContent?.includes("Create a Sample Resume"),
    );
    if (!(sampleAgain instanceof HTMLElement)) throw new Error("missing sample item");
    await act(async () => {
      sampleAgain.click();
    });
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("sample failed", expect.anything());
    });
    blank();
  });

  it("reports a duplicate slug and a failed duplication that would redirect", async () => {
    useDialogStore.setState({ open: true, activeDialog: null });
    updateResume.mockRejectedValueOnce(new Error("RESUME_SLUG_ALREADY_EXISTS"));
    const unmountUpdate = await renderDialog(<UpdateResumeDialog data={resume} />);
    await submit();
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("A resume with this slug already exists.", expect.anything());
    });
    unmountUpdate();

    const unmountDuplicate = await renderDialog(<DuplicateResumeDialog data={{ ...resume, shouldRedirect: true }} />);
    await submit();
    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/builder/$resumeId", params: { resumeId: "copy-1" } });
    });
    unmountDuplicate();

    duplicateResume.mockRejectedValueOnce(new Error("dup failed"));
    const unmountError = await renderDialog(<DuplicateResumeDialog data={{ ...resume, shouldRedirect: true }} />);
    await submit();
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("dup failed", expect.anything());
    });
    unmountError();
  });
});

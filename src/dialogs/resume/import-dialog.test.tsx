import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";
import { sampleResumeData } from "@/schema/resume/sample";

const ai = vi.hoisted(() => ({
  canUse: true,
  isAvailabilityLoaded: true,
}));
const parsePdf = vi.hoisted(() => vi.fn(async () => defaultResumeData));
const parseDocx = vi.hoisted(() => vi.fn(async () => defaultResumeData));
const importResume = vi.hoisted(() => vi.fn(async () => "resume-1"));
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/integrations/ai/use-ai-integration", () => ({
  useAiIntegration: () => ({
    canUse: ai.canUse,
    isAvailabilityLoaded: ai.isAvailabilityLoaded,
    serverConfigured: ai.canUse,
  }),
}));
vi.mock("@/integrations/orpc/client", () => ({
  client: { ai: { parsePdf, parseDocx } },
  orpc: { resume: { import: { mutationOptions: () => ({ mutationFn: importResume }) } } },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast") },
}));

import { toast } from "sonner";

import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { ImportResumeDialog } from "./import";

async function submit(label: string, file: File) {
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDialogProvider>
          <Dialog open>
            <ImportResumeDialog />
          </Dialog>
        </ConfirmDialogProvider>
      </QueryClientProvider>,
    );
  });

  const typeLabel = [...document.querySelectorAll("label")].find((item) => item.textContent?.trim() === "Type");
  const typeButton = typeLabel?.parentElement?.querySelector("button");
  if (!(typeButton instanceof HTMLButtonElement)) {
    throw new Error(`missing import type: ${document.body.textContent?.slice(0, 180)}`);
  }
  act(() => {
    typeButton.click();
  });
  const option = [...document.querySelectorAll("[role='option']")].find((item) => item.textContent?.includes(label));
  if (!(option instanceof HTMLElement)) throw new Error(`missing ${label}`);
  act(() => {
    option.click();
  });

  const input = document.querySelector("input[type='file']");
  if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
  Object.defineProperty(input, "files", { configurable: true, value: { 0: file, length: 1, item: () => file } });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
  form.noValidate = true;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await vi.waitFor(() => {
    expect(vi.mocked(toast.success).mock.calls.length + vi.mocked(toast.error).mock.calls.length).toBeGreaterThan(0);
  });

  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("import resume dialog", () => {
  beforeEach(() => {
    parsePdf.mockClear();
    parseDocx.mockClear();
    importResume.mockClear();
    navigate.mockClear();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  it("parses a pdf and a word file when AI is available", async () => {
    ai.canUse = true;
    ai.isAvailabilityLoaded = true;
    await submit("PDF", new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
    expect(parsePdf).toHaveBeenCalled();
    expect(importResume).toHaveBeenCalledWith(expect.objectContaining({ data: defaultResumeData }), expect.anything());
    expect(navigate).toHaveBeenCalledWith({ to: "/builder/$resumeId", params: { resumeId: "resume-1" } });

    await submit("Microsoft Word", new File(["doc"], "cv.doc", { type: "application/msword" }));
    expect(parseDocx).toHaveBeenCalledWith(expect.objectContaining({ mediaType: "application/msword" }));

    await submit(
      "Microsoft Word",
      new File(["doc"], "cv.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
    expect(parseDocx).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );
  }, 20_000);

  it("imports a JSON Resume file and surfaces a non-error failure", async () => {
    ai.canUse = true;
    ai.isAvailabilityLoaded = true;
    const file = new File([JSON.stringify({ basics: { name: "Ada Lovelace" } })], "cv.json", {
      type: "application/json",
    });
    await submit("JSON Resume", file);
    expect(importResume).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();

    importResume.mockRejectedValueOnce("nope");
    await submit("JSON Resume", file);
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
  });

  it("stops a pdf import while AI is off or still loading", async () => {
    ai.isAvailabilityLoaded = false;
    ai.canUse = false;
    await submit("PDF", new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
    expect(vi.mocked(toast.error)).toHaveBeenCalled();

    ai.isAvailabilityLoaded = true;
    await submit("PDF", new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
    expect(parsePdf).not.toHaveBeenCalled();
  });

  it("opens the picker, ignores an empty file, and stops when no type is chosen", async () => {
    ai.canUse = true;
    ai.isAvailabilityLoaded = true;
    const unmount = await mountImport();
    const choose = [...document.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("select a file"),
    );
    if (!(choose instanceof HTMLButtonElement)) throw new Error("missing file button");
    const input = document.querySelector("input[type='file']");
    if (!(input instanceof HTMLInputElement)) throw new Error("missing file input");
    const click = vi.spyOn(input, "click").mockImplementation(() => undefined);
    await act(async () => {
      choose.click();
    });
    expect(click).toHaveBeenCalled();

    Object.defineProperty(input, "files", { configurable: true, value: [] });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(importResume).not.toHaveBeenCalled();
    unmount();
  });

  it("imports skill verdict files and reports an empty parser result", async () => {
    ai.canUse = true;
    ai.isAvailabilityLoaded = true;
    const current = await mountImport();
    await setImportType(
      "skill-verdict-json",
      new File([JSON.stringify(sampleResumeData)], "cv.json", { type: "application/json" }),
    );
    await submitMounted();
    expect(importResume).toHaveBeenCalled();
    current();

    const legacy = await mountImport();
    await setImportType(
      "skill-verdict-v4-json",
      new File(
        [
          JSON.stringify({
            basics: { name: "Ada Lovelace", email: "ada@example.com" },
            sections: {},
            metadata: { template: "onyx", layout: [[["summary"], ["skills"]]] },
          }),
        ],
        "v4.json",
        { type: "application/json" },
      ),
    );
    await submitMounted();
    expect(importResume).toHaveBeenCalled();
    legacy();

    parsePdf.mockResolvedValueOnce(undefined as never);
    await submit("PDF", new File(["%PDF"], "cv.pdf", { type: "application/pdf" }));
    expect(toast.error).toHaveBeenCalledWith("No data was returned from the import.", expect.anything());
  });
});

async function mountImport() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ConfirmDialogProvider>
          <Dialog open>
            <ImportResumeDialog />
          </Dialog>
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

type Fiber = { return: Fiber | null; memoizedProps: Record<string, unknown> | null };

async function setImportType(type: string, file: File) {
  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
  const key = Object.keys(form).find((name) => name.startsWith("__reactFiber$"));
  let fiber: Fiber | null = key ? (form as unknown as Record<string, Fiber>)[key] : null;
  while (fiber) {
    const value = fiber.memoizedProps?.value;
    if (value && typeof value === "object" && "setValue" in value && typeof value.setValue === "function") {
      const setValue = value.setValue as (name: string, next: unknown) => void;
      await act(async () => {
        setValue("type", type);
      });
      await act(async () => {
        setValue("file", file);
      });
      return;
    }
    fiber = fiber.return;
  }
  throw new Error("missing form api");
}

async function submitMounted() {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  const form = document.querySelector("form");
  if (!(form instanceof HTMLFormElement)) throw new Error("missing form");
  form.noValidate = true;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await vi.waitFor(() => {
    expect(vi.mocked(toast.success).mock.calls.length + vi.mocked(toast.error).mock.calls.length).toBeGreaterThan(0);
  });
}

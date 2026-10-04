import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { defaultResumeData } from "@/schema/resume/data";

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
});

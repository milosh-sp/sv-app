import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Reorder } from "motion/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";

const mobile = vi.hoisted(() => ({ value: false }));

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray | { message?: string }, ...values: Array<string | number>) => {
    if (!Array.isArray(strings)) return "message" in strings ? (strings.message ?? "") : "";
    return strings.reduce((result, part, index) => result + part + (values[index] ?? ""), "");
  },
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  Plural: ({ one, other, value }: { one?: React.ReactNode; other?: React.ReactNode; value: number }) =>
    value === 1 ? one : other,
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: {
    resume: { update: { call: vi.fn() } },
    storage: {
      uploadFile: { mutationOptions: () => ({ mutationFn: async () => undefined }) },
      deleteFile: { mutationOptions: () => ({ mutationFn: async () => undefined }) },
    },
    printer: {
      printResumeAsPDF: {
        mutationOptions: () => ({ mutationFn: async () => ({ url: "https://example.com/cv.pdf" }) }),
      },
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn(() => "toast"), dismiss: vi.fn() },
}));

vi.mock("react-zoom-pan-pinch", () => ({
  useControls: () => ({ zoomIn: vi.fn(), zoomOut: vi.fn(), centerView: vi.fn() }),
}));

vi.mock("@/integrations/auth/client", () => ({
  authClient: { useSession: () => ({ data: { user: { username: "ada" } } }) },
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mobile.value,
}));

vi.mock("@/components/ai/chat", () => ({
  AIChat: () => <div>chat</div>,
}));

import { useResumeStore } from "@/components/resume/store/resume";
import { ConfirmDialogProvider } from "@/hooks/use-confirm";

import { BuilderDock } from "./-components/dock";
import { CustomSectionBuilder } from "./-sidebar/left/sections/custom";
import { PictureSectionBuilder } from "./-sidebar/left/sections/picture";
import { SectionItem } from "./-sidebar/left/shared/section-item";
import { DesignSectionBuilder } from "./-sidebar/right/sections/design";
import { LayoutPages } from "./-sidebar/right/sections/layout/pages";
import { TypographySectionBuilder } from "./-sidebar/right/sections/typography";

function clickText(text: string) {
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.includes(text));
  if (!button) throw new Error(`missing button ${text}`);
  act(() => {
    button.click();
  });
}

describe("builder chrome", () => {
  it("renders the sidebar editors and adds or deletes a layout page", async () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const experience = data.sections.experience.items[0];
    if (!experience) throw new Error("sample resume has no experience");

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ConfirmDialogProvider>
            <PictureSectionBuilder />
            <CustomSectionBuilder />
            <TypographySectionBuilder />
            <DesignSectionBuilder />
            <LayoutPages />
            <Reorder.Group values={[experience]} onReorder={() => undefined}>
              <SectionItem
                type="experience"
                item={experience}
                title={experience.company}
                subtitle={experience.position}
              />
            </Reorder.Group>
          </ConfirmDialogProvider>
        </QueryClientProvider>,
      );
    });

    expect(container.textContent).toContain(experience.company);
    expect(container.textContent).toContain(data.customSections[0]?.title);
    expect(container.querySelector("input")).toBeTruthy();

    const before = useResumeStore.getState().resume.data.metadata.layout.pages.length;
    clickText("Add Page");
    expect(useResumeStore.getState().resume.data.metadata.layout.pages).toHaveLength(before + 1);

    clickText("Delete Page");
    expect(useResumeStore.getState().resume.data.metadata.layout.pages).toHaveLength(before);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the desktop and mobile docks", async () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const queryClient = new QueryClient();
    const container = document.createElement("div");
    const root = createRoot(container);

    for (const isMobile of [false, true]) {
      mobile.value = isMobile;
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <BuilderDock />
          </QueryClientProvider>,
        );
      });
      expect(container.querySelectorAll("button").length).toBeGreaterThan(2);
      expect(container.textContent).toContain("chat");
    }

    act(() => {
      root.unmount();
    });
  });
});

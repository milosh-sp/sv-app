import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import { sampleResumeData } from "@/schema/resume/sample";
import { templateSchema } from "@/schema/templates";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock("@/integrations/orpc/client", () => ({
  orpc: { resume: { update: { call: vi.fn() } } },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/components/resume/hooks/use-webfonts", () => ({
  useWebfonts: () => undefined,
}));

import { ResumePreview } from "@/components/resume/preview";
import { useResumeStore } from "@/components/resume/store/resume";

describe("resume templates", () => {
  it("renders every template for the first page, a later page, and a full-width page", () => {
    const data = structuredClone(sampleResumeData);
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    for (const template of templateSchema.options) {
      useResumeStore.setState((state) => {
        state.resume.data.metadata.template = template;
      });

      const container = document.createElement("div");
      const root = createRoot(container);
      act(() => {
        root.render(<ResumePreview showPageNumbers />);
      });

      expect(container.querySelectorAll("[data-page-index]")).toHaveLength(data.metadata.layout.pages.length);
      expect(container.textContent).toContain(data.basics.name);
      expect(container.querySelector("[data-page-index='0']")).toBeTruthy();
      expect(container.querySelector("[data-page-index='2']")).toBeTruthy();

      act(() => {
        root.unmount();
      });
    }
  });

  it("renders unlinked custom fields, a full-width first page, and scoped css", () => {
    const data = structuredClone(sampleResumeData);
    data.basics.customFields.push({
      id: "nolink",
      icon: "",
      text: "no-link-field",
      link: "",
    });
    data.metadata.layout.pages[0]!.fullWidth = true;
    data.metadata.css = { enabled: true, value: " \n " };
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: data.basics.name,
      slug: "sample",
      tags: [],
      data,
      isLocked: false,
    });

    const blank = document.createElement("div");
    const blankRoot = createRoot(blank);
    act(() => {
      blankRoot.render(<ResumePreview />);
    });
    expect(blank.querySelector("style")).toBeNull();
    act(() => {
      blankRoot.unmount();
    });

    useResumeStore.setState((state) => {
      state.resume.data.metadata.css.value = "@media screen {\n   \n.foo, .bar { color: blue }";
    });

    for (const template of templateSchema.options) {
      useResumeStore.setState((state) => {
        state.resume.data.metadata.template = template;
      });

      const container = document.createElement("div");
      const root = createRoot(container);
      act(() => {
        root.render(<ResumePreview showPageNumbers />);
      });

      expect(container.textContent).toContain("no-link-field");
      expect(container.querySelector("style")?.textContent).toContain(".resume-preview-container");
      act(() => {
        root.unmount();
      });
    }
  });
});

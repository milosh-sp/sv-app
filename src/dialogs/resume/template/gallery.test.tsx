import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  msg: (strings: TemplateStringsArray) => ({ id: strings.join("") }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));
vi.mock("@/integrations/orpc/client", () => ({
  orpc: { resume: { update: { call: vi.fn() } } },
}));
vi.mock("@lingui/react", () => ({
  useLingui: () => ({
    i18n: {
      t: (message: { id?: string } | string) => (typeof message === "string" ? message : (message.id ?? "")),
    },
  }),
}));

import { useResumeStore } from "@/components/resume/store/resume";
import { Dialog } from "@/components/ui/dialog";
import { sampleResumeData } from "@/schema/resume/sample";

import { useDialogStore } from "../../store";
import { TemplateGalleryDialog } from "./gallery";

describe("template gallery dialog", () => {
  it("selects a template and closes", async () => {
    useResumeStore.getState().initialize({
      id: "resume-1",
      name: "CV",
      slug: "cv",
      tags: [],
      data: structuredClone(sampleResumeData),
      isLocked: false,
    });
    useDialogStore.setState({ open: true, activeDialog: { type: "resume.template.gallery" } as never });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Dialog open>
          <TemplateGalleryDialog />
        </Dialog>,
      );
    });

    const button = document.querySelector("img[alt='Bronzor']")?.closest("button");
    if (!(button instanceof HTMLButtonElement)) throw new Error("missing template");
    await act(async () => {
      button.click();
    });
    expect(useResumeStore.getState().resume.data.metadata.template).toBe("bronzor");
    expect(useDialogStore.getState().open).toBe(false);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

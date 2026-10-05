import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import { useDialogStore } from "@/dialogs/store";

import { ResumeQuickActions } from "./resume-quick-actions";

describe("resume quick actions", () => {
  it("opens create and import dialogs", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(<ResumeQuickActions />);
    });
    const create = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Create"));
    const importButton = [...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Import"));
    await act(async () => {
      create?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.create");
    await act(async () => {
      importButton?.click();
    });
    expect(useDialogStore.getState().activeDialog?.type).toBe("resume.import");
    root.unmount();
  });
});

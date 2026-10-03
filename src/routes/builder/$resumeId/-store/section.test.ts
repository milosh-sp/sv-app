import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useSectionStore } from "./section";

describe("builder section store", () => {
  beforeEach(() => {
    localStorage.clear();
    useSectionStore.setState({ sections: {} });
  });

  it("selects a section and toggles the rest", () => {
    useSectionStore.getState().setCollapsed("experience", true);
    expect(useSectionStore.getState().sections.experience).toEqual({ collapsed: true });

    useSectionStore.getState().toggleCollapsed("experience");
    expect(useSectionStore.getState().sections.experience).toEqual({ collapsed: false });

    useSectionStore.getState().toggleCollapsed("summary");
    expect(useSectionStore.getState().sections.summary).toEqual({ collapsed: true });

    useSectionStore.getState().toggleAll();
    expect(useSectionStore.getState().sections.experience?.collapsed).toBe(true);
    expect(useSectionStore.getState().sections.summary?.collapsed).toBe(false);
    expect(useSectionStore.getState().sections.export?.collapsed).toBe(true);
  });
});

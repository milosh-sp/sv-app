import { beforeEach, describe, expect, it } from "vite-plus/test";

import { useCommandPaletteStore } from "./store";

describe("command palette store", () => {
  beforeEach(() => {
    useCommandPaletteStore.getState().reset();
  });

  it("opens a page, clears the search, and resets when closed", () => {
    const store = useCommandPaletteStore.getState();
    store.setOpen(true);
    store.setSearch("ada");
    expect(useCommandPaletteStore.getState()).toMatchObject({ open: true, search: "ada" });

    useCommandPaletteStore.getState().pushPage("resumes");
    expect(useCommandPaletteStore.getState().peekPage()).toBe("resumes");
    expect(useCommandPaletteStore.getState().search).toBe("");

    useCommandPaletteStore.getState().setSearch("skill");
    useCommandPaletteStore.getState().goBack();
    expect(useCommandPaletteStore.getState()).toMatchObject({ search: "", pages: ["resumes"], open: true });

    useCommandPaletteStore.getState().goBack();
    expect(useCommandPaletteStore.getState().pages).toEqual([]);

    useCommandPaletteStore.getState().goBack();
    expect(useCommandPaletteStore.getState().open).toBe(false);

    useCommandPaletteStore.getState().setOpen(true);
    useCommandPaletteStore.getState().pushPage("resumes");
    useCommandPaletteStore.getState().popPage();
    expect(useCommandPaletteStore.getState().pages).toEqual([]);

    useCommandPaletteStore.getState().setSearch("ada");
    useCommandPaletteStore.getState().setOpen(false);
    expect(useCommandPaletteStore.getState()).toMatchObject({ open: false, search: "", pages: [] });
  });
});

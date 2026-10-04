import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useDialogStore } from "./store";

describe("dialog store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDialogStore.setState({ open: false, activeDialog: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a dialog and clears it 300ms after close", () => {
    useDialogStore.getState().openDialog("resume.create", undefined);
    expect(useDialogStore.getState()).toMatchObject({
      open: true,
      activeDialog: { type: "resume.create", data: undefined },
    });

    useDialogStore.getState().closeDialog();
    expect(useDialogStore.getState().open).toBe(false);
    expect(useDialogStore.getState().activeDialog).not.toBeNull();

    vi.advanceTimersByTime(299);
    expect(useDialogStore.getState().activeDialog).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(useDialogStore.getState().activeDialog).toBeNull();
  });

  it("keeps the active dialog while open and clears it after the dialog closes", () => {
    useDialogStore.getState().openDialog("api-key.create", undefined);
    useDialogStore.getState().onOpenChange(true);
    expect(useDialogStore.getState().activeDialog?.type).toBe("api-key.create");

    useDialogStore.getState().onOpenChange(false);
    expect(useDialogStore.getState().open).toBe(false);
    expect(useDialogStore.getState().activeDialog).not.toBeNull();
    vi.advanceTimersByTime(300);
    expect(useDialogStore.getState().activeDialog).toBeNull();
  });
});

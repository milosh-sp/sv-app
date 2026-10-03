import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/core/macro", () => ({
  t: (strings: TemplateStringsArray, ...values: Array<string | number>) =>
    strings.reduce((result, part, index) => result + part + (values[index] ?? ""), ""),
}));

const confirm = vi.hoisted(() => vi.fn());
const closeDialog = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-confirm", () => ({
  useConfirm: () => confirm,
}));
vi.mock("@/dialogs/store", () => ({
  useDialogStore: (selector: (state: { closeDialog: typeof closeDialog }) => unknown) => selector({ closeDialog }),
}));

import { useFormBlocker } from "./use-form-blocker";

function Probe({
  dirty,
  submitting = false,
  shouldBlock,
  onReady,
}: {
  dirty: boolean;
  submitting?: boolean;
  shouldBlock?: () => boolean;
  onReady: (blocker: ReturnType<typeof useFormBlocker>) => void;
}) {
  onReady(
    useFormBlocker(
      { formState: { isDirty: dirty, isSubmitting: submitting } } as never,
      shouldBlock ? { shouldBlock } : undefined,
    ),
  );
  return null;
}

describe("unsaved form navigation block", () => {
  beforeEach(() => {
    confirm.mockReset();
    closeDialog.mockReset();
  });

  it("closes a clean form and asks before closing a dirty one", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let blocker: ReturnType<typeof useFormBlocker> | undefined;

    await act(async () => {
      root.render(<Probe dirty={false} onReady={(value) => (blocker = value)} />);
    });
    await act(async () => {
      await blocker!.requestClose();
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(closeDialog).toHaveBeenCalledOnce();

    closeDialog.mockClear();
    await act(async () => {
      root.render(<Probe dirty submitting onReady={(value) => (blocker = value)} />);
    });
    await act(async () => {
      await blocker!.requestClose();
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(closeDialog).toHaveBeenCalledOnce();

    closeDialog.mockClear();
    confirm.mockResolvedValueOnce(false);
    await act(async () => {
      root.render(<Probe dirty onReady={(value) => (blocker = value)} />);
    });
    await act(async () => {
      await blocker!.requestClose();
    });
    expect(confirm).toHaveBeenCalledOnce();
    expect(closeDialog).not.toHaveBeenCalled();

    const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    blocker!.blockEvents.onEscapeKeyDown(event);
    blocker!.blockEvents.onPointerDownOutside(event);
    expect(event.defaultPrevented).toBe(true);

    confirm.mockResolvedValueOnce(true);
    await act(async () => {
      await blocker!.requestClose();
    });
    expect(closeDialog).toHaveBeenCalledOnce();

    await act(async () => {
      root.render(<Probe dirty={false} shouldBlock={() => false} onReady={(value) => (blocker = value)} />);
    });
    const outside = new Event("pointerdown", { cancelable: true });
    blocker!.blockEvents.onInteractOutside(outside);
    expect(outside.defaultPrevented).toBe(false);

    root.unmount();
  });
});

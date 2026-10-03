globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vite-plus/test";

import { ConfirmDialogProvider, useConfirm } from "./use-confirm";

function Harness({ onReady }: { onReady: (confirm: ReturnType<typeof useConfirm>) => void }) {
  onReady(useConfirm());
  return null;
}

describe("confirm dialog", () => {
  it("resolves true on confirm and false on cancel", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    let confirm: ReturnType<typeof useConfirm> | undefined;

    await act(async () => {
      root.render(
        <ConfirmDialogProvider>
          <Harness onReady={(value) => (confirm = value)} />
        </ConfirmDialogProvider>,
      );
    });

    const accepted = confirm!("Delete this resume?");
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      document.querySelector<HTMLElement>("[data-slot='alert-dialog-action']")?.click();
    });
    await expect(accepted).resolves.toBe(true);

    const declined = confirm!("Delete this resume?");
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      document.querySelector<HTMLElement>("[data-slot='alert-dialog-cancel']")?.click();
    });
    await expect(declined).resolves.toBe(false);

    root.unmount();
    container.remove();
  });

  it("throws outside the provider", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    await expect(
      act(async () => {
        root.render(<Harness onReady={() => undefined} />);
      }),
    ).rejects.toThrow("useConfirm must be used within");
    root.unmount();
  });
});

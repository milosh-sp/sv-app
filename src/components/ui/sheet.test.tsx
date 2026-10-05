import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./sheet";

describe("sheet", () => {
  it("renders the close button and footer", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <Sheet open>
          <SheetTrigger>Open</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Title</SheetTitle>
            </SheetHeader>
            <SheetFooter>Done</SheetFooter>
            <SheetClose>Close</SheetClose>
          </SheetContent>
        </Sheet>,
      );
    });
    expect(document.body.textContent).toContain("Done");
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
